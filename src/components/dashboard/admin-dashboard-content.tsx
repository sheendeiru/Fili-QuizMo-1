"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { TeacherApprovalList } from "@/components/dashboard/teacher-approval-list";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { defaultSearchQuery } from "@/lib/search/url-state";
import { getStatusLabel } from "@/lib/search/config";
import { logoutAndRedirect } from "@/lib/auth/logout";
import type { AdminDashboardData } from "@/lib/dashboard/data";

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
  { key: "quizzes", label: "Manage Quizzes" },
  { key: "teacher-data", label: "Manage Teacher Data" },
  { key: "teacher-accounts", label: "Manage Teacher Accounts" },
  { key: "participants", label: "Manage Participants" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-PH", {
    dateStyle: "medium",
  });
}

export default function AdminDashboardContent({
  data,
}: {
  data: AdminDashboardData;
}) {
  const searchParams = useSearchParams();
  const entity = searchParams.get("entity");
  const searchActiveKey =
    entity === "teachers"
      ? "teacher-data"
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
      key === "teacher-data" ||
        key === "teacher-accounts" ||
        key === "participants" ||
        key === "quizzes"
        ? null
        : key,
    );
    if (
      key !== "teacher-data" &&
      key !== "teacher-accounts" &&
      key !== "participants" &&
      key !== "quizzes"
    ) {
      return;
    }

    const entity =
      key === "teacher-data" || key === "teacher-accounts"
        ? "teachers"
        : key === "participants"
          ? "participants"
          : "quizzes";
    const query = defaultSearchQuery("admin", entity);
    const params = new URLSearchParams();
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
      role="Admin"
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
      {activeKey === "quizzes" && <ManageQuizzesSection data={data} />}
      {activeKey === "teacher-data" && <TeacherDataSection data={data} />}
      {activeKey === "teacher-accounts" && (
        <TeacherAccountsSection data={data} />
      )}
      {activeKey === "participants" && <ParticipantsSection data={data} />}
      {activeKey === "settings" && <AdminSettingsSection />}
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

function ManageQuizzesSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Quizzes"
        description="Review, edit, and control quiz content across the platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Quizzes" value={String(data.quizzes.total)} />
        <StatCard label="Ready" value={String(data.quizzes.ready)} />
        <StatCard label="Drafts" value={String(data.quizzes.draft)} />
        <StatCard label="Failed" value={String(data.quizzes.failed)} />
      </div>

      <SearchFilter role="admin" entity="quizzes" />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          <caption className="sr-only">Recently created quizzes</caption>
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-foreground">Quiz</th>
              <th className="px-6 py-4 font-semibold text-foreground">Teacher</th>
              <th className="px-6 py-4 font-semibold text-foreground">Status</th>
              <th className="px-6 py-4 font-semibold text-foreground">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.recentQuizzes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-neutral-600">
                  No quizzes have been created yet.
                </td>
              </tr>
            ) : (
              data.recentQuizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {quiz.title}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {quiz.teacherUsername}
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
          Score Distribution
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Completed attempt scores across the platform.
        </p>
        <div className="mt-6">
          <PieChart distributions={data.distributions} />
        </div>
      </div>
    </div>
  );
}

function TeacherDataSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Teacher Data"
        description="Review teacher accounts and quiz ownership."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Teachers" value={String(data.teachers.total)} />
        <StatCard label="Approved" value={String(data.teachers.approved)} />
        <StatCard label="Pending" value={String(data.teachers.pending)} />
      </div>

      <SearchFilter role="admin" entity="teachers" />
    </div>
  );
}

function TeacherAccountsSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Teacher Accounts"
        description="Approve, reject, or suspend teacher login access."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Teachers" value={String(data.teachers.total)} />
        <StatCard label="Approved" value={String(data.teachers.approved)} />
        <StatCard label="Pending" value={String(data.teachers.pending)} />
      </div>

      <TeacherApprovalList teachers={data.teacherAccounts} />

      <SearchFilter role="admin" entity="teachers" />
    </div>
  );
}

function ParticipantsSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Manage Participants"
        description="Search quiz participants, session IDs, and completion status."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={String(data.studentCount)} />
        <StatCard label="Results" value={String(data.results.total)} />
        <StatCard label="Average Score" value={`${data.results.average}%`} />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          <caption className="sr-only">Recent student scores</caption>
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-foreground">Student</th>
              <th className="px-6 py-4 font-semibold text-foreground">Quiz</th>
              <th className="px-6 py-4 font-semibold text-foreground">Score</th>
              <th className="px-6 py-4 font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.recentScores.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-neutral-600">
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
                  <td className="px-6 py-4 text-neutral-600">{score.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SearchFilter role="admin" entity="participants" />
    </div>
  );
}

function AdminSettingsSection() {
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
        description="Update your admin profile and platform preferences."
      />

      <div className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <FormField
            label="Display name"
            id="admin-display-name"
            name="displayName"
            type="text"
            defaultValue="Administrator"
            required
          />
          <FormField
            label="Email address"
            id="admin-settings-email"
            name="email"
            type="email"
            defaultValue="admin@example.com"
            required
          />
          <label className="flex items-center gap-3 text-sm text-neutral-600">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked
              className="h-4 w-4 rounded border-neutral-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            Notify me about new teacher account requests
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
