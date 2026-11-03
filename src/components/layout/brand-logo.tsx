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
        src="/assets/Fili-QuizMo%20Logo.png"
        alt="Fili-QuizMo trophy logo"
        width={2000}
        height={2000}
        preload={priority}
        draggable={false}
        className="h-10 w-10 shrink-0 select-none object-contain"
      />
      <span className="min-w-0 font-pixel text-[0.5rem] leading-relaxed text-secondary sm:text-[0.625rem]">
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
