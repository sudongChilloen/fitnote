/** FitNote 로고 자리. 초록 네모 안의 바벨 + 글자. 로그인·가입 화면 위쪽에 쓴다. */
export function BrandMark() {
  return (
    <div className="mb-7 flex items-center gap-2.5">
      <span className="flex size-11 items-center justify-center rounded-[0.875rem] bg-primary text-brand">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          aria-hidden
          className="size-6"
        >
          <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" />
        </svg>
      </span>
      <span className="leading-tight">
        <b className="block text-lg font-extrabold">FitNote</b>
        <span className="block text-xs text-muted-foreground">나의 운동 알림장</span>
      </span>
    </div>
  );
}
