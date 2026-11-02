"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-shell";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { FormField } from "@/components/ui/form-field";
import { defaultSearchQuery } from "@/lib/search/url-state";
import { getStatusLabel } from "@/lib/search/config";
import { logoutAndRedirect } from "@/lib/auth/logout";
import type { TeacherDashboardData } from "@/lib/dashboard/data";

const PieChart = dynamic(
  () =>
    import("@/components/dashboard/pie-chart").then(
      (module) => module.PieChart,
    ),
  {
    loading: () => <PixelLoader label="Loading score chart..." />,
  },
);

const navItems: DashboardNavItem[] = [
  { key: "quizzes", label: "View Quizzes" },
  { key: "students", label: "Manage Student Info" },
  { key: "participants", label: "Manage Participants" },
  { key: "scores", label: "View Scores" },
  { key: "settings", label: "Settings" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-PH", {
    dateStyle: "medium",
  });
}

export default function TeacherDashboardContent({
  data,
}: {
  data: TeacherDashboardData;
}) {
  const searchParams = useSearchParams();
  const entity = searchParams.get("entity");
  const searchActiveKey =
    entity === "students"
      ? "students"
      : entity === "participants"
        ? "participants"
        : "quizzes";
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey ?? searchActiveKey;
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function clearManualSection() {
      setManualActiveKey(null);
    }

    window.addEventListener("popstate", clearManualSection);
    return () => window.removeEventListener("popstate", clearManualSection);
  }, []);

  function navigateToSection(key: string) {
    setManualActiveKey(
      key === "students" || key === "participants" || key === "quizzes"
        ? null
        : key,
    );
    if (key !== "students" && key !== "participants" && key !== "quizzes") {
      return;
    }

    const entity =
      key === "students"
        ? "students"
        : key === "participants"
          ? "participants"
          : "quizzes";
    const params = new URLSearchParams();
    const query = defaultSearchQuery("teacher", entity);
    params.set("entity", query.entity);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function handleLogout() {
    setLogoutError("");

    try {
      await logoutAndRedirect(router);
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to log out.",
      );
    }
  }

  return (
    <DashboardShell
      role="Teacher"
      navItems={navItems}
      activeKey={activeKey}
      onNavigate={navigateToSection}
      onLogout={handleLogout}
    >
      {logoutError ? (
        <p
          role="alert"
          className="mb-6 flex items-center gap-2 border-2 border-red-400 bg-red-950/60 px-4 py-3 text-sm text-red-200"
        >
          <span aria-hidden="true" className="font-bold">
            !
          </span>
          Unable to log out: {logoutError}
        </p>
      ) : null}
      {activeKey === "quizzes" && <QuizzesSection data={data} />}
      {activeKey === "students" && <StudentsSection />}
      {activeKey === "participants" && <ParticipantsSection />}
      {activeKey === "scores" && <ScoresSection data={data} />}
      {activeKey === "settings" && <SettingsSection />}
    </DashboardShell>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function QuizzesSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="View Quizzes"
        description="Review your quiz library and overall class performance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Quizzes"
          value={String(data.quizzes.total)}
        />
        <StatCard
          label="Active Students"
          value={String(data.studentCount)}
        />
        <StatCard
          label="Average Score"
          value={`${data.results.average}%`}
        />
      </div>

      <SearchFilter role="teacher" entity="quizzes" />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          <caption className="sr-only">Recently created quizzes</caption>
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-foreground">Quiz</th>
              <th className="px-6 py-4 font-semibold text-foreground">Status</th>
              <th className="px-6 py-4 font-semibold text-foreground">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.recentQuizzes.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-4 text-neutral-600"
                >
                  You have not created a quiz yet.
                </td>
              </tr>
            ) : (
              data.recentQuizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {quiz.title}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {getStatusLabel("quizzes", quiz.status)}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {formatDate(quiz.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">
          Student Score Distribution
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Latest quiz performance across score bands.
        </p>
        <div className="mt-6">
          <PieChart distributions={data.distributions} />
        </div>
      </div>
    </div>
  );
}

function StudentsSection() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Student Info"
        description="Search students assigned to your classes."
      />

      <SearchFilter role="teacher" entity="students" />
    </div>
  );
}

function ParticipantsSection() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Participants"
        description="Search participant usernames, sessions, and completion status."
      />
      <SearchFilter role="teacher" entity="participants" />
    </div>
  );
}

function ScoresSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="View Scores"
        description="Review student quiz results and performance trends."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
            <caption className="sr-only">Recent student scores</caption>
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-foreground">
                  Student
                </th>
                <th className="px-6 py-4 font-semibold text-foreground">Quiz</th>
                <th className="px-6 py-4 font-semibold text-foreground">Score</th>
                <th className="px-6 py-4 font-semibold text-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.recentScores.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-neutral-600"
                  >
                    No quiz results have been recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentScores.map((score) => (
                  <tr key={score.id}>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {score.student}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {score.quizTitle}
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {score.score}%
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {score.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">
            Score Distribution
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Student score distribution per quiz.
          </p>
          <div className="mt-6">
            <PieChart distributions={data.distributions} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  const [saveNotice, setSaveNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveNotice(
      "Settings are not connected to profile storage yet; no changes were saved.",
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Settings"
        description="Update your teacher profile and notification preferences."
      />

      <div className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <FormField
            label="Display name"
            id="teacher-display-name"
            name="displayName"
            type="text"
            defaultValue="Teacher Account"
            required
          />
          <FormField
            label="Email address"
            id="teacher-settings-email"
            name="email"
            type="email"
            defaultValue="teacher@example.com"
            required
          />
          <label className="flex items-center gap-3 text-sm text-neutral-600">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked
              className="h-4 w-4 rounded border-neutral-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            Email me when students submit quiz scores
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit">Save Changes</Button>
            {saveNotice ? (
              <span role="status" className="text-sm text-warning">
                {saveNotice}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
