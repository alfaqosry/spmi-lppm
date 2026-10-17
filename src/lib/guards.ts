import {
  getCurrentUser,
  isLpm,
  isLpmAdmin,
  isSuperadmin,
  unitIdsOf,
  type SessionUser,
} from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getSettings, isOn } from "@/lib/settings";

/**
 * Penjaga otorisasi (RBAC) terpusat untuk SETIAP server action & route handler.
 *
 * Catatan Next.js 16: Server Function dapat dipanggil langsung lewat POST
 * tanpa melalui layout/halaman, sehingga pemeriksaan di layout (mis. mode
 * pemeliharaan, pengunjung) TIDAK cukup — setiap action wajib memanggil salah
 * satu fungsi di bawah ini sebagai baris pertama.
 */

const MSG_SESSION = "Sesi tidak valid. Silakan masuk kembali.";
const MSG_DENIED = "Akses ditolak.";

/** Mode pemeliharaan: hanya superadmin yang boleh melakukan perubahan. */
async function assertNotMaintenance(user: SessionUser) {
  if (isSuperadmin(user.role)) return;
  const s = await getSettings();
  if (isOn(s["maintenance.enabled"])) {
    throw new AppError(
      s["maintenance.message"] ||
        "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi."
    );
  }
}

/** Pengguna login (termasuk pengunjung). Dipakai untuk aksi akun sendiri. */
export async function requireUser(opts?: { allowDuringMaintenance?: boolean }) {
  const user = await getCurrentUser();
  if (!user) throw new AppError(MSG_SESSION);
  if (!opts?.allowDuringMaintenance) await assertNotMaintenance(user);
  return user;
}

/** Pengguna dengan akses aplikasi (bukan pengunjung). */
export async function requireAccess() {
  const user = await requireUser();
  if (user.role === "pengunjung") throw new AppError(MSG_DENIED);
  return user;
}

/** Tim LPM (admin, anggota) + superadmin. */
export async function requireLpm() {
  const user = await requireUser();
  if (!isLpm(user.role))
    throw new AppError("Akses ditolak. Hanya pengguna LPM.");
  return user;
}

/** Admin LPM + superadmin. */
export async function requireLpmAdmin() {
  const user = await requireUser();
  if (!isLpmAdmin(user.role))
    throw new AppError("Akses ditolak. Hanya Admin LPM.");
  return user;
}

/** Superadmin saja. */
export async function requireSuperadmin() {
  const user = await requireUser();
  if (!isSuperadmin(user.role))
    throw new AppError("Akses ditolak. Hanya Superadmin.");
  return user;
}

/** Auditee (kepala/anggota unit) yang ditempatkan pada `unitId`. */
export async function requireUnitMember(unitId: number) {
  const user = await requireAccess();
  if (user.role !== "auditee_head" && user.role !== "auditee_member") {
    throw new AppError("Hanya akun unit yang dapat mengisi data unit.");
  }
  if (!unitIdsOf(user).includes(unitId)) {
    throw new AppError("Anda tidak memiliki akses ke unit tersebut.");
  }
  return user;
}

/** Apakah pengguna boleh MEMBACA data unit tertentu (LPM: semua; auditee: unitnya). */
export function canReadUnit(user: SessionUser, unitId: number): boolean {
  if (isLpm(user.role)) return true;
  if (user.role === "pengunjung") return false;
  return unitIdsOf(user).includes(unitId);
}
