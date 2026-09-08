import { requireUser } from "@/app/lib/dal";
import { getTrainerHome } from "@/server/trainers/trainer.service";

import { MemberCard, NoMembers } from "../member-card";

export const metadata = { title: "회원 | FitNote" };

/**
 * 담당 회원 목록.
 *
 * 홈에서 떼어냈다. 홈이 목록을 겸하고 있으면 회원이 스무 명 넘는 순간
 * "오늘 할 일" 이 목록에 파묻힌다. 홈은 오늘, 여기는 전체다.
 *
 * 정렬은 홈과 같이 할 일 있는 사람이 위다. 목록 화면이라고 이름순으로
 * 되돌리면, 같은 사람이 두 화면에서 다른 자리에 있게 된다.
 */
export default async function TrainerMembersPage() {
  const user = await requireUser();
  const home = await getTrainerHome(user.id);

  return (
    <main className="px-5 pt-5 pb-16">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">담당 회원</h1>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {home.members.length}명
        </span>
      </div>

      {home.members.length === 0 ? (
        <NoMembers />
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {home.members.map((member) => (
            <MemberCard key={member.connectionId} member={member} />
          ))}
        </ul>
      )}
    </main>
  );
}
