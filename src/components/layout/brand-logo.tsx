import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Fili-QuizMo"
      width={2000}
      height={2000}
      preload={priority}
      draggable={false}
      className={`pointer-events-none select-none object-cover ${className}`}
      style={{
        filter: "url(#remove-logo-background)",
        objectPosition: "center",
        userSelect: "none",
      }}
    />
  );
}
