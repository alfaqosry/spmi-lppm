import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperadmin } from "@/lib/auth";
import { getSettingsForAdmin } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsManager } from "@/components/settings/settings-manager";

export const metadata = { title: "Pengaturan Sistem" };

export default async function PengaturanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isSuperadmin(user.role)) redirect("/dashboard");

  const [settings, loginLogs, activityLogs, superadmins] = await Promise.all([
    getSettingsForAdmin(),
    prisma.loginLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.findMany({
      where: { role: "superadmin" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        icon={Settings}
        title="Pengaturan Sistem"
        description="Kelola identitas & SEO, integrasi SSO, log login/aktivitas, kebijakan keamanan, mode pemeliharaan, dan akun superadmin. Perubahan berlaku langsung tanpa mengubah berkas .env."
      />
      <SettingsManager
        settings={settings}
        superadmins={superadmins}
        loginLogs={loginLogs.map((l) => ({
          id: l.id,
          email: l.email,
          success: l.success,
          method: l.method,
          ip: l.ip,
          message: l.message,
          createdAt: formatDateTime(l.createdAt),
        }))}
        activityLogs={activityLogs.map((l) => ({
          id: l.id,
          userName: l.userName,
          action: l.action,
          entity: l.entity,
          detail: l.detail,
          createdAt: formatDateTime(l.createdAt),
        }))}
      />
    </div>
  );
}
