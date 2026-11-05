import Image from "next/image";
import { NavLink } from "@/components/pixel";

type BrandLogoProps = {
  className?: string;
  linked?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  className = "",
  linked = true,
  priority = false,
}: BrandLogoProps) {
 const content = (
  <>
    <Image
      src="/assets/Fili-QuizMo Logo.png"
      alt="Fili-QuizMo trophy logo"
      width={2000}
      height={2000}
      preload={priority}
      draggable={false}
      className="h-9 w-9 shrink-0 select-none object-contain"
    />
    <span className="ml-2 min-w-0 font-pixel text leading-relaxed text-px-gold pixel-text-border">
      Fili-QuizMo
    </span>
  </>
);

  const classNames = `inline-flex min-w-0 items-center gap-2 text-primary-foreground ${className}`;

  return linked ? (
    <NavLink href="/" aria-label="Fili-QuizMo home" className={classNames}>
      {content}
    </NavLink>
  ) : (
    <div className={classNames}>{content}</div>
  );
}
