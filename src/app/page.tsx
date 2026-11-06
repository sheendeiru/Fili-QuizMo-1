import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { Bubble } from "@/components/ui/bubble";
import { Carousel } from "@/components/ui/carousel";
import { SectionLabel } from "@/components/ui/section-label";
import { Footer } from "@/components/layout/footer";
import { AndroidOnlyNote, InstallGuide } from "@/components/layout/install-guide";
import { Navbar } from "@/components/layout/navbar";
import { TeamCard } from "@/components/layout/team-card";
import { PixelCard } from "@/components/pixel";

const APK_HREF = "/assets/Fili-QuizMo-1.0.0.apk";

const carouselItems = [
  {
    src: "/assets/home_screen.jpg",
    alt: "Fili-QuizMo home screen",
    caption: "Create or join quizzes with generated code",
  },
  {
    src: "/assets/fill_in_the_blanks.jpg",
    alt: "Fili-QuizMo fill in the blanks quiz",
    caption: "Fill in the blanks with your filipino knowledge",
  },
  {
    src: "/assets/true_false_quiz.jpg",
    alt: "Fili-QuizMo true or false quiz",
    caption: "Test your knowledge with true or false questions",
  },
  {
    src: "/assets/role_select.jpg",
    alt: "Fili-QuizMo role selection",
    caption: "Students can join quizzes while teachers can create and join quizzes",
  },
];

const features = [
  {
    title: "Multiple quiz modes",
    description:
      "Practice with fill-in-the-blank and true-or-false questions in a game-like format.",
    icon: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z",
  },
  {
    title: "Instant feedback",
    description:
      "See how you did right away, so every attempt becomes a chance to learn.",
    icon: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  },
  {
    title: "Teacher tools",
    description:
      "Create quizzes in Mobile App and keep track of student progress from one simple dashboard in website.",
    icon: "M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3",
  },
];

const developers = [
  {
    src: "/assets/images.jpg",
    name: "Edrian Sarte",
    role: "Documentation",
  },
  {
    src: "/assets/AJ.jpg",
    name: "Allen Joseph Cabatingan",
    role: "Web Developer",
  },
  {
    src: "/assets/profileniRub.png",
    name: "John Carl Rubio",
    role: "Documentation",
  },
  {
    src: null,
    name: "Sheen Agustin",
    role: "Mobile App Developer",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <section className="landing-skyline relative overflow-hidden bg-sky-top text-ink">
          <div aria-hidden="true" className="hero-grid absolute inset-0" />
          <div
            aria-hidden="true"
            className="absolute left-8 top-12 h-3 w-3 bg-sky-400/40"
          />
          <div
            aria-hidden="true"
            className="absolute right-12 top-1/4 h-4 w-4 bg-emerald-400/40"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-8 left-1/3 h-2 w-2 bg-amber-300/50"
          />

          <div className="relative mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-12">
            <div>
              <span className="inline-flex items-center gap-2 border-2 border-ink bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                <span className="h-2 w-2 bg-primary" />
                Interactive Filipino quiz platform
              </span>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Learn. Quiz.{" "}
              <Bubble as="span" tone="gold" shape="pill" size="inherit" className="whitespace-nowrap leading-none">
                Master<span className="-mr-[0.3em]">.</span>
              </Bubble>
            </h1>

              <Bubble as="p" className="mt-3 max-w-xl px-4 py-3 text-sm leading-6">
                Fili-QuizMo turns learning into an interactive quiz experience.
                Built for students who want a fun and engaging way to answer
                quizzes, and for teachers who want to see progress at a glance.
              </Bubble>

              <div className="mt-4 flex w-fit max-w-full flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink
                    href="/signup"
                    variant="neutral"
                    className="sm:flex-1"
                  >
                    Create an Account
                  </ButtonLink>
                  <ButtonLink
                    href={APK_HREF}
                    download
                    variant="primary"
                    className="sm:flex-1"
                  >
                    Download APK
                  </ButtonLink>
                </div>

                <AndroidOnlyNote
                  compact
                  installHref="#install"
                  className="self-start"
                />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-px-ink bg-px-cream px-2 py-1 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                    Student-friendly
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Teacher-ready
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    Free on the web
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[15rem]">
              <div
                aria-hidden="true"
                className="absolute -inset-3 bg-px-gold/20"
              />
              <div className="pixel-border relative border-2 border-ink bg-surface p-2 shadow-[4px_4px_0_var(--color-ink)]">
                <div className="overflow-hidden bg-sky-bottom">
                  <Image
                    src="/assets/home_screen2.jpg"
                    alt="Fili-QuizMo home screen"
                    width={450}
                    height={950}
                    priority
                    sizes="(max-width: 1024px) 304px, 320px"
                    className="aspect-[9/19] w-full object-cover"
                  />
                </div>
              </div>
             <Bubble
              as="div"
              className="absolute z-10 bottom-0 -left-6 max-w-[48%] text-left
                        sm:-bottom-2 sm:-left-12 sm:max-w-[14rem]
                        md:-left-20"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-700 sm:text-[0.7rem]">
                Instant feedback
              </p>
              <p className="mt-0.5 text-xs font-bold text-primary sm:mt-1 sm:text-sm">
                Learn from every answer
              </p>
            </Bubble>

            <Bubble
              as="div"
              className="absolute z-10 top-3 -right-6 max-w-[48%] text-left
                         sm:top-6 sm:-right-12 sm:max-w-[14rem]
                         md:top-12 md:-right-20
                         lg:top-16 lg:-right-24"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-700 sm:text-[0.7rem]">
                Quiz modes
              </p>
              <p className="mt-0.5 text-xs font-bold text-primary sm:mt-1 sm:text-sm">
                3 ways to play
              </p>
            </Bubble>
            </div>
          </div>
        </section>

        <section id="about-app" className="bg-white py-8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <div className="max-w-2xl">
                <SectionLabel>About the App</SectionLabel>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  A quiz experience built for real classrooms.
                </h2>
                <p className="mt-3 text-sm leading-6 text-px-text-dark">
                  Fili-QuizMo is a quiz-based learning platform that helps users
                  practice with interactive quizzes, track performance, and
                  prepare effectively. It is designed for learners who want
                  immediate feedback and for teachers who need tools to manage
                  quizzes and student progress.
                </p>
              </div>
              <ButtonLink href="/signup" className="mt-6 w-full sm:w-auto">
                Create an Account
              </ButtonLink>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {features.map((feature) => (
                <PixelCard
                  as="article"
                  key={feature.title}
                  className="group flex h-full flex-col bg-neutral-50/80 p-6 text-px-text-dark transition-[background-color,color,transform] duration-100 ease-[steps(2,end)] hover:-translate-y-1 hover:bg-px-cream hover:text-px-text-dark focus-within:bg-px-cream focus-within:text-px-text-dark active:bg-px-cream active:text-px-text-dark"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-colors group-hover:bg-primary/90">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    {feature.description}
                  </p>
                </PixelCard>
              ))}
            </div>
          </div>
        </section>

        <section id="tour" className="bg-background py-8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto mb-5 max-w-2xl text-center">
              <SectionLabel centered tone="dark">App Tour</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                See the App in Action
              </h2>
              <p className="mt-3 text-px-muted">
                Take a quick tour through the quiz experience, from choosing a
                mode to answering your first question.
              </p>
            </div>
            <Carousel items={carouselItems} />
          </div>
        </section>

        <InstallGuide apkHref={APK_HREF} />

        <section id="about" className="bg-white py-8">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-3 bg-px-gold/20"
              />
              <Image
                src="/assets/DocumentationwthClient.jpg"
                alt="The Fili-QuizMo Team with The Little Einstein Discovery School campus"
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-xl ring-1 ring-black/5"
              />
              <Bubble
                as="div"
                className="relative mx-auto -mt-8 w-[calc(100%-2rem)] p-4 sm:absolute sm:-bottom-4 sm:left-2 sm:mt-0 sm:w-auto"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-neutral-700">
                      Built for the classroom
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      Learners, and teachers
                    </p>
                  </div>
                </div>
              </Bubble>
            </div>

            <div className="lg:pl-4">
              <SectionLabel>About Us</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Built by a small team that loves learning.
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                Fili-QuizMo was created by a small team of developers who wanted
                to make learning more interactive, accessible, and fun.
              </p>

              <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2">
                <PixelCard as="article" className="flex h-full flex-col bg-neutral-50">
                  <h3 className="text-base font-semibold">Our Story</h3>
                  <p className="mt-2 flex-1 text-sm leading-7 text-px-text-dark">
                    What began as a simple quiz concept grew into Fili-QuizMo, a
                    platform designed to help learners practice through
                    interactive quizzes while giving educators tools to manage
                    content and track progress.
                  </p>
                </PixelCard>
                <PixelCard as="article" className="flex h-full flex-col bg-neutral-50">
                  <h3 className="text-base font-semibold">Our Mission</h3>
                  <p className="mt-2 flex-1 text-sm leading-7 text-px-text-dark">
                    To make learning engaging, measurable, and accessible through
                    interactive quizzes that adapt to the needs of students and
                    teachers.
                  </p>
                </PixelCard>
              </div>
            </div>
          </div>
        </section>

        <section id="developers" className="bg-background py-8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel centered tone="dark">The Team</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                About the Developers
              </h2>
              <p className="mt-3 text-px-muted">
                The people behind the quizzes, the app, and the experience.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
              {developers.map((developer) => (
                <TeamCard
                  key={developer.name}
                  image={developer.src}
                  name={developer.name}
                  role={developer.role}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          id="signup"
          className="landing-skyline relative overflow-hidden bg-sky-top py-8 text-ink"
        >
          <div aria-hidden="true" className="hero-grid absolute inset-0" />
          <div
            aria-hidden="true"
            className="absolute left-10 top-8 h-3 w-3 bg-sky-400/40"
          />
          <div
            aria-hidden="true"
            className="absolute right-10 bottom-8 h-4 w-4 bg-emerald-400/40"
          />

          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <SectionLabel centered tone="dark">Get Started</SectionLabel>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Make every quiz a step forward.
            </h2>
            <Bubble
              as="p"
              className="mx-auto mt-3 max-w-2xl px-4 py-3 text-sm leading-6"
            >
              Create an account to start building quizzes, tracking progress,
              and making learning feel a little more like play.
            </Bubble>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <ButtonLink href="/signup" variant="neutral">
                Create an Account
              </ButtonLink>
              <ButtonLink href={APK_HREF} download variant="primary">
                Download APK
              </ButtonLink>
            </div>
            <AndroidOnlyNote compact installHref="#install" className="mt-3" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
