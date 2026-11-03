import type { ReactNode } from "react";

export {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelInput,
  PixelTable,
} from "@/components/ui/pixel-primitives";
export { PixelModal } from "@/components/ui/pixel-modal";

const avatarRows = [
  "..nnnn..",
  ".nnggnn.",
  "nnngggnn",
  "nccnnccn",
  "nccnnccn",
  ".nccggn.",
  "..nccn..",
  "...nn...",
];

const avatarColors: Record<string, string> = {
  n: "bg-px-indigo",
  g: "bg-px-gold",
  c: "bg-px-cream",
};

export function PixelAvatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${name} pixel avatar`}
      className={`pixel-border pixel-grid grid aspect-square grid-cols-8 border-2 border-ink bg-surface p-2 ${className}`}
    >
      {avatarRows.flatMap((row, rowIndex) =>
        [...row].map((pixel, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            aria-hidden="true"
            className={pixel === "." ? "" : avatarColors[pixel]}
          />
        )),
      )}
    </span>
  );
}
