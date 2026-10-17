"use client";

import { MotionConfig } from "framer-motion";

/**
 * Seluruh animasi framer-motion mengikuti preferensi OS
 * "prefers-reduced-motion" (WCAG 2.3.3). Animasi transform dimatikan,
 * sedangkan opacity tetap (tidak memicu vestibular).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
