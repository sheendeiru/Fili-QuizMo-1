import type { ReactNode } from "react";
import { Bubble } from "@/components/ui/bubble";

export function SectionLabel({
  children,
  centered = false,
  tone = "light",
}: {
  children: ReactNode;
  centered?: boolean;
  tone?: "light" | "dark";
}) {
  return (
    <p className={centered ? "text-center" : undefined}>
      <Bubble
        as="span"
        shape="pill"
        tone={tone === "dark" ? "light" : "indigo"}
        className="pixel-text inline-block px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
      >
        {children}
      </Bubble>
    </p>
  );
}
