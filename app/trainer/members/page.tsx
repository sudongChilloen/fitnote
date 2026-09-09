import { requireUser } from "@/app/lib/dal";
import {
  getTrainerHome,
  memberContractGroup,
} from "@/server/trainers/trainer.service";

import { MemberCard, NoMembers } from "../member-card";
import { MemberFilterChips } from "./filter-chips";
import { parseMemberFilter, type MemberFilter } from "./member-filter";

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
export default async function TrainerMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const home = await getTrainerHome(user.id);

  const filter = parseMemberFilter(query.filter);

  const counts: Record<MemberFilter, number> = {
    all: home.members.length,
    pt: 0,
    soon: 0,
    none: 0,
  };

  for (const member of home.members) {
    counts[memberContractGroup(member)] += 1;
  }

  const shown =
    filter === "all"
      ? home.members
      : home.members.filter((member) => memberContractGroup(member) === filter);

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
        <>
          <MemberFilterChips current={filter} counts={counts} />

          {shown.length === 0 ? (
            /*
              걸렀더니 아무도 없는 것과 담당 회원이 아예 없는 것은 다르다.
              여기서 초대 코드를 만들라고 하면 엉뚱한 곳으로 데려가는 셈이다.
            */
            <p className="mt-8 text-center text-sm text-muted-foreground">
              여기에 해당하는 회원이 없어요.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {shown.map((member) => (
                <MemberCard key={member.connectionId} member={member} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
