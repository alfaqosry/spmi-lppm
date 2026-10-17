import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  enforceRateLimit,
  LIMITS_RL,
  rateLimit,
  rateLimitMessage,
  resetRateLimit,
} from "@/lib/ratelimit";

let n = 0;
/** Kunci unik per uji (bucket bersifat global per modul). */
const key = () => `test:${++n}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("mengizinkan hingga `limit` percobaan dalam satu jendela", () => {
    const k = key();
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000).ok).toBe(true);
    const blocked = rateLimit(k, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it("retryAfter berkurang seiring waktu (dibulatkan ke atas)", () => {
    const k = key();
    rateLimit(k, 1, 60_000);
    vi.advanceTimersByTime(20_500);
    const r = rateLimit(k, 1, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBe(40);
  });

  it("jendela baru dimulai setelah kedaluwarsa", () => {
    const k = key();
    rateLimit(k, 1, 1_000);
    expect(rateLimit(k, 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(rateLimit(k, 1, 1_000).ok).toBe(true);
    expect(rateLimit(k, 1, 1_000).ok).toBe(false);
  });

  it("kunci berbeda dihitung terpisah", () => {
    const a = key();
    const b = key();
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("tetap memblokir selama jendela meski terus dicoba (tanpa reset)", () => {
    const k = key();
    for (let i = 0; i < 50; i++) rateLimit(k, 3, 60_000);
    vi.advanceTimersByTime(59_000);
    expect(rateLimit(k, 3, 60_000).ok).toBe(false);
  });

  it("resetRateLimit menghapus hitungan (mis. setelah login sukses)", () => {
    const k = key();
    rateLimit(k, 1, 60_000);
    expect(rateLimit(k, 1, 60_000).ok).toBe(false);
    resetRateLimit(k);
    expect(rateLimit(k, 1, 60_000).ok).toBe(true);
  });

  it("menyapu bucket kedaluwarsa saat jumlah bucket besar", () => {
    for (let i = 0; i < 5_001; i++) rateLimit(`sweep:${i}`, 1, 1_000);
    vi.advanceTimersByTime(2_000);
    // Memicu sweep; kunci lama sudah kedaluwarsa sehingga diizinkan lagi.
    expect(rateLimit("sweep:0", 1, 1_000).ok).toBe(true);
    expect(rateLimit("sweep:1", 1, 1_000).ok).toBe(true);
  });
});

describe("retryAfter minimum", () => {
  it("tidak pernah 0 detik (klien tidak langsung mencoba ulang)", () => {
    const k = key();
    rateLimit(k, 1, 1_000);
    vi.advanceTimersByTime(999);
    expect(rateLimit(k, 1, 1_000).retryAfter).toBe(1);
  });
});

describe("enforceRateLimit & rateLimitMessage", () => {
  it("melempar AppError dengan pesan berbahasa Indonesia saat dibatasi", () => {
    const k = key();
    enforceRateLimit(k, 2, 60_000);
    enforceRateLimit(k, 2, 60_000);
    expect(() => enforceRateLimit(k, 2, 60_000)).toThrow(AppError);
    expect(() => enforceRateLimit(k, 2, 60_000)).toThrow(/60 detik/);
  });

  it("pesan default 60 detik", () => {
    expect(rateLimitMessage()).toMatch(/60 detik/);
    expect(rateLimitMessage(5)).toMatch(/5 detik/);
  });
});

describe("LIMITS_RL", () => {
  it("setiap preset memiliki limit & jendela positif", () => {
    for (const [name, v] of Object.entries(LIMITS_RL)) {
      expect(v.limit, name).toBeGreaterThan(0);
      expect(v.windowMs, name).toBeGreaterThan(0);
    }
  });
});
