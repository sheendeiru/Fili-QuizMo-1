import { Suspense } from "react";
import { connection } from "next/server";
import AdminDashboardContent from "@/components/dashboard/admin-dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireAdminAccess } from "@/lib/auth/require-dashboard-access";
import { loadAdminDashboardData } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";

async function AdminDashboardData() {
  const supabase = await createClient();
  const data = await loadAdminDashboardData(supabase);
  return <AdminDashboardContent data={data} />;
}

export default async function AdminDashboardPage() {
  await connection();
  await requireAdminAccess();
  return (
    <Suspense
      fallback={<DashboardSkeleton label="Loading admin dashboard..." />}
    >
      <AdminDashboardData />
    </Suspense>
  );
}
