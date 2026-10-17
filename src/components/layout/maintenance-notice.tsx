import { Wrench } from "lucide-react";

/**
 * Halaman pemberitahuan mode pemeliharaan. Ditampilkan (tanpa sidebar/navbar)
 * kepada semua pengguna non-superadmin ketika mode pemeliharaan aktif.
 */
export function MaintenanceNotice({ message }: { message?: string }) {
  return (
    <main
      id="konten-utama"
      tabIndex={-1}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 focus:outline-none"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl"
      />
      <div className="card animate-in w-full max-w-lg p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-300">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-white">
          Sistem Sedang Dalam Pemeliharaan
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {message ||
            "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi."}
        </p>
        <p className="mt-6 text-xs text-slate-500">
          Terima kasih atas kesabaran Anda.
        </p>
      </div>
    </main>
  );
}
