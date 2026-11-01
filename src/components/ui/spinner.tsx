import type { HTMLAttributes } from "react";

export function Spinner({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`pixel-spinner ${className}`}
      aria-hidden="true"
      {...props}
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
