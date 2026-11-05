"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PixelLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "screen";
  delayMs?: number;
  className?: string;
};

const sizes = {
  sm: { width: "w-20", bar: "h-2 w-20", text: "text-xs" },
  md: { width: "w-40", bar: "h-3 w-40", text: "text-sm" },
  lg: { width: "w-56", bar: "h-4 w-56", text: "text-base" },
};

export function PixelLoader({
  label = "Loading...",
  size,
  variant = "inline",
  delayMs = 180,
  className = "",
}: PixelLoaderProps) {
  const [visible, setVisible] = useState(delayMs === 0);
  const screen = variant === "screen";
  const selectedSize = size ?? (screen ? "lg" : "md");
  const hasLoadingDots = label.endsWith("...") || label.endsWith("…");
  const labelText = hasLoadingDots
    ? label.replace(/(?:\.{3}|…)$/u, "")
    : label;

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  const layout = screen ? "min-h-screen" : "min-h-24";
  if (!visible) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`${layout} ${className}`}
      >
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`pixel-grid flex items-center justify-center bg-px-ink px-4 py-8 text-px-cream ${layout} ${className}`}
    >
      <div className={`flex flex-col items-center gap-4 text-center ${sizes[selectedSize].width}`}>
        <div
          aria-hidden="true"
          className="pixel-loader-logo pixel-border grid h-14 w-14 place-items-center border-2 border-px-gold bg-px-night p-1"
        >
          <Image
            src="/assets/Fili-QuizMo%20Logo.png"
            alt=""
            width={48}
            height={48}
            draggable={false}
            className="pixel-sprite h-full w-full object-contain"
          />
        </div>
        <p className={`pixel-text text-px-cream ${sizes[selectedSize].text}`}>
          {labelText}
          {hasLoadingDots ? (
            <span aria-hidden="true" className="pixel-loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          ) : null}
        </p>
        <div
          aria-hidden="true"
          className={`${sizes[selectedSize].bar} overflow-hidden border-2 border-px-cream bg-px-night`}
        >
          <div className="pixel-loader-progress h-full w-1/3 bg-px-gold" />
        </div>
      </div>
    </div>
  );
}
