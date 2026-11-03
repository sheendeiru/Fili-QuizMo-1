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
import { useNavigation } from "@/components/pixel";
import { Button } from "@/components/ui/button";
import { PixelCard } from "@/components/ui/pixel-primitives";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { FormField } from "@/components/ui/form-field";
import { defaultSearchQuery } from "@/lib/search/url-state";
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
  { key: "participants", label: "Manage Participants & Scores" },
  { key: "settings", label: "Settings" },
];

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
      role="Teacher"
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
      {activeKey === "quizzes" && <QuizzesSection data={data} />}
      {activeKey === "students" && <StudentsSection />}
      {activeKey === "participants" && <ParticipantsSection data={data} />}
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

function QuizzesSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="View Quizzes"
        description="Review your quiz library and overall class performance."
      />

      <div className="grid gap-3 sm:grid-cols-3">
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

      <PixelCard>
        <h3 className="text-lg font-semibold text-foreground">
          Student Score Distribution
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Latest quiz performance across score bands.
        </p>
        <div className="mt-3">
          <PieChart distributions={data.distributions} />
        </div>
      </PixelCard>
    </div>
  );
}

function StudentsSection() {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Manage Student Info"
        description="Search students assigned to your classes."
      />

      <ManageAccountsTable actorRole="teacher" accountRole="student" />
    </div>
  );
}

function ParticipantsSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Participants & Scores"
        description="Search quiz participants and review class performance."
      />
      <SearchFilter role="teacher" entity="participants" />
      <PixelCard>
        <h3 className="text-base font-semibold text-foreground">
          Score Distribution
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Student score distribution per quiz.
        </p>
        <div className="mt-3">
          <PieChart distributions={data.distributions} />
        </div>
      </PixelCard>
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
    <div className="space-y-3">
      <SectionHeading
        title="Settings"
        description="Update your teacher profile and notification preferences."
      />

      <PixelCard className="max-w-2xl">
        <form className="space-y-3" onSubmit={handleSubmit}>
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
