"use client";

import { useState } from "react";
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
import { PixelCard } from "@/components/ui/pixel-primitives";
import {
  ChartTabs,
  SectionHeading,
  StatCard,
  StatGrid,
} from "@/components/dashboard/compact-layout";
import { ProfileCard } from "@/components/dashboard/profile-card";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { ManageQuizzesTable } from "@/components/dashboard/manage-quizzes";
import {
  BarChartCard,
  MeterCard,
  RecentScoresCard,
  percentOf,
} from "@/components/dashboard/dashboard-charts";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { TeacherStatusActions } from "@/components/dashboard/teacher-status-actions";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { useNavigation } from "@/components/pixel";
import { useResetRouteState } from "@/lib/dashboard/route-reset";
import { logoutAndRedirect } from "@/lib/auth/logout";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";
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

// shortLabel is what the navbar shows; the drawer, the tooltip and screen
// readers keep the full label.
const navItems: DashboardNavItem[] = [
  { key: "quizzes", label: "Manage Quizzes", shortLabel: "Quizzes" },
  {
    key: "teacher-accounts",
    label: "Manage Teacher Accounts",
    shortLabel: "Teachers",
  },
  {
    key: "students",
    label: "Manage Student Accounts",
    shortLabel: "Students",
  },
];

// Tables the admin dashboard summarises. A change in any of them refreshes
// the stat cards, charts and teacher list.
const LIVE_TABLES = [
  "quiz_sessions",
  "quizzes",
  "teachers",
  "students",
  "quiz_results",
  "account_profiles",
] as const;

const BASE_PATH = "/admin-dashboard";

// One route per sidebar button. `entity` is still sent as a query param
// because the search and table components read it from the URL.
const SECTION_ROUTES = {
  quizzes: { slug: "quizzes", entity: "quizzes" },
  "teacher-accounts": { slug: "teachers", entity: "teachers" },
  students: { slug: "students", entity: "student_accounts" },
  settings: { slug: "settings", entity: null },
} as const;

type SectionKey = keyof typeof SECTION_ROUTES;

function sectionHref(key: SectionKey): string {
  const route = SECTION_ROUTES[key];

  return `${BASE_PATH}/${route.slug}${route.entity ? `?entity=${route.entity}` : ""}`;
}

function isSectionKey(key: string): key is SectionKey {
  return key in SECTION_ROUTES;
}

/** /admin-dashboard/teachers -> "teacher-accounts". Old ?entity= links still work. */
function sectionFromUrl(pathname: string, entity: string | null): SectionKey {
  const segment = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length).split("/").filter(Boolean)[0]
    : undefined;

  const match = (Object.keys(SECTION_ROUTES) as SectionKey[]).find(
    (key) => SECTION_ROUTES[key].slug === segment,
  );
  if (match) return match;

  if (entity === "teachers") return "teacher-accounts";
  if (entity === "students" || entity === "student_accounts") return "students";
  return "quizzes";
}

export default function AdminDashboardContent({
  data,
}: {
  data: AdminDashboardData;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeKey = sectionFromUrl(pathname, searchParams.get("entity"));
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const { navigate } = useNavigation();

  useResetRouteState("admin-dashboard", sectionHref(activeKey));
  useRealtimeRefresh(LIVE_TABLES);

  function navigateToSection(key: string) {
    if (!isSectionKey(key)) return;

    const target = sectionHref(key);
    const currentSearch = searchParams.toString();
    if (target === `${pathname}${currentSearch ? `?${currentSearch}` : ""}`) {
      return;
    }

    navigate(() => router.push(target, { scroll: false }));
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
      {activeKey === "settings" && <AdminSettingsSection />}
    </DashboardShell>
  );
}

function ManageQuizzesSection({ data }: { data: AdminDashboardData }) {
  const { total, ready, draft, failed } = data.quizzes;
  // 'processing' quizzes are in the total but have no stat card of their own
  const processing = Math.max(total - ready - draft - failed, 0);
  const topTeachers = data.teacherAccounts
    .filter((teacher) => teacher.quizCount > 0)
    .sort((left, right) => right.quizCount - left.quizCount)
    .slice(0, 5);

  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Manage Quizzes"
        description="Review, edit, and control quiz content across the platform."
      />

      <StatGrid columns={4}>
        <StatCard label="Total Quizzes" value={String(total)} />
        <StatCard label="Ready" value={String(ready)} />
        <StatCard label="Drafts" value={String(draft)} />
        <StatCard label="Failed" value={String(failed)} />
      </StatGrid>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <MeterCard label="Ready Rate" percent={percentOf(ready, total)} />
        <MeterCard label="Failed Rate" percent={percentOf(failed, total)} />
      </div>

      {/* Phones: one chart at a time behind tabs. md and up: all four in a 2-column grid. */}
      <ChartTabs
        label="Quiz charts"
        tabs={[
          {
            key: "teachers",
            label: "By Teacher",
            content: (
              <BarChartCard
                title="Quizzes by Teacher"
                description="Top teachers by number of quizzes created."
                total={total}
                items={topTeachers.map((teacher) => ({
                  label: teacher.username,
                  value: teacher.quizCount,
                  color: "bg-primary",
                }))}
              />
            ),
          },
          {
            key: "recent",
            label: "Recent Scores",
            content: (
              <RecentScoresCard
                title="Recent Scores"
                description="The latest completed attempts across the platform."
                scores={data.recentScores}
              />
            ),
          },
          {
            key: "status",
            label: "Quiz Status",
            content: (
              <BarChartCard
                title="Quiz Status"
                description="How the quizzes on the platform are split by status."
                total={total}
                items={[
                  { label: "Ready", value: ready, color: "bg-success" },
                  { label: "Drafts", value: draft, color: "bg-px-gold" },
                  { label: "Failed", value: failed, color: "bg-danger-dark" },
                  ...(processing > 0
                    ? [
                        {
                          label: "Processing",
                          value: processing,
                          color: "bg-px-indigo",
                        },
                      ]
                    : []),
                ]}
              />
            ),
          },
          {
            key: "distribution",
            label: "Score Distribution",
            content: (
              <PixelCard className="h-full p-2.5! sm:p-3!">
                <h3 className="text-base font-semibold text-foreground">
                  Score Distribution
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Completed attempt scores across the platform.
                </p>
                <div className="mt-2">
                  <PieChart distributions={data.distributions} />
                </div>
              </PixelCard>
            ),
          },
        ]}
      />

      <ManageQuizzesTable actorRole="admin" />
    </div>
  );
}

function TeacherAccountsSection({ data }: { data: AdminDashboardData }) {
  const { total, approved, pending, rejected, suspended } = data.teachers;

  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Manage Teacher Accounts"
        description="Approve, reject, or suspend teacher login access."
      />

      <StatGrid columns={4}>
        <StatCard label="Total Teachers" value={String(total)} />
        <StatCard label="Approved" value={String(approved)} />
        <StatCard label="Pending" value={String(pending)} />
        <MeterCard label="Approval Rate" percent={percentOf(approved, total)} />
      </StatGrid>

      <BarChartCard
        title="Account Status"
        description="Teacher accounts by approval status."
        total={total}
        items={[
          { label: "Approved", value: approved, color: "bg-success" },
          { label: "Pending", value: pending, color: "bg-px-gold" },
          { label: "Rejected", value: rejected, color: "bg-danger-dark" },
          { label: "Suspended", value: suspended, color: "bg-px-indigo" },
        ]}
      />

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
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Manage Student Accounts"
        description="Create and remove student logins, and optionally assign a managing teacher."
      />

      <StatGrid columns={3}>
        <StatCard label="Students" value={String(data.studentCount)} />
        <StatCard label="Results" value={String(data.studentResults.total)} />
        <MeterCard
          label="Average Score"
          percent={Number(data.studentResults.average)}
        />
      </StatGrid>

      <RecentScoresCard
        title="Recent Scores"
        description="The latest completed attempts by student accounts."
        scores={data.studentRecentScores}
      />

      <ManageAccountsTable
        actorRole="admin"
        accountRole="student"
        teachers={data.teacherAccounts}
      />
    </div>
  );
}

function AdminSettingsSection() {
  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Settings"
        description="Review your admin account details and keep your password up to date."
      />

      <ProfileCard role="admin" />

      <SettingsPasswordForm sessionExpiredPath="/admin-login?status=session_expired" />
    </div>
  );
}
