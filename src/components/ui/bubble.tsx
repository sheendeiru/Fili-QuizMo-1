import type { ElementType, HTMLAttributes, ReactNode } from "react";

type Tone = "light" | "indigo" | "dark" | "gold";
type Shape = "bubble" | "pill";
type Size = "text" | "inherit";

const tones: Record<Tone, string> = {
  light: "bg-surface text-ink",
  indigo: "bg-surface text-px-indigo",
  dark: "bg-ink text-surface",
  gold: "bg-ink text-px-gold",
};

// Corners are square on purpose: globals.css forces border-radius: 0.
const shapes: Record<Shape, string> = {
  bubble: "block shadow-[3px_3px_0_var(--color-ink)]",
  pill: "inline-block shadow-[2px_2px_0_var(--color-ink)]",
};

const sizes: Record<Shape, Record<Size, string>> = {
  bubble: {
    text: "px-3 py-2 text-sm sm:px-4 sm:py-3 sm:text-base",
    inherit: "px-3 py-2 sm:px-4 sm:py-3",
  },
  pill: {
    text: "px-2.5 py-0.5 text-xs sm:px-3 sm:py-1 sm:text-sm",
    inherit: "px-3 py-1 sm:px-4 sm:py-1.5",
  },
};

const base =
  "box-border min-w-0 max-w-full border-2 border-ink break-words [overflow-wrap:anywhere]";

type BubbleProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: Tone;
  shape?: Shape;
  size?: Size;
  fit?: boolean;
  children: ReactNode;
};

export function Bubble({
  as: Tag = "span",
  tone = "light",
  shape = "bubble",
  size = "text",
  fit = false,
  className = "",
  children,
  ...rest
}: BubbleProps) {
  return (
    <Tag
      className={`${base} ${shapes[shape]} ${sizes[shape][size]} ${tones[tone]} ${fit ? "w-fit" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}