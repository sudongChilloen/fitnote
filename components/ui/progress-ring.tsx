/**
 * 진행 링 (v3).
 *
 * 남은 PT 횟수, 회차 진행률처럼 "얼마나 왔나" 를 보여줄 때 쓴다. 숫자는
 * 가운데 글자로도 말하므로 색만으로 뜻을 전하지 않는다.
 */
export function ProgressRing({
  ratio,
  size = 46,
  stroke = 5,
  color = "var(--brand)",
  track = "#eef0ee",
  fill = "#ffffff",
  children,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  fill?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2 - 1;
  const length = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(ratio, 1));
  const center = size / 2;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={center} cy={center} r={radius} fill={fill} stroke={track} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - clamped)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </span>
    </span>
  );
}
