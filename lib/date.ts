/**
 * 날짜 유틸.
 *
 * 서비스 대상이 국내 사용자라 날짜 경계를 KST 로 고정한다.
 * Vercel 서버는 UTC 로 도므로 서버의 로컬 시간으로 하루를 나누면
 * 밤 9시 이후 운동이 다음 날로 밀린다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜 키 (YYYY-MM-DD) */
export function toKstDateKey(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 기준 그 날 0시에 해당하는 시각 */
export function kstStartOfDay(date: Date = new Date()) {
  return new Date(`${toKstDateKey(date)}T00:00:00+09:00`);
}

/** KST 기준으로 days 일 전 0시 */
export function kstDaysAgo(days: number, from: Date = new Date()) {
  const start = kstStartOfDay(from);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** KST 기준 요일 한 글자 */
export function kstWeekdayLabel(date: Date) {
  return WEEKDAY[new Date(date.getTime() + KST_OFFSET_MS).getUTCDay()];
}

/** KST 기준 "9월 4일 (목)" */
export function formatKstDateLabel(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${kstWeekdayLabel(date)})`;
}

/** KST 기준 월 키 (YYYY-MM) */
export function toKstMonthKey(date: Date = new Date()) {
  return toKstDateKey(date).slice(0, 7);
}

/** YYYY-MM 을 months 만큼 옮긴다. */
export function shiftMonthKey(monthKey: string, months: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 해당 월의 KST 시작/끝(다음 달 1일 0시) */
export function kstMonthRange(monthKey: string) {
  const start = new Date(`${monthKey}-01T00:00:00+09:00`);
  const end = new Date(`${shiftMonthKey(monthKey, 1)}-01T00:00:00+09:00`);
  return { start, end };
}

/**
 * 달력 그리드에 그릴 날짜들.
 *
 * 일요일부터 시작하도록 앞뒤를 이전/다음 달 날짜로 채워 항상 7의 배수로 맞춘다.
 * 빈 칸으로 두면 주 단위 줄이 어긋난다.
 */
export function buildMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { dateKey: string; inMonth: boolean }[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - i)));
    cells.push({ dateKey: date.toISOString().slice(0, 10), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${monthKey}-${String(day).padStart(2, "0")}`,
      inMonth: true,
    });
  }

  for (let extra = 1; cells.length % 7 !== 0; extra += 1) {
    const next = new Date(Date.UTC(year, month - 1, daysInMonth + extra));
    cells.push({ dateKey: next.toISOString().slice(0, 10), inMonth: false });
  }

  return cells;
}

/** 초를 "1시간 12분" / "12분" 형태로 */
export function formatDuration(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
  return `${minutes}분`;
}
