import { type MetricTrend } from "@/server/body/body.service";

/**
 * 지표 하나의 흐름.
 *
 * 차트 라이브러리를 넣지 않는다. 점 몇 개를 잇는 선 하나 때문에 100KB 를
 * 내려받게 할 이유가 없고, 이 그래프는 눈금도 범례도 필요 없다. 회원이 여기서
 * 알고 싶은 건 "줄고 있나 늘고 있나" 하나다. 정확한 숫자는 아래 목록에 있다.
 *
 * 서버에서 그대로 그린다. 자바스크립트가 늦게 와도 선이 먼저 보인다.
 */
export function TrendChart({ trend }: { trend: MetricTrend }) {
  const points = trend.points;

  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // 변화가 거의 없을 때 선이 위아래로 요동치지 않게 최소 폭을 준다.
  const span = Math.max(max - min, 1);
  const top = max + span * 0.15;
  const bottom = min - span * 0.15;

  const width = 300;
  const height = 72;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - bottom) / (top - bottom)) * height;
    return { x, y };
  });

  const line = coords
    .map(
      ({ x, y }, index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(" ");

  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 h-18 w-full"
      role="img"
      aria-label={`${trend.label} 최근 ${points.length}회 변화`}
    >
      <path d={area} className="fill-brand/10" />
      <path
        d={line}
        className="stroke-brand"
        strokeWidth={2}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3} className="fill-brand" />
    </svg>
  );
}
