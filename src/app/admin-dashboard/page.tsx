import { Suspense } from "react";
import AdminDashboardContent from "@/components/dashboard/admin-dashboard-content";
import { requireAdminAccess } from "@/lib/auth/require-dashboard-access";
import { PixelLoader } from "@/components/ui/pixel-loader";

export default async function AdminDashboardPage() {
  await requireAdminAccess();
  return (
    <Suspense
      fallback={<PixelLoader label="Loading admin dashboard..." variant="screen" />}
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
