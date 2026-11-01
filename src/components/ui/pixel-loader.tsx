"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PixelLoaderProps = {
  label?: string;
  variant?: "inline" | "screen";
  delayMs?: number;
  className?: string;
};

export function PixelLoader({
  label = "Loading...",
  variant = "inline",
  delayMs = 180,
  className = "",
}: PixelLoaderProps) {
  const [visible, setVisible] = useState(delayMs === 0);
  const isFullScreen = variant === "screen";

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  const layoutClass = isFullScreen
    ? "min-h-screen"
    : "min-h-24";

  if (!visible) {
    return <div aria-hidden="true" className={`${layoutClass} ${className}`} />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center bg-background px-4 py-8 ${layoutClass} ${className}`}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Image
          src="/assets/Fili-QuizMo%20Logo.png"
          alt=""
          aria-hidden="true"
          width={2000}
          height={2000}
          className="pixel-loader-logo h-16 w-16 object-contain"
        />
        <span className="font-pixel text-[0.5rem] text-secondary">
          Fili-QuizMo
        </span>
        <span className="sr-only">{label}</span>
        <p aria-hidden="true" className="text-sm text-foreground">
          {label}
        </p>
        <div
          aria-hidden="true"
          className="h-3 w-40 overflow-hidden border-2 border-border bg-surface"
        >
          <div className="pixel-loader-progress h-full w-1/3 bg-progress" />
        </div>
      </div>
    </div>
  );
}
