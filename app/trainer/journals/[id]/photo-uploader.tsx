"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ImagePlus, Loader2, X } from "lucide-react";

import { resizeImage } from "@/lib/image-resize";

import {
  attachPhotoAction,
  removePhotoAction,
  requestPhotoUpload,
} from "../actions";

interface Photo {
  id: string;
  url: string | null;
}

/**
 * 사진 첨부.
 *
 * 서버를 거치지 않고 저장소로 바로 올린다. 서버 액션 본문 한도가 기본 1MB 라 사진이
 * 들어가지 않고, 거쳐 가면 같은 파일이 두 번 오간다. 서버는 올릴 자리만 만들어 준다.
 *
 * 자바스크립트가 없으면 사진은 못 올린다. 알림장 글쓰기 자체는 사진 없이도 되도록
 * 폼을 나눠 두었다.
 */
export function PhotoUploader({
  journalId,
  photos,
  maxPhotos,
}: {
  journalId: string;
  photos: Photo[];
  maxPhotos: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const full = photos.length >= maxPhotos;

  async function upload(file: File) {
    const { full: fullBlob, thumbnail } = await resizeImage(file);

    const ticket = await requestPhotoUpload(journalId, "image/webp");
    if (!ticket.ok) throw new Error(ticket.error);

    const put = (url: string, blob: Blob) =>
      fetch(url, {
        method: "PUT",
        headers: { "content-type": "image/webp" },
        body: blob,
      });

    const [a, b] = await Promise.all([
      put(ticket.ticket.uploadUrl, fullBlob),
      put(ticket.ticket.thumbnailUploadUrl, thumbnail),
    ]);

    if (!a.ok || !b.ok) throw new Error("사진을 올리지 못했어요.");

    const attached = await attachPhotoAction(
      journalId,
      ticket.ticket.path,
      ticket.ticket.thumbnailPath,
    );

    if (!attached.ok) throw new Error(attached.error);
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";

    if (files.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const room = maxPhotos - photos.length;

      if (files.length > room) {
        setError(`${maxPhotos}장까지 올릴 수 있어요. ${room}장만 올릴게요.`);
      }

      // 한 장씩 올린다. 한꺼번에 보내면 폰 회선에서 전부 느려지고, 어디서 실패했는지도
      // 알기 어렵다.
      for (const file of files.slice(0, room)) {
        await upload(file);
      }

      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "사진을 올리지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold">사진</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {photos.length} / {maxPhotos}
        </p>
      </div>

      <ul className="mt-2 grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <li key={photo.id} className="relative">
            {photo.url ? (
              // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
              // 올릴 때 이미 줄여서 저장하므로 최적화로 얻을 것도 없다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-xl bg-secondary object-cover"
              />
            ) : (
              <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-secondary text-[0.6875rem] text-muted-foreground">
                불러오지 못함
              </span>
            )}

            <button
              type="button"
              aria-label="사진 삭제"
              disabled={pending || busy}
              onClick={() => {
                startTransition(async () => {
                  const body = new FormData();
                  body.set("journalId", journalId);
                  body.set("photoId", photo.id);
                  await removePhotoAction(body);
                  router.refresh();
                });
              }}
              className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}

        {!full ? (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-[0.6875rem]">
                {busy ? "올리는 중" : "사진 추가"}
              </span>
            </button>
          </li>
        ) : null}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPick}
      />

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
