import { redirect } from "next/navigation";
import { getCurrentUser, isSuperadmin } from "@/lib/auth";
import { getSettings, isOn } from "@/lib/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileMenuProvider } from "@/components/layout/mobile-menu";
import { MaintenanceNotice } from "@/components/layout/maintenance-notice";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "pengunjung") redirect("/no-access");

  const settings = await getSettings();

  // Mode pemeliharaan: hanya superadmin yang boleh lewat.
  if (isOn(settings["maintenance.enabled"]) && !isSuperadmin(user.role)) {
    return <MaintenanceNotice message={settings["maintenance.message"]} />;
  }

  const branding = {
    logo: settings["site.logo"],
    shortName: settings["site.shortName"] || "SPMI",
    name: settings["site.name"] || "Sistem Informasi SPMI",
    subtitle: settings["site.organization"] || "Penjaminan Mutu Internal",
  };

  return (
    <MobileMenuProvider>
      <div className="flex min-h-screen">
        <Sidebar user={user} branding={branding} />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[268px]">
          <Topbar user={user} />
          <main className="flex-1 px-4 pb-12 pt-5 sm:px-6 lg:px-8">
            <div className="animate-in mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
