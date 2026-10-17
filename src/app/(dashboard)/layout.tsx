import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperadmin } from "@/lib/auth";
import { getSettings, isOn } from "@/lib/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileMenuProvider } from "@/components/layout/mobile-menu";
import { MaintenanceNotice } from "@/components/layout/maintenance-notice";
import { LegalFooter } from "@/components/legal/legal-footer";
import { ConsentDialog } from "@/components/legal/consent-dialog";

/** Halaman dasbor berisi data internal — jangan diindeks mesin pencari. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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
          <main
            id="konten-utama"
            tabIndex={-1}
            className="flex-1 px-3 pb-10 pt-5 focus:outline-none sm:px-6 lg:px-8"
          >
            <div className="animate-in mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
          <LegalFooter
            organization={settings["site.organization"]}
            className="border-t border-indigo-400/10 px-4 py-5"
          />
        </div>
      </div>
      {/* Persetujuan kebijakan privasi (UU 27/2022 PDP) — wajib sebelum memakai sistem. */}
      {user.consentRequired && <ConsentDialog userName={user.name} />}
    </MobileMenuProvider>
  );
}
