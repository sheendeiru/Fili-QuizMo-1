"use client";

import { useState, type InputHTMLAttributes } from "react";
import { PixelInput } from "@/components/pixel/primitives";

type FormFieldProps = {
  label: string;
  id: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

function PixelEye() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        d="
          M4 3h8v1h-8z
          M2 4h2v1h-2z M12 4h2v1h-2z
          M1 5h1v1h-1z M6 5h4v1h-4z M14 5h1v1h-1z
          M0 6h1v2h-1z M5 6h6v2h-6z M15 6h1v2h-1z
          M1 8h1v1h-1z M6 8h4v1h-4z M14 8h1v1h-1z
          M2 9h2v1h-2z M12 9h2v1h-2z
          M4 10h8v1h-8z
        "
      />
    </svg>
  );
}

function PixelEyeSlash() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* eye */}
      <path
        d="
          M4 3h8v1h-8z
          M2 4h2v1h-2z M12 4h2v1h-2z
          M1 5h1v1h-1z M6 5h4v1h-4z M14 5h1v1h-1z
          M0 6h1v2h-1z M5 6h6v2h-6z M15 6h1v2h-1z
          M1 8h1v1h-1z M6 8h4v1h-4z M14 8h1v1h-1z
          M2 9h2v1h-2z M12 9h2v1h-2z
          M4 10h8v1h-8z
        "
      />
      {/* pixel slash */}
      <path
        d="
          M1 0h2v1h-2z M2 1h2v1h-2z M3 2h2v1h-2z M4 3h2v1h-2z
          M5 4h2v1h-2z M6 5h2v1h-2z M7 6h2v1h-2z M8 7h2v1h-2z
          M9 8h2v1h-2z M10 9h2v1h-2z M11 10h2v1h-2z M12 11h2v1h-2z
          M13 12h2v1h-2z M14 13h2v1h-2z
        "
      />
    </svg>
  );
}

export function FormField({
  label,
  id,
  className = "",
  type,
  ...props
}: FormFieldProps) {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>

      <div className="relative">
        <PixelInput
          id={id}
          type={isPassword && showPassword ? "text" : type}
          className={`mt-1 h-10 pl-3 text-sm ${
            isPassword ? "pr-11" : "pr-3"
          } ${className}`}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-0 top-1 flex h-10 w-11 items-center justify-center text-foreground/80 hover:text-foreground focus-visible:outline image-rendering: pixelated;"
          >
            {showPassword ? <PixelEyeSlash /> : <PixelEye />}
          </button>
        ) : null}
      </div>
    </div>
  );
}