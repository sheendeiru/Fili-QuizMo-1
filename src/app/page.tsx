import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Carousel } from "@/components/ui/carousel";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

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
      "Create quizzes and keep track of student progress from one simple dashboard.",
    icon: "M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3",
  },
];

const developers = [
  {
    src: "/assets/docu.jpg",
    name: "Edrian Sarte",
    role: "Documentation",
  },
  {
    src: "/assets/leader.jpg",
    name: "Allen Joseph Cabatingan",
    role: "Leader",
  },
  {
    src: "/assets/web-dev.jpg",
    name: "John Carl Rubio",
    role: "Web Developer",
  },
  {
    src: "/assets/Default_pfp.jpg",
    name: "Sheen Agustin",
    role: "Mobile App Developer",
  },
];

function SectionLabel({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 ${
        centered ? "text-center" : ""
      }`}
    >
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-primary text-white">
          <div aria-hidden="true" className="hero-grid absolute inset-0" />
          <div
            aria-hidden="true"
            className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Interactive Filipino quiz platform
              </span>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Learn. Quiz.{" "}
                <span className="bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                  Master.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
                Fili-QuizMo turns learning into an interactive quiz experience.
                Built for students who want a fun and engaging way to answer
                quizzes, and for teachers who want to see progress at a glance.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  href="/signup"
                  variant="secondary"
                  className="bg-white text-primary hover:bg-sky-50 focus:ring-white/70"
                >
                  Create an Account
                </ButtonLink>
                <ButtonLink
                  href="/assets/Fili-QuizMo-1.0.0.apk"
                  download
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 focus:ring-white/70"
                >
                  Download APK
                </ButtonLink>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/65">
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

            <div className="relative mx-auto w-full max-w-[19rem] lg:max-w-[20rem]">
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-[2.75rem] bg-gradient-to-br from-sky-400/30 via-emerald-400/20 to-amber-300/25 blur-2xl"
              />
              <div className="relative rounded-[2.2rem] border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-[1.7rem] bg-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/home_screen.jpg"
                    alt="Fili-QuizMo home screen"
                    className="aspect-[9/19] w-full object-cover"
                  />
                </div>
              </div>

              <div className="absolute -left-8 bottom-16 hidden rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-left shadow-xl lg:block">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-500">
                  Instant feedback
                </p>
                <p className="mt-1 text-sm font-bold text-primary">
                  Learn from every answer
                </p>
              </div>
              <div className="absolute -right-4 top-16 hidden rounded-2xl border border-white/10 bg-white/95 px-4 py-3 shadow-xl lg:block">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-500">
                  Quiz modes
                </p>
                <p className="mt-1 text-sm font-bold text-primary">
                  3 ways to play
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="about-app" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <SectionLabel>About the App</SectionLabel>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  A quiz experience built for real classrooms.
                </h2>
                <p className="mt-5 text-lg leading-8 text-neutral-600">
                  Fili-QuizMo is a quiz-based learning platform that helps users
                  practice with interactive quizzes, track performance, and
                  prepare effectively. It is designed for learners who want
                  immediate feedback and for teachers who need tools to manage
                  quizzes and student progress.
                </p>
              </div>
              <ButtonLink href="/signup" className="shrink-0">
                Create an Account
              </ButtonLink>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-neutral-200 bg-neutral-50/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:bg-white hover:shadow-xl hover:shadow-primary/5"
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
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tour" className="bg-background py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <SectionLabel centered>App Tour</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                See the App in Action
              </h2>
              <p className="mt-3 text-neutral-600">
                Take a quick tour through the quiz experience, from choosing a
                mode to answering your first question.
              </p>
            </div>
            <Carousel items={carouselItems} />
          </div>
        </section>

        <section id="about" className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 blur-2xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/DocumentationwthClient.jpg"
                alt="The Fili-QuizMo Team with The Little Einstein Discovery School campus"
                className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-xl ring-1 ring-black/5"
              />
              <div className="relative mx-auto -mt-8 w-[calc(100%-2rem)] rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5 sm:absolute sm:-bottom-6 sm:left-6 sm:mt-0 sm:w-auto">
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
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-500">
                      Built for the classroom
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      Learners, and teachers
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:pl-4">
              <SectionLabel>About Us</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Built by a small team that loves learning.
              </h2>
              <p className="mt-5 text-lg leading-8 text-neutral-600">
                Fili-QuizMo was created by a small team of developers who wanted
                to make learning more interactive, accessible, and fun.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <h3 className="text-base font-semibold">Our Story</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    What began as a simple quiz concept grew into Fili-QuizMo, a
                    platform designed to help learners practice through
                    interactive quizzes while giving educators tools to manage
                    content and track progress.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <h3 className="text-base font-semibold">Our Mission</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    To make learning engaging, measurable, and accessible through
                    interactive quizzes that adapt to the needs of students and
                    teachers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="developers" className="bg-background py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel centered>The Team</SectionLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                About the Developers
              </h2>
              <p className="mt-3 text-neutral-600">
                The people behind the quizzes, the app, and the experience.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {developers.map((developer) => (
                <article
                  key={developer.name}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={developer.src}
                      alt={developer.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-sm font-semibold sm:text-base">
                      {developer.name}
                    </h3>
                    <p className="mt-2 inline-flex rounded-full bg-primary/5 px-2.5 py-1 text-[0.65rem] font-semibold text-primary/70 sm:px-3 sm:text-xs">
                      {developer.role}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="signup"
          className="relative overflow-hidden bg-primary py-20 text-white"
        >
          <div aria-hidden="true" className="hero-grid absolute inset-0" />
          <div
            aria-hidden="true"
            className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Get Started
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Make every quiz a step forward.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/75">
              Create an account to start building quizzes, tracking progress,
              and making learning feel a little more like play.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink
                href="/signup"
                variant="secondary"
                className="bg-white text-primary hover:bg-sky-50 focus:ring-white/70"
              >
                Create an Account
              </ButtonLink>
              <ButtonLink
                href="/assets/Fili-QuizMo-1.0.0.apk"
                download
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 focus:ring-white/70"
              >
                Download APK
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
