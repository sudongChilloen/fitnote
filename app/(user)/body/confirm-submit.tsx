"use client";

import { useFormStatus } from "react-dom";

/**
 * 되돌릴 수 없는 것을 누르기 전에 한 번 묻는다.
 *
 * 서버 컴포넌트가 서버 액션을 그대로 물고 그리도록, 눌리는 부분만 떼어냈다.
 */
export function ConfirmSubmit({
  children,
  confirm,
  className = "",
  label,
}: {
  children: React.ReactNode;
  confirm: string;
  className?: string;
  label?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={`disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
