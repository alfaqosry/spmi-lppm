"use client";

import { useId, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  useFocusTrap,
  useIsClient,
  useScrollLock,
} from "@/components/ui/use-focus-trap";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/**
 * Dialog modal yang aksesibel (WAI-ARIA Dialog Pattern):
 * role="dialog" + aria-modal, judul terhubung via aria-labelledby,
 * perangkap fokus, Esc untuk menutup, dan fokus kembali ke pemicu.
 *
 * `role="alertdialog"` dipakai untuk konfirmasi tindakan destruktif.
 * `dismissible={false}` untuk dialog wajib (mis. persetujuan privasi):
 * Esc & klik latar tidak menutup, tombol tutup disembunyikan.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  size = "md",
  role = "dialog",
  dismissible = true,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  size?: keyof typeof SIZES;
  role?: "dialog" | "alertdialog";
  dismissible?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const mounted = useIsClient();

  const titleId = useId();
  const descId = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(
    open,
    dismissible ? onClose : undefined,
    initialFocus
  );
  useScrollLock(open);

  if (!mounted) return null;

  /**
   * Dirender melalui portal ke <body> agar terlepas dari leluhur yang memiliki
   * `transform` (mis. wrapper animasi). Tanpa portal, elemen `position: fixed`
   * akan "terkurung" pada leluhur ber-transform dan backdrop tidak menutupi
   * seluruh layar.
   */
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`surface-modal relative z-10 my-auto w-full ${SIZES[size]} rounded-2xl border border-indigo-400/20 p-4 shadow-2xl shadow-black/60 focus:outline-none sm:p-5`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                {icon && (
                  <span
                    className="mt-0.5 shrink-0 text-indigo-300"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-white"
                  >
                    {title}
                  </h2>
                  {description && (
                    <div id={descId} className="mt-0.5 text-xs text-slate-400">
                      {description}
                    </div>
                  )}
                </div>
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup dialog"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
