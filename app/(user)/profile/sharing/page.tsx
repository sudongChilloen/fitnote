import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { getMySharing } from "@/server/sharing/sharing.service";

import { saveSharing } from "./actions";
import { SaveSharingButton } from "./save-sharing-button";

export const metadata = { title: "트레이너와 공유 | FitNote" };

interface Row {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  nested?: boolean;
}

/**
 * 켜고 끄는 스위치. 진짜 체크박스를 숨겨 두고 그 옆 칸을 스위치 모양으로 칠한다.
 * 자바스크립트 없이도 동작하고, 화면 읽기 프로그램에는 체크박스로 읽힌다.
 */
function Toggle({ name, label, hint, checked, nested, first }: Row & { first?: boolean }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 py-3.5 pr-4 ${
        nested ? "bg-[#fafbfa] pl-8" : "pl-4"
      } ${first ? "" : "border-t border-line"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="relative h-7 w-11.5 shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          role="switch"
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[#dfe4e1] transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
        />
        <span
          aria-hidden
          className="absolute top-0.75 left-0.75 size-5.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/20%)] transition-transform peer-checked:translate-x-4.5"
        />
      </span>
    </label>
  );
}

export default async function SharingPage({
  searchParams,
}: PageProps<"/profile/sharing">) {
  const user = await requireUser();
  const mine = await getMySharing(user.id);
  const { saved } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link
          href="/profile"
          aria-label="내 정보"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 text-[1.0625rem] font-bold">트레이너와 공유</h1>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <p className="mx-1 text-sm leading-normal">내가 켠 항목만 담당 트레이너에게 보여요.</p>

        <div
          className="flex items-center gap-2.5 rounded-2xl bg-brand-muted px-3.5 py-3"
          role={saved === "1" ? "status" : undefined}
        >
          {mine.trainerName ? (
            <span className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.8125rem] font-extrabold text-brand">
              {mine.trainerName.trim().slice(0, 1)}
            </span>
          ) : null}
          <b className="min-w-0 flex-1 text-[0.8125rem] text-primary">
            {mine.trainerName
              ? `${mine.trainerName} 트레이너에게 보여요`
              : "아직 담당 트레이너가 없어요. 연결되면 이 설정이 그대로 적용돼요"}
          </b>
          {saved === "1" ? (
            <span className="shrink-0 text-[0.6875rem] font-bold text-primary">✓ 저장했어요.</span>
          ) : null}
        </div>

        <form action={saveSharing} className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[1.25rem] border border-border">
            <Toggle
              first
              name="shareDiet"
              label="식단"
              hint="내가 올린 식단 기록을 보여줘요."
              checked={mine.setting.shareDiet}
            />
            <Toggle
              name="shareDietPhoto"
              label="식단 사진"
              hint="식단을 공유할 때만 함께 보여요."
              checked={mine.setting.shareDietPhoto}
              nested
            />
            <Toggle
              name="sharePersonalWorkout"
              label="개인 운동 기록"
              hint="혼자 한 운동도 트레이너가 볼 수 있어요."
              checked={mine.setting.sharePersonalWorkout}
            />
            <Toggle
              name="shareBody"
              label="체중 · 체성분"
              hint="몸무게와 체성분 변화를 보여줘요."
              checked={mine.setting.shareBody}
            />
          </div>

          <SaveSharingButton />
        </form>

        <p className="mx-1 rounded-[0.875rem] bg-[#f7f8f7] px-3.5 py-3 text-xs leading-relaxed text-[#4b5650]">
          PT 수업에서 트레이너가 적은 기록은 트레이너 본인이 쓴 것이라 항상 보여요.
        </p>
      </div>
    </main>
  );
}
