import { type MetricTrend } from "@/server/body/body.service";

/**
 * 지표 하나의 흐름 (v3).
 *
 * 차트 라이브러리를 넣지 않는다. 점 몇 개를 잇는 선 하나 때문에 100KB 를
 * 내려받게 할 이유가 없다. 서버에서 그대로 그려서 자바스크립트가 늦게 와도
 * 선이 먼저 보인다.
 *
 * 세로 눈금 네 줄, 목표가 있으면 민트 점선, 가로에는 첫·가운데·마지막 날짜.
 * 정확한 숫자는 아래 기록 목록에 있다.
 */
export function TrendChart({
  trend,
  goal,
}: {
  trend: MetricTrend;
  goal?: number | null;
}) {
  const points = trend.points.slice(-12);

  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        두 번 이상 재면 흐름을 그려 드려요
      </p>
    );
  }

  const values = points.map((point) => point.value);
  if (goal != null) values.push(goal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const top = max + span * 0.12;
  const bottom = min - span * 0.12;

  const width = 340;
  const height = 190;
  const left = 30;
  const right = 334;
  const chartTop = 16;
  const chartBottom = 168;

  const y = (value: number) =>
    chartBottom - ((value - bottom) / (top - bottom)) * (chartBottom - chartTop);
  const x = (index: number) => left + 6 + (index / (points.length - 1)) * (right - left - 12);

  const coords = points.map((point, index) => ({ x: x(index), y: y(point.value) }));
  const line = coords
    .map(({ x: px, y: py }, index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${coords.at(-1)!.x.toFixed(1)} ${chartBottom} L${coords[0].x.toFixed(1)} ${chartBottom} Z`;
  const last = coords[coords.length - 1];

  const ticks = Array.from({ length: 4 }, (_, index) => top - ((top - bottom) * (index + 0.5)) / 4);
  const digits = span < 4 ? 1 : 0;

  const dateLabel = (at: Date) => {
    const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`;
  };
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${trend.label} 최근 ${points.length}회 변화: ${points[0].value}${trend.unit}에서 ${
        points.at(-1)!.value
      }${trend.unit}${goal != null ? `, 목표 ${goal}${trend.unit}` : ""}`}
    >
      <defs>
        <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9fdcc4" />
          <stop offset="1" stopColor="#2f6b53" />
        </linearGradient>
        <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fd3a8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#5fd3a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="#e8ebe9" />
          <text x="2" y={y(tick) + 3.5} fontSize="10" fill="#68736d">
            {tick.toFixed(digits)}
          </text>
        </g>
      ))}

      {goal != null ? (
        <g>
          <line
            x1={left}
            x2={right}
            y1={y(goal)}
            y2={y(goal)}
            stroke="#5fd3a8"
            strokeDasharray="4 4"
          />
          <text x={right} y={y(goal) - 5} fontSize="10" fill="#2f6b53" textAnchor="end">
            목표 {goal}
            {trend.unit}
          </text>
        </g>
      ) : null}

      <path d={area} fill="url(#trend-area)" />
      <path
        d={line}
        fill="none"
        stroke="url(#trend-line)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="5" fill="#2f6b53" />

      {labelIndexes.map((index) => (
        <text
          key={index}
          x={coords[index].x}
          y="186"
          fontSize="10"
          fill="#68736d"
          textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
        >
          {dateLabel(points[index].at)}
        </text>
      ))}
    </svg>
  );
}
