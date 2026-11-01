import { Suspense } from "react";
import TeacherDashboardContent from "@/components/dashboard/teacher-dashboard-content";
import { requireTeacherAccess } from "@/lib/auth/require-dashboard-access";
import { PixelLoader } from "@/components/ui/pixel-loader";

export default async function TeacherDashboardPage() {
  await requireTeacherAccess();
  return (
    <Suspense
      fallback={<PixelLoader label="Loading teacher dashboard..." variant="screen" />}
    >
      <TeacherDashboardContent />
    </Suspense>
  );
}
