import type { AnchorHTMLAttributes, ReactNode } from "react";
import { NavLink } from "@/components/pixel";
import {
  pixelButtonVariants,
  type PixelButtonVariant,
} from "@/components/ui/pixel-primitives";

type ButtonLinkProps = {
  variant?: PixelButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
  href: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <NavLink
      href={href}
      className={`pixel-button inline-flex items-center justify-center border-2 font-semibold transition-[background-color,color,transform,box-shadow] duration-100 ease-[steps(2,end)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm"} ${pixelButtonVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </NavLink>
  );
}
