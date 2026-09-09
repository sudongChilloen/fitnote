import { toKstTimeValue } from "@/lib/date";

/**
 * 새 수업의 기본 시각.
 *
 * 그날 마지막 수업이 끝나는 시각을 쓴다. 수업은 연달아 잡히는 일이 많아서
 * 매번 같은 시각에서 시작해 고치는 것보다 붙여 주는 쪽이 손이 덜 간다.
 *
 * 취소된 수업은 세지 않는다. 취소한 자리는 비어 있는 자리다.
 *
 * 5분 단위로 올린다. input[type=time] 의 step 이 300 이라 어긋난 값이 들어가면
 * 브라우저가 폼을 막는다.
 *
 * 밤을 넘기면 저녁으로 되돌린다. 23시에 끝난 뒤에 잡는 다음 수업이 24시일
 * 리는 없고, 그 경우엔 어차피 트레이너가 직접 고쳐야 한다.
 */
export function nextFreeTime(
  sessions: { scheduledAt: Date; durationMinutes: number; status: string }[],
) {
  const open = sessions.filter((session) => session.status !== "CANCELLED");

  if (open.length === 0) return "19:00";

  const last = open.reduce((latest, session) => {
    const end = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
    return end > latest ? end : latest;
  }, 0);

  const value = toKstTimeValue(new Date(Math.ceil(last / 300_000) * 300_000));

  return value < "06:00" || value > "22:00" ? "19:00" : value;
}
