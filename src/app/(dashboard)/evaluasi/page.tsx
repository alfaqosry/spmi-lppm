import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { DocumentManager } from "@/components/documents/document-manager";

export const metadata: Metadata = {
  title: "Dokumen Evaluasi",
  description: "Repositori dokumen evaluasi SPMI dari Lembaga Penjaminan Mutu.",
};

export default async function EvaluasiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [cycles, docs] = await Promise.all([
    prisma.auditCycle.findMany({ orderBy: { startDate: "desc" } }),
    prisma.document.findMany({
      where: { type: "evaluasi" },
      orderBy: { createdAt: "desc" },
      include: {
        cycle: { select: { name: true } },
        uploader: { select: { name: true } },
      },
    }),
  ]);

  const isLpm =
    user.role === "lpm_admin" ||
    user.role === "lpm_member" ||
    user.role === "superadmin";

  return (
    <div>
      <PageHeader
        icon={FileSearch}
        title="Dokumen Evaluasi"
        description={
          isLpm
            ? "Repositori dokumen evaluasi — unggah file PDF atau tautan."
            : "Daftar dokumen evaluasi dari LPM (hanya baca)."
        }
      />
      <DocumentManager
        type="evaluasi"
        canManage={isLpm}
        cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
        documents={docs.map((d) => ({
          id: d.id,
          title: d.title,
          cycleName: d.cycle.name,
          filePath: d.filePath,
          link: d.link,
          uploaderName: d.uploader?.name ?? "LPM",
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
