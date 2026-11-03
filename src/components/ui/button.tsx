import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  PixelButton,
  type PixelButtonVariant,
} from "@/components/ui/pixel-primitives";

type ButtonProps = {
  variant?: PixelButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <PixelButton
      variant={variant}
      size={size}
      className={className}
      {...props}
    >
      {children}
    </PixelButton>
  );
}
