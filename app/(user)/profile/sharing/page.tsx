import Link from "next/link";

import { ChevronLeft, Info } from "lucide-react";

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

function Toggle({ name, label, hint, checked, nested }: Row) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 py-3.5 ${
        nested ? "pl-8" : ""
      }`}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 size-5 shrink-0 accent-brand-strong"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
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
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <Link
        href="/profile"
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />내 정보
      </Link>

      <h1 className="mt-2 text-xl font-bold">트레이너와 공유</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        내가 켠 항목만 담당 트레이너에게 보여요.
      </p>

      {mine === null ? (
        <p className="mt-5 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          아직 센터에 소속되어 있지 않아요. 센터에 들어가면 무엇을 공유할지 고를
          수 있어요.
        </p>
      ) : (
        <>
          <p
            className="mt-4 flex items-start gap-2 rounded-2xl bg-accent p-4 text-xs text-primary"
            role={saved === "1" ? "status" : undefined}
          >
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {saved === "1" ? <b className="font-bold">저장했어요. </b> : null}
              {mine.trainerName
                ? `${mine.centerName} · ${mine.trainerName} 트레이너에게 보여요.`
                : `${mine.centerName}에 담당 트레이너가 아직 없어요. 배정되면 여기 설정이 그대로 적용돼요.`}
              {
                " PT 수업에서 트레이너가 적은 기록은 트레이너 본인이 쓴 것이라 항상 보여요."
              }
            </span>
          </p>

          <form action={saveSharing} className="mt-4">
            <div className="rounded-2xl border border-border bg-card px-5 py-1.5">
              <Toggle
                name="shareDiet"
                label="식단"
                hint="내가 올린 식단 기록을 보여줘요."
                checked={mine.setting.shareDiet}
              />
              <div className="border-t border-border" />
              <Toggle
                name="shareDietPhoto"
                label="식단 사진"
                hint="식단을 공유할 때만 함께 보여요."
                checked={mine.setting.shareDietPhoto}
                nested
              />
              <div className="border-t border-border" />
              <Toggle
                name="sharePersonalWorkout"
                label="개인 운동 기록"
                hint="혼자 한 운동도 트레이너가 볼 수 있어요."
                checked={mine.setting.sharePersonalWorkout}
              />
              <div className="border-t border-border" />
              <Toggle
                name="shareBody"
                label="체중 · 체성분"
                hint="몸무게와 체성분 변화를 보여줘요."
                checked={mine.setting.shareBody}
              />
            </div>

            <SaveSharingButton />
          </form>
        </>
      )}
    </main>
  );
}
