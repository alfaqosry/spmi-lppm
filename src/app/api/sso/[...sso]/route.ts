import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SSOClient } from "@alfaqosry/sso-client-next";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  getSession,
  revokeUserSessions,
  setSessionCookie,
} from "@/lib/auth";
import {
  getSsoRuntimeConfig,
  resolveLocalRole,
  type SsoIdentity,
  type SsoRuntimeConfig,
} from "@/lib/sso";
import { recordLogin, recordActivity } from "@/lib/logs";
import { appBaseUrl, clientIpFromHeaders } from "@/lib/net";
import { rateLimit, LIMITS_RL } from "@/lib/ratelimit";
import { getSettings, isOn } from "@/lib/settings";
import { logError } from "@/lib/redact";

/**
 * Route handler SSO UP (catch-all):
 *   GET /api/sso/redirect  -> mulai OAuth2 (authorization code) + parameter `state`
 *   GET /api/sso/callback  -> validasi `state`, tukar code, buat sesi lokal
 *   GET /api/sso/logout    -> hapus cookie sesi lokal & cookie SSO lama
 *
 * Diimplementasikan sendiri (bukan `createSSORouteHandlers` dari paket) karena
 * handler bawaan paket: tidak memakai `state` (rentan login CSRF), membocorkan
 * pesan error token endpoint ke klien, menerima POST pada callback, dan
 * menyimpan access/refresh token SSO di cookie tanpa enkripsi. Paket tetap
 * dipakai untuk klien HTTP OAuth (`SSOClient`).
 *
 * URL absolut dibangun dari APP_URL / pengaturan (lihat `appBaseUrl()`),
 * bukan dari header Host yang dapat dimanipulasi di balik proxy.
 * Kode galat ke halaman login: /login?sso_error=<konfigurasi|ditolak|state|
 * gagal|nonaktif|pemeliharaan|batas>.
 *
 * Tujuan redirect pasca-login TETAP (/dashboard atau /no-access) — tidak ada
 * parameter `next`/`callbackUrl` sehingga tidak ada open redirect.
 */

export const dynamic = "force-dynamic";

const IS_PROD = process.env.NODE_ENV === "production";
const STATE_COOKIE = IS_PROD ? "__Host-spmi_sso_state" : "spmi_sso_state";
const STATE_TTL_SECONDS = 600;
const HTTP_TIMEOUT_MS = 10_000;

function toLogin(origin: string, code: string) {
  const res = NextResponse.redirect(
    new URL(`/login?sso_error=${encodeURIComponent(code)}`, origin)
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SSO request timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function clip(v: unknown, max: number): string {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}

const userInclude = {
  unit: true,
  memberships: { include: { unit: { select: { name: true } } } },
} as const;

async function handleRedirect(origin: string, cfg: SsoRuntimeConfig) {
  const client = new SSOClient({
    ssoUrl: cfg.url,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    redirectUri: cfg.redirectUri,
    scope: cfg.scope,
    prompt: cfg.prompt || null,
  });
  const state = randomBytes(32).toString("base64url");
  let authUrl: string;
  try {
    authUrl = client.getAuthorizationUrl({
      redirectUri: cfg.redirectUri,
      state,
      prompt: cfg.prompt || null,
    });
  } catch (e) {
    logError("[sso] gagal membangun URL otorisasi:", e);
    return toLogin(origin, "konfigurasi");
  }
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: IS_PROD,
    // lax: cookie ikut terkirim pada navigasi GET top-level kembali dari SSO.
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  const res = NextResponse.redirect(authUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handleCallback(
  request: NextRequest,
  origin: string,
  cfg: SsoRuntimeConfig,
  ip: string
) {
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? "";
  store.delete(STATE_COOKIE); // sekali pakai

  if (params.get("error")) return toLogin(origin, "ditolak");

  const state = params.get("state") ?? "";
  if (!expected || !state || !safeEqual(state, expected)) {
    await recordLogin({
      email: "",
      success: false,
      method: "sso",
      ip,
      userAgent: request.headers.get("user-agent"),
      message: "Ditolak: parameter state SSO tidak valid",
    });
    return toLogin(origin, "state");
  }
  const code = params.get("code") ?? "";
  if (!code || code.length > 4096) return toLogin(origin, "gagal");

  const client = new SSOClient({
    ssoUrl: cfg.url,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    redirectUri: cfg.redirectUri,
    scope: cfg.scope,
    prompt: cfg.prompt || null,
  });

  let identity: SsoIdentity;
  try {
    const tokens = await withTimeout(
      client.exchangeCode(code, cfg.redirectUri),
      HTTP_TIMEOUT_MS
    );
    const info = await withTimeout(
      client.getUserInfo(tokens.access_token),
      HTTP_TIMEOUT_MS
    );
    identity = {
      username: clip(info.username, 190),
      email: clip(info.email, 190).toLowerCase(),
      name: clip(info.name, 160),
      sub: clip(info.sub, 190),
      role: clip(info.role, 40),
    };
    // Token SSO tidak disimpan — aplikasi memakai sesi lokal sendiri.
  } catch (e) {
    logError("[sso] pertukaran kode/userinfo gagal:", e);
    return toLogin(origin, "gagal");
  }
  if (!identity.username && !identity.email && !identity.sub) {
    return toLogin(origin, "gagal");
  }
  if (identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identity.email)) {
    identity.email = "";
  }

  // Cari akun lokal: utamakan username (NIDN/NIM/NIP), lalu email, lalu sso_id.
  let user =
    (identity.username
      ? await prisma.user.findFirst({
          where: { username: identity.username },
          include: userInclude,
        })
      : null) ??
    (identity.email
      ? await prisma.user.findUnique({
          where: { email: identity.email },
          include: userInclude,
        })
      : null) ??
    (identity.sub
      ? await prisma.user.findFirst({
          where: { ssoId: identity.sub },
          include: userInclude,
        })
      : null);

  let created = false;
  if (!user) {
    // Auto-provision: akun baru via SSO default sebagai Pengunjung (tanpa akses).
    user = await prisma.user.create({
      data: {
        name:
          identity.name ||
          identity.username ||
          identity.email ||
          "Pengguna SSO",
        email:
          identity.email ||
          `${(identity.username || identity.sub).replace(/[^A-Za-z0-9._-]/g, "_")}@sso.universitaspahlawan.ac.id`,
        username: identity.username || null,
        ssoId: identity.sub || null,
        password: null,
        role: resolveLocalRole(identity, cfg.adminEmails),
        isActive: true,
      },
      include: userInclude,
    });
    created = true;
  } else if (user.isActive) {
    // Sinkronkan data terbaru dari SSO (tanpa menimpa peran yang sudah diatur admin).
    let email = user.email;
    if (identity.email && identity.email !== user.email) {
      const taken = await prisma.user.findUnique({
        where: { email: identity.email },
        select: { id: true },
      });
      if (!taken) email = identity.email;
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        ssoId: identity.sub || user.ssoId,
        username: identity.username || user.username,
        name: identity.name || user.name,
        email,
      },
      include: userInclude,
    });
  }

  const ua = request.headers.get("user-agent");
  if (!user.isActive) {
    await recordLogin({
      email: user.email,
      userId: user.id,
      success: false,
      method: "sso",
      ip,
      userAgent: ua,
      message: "Akun nonaktif",
    });
    return toLogin(origin, "nonaktif");
  }

  const settings = await getSettings();
  if (isOn(settings["maintenance.enabled"]) && user.role !== "superadmin") {
    return toLogin(origin, "pemeliharaan");
  }

  await setSessionCookie({ id: user.id, sessionVersion: user.sessionVersion });
  // Bersihkan cookie token SSO peninggalan versi lama (bila ada).
  store.delete("sso_session");
  store.delete("sso_access_token");

  await recordLogin({
    email: user.email,
    userId: user.id,
    success: true,
    method: "sso",
    ip,
    userAgent: ua,
    message: created ? "Akun baru dibuat via SSO" : "Login SSO berhasil",
  });
  await recordActivity({
    userId: user.id,
    userName: user.name,
    action: created ? "sso.register" : "sso.login",
    entity: "user",
    entityId: user.id,
    ip,
  });

  const target = user.role === "pengunjung" ? "/no-access" : "/dashboard";
  const res = NextResponse.redirect(new URL(target, origin));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ sso: string[] }> }
) {
  const { sso } = await ctx.params;
  const action = sso?.length === 1 ? sso[0] : "";
  const cfg = await getSsoRuntimeConfig();
  // Origin tepercaya (APP_URL / pengaturan) — tidak pernah dari header Host.
  const origin = await appBaseUrl();

  try {
    if (action === "logout") {
      // Akhiri sesi aplikasi: cabut versi sesi bila token masih sah, hapus cookie.
      const session = await getSession();
      if (session) {
        const u = await prisma.user.findUnique({
          where: { id: session.id },
          select: { id: true, name: true, sessionVersion: true },
        });
        if (u && u.sessionVersion === session.sv) {
          await revokeUserSessions(u.id);
          await recordActivity({
            userId: u.id,
            userName: u.name,
            action: "auth.logout",
            entity: "user",
            entityId: u.id,
            ip: clientIpFromHeaders(request.headers),
          });
        }
      }
      await clearSessionCookie();
      const res = NextResponse.redirect(new URL("/login", origin));
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    if (action !== "redirect" && action !== "callback") {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }

    const ip = clientIpFromHeaders(request.headers);
    const rl = rateLimit(
      `sso:${ip}`,
      LIMITS_RL.sso.limit,
      LIMITS_RL.sso.windowMs
    );
    if (!rl.ok) return toLogin(origin, "batas");

    if (
      !cfg.enabled ||
      !cfg.clientId ||
      !cfg.clientSecret ||
      !cfg.redirectUri
    ) {
      return toLogin(origin, "konfigurasi");
    }

    return action === "redirect"
      ? await handleRedirect(origin, cfg)
      : await handleCallback(request, origin, cfg, ip);
  } catch (e) {
    logError("[sso] kesalahan tak terduga:", e);
    return toLogin(origin, "gagal");
  }
}

/** POST tidak didukung (callback OAuth hanya GET). */
export async function POST() {
  return NextResponse.json(
    { error: "Metode tidak diizinkan." },
    { status: 405, headers: { Allow: "GET" } }
  );
}
