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
import { PixelCard } from "@/components/ui/pixel-primitives";
import { FormField } from "@/components/ui/form-field";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { TeacherStatusActions } from "@/components/dashboard/teacher-status-actions";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { useNavigation } from "@/components/pixel";
import { defaultSearchQuery } from "@/lib/search/url-state";
import { logoutAndRedirect } from "@/lib/auth/logout";
import type { AdminDashboardData } from "@/lib/dashboard/data";
import type { SearchItem } from "@/lib/search/types";

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
  { key: "teacher-accounts", label: "Manage Teacher Accounts" },
  { key: "students", label: "Manage Student Accounts" },
  { key: "participants", label: "Manage Participants" },
];

export default function AdminDashboardContent({
  data,
}: {
  data: AdminDashboardData;
}) {
  const searchParams = useSearchParams();
  const entity = searchParams.get("entity");
  const searchActiveKey =
    entity === "teachers"
      ? "teacher-accounts"
      : entity === "students"
        ? "students"
        : entity === "participants"
          ? "participants"
          : "quizzes";
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey ?? searchActiveKey;
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const { navigate } = useNavigation();
  const pathname = usePathname();

  useEffect(() => {
    function clearManualSection() {
      setManualActiveKey(null);
    }

    window.addEventListener("popstate", clearManualSection);
    return () => window.removeEventListener("popstate", clearManualSection);
  }, []);

  function navigateToSection(key: string) {
    setManualActiveKey(key === "settings" ? "settings" : null);
    if (
      key !== "teacher-accounts" &&
      key !== "students" &&
      key !== "participants" &&
      key !== "quizzes"
    ) {
      return;
    }

    const entity =
      key === "teacher-accounts"
        ? "teachers"
        : key === "students"
          ? "students"
          : key === "participants"
            ? "participants"
            : "quizzes";
    const query = defaultSearchQuery("admin", entity);
    const params = new URLSearchParams();
    params.set("entity", query.entity);
    navigate(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false }),
    );
  }

  async function handleLogout() {
    setLogoutError("");

    try {
      await logoutAndRedirect(router, navigate);
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
          className="mb-3 flex items-center gap-2 border-2 border-danger-dark bg-danger-surface px-3 py-2 text-sm text-danger-dark"
        >
          Unable to log out: {logoutError}
        </p>
      ) : null}
      {activeKey === "quizzes" && <ManageQuizzesSection data={data} />}
      {activeKey === "teacher-accounts" && (
        <TeacherAccountsSection data={data} />
      )}
      {activeKey === "students" && <StudentAccountsSection data={data} />}
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
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-px-muted">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <PixelCard as="article">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </PixelCard>
  );
}

function ManageQuizzesSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Manage Quizzes"
        description="Review, edit, and control quiz content across the platform."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Quizzes" value={String(data.quizzes.total)} />
        <StatCard label="Ready" value={String(data.quizzes.ready)} />
        <StatCard label="Drafts" value={String(data.quizzes.draft)} />
        <StatCard label="Failed" value={String(data.quizzes.failed)} />
      </div>

      <SearchFilter role="admin" entity="quizzes" />

      <PixelCard>
        <h3 className="text-lg font-semibold text-foreground">
          Score Distribution
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Completed attempt scores across the platform.
        </p>
        <div className="mt-3">
          <PieChart distributions={data.distributions} />
        </div>
      </PixelCard>
    </div>
  );
}

function TeacherAccountsSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Manage Teacher Accounts"
        description="Approve, reject, or suspend teacher login access."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Teachers" value={String(data.teachers.total)} />
        <StatCard label="Approved" value={String(data.teachers.approved)} />
        <StatCard label="Pending" value={String(data.teachers.pending)} />
      </div>

      <ManageAccountsTable
        actorRole="admin"
        accountRole="teacher"
        renderExtraActions={(item: SearchItem) =>
          item.entity === "teachers" ? (
            <TeacherStatusActions
              teacherId={item.id}
              status={item.status}
            />
          ) : null
        }
      />
    </div>
  );
}

function StudentAccountsSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Manage Student Accounts"
        description="Create and remove student logins, and optionally assign a managing teacher."
      />
      <StatCard label="Students" value={String(data.studentCount)} />
      <ManageAccountsTable
        actorRole="admin"
        accountRole="student"
        teachers={data.teacherAccounts}
      />
    </div>
  );
}

function ParticipantsSection({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Manage Participants"
        description="Search quiz participants, session IDs, and completion status."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Students" value={String(data.studentCount)} />
        <StatCard label="Results" value={String(data.results.total)} />
        <StatCard label="Average Score" value={`${data.results.average}%`} />
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
    <div className="space-y-3">
      <SectionHeading
        title="Settings"
        description="Update your admin profile and platform preferences."
      />

      <PixelCard className="max-w-2xl">
        <form className="space-y-3" onSubmit={handleSubmit}>
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
              <span role="status" className="text-sm text-px-gold-text">
                {saveNotice}
              </span>
            ) : null}
          </div>
        </form>
      </PixelCard>
    </div>
  );
}
