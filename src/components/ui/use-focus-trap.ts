"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** true setelah hidrasi di klien (pengganti pola useEffect(setMounted)). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

/** Tumpukan lapisan aktif — hanya lapisan teratas yang menangani Esc/Tab. */
const stack: symbol[] = [];

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0
  );
}

/**
 * Perangkap fokus untuk dialog/drawer (WCAG 2.1.2 & 2.4.3):
 * - memindahkan fokus ke dalam lapisan saat dibuka,
 * - Tab/Shift+Tab berputar di dalam lapisan,
 * - Esc menutup (bila `onEscape` diberikan),
 * - mengembalikan fokus ke pemicu saat ditutup.
 * Mendukung lapisan bertingkat (mis. dialog konfirmasi di atas modal).
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
  initialFocus?: RefObject<HTMLElement | null>
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const escRef = useRef(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const id = Symbol("layer");
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Fokus awal setelah frame berikutnya (menunggu animasi mount).
    const raf = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) return;
      const target =
        initialFocus?.current ??
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        focusables(root)[0] ??
        root;
      target.focus({ preventScroll: true });
    });

    function onKey(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return;
      const root = ref.current;
      if (!root) return;
      if (e.key === "Escape" && escRef.current) {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      const idx = stack.indexOf(id);
      if (idx >= 0) stack.splice(idx, 1);
      // Kembalikan fokus ke elemen pemicu (bila masih ada di DOM).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // initialFocus sengaja tidak dimasukkan: ref stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}

/** Kunci gulir <body> selama lapisan terbuka (aman untuk lapisan bertingkat). */
let scrollLocks = 0;
let prevOverflow = "";
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (scrollLocks === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}
