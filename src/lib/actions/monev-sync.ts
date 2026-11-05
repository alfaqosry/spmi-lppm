"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLpmAdmin } from "@/lib/guards";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import {
  daftarSemesterTersedia,
  syncSemester,
  syncSemesterData,
} from "@/lib/monev-sync";

export type SyncState =
  | {
      ok?: boolean;
      error?: string;
      pesan?: string;
      jumlahSemester?: number;
      jumlahBaris?: number;
      selesai?: string;
    }
  | undefined;

function revalidateMonev() {
  revalidatePath("/monev");
  revalidatePath("/wsstatistik");
}

/**
 * Sinkronkan data kuesioner ke database.
 * - mode "semester": hanya semester terpilih (cepat, untuk refresh harian)
 * - mode "semua": seluruh semester yang punya jawaban (lama, untuk sinkron awal)
 */
export async function sinkronkanMonev(
  _prev: SyncState,
  formData: FormData
): Promise<SyncState> {
  let user;
  try {
    user = await requireLpmAdmin();
  } catch {
    return {
      ok: false,
      error: "Akses ditolak. Hanya Admin LPM yang dapat menyinkronkan.",
    };
  }

  const mode =
    String(formData.get("mode") ?? "semester") === "semua"
      ? "semua"
      : "semester";
  const idSmtDiminta = String(formData.get("id_smt") ?? "").trim();

  // Cegah dua proses sinkron berjalan bersamaan (bisa membuat data ganda).
  const berjalan = await prisma.monevSyncRun.findFirst({
    where: {
      status: "running",
      mulai: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    select: { id: true },
  });
  if (berjalan) {
    return {
      ok: false,
      error:
        "Sinkronisasi lain masih berjalan. Tunggu hingga selesai lalu coba lagi.",
    };
  }

  const run = await prisma.monevSyncRun.create({
    data: {
      status: "running",
      mode,
      idSmt: mode === "semester" ? idSmtDiminta || null : null,
      olehUserId: user.id,
      olehNama: user.name?.slice(0, 160) ?? null,
    },
  });

  try {
    let jumlahSemester = 0;
    let jumlahBaris = 0;

    if (mode === "semester") {
      if (!idSmtDiminta) throw new Error("Semester belum dipilih.");
      jumlahSemester = await syncSemester();
      jumlahBaris = await syncSemesterData(idSmtDiminta);
    } else {
      jumlahSemester = await syncSemester();
      const daftar = await daftarSemesterTersedia();
      if (!daftar.length)
        throw new Error("Belum ada semester yang memiliki jawaban.");
      for (const idSmt of daftar) {
        jumlahBaris += await syncSemesterData(idSmt);
      }
    }

    await prisma.monevSyncRun.update({
      where: { id: run.id },
      data: {
        status: "sukses",
        jumlahSemester,
        jumlahBaris,
        selesai: new Date(),
        pesan:
          mode === "semester"
            ? `Semester ${idSmtDiminta} tersinkron.`
            : `${jumlahSemester} semester tersinkron.`,
      },
    });

    await recordActivity({
      userId: user.id,
      userName: user.name ?? undefined,
      action: "monev.sync",
      entity: "monev",
      entityId: mode === "semester" ? idSmtDiminta : "semua",
      detail: `${mode}: ${jumlahSemester} semester, ${jumlahBaris} baris`,
      ip: await getClientIp(),
    });

    revalidateMonev();
    return {
      ok: true,
      pesan:
        mode === "semester"
          ? `Data semester ${idSmtDiminta} berhasil disimpan.`
          : `Data ${jumlahSemester} semester berhasil disimpan.`,
      jumlahSemester,
      jumlahBaris,
      selesai: new Date().toISOString(),
    };
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Sinkronisasi gagal.";
    await prisma.monevSyncRun.update({
      where: { id: run.id },
      data: {
        status: "gagal",
        selesai: new Date(),
        pesan: pesan.slice(0, 500),
      },
    });
    return { ok: false, error: pesan };
  }
}
