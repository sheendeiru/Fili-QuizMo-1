import type { ReactNode } from "react";
import { SafeReturnLink } from "@/components/auth/safe-return-link";
import { safeInternalPath } from "@/lib/safe-redirect";

export type PolicySection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function PolicyPage({
  title,
  description,
  returnTo,
  sections,
}: {
  title: string;
  description: string;
  returnTo: string | null;
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
        <div className="mb-3 flex justify-start">
          <SafeReturnLink returnTo={returnTo} />
        </div>

        <header className="pixel-border border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_var(--color-ink)] sm:p-4">
          <p className="text-xs font-semibold text-ink">
            Last updated: [EFFECTIVE DATE]
          </p>
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm">{description}</p>
        </header>

        <nav
          aria-label="Table of contents"
          className="pixel-border mt-3 border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_var(--color-ink)]"
        >
          <h2 className="text-base font-bold text-ink">On this page</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-ink underline decoration-accent underline-offset-4 hover:text-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-3 space-y-3">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="pixel-border scroll-mt-20 border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_var(--color-ink)] sm:p-4"
            >
              <h2 className="text-lg font-bold">{section.title}</h2>
              <div className="mt-2 space-y-2 text-sm leading-6">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <SafeReturnLink returnTo={returnTo} />
        </div>
      </main>
    </div>
  );
}

export function policyReturnTo(
  params: { returnTo?: string | string[] },
): string | null {
  const value = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  return safeInternalPath(value);
}

export function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}
