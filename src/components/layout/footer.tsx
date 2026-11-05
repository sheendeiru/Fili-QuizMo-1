import { BrandLogo } from "@/components/layout/brand-logo";
import { NavLink } from "@/components/pixel";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/#about-app", label: "About the App" },
  { href: "/#about", label: "About Us" },
  { href: "/#developers", label: "Developers" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/privacy" , label: "Privacy Notice" },
  { href: "/cookies", label: "Cookie Policy" },
];

const accountLinks = [
  { href: "/signup", label: "Create Account" },
  { href: "/teacher-login", label: "Login" },
];

export function Footer() {
  return (
    <footer className="relative w-full bg-ink text-surface">
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-secondary/60 via-success/50 to-secondary/60"
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="grid gap-5 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="inline-flex items-center">
              <BrandLogo className="h-12 w-56" />
            </div>
            <p className="mt-2 text-sm leading-5 text-surface/80">
              An interactive quiz platform built for learners, and teachers.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Quick Links
            </h3>
            <ul className="mt-2 space-y-1">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <NavLink
                    href={link.href}
                    className="text-sm text-surface/80 transition-colors hover:text-accent"
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Account
            </h3>
            <ul className="mt-2 space-y-1">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <NavLink
                    href={link.href}
                    className="text-sm text-surface/80 transition-colors hover:text-accent"
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-surface/20 pt-4 text-xs text-surface/80 sm:flex-row">
          <p>© 2026 All rights reserved.</p>
          <p>Built for learners and educators.</p>
        </div>
      </div>
    </footer>
  );
}
