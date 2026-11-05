import { Bubble } from "@/components/ui/bubble";
import { ButtonLink } from "@/components/ui/button-link";
import { PixelCard } from "@/components/pixel";
import { SectionLabel } from "@/components/ui/section-label";

const steps = [
  {
    title: "Open this page on your Android phone",
    description:
      "Use your phone’s browser so the file saves straight to the device.",
  },
  {
    title: "Tap Download APK",
    description:
      "If your browser warns that this type of file can be harmful, tap Download anyway.",
  },
  {
    title: "Open the downloaded file",
    description:
      "Tap the download notification, or open the Files app, go to Downloads, and tap Fili-QuizMo-1.0.0.apk.",
  },
  {
    title: "Allow the install if asked",
    description:
      "Tap Settings, turn on Allow from this source, then press Back. You can turn it off again after installing.",
  },
  {
    title: "Install and open the app",
    description:
      "Tap Install. If Google Play Protect shows a warning, tap Install anyway. When it finishes, tap Open, then you can use the app after starting the app.",
  },
];

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 10a7 7 0 0 1 14 0H5z" />
      <rect x="5" y="12" width="14" height="7" rx="1.5" />
      <circle cx="9.5" cy="7" r="0.9" fill="var(--color-surface)" />
      <circle cx="14.5" cy="7" r="0.9" fill="var(--color-surface)" />
      <path
        d="M8 3.5l1.5 2M16 3.5l-1.5 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * AndroidOnlyNote
 * compact: one-line pill to sit under download buttons.
 * default: full callout used inside the install guide.
 */
export function AndroidOnlyNote({
  compact = false,
  installHref,
  className = "",
}: {
  compact?: boolean;
  installHref?: string;
  className?: string;
}) {
  if (compact) {
    return (
      <Bubble
        as="p"
        role="note"
        shape="pill"
        className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 text-xs font-semibold ${className}`}
      >
        <span className="inline-flex items-center gap-2">
          <AndroidIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          Works on Android only
        </span>
        {installHref ? (
          <a
            href={installHref}
            className="underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            How to install
          </a>
        ) : null}
      </Bubble>
    );
  }

  return (
    <Bubble
      as="div"
      role="note"
      className={`flex items-start gap-3 p-4 text-left ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink bg-emerald-300 text-ink"
      >
        <AndroidIcon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-bold">Works on Android devices only</p>
        <p className="mt-1 text-sm leading-6">
          iPhones and iPads can’t install this app.
        </p>
      </div>
    </Bubble>
  );
}

export function InstallGuide({ apkHref }: { apkHref: string }) {
  return (
    <section
      id="install"
      aria-labelledby="install-heading"
      className="scroll-mt-16 bg-px-cream py-8"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel centered tone="dark">
            Installation Guide
          </SectionLabel>
          <h2
            id="install-heading"
            className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            How to install Fili-QuizMo on your phone?
          </h2>
          <p className="mt-3 text-px-text-dark">
            Install the app from the APK file in five short steps.
          </p>
        </div>

        <AndroidOnlyNote className="mx-auto mt-5 max-w-xl" />

        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={index === steps.length - 1 ? "md:col-span-2" : undefined}
            >
              <PixelCard
                as="article"
                className="flex h-full items-start gap-4 bg-white p-4 text-px-text-dark"
              >
                <span
                  aria-hidden="true"
                  className="pixel-text flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-primary text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6">{step.description}</p>
                </div>
              </PixelCard>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <ButtonLink href={apkHref} download variant="primary">
            Download APK
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
