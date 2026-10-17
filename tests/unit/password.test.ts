import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
} from "@/lib/password";

describe("validatePassword", () => {
  it("menerima kata sandi yang memenuhi kebijakan", () => {
    expect(validatePassword("rahasia123")).toBeNull();
    expect(validatePassword("A1b2C3d4")).toBeNull();
  });

  it("menolak kata sandi kosong / bukan string", () => {
    expect(validatePassword("")).toMatch(/wajib diisi/);
    expect(validatePassword(undefined as unknown as string)).toMatch(
      /wajib diisi/
    );
  });

  it(`menolak kurang dari ${PASSWORD_MIN_LENGTH} karakter`, () => {
    expect(validatePassword("abc1234")).toMatch(/minimal 8/);
    expect(validatePassword("abcd1234")).toBeNull();
  });

  it(`menolak lebih dari ${PASSWORD_MAX_BYTES} byte UTF-8 (batas bcrypt)`, () => {
    const ok = "a1" + "x".repeat(PASSWORD_MAX_BYTES - 2);
    expect(Buffer.byteLength(ok)).toBe(PASSWORD_MAX_BYTES);
    expect(validatePassword(ok)).toBeNull();
    expect(validatePassword(ok + "y")).toMatch(/maksimal/);
    // Karakter multi-byte dihitung per byte, bukan per karakter.
    const multibyte = "a1" + "é".repeat(36); // 2 + 72 byte
    expect(multibyte.length).toBeLessThan(PASSWORD_MAX_BYTES);
    expect(validatePassword(multibyte)).toMatch(/maksimal/);
  });

  it("wajib mengandung huruf dan angka", () => {
    expect(validatePassword("12345678")).toMatch(/huruf dan angka/);
    expect(validatePassword("abcdefgh")).toMatch(/huruf dan angka/);
    expect(validatePassword("!!!!!!!!")).toMatch(/huruf dan angka/);
  });

  it("tidak boleh sama dengan email atau bagian lokalnya", () => {
    const ctx = { email: "Budi2024@up.ac.id" };
    expect(validatePassword("budi2024@up.ac.id", ctx)).toMatch(/email/);
    expect(validatePassword("BUDI2024", ctx)).toMatch(/email/);
    expect(validatePassword("budi2024x", ctx)).toBeNull();
  });

  it("bagian lokal email pendek (< 4) tidak dibandingkan", () => {
    expect(validatePassword("ab12cdef", { email: "ab1@x.id" })).toBeNull();
  });

  it("konteks email null/kosong diabaikan", () => {
    expect(validatePassword("rahasia123", { email: null })).toBeNull();
    expect(validatePassword("rahasia123", { email: "  " })).toBeNull();
  });

  it("menyediakan petunjuk kebijakan untuk UI", () => {
    expect(PASSWORD_POLICY_HINT).toMatch(/8 karakter/);
  });
});
