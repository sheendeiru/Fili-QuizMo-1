"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useNavigation } from "@/components/pixel";
import { ButtonLink } from "@/components/ui/button-link";
import { PixelButton } from "@/components/ui/pixel-primitives";

type NavbarRouteButtonProps = {
  href: string;
  label: string;
  variant: "login" | "admin";
  onNavigate: () => void;
};

function NavbarRouteButton({
  href,
  label,
  variant,
  onNavigate,
}: NavbarRouteButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { navigate } = useNavigation();
  const [isPending, startTransition] = useTransition();
  const navigationStarted = useRef(false);

  useEffect(() => {
    if (!isPending) {
      navigationStarted.current = false;
    }
  }, [isPending, pathname]);

  function handleClick() {
    if (navigationStarted.current || isPending || pathname === href) {
      return;
    }

    navigationStarted.current = true;
    onNavigate();
    startTransition(() => {
      navigate(() => router.push(href));
    });
  }

  return (
    <PixelButton
      type="button"
      size="sm"
      variant="primary"
      onClick={handleClick}
      disabled={isPending}
      aria-disabled={isPending}
      aria-busy={isPending}
      aria-label={isPending ? `Loading ${label}` : label}
      aria-current={pathname === href ? "page" : undefined}
      className="min-h-10 w-full whitespace-nowrap sm:w-auto"
    >
      {isPending ? (
        <span
          aria-hidden="true"
          className="pixel-spinner h-4 w-4 shrink-0"
        >
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : variant === "admin" ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0"
          shapeRendering="crispEdges"
        >
          <path
            d="M3 2h10v7l-5 5-5-5V2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          <path d="M7 5h2v3H7z" fill="currentColor" />
        </svg>
      ) : null}
      <span>{isPending ? "Loading..." : label}</span>
      {isPending ? <span className="sr-only">Loading</span> : null}
    </PixelButton>
  );
}

export function NavbarActions() {
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuState, setMenuState] = useState<{
    open: boolean;
    pathname: string;
  } | null>(null);
  const menuOpen =
    menuState?.open === true && menuState.pathname === pathname;

  return (
    <div
      className="relative flex items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuState({ open: false, pathname });
          menuButtonRef.current?.focus();
        }
      }}
    >
      <PixelButton
        ref={menuButtonRef}
        type="button"
        size="sm"
        variant="neutral"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="navbar-actions-menu"
        onClick={() => setMenuState({ open: !menuOpen, pathname })}
        className="h-10 w-10 p-0 min-[641px]:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-5 w-5"
          shapeRendering="crispEdges"
        >
          {menuOpen ? (
            <path
              d="M3 3h2v2h2v2h2V5h2V3h2v2h-2v2h-2v2h2v2h2v2h-2v-2h-2v-2H7v2H5v2H3v-2h2v-2h2V7H5V5H3z"
              fill="currentColor"
            />
          ) : (
            <path
              d="M2 3h12v2H2zm0 4h12v2H2zm0 4h12v2H2z"
              fill="currentColor"
            />
          )}
        </svg>
      </PixelButton>

      <div
         id="navbar-actions-menu"
         className={`${menuOpen ? "flex" : "hidden"} absolute right-0 top-full z-50 mt-2 w-56 flex-col gap-3 border-2 border-ink bg-surface p-2 shadow-[3px_3px_0_var(--color-ink)] min-[641px]:static min-[641px]:mt-0 min-[641px]:flex min-[641px]:w-auto min-[641px]:flex-row min-[641px]:items-center min-[641px]:gap-4 min-[641px]:border-0 min-[641px]:bg-transparent min-[641px]:p-0 min-[641px]:shadow-none`}
      >
        <ButtonLink
          href="/"
          variant="primary"
          size="sm"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={() => setMenuState({ open: false, pathname })}
          className="min-h-10 w-full whitespace-nowrap sm:w-auto"
        >
          Home
        </ButtonLink>
        <NavbarRouteButton
          href="/teacher-login"
          label="Login"
          variant="login"
          onNavigate={() => setMenuState({ open: false, pathname })}
        />
        <NavbarRouteButton
          href="/admin-login"
          label="Admin Login"
          variant="admin"
          onNavigate={() => setMenuState({ open: false, pathname })}
        />
      </div>
    </div>
  );
}
