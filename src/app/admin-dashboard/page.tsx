import { Suspense } from "react";
import AdminDashboardContent from "@/components/dashboard/admin-dashboard-content";
import { requireAdminAccess } from "@/lib/auth/require-dashboard-access";
import { loadAdminDashboardData } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";
import { PixelLoader } from "@/components/ui/pixel-loader";

export default async function AdminDashboardPage() {
  await requireAdminAccess();
  const supabase = await createClient();
  const data = await loadAdminDashboardData(supabase);

  return (
    <Suspense
      fallback={<PixelLoader label="Loading admin dashboard..." variant="screen" />}
    >
      <AdminDashboardContent data={data} />
    </Suspense>
  );
}
