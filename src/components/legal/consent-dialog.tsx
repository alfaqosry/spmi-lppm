"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  ActionFeedback,
  BTN_SECONDARY,
  Field,
  SubmitButton,
} from "@/components/ui/form";
import { recordConsent, type ConsentState } from "@/lib/actions/privacy";
import { logoutAction } from "@/lib/actions/auth";
import {
  CONTACT_EMAIL,
  LEGAL_DATE,
  LEGAL_VERSION,
} from "@/components/legal/site";

/**
 * Dialog persetujuan Kebijakan Privasi (UU 27/2022 PDP) yang wajib
 * disetujui sebelum memakai sistem. Bersifat memblokir (tidak bisa ditutup
 * dengan Esc/klik latar) namun tetap aksesibel: role="dialog", fokus
 * terkunci di dalam, label & pesan galat terbaca pembaca layar.
 * Pengguna yang tidak setuju dapat keluar (logout).
 */
export function ConsentDialog({ userName }: { userName: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ConsentState, FormData>(
    recordConsent,
    undefined
  );
  // Dialog tertutup segera setelah persetujuan tersimpan.
  const open = !state?.ok;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Modal
      open={open}
      onClose={() => {}}
      dismissible={false}
      size="md"
      title="Persetujuan Kebijakan Privasi"
      icon={<ShieldCheck className="h-5 w-5" />}
      description={`Versi ${LEGAL_VERSION} — berlaku ${LEGAL_DATE}`}
    >
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          Halo <strong className="text-slate-100">{userName}</strong>, sebelum
          melanjutkan, mohon baca dan setujui cara Universitas Pahlawan Tuanku
          Tambusai (melalui LPM) memproses data pribadi Anda di Sistem Informasi
          SPMI.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
          <li>
            Data yang diproses: nama, email, NIDN/NIP/username SSO, unit,
            jawaban audit, berkas bukti, serta log login (alamat IP &amp;
            perangkat).
          </li>
          <li>
            Tujuan: pelaksanaan audit mutu internal (SPMI) sesuai kewajiban
            hukum institusi.
          </li>
          <li>
            Anda berhak mengakses, memperbaiki, mengekspor, dan meminta
            penghapusan data melalui{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-indigo-300 underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </li>
        </ul>
        <p className="text-xs">
          <Link
            href="/kebijakan-privasi"
            target="_blank"
            rel="noopener"
            className="font-medium text-indigo-300 underline underline-offset-2"
          >
            Baca Kebijakan Privasi lengkap
            <span className="sr-only"> (membuka tab baru)</span>
          </Link>{" "}
          ·{" "}
          <Link
            href="/syarat-ketentuan"
            target="_blank"
            rel="noopener"
            className="font-medium text-indigo-300 underline underline-offset-2"
          >
            Syarat &amp; Ketentuan
            <span className="sr-only"> (membuka tab baru)</span>
          </Link>
        </p>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <ActionFeedback
          state={state}
          successMessage="Terima kasih, persetujuan Anda tersimpan."
        />
        <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] px-3 py-2.5">
          <Field
            label="Saya telah membaca dan menyetujui Kebijakan Privasi"
            labelHidden
          >
            <span className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="agree"
                required
                data-autofocus
                className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-500"
              />
              <span aria-hidden="true" className="text-sm text-slate-200">
                Saya telah membaca dan menyetujui Kebijakan Privasi
              </span>
            </span>
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button
            type="submit"
            formAction={logoutAction}
            formNoValidate
            className={BTN_SECONDARY}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Tidak setuju, keluar
          </button>
          <SubmitButton
            label="Setuju & Lanjutkan"
            pendingLabel="Menyimpan…"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>
      </form>
    </Modal>
  );
}
