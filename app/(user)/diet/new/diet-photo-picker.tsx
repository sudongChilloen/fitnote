"use client";

import { useRef, useState } from "react";

import { ImagePlus, Loader2, X } from "lucide-react";

import { resizeImage } from "@/lib/image-resize";

import { discardDietPhotoAction, requestDietPhotoUpload } from "../actions";

/**
 * 등록하기 전에 사진을 미리 올려 둔다.
 *
 * 사진을 붙이려면 기록이 먼저 있어야 하는 구조로 만들면, 사진을 고르려고 빈 기록부터
 * 만들어야 하고 도중에 나간 사람의 빈 줄이 목록에 쌓인다. 그래서 저장소에는 먼저
 * 올리고, 경로만 히든 필드로 폼에 실어 보낸다.
 *
 * 자바스크립트가 없으면 사진은 못 올린다. 대신 끼니 · 음식 이름 · 메모만으로도
 * 등록되도록 폼을 짰다.
 */
export function DietPhotoPicker() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ full: string; thumb: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const { full, thumbnail } = await resizeImage(file);

      const ticket = await requestDietPhotoUpload("image/webp");
      if (!ticket.ok) throw new Error(ticket.error);

      const put = (url: string, blob: Blob) =>
        fetch(url, {
          method: "PUT",
          headers: { "content-type": "image/webp" },
          body: blob,
        });

      const [a, b] = await Promise.all([
        put(ticket.ticket.uploadUrl, full),
        put(ticket.ticket.thumbnailUploadUrl, thumbnail),
      ]);

      if (!a.ok || !b.ok) throw new Error("사진을 올리지 못했어요.");

      // 이미 고른 사진이 있었다면 그건 이제 아무도 안 쓴다.
      if (paths) void discardDietPhotoAction(paths.full);

      setPaths({
        full: ticket.ticket.path,
        thumb: ticket.ticket.thumbnailPath,
      });
      setPreview(URL.createObjectURL(thumbnail));
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

  function remove() {
    if (paths) void discardDietPhotoAction(paths.full);
    setPaths(null);
    setPreview(null);
  }

  return (
    <div>
      <p className="text-sm font-bold">사진</p>

      <div className="mt-2">
        {preview ? (
          <div className="relative w-32">
            {/* 미리보기는 브라우저가 만든 blob 주소라 최적화할 대상이 없다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="고른 사진"
              className="aspect-square w-32 rounded-xl bg-secondary object-cover"
            />
            <button
              type="button"
              aria-label="사진 빼기"
              onClick={remove}
              className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex size-32 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-5" aria-hidden />
            )}
            <span className="text-[0.6875rem]">
              {busy ? "올리는 중" : "사진 고르기"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
      />

      {paths ? (
        <>
          <input type="hidden" name="imagePath" value={paths.full} />
          <input type="hidden" name="thumbnailPath" value={paths.thumb} />
        </>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
