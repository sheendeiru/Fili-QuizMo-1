import { BrandLogo } from "@/components/layout/brand-logo";
import { NavbarActions } from "@/components/layout/navbar-actions";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-ink bg-surface text-ink shadow-[0_3px_0_var(--color-ink)]">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center">
          <BrandLogo
            priority
            className="h-9 w-auto shrink-0"
          />
        </div>
        <NavbarActions />
      </nav>
    </header>
  );
}
