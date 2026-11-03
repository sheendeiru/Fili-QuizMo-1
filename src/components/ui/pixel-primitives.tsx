import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";

export type PixelButtonVariant =
  | "primary"
  | "accent"
  | "danger"
  | "neutral"
  | "secondary"
  | "success"
  | "outline";

export type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PixelButtonVariant;
  size?: "sm" | "md";
};

export const pixelButtonVariants: Record<PixelButtonVariant, string> = {
  primary: "text-ink [--pixel-button-bg:var(--color-primary)] [--pixel-button-shadow:var(--color-primary-dark)]",
  accent: "text-ink [--pixel-button-bg:var(--color-accent)] [--pixel-button-shadow:var(--color-accent-dark)]",
  danger: "text-danger-foreground [--pixel-button-bg:var(--color-danger-dark)] [--pixel-button-shadow:var(--color-danger-dark)]",
  neutral: "text-ink [--pixel-button-bg:var(--color-surface)] [--pixel-button-shadow:var(--color-neutral-dark)]",
  secondary: "text-ink [--pixel-button-bg:var(--color-accent)] [--pixel-button-shadow:var(--color-accent-dark)]",
  success: "text-ink [--pixel-button-bg:var(--color-primary)] [--pixel-button-shadow:var(--color-primary-dark)]",
  outline: "text-ink [--pixel-button-bg:var(--color-surface)] [--pixel-button-shadow:var(--color-neutral-300)]",
};

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  function PixelButton(
    {
      variant = "primary",
      size = "md",
      className = "",
      disabled,
      ...props
    },
    ref,
  ) {
    const sizeStyles =
      size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm";

    return (
      <button
        ref={ref}
        className={`pixel-button inline-flex items-center justify-center gap-2 border-2 font-semibold transition-[background-color,color,transform,box-shadow] duration-100 ease-[steps(2,end)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none ${sizeStyles} ${pixelButtonVariants[variant]} ${className}`}
        disabled={disabled}
        {...props}
      />
    );
  },
);

type PixelCardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
};

export function PixelCard({
  as: Tag = "section",
  className = "",
  ...props
}: PixelCardProps) {
  return (
    <Tag
      className={`pixel-card border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_var(--color-ink)] sm:p-4 ${className}`}
      {...props}
    />
  );
}

export function PixelInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`pixel-input h-10 w-full border-2 border-ink bg-surface px-3 text-sm text-ink placeholder:text-ink/60 focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function PixelBadge({
  children,
  variant = "info",
  className = "",
}: {
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "danger";
  className?: string;
}) {
  const styles = {
    info: "border-ink bg-sky-top text-ink",
    success: "border-primary-dark bg-primary text-ink",
    warning: "border-accent-dark bg-accent text-ink",
    danger: "border-danger-dark bg-danger-surface text-danger-dark",
  };

  return (
    <span
      className={`inline-flex items-center border-2 px-2 py-1 text-xs font-semibold ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PixelTable({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={`min-w-full border-2 border-ink bg-surface text-left text-sm text-ink ${className}`}
      {...props}
    />
  );
}
