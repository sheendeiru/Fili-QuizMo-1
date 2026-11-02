import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type ButtonLinkProps = {
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  children: ReactNode;
  href: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  href,
  ...props
}: ButtonLinkProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  const variantStyles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground border border-secondary-foreground/20 hover:bg-secondary/80",
    outline: "border border-primary text-primary hover:bg-primary/5",
  };

  return (
    <Link
      href={href}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
