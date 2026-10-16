import { NextResponse, type NextRequest } from "next/server";
import { createSSORouteHandlers } from "@alfaqosry/sso-client-next/next";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, buildSessionUser } from "@/lib/auth";
import {
  getSsoRuntimeConfig,
  resolveLocalRole,
  type SsoIdentity,
} from "@/lib/sso";
import { recordLogin, recordActivity } from "@/lib/logs";

/**
 * Route handler SSO UP (catch-all) — /api/sso/redirect, /api/sso/callback, /api/sso/logout
 *
 * Setelah SSO berhasil, identitas pengguna disinkronkan ke database lokal
 * lalu sesi aplikasi (cookie JWT) dibuat sehingga RBAC internal tetap berlaku.
 * Konfigurasi SSO dibaca dari pengaturan (DB) sehingga dapat diubah dari UI.
 */
async function buildHandlers() {
  const cfg = await getSsoRuntimeConfig();
  return createSSORouteHandlers({
    config: {
      ssoUrl: cfg.url,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
      scope: cfg.scope,
      prompt: cfg.prompt || null,
    },
    redirectTo: "/dashboard",
    roleRedirects: {
      admin: "/dashboard",
      lpm: "/dashboard",
    },
    onAuthenticated: async (userInfo) => {
      const identity: SsoIdentity = {
        username: String(userInfo.username ?? "").trim(),
        email: String(userInfo.email ?? "")
          .trim()
          .toLowerCase(),
        name: String(userInfo.name ?? "").trim(),
        sub: String(userInfo.sub ?? ""),
        role: String(userInfo.role ?? ""),
      };

      // Cari akun lokal: utamakan username (NIDN/NIM/NIP), lalu email, lalu sso_id.
      let user =
        (identity.username
          ? await prisma.user.findFirst({
              where: { username: identity.username },
              include: {
                unit: true,
                memberships: { include: { unit: { select: { name: true } } } },
              },
            })
          : null) ??
        (identity.email
          ? await prisma.user.findUnique({
              where: { email: identity.email },
              include: {
                unit: true,
                memberships: { include: { unit: { select: { name: true } } } },
              },
            })
          : null) ??
        (identity.sub
          ? await prisma.user.findFirst({
              where: { ssoId: identity.sub },
              include: {
                unit: true,
                memberships: { include: { unit: { select: { name: true } } } },
              },
            })
          : null);

      let created = false;
      if (!user) {
        // Auto-provision: akun baru via SSO default sebagai Pengunjung (tanpa akses).
        user = await prisma.user.create({
          data: {
            name: identity.name || identity.username || identity.email,
            email:
              identity.email ||
              `${identity.username || identity.sub}@sso.universitaspahlawan.ac.id`,
            username: identity.username || null,
            ssoId: identity.sub || null,
            password: null,
            role: resolveLocalRole(identity, cfg.adminEmails),
            isActive: true,
          },
          include: {
            unit: true,
            memberships: { include: { unit: { select: { name: true } } } },
          },
        });
        created = true;
      } else if (user.isActive) {
        // Sinkronkan data terbaru dari SSO (tanpa menimpa peran yang sudah diatur admin).
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ssoId: identity.sub || user.ssoId,
            username: identity.username || user.username,
            name: identity.name || user.name,
            email: identity.email || user.email,
          },
          include: {
            unit: true,
            memberships: { include: { unit: { select: { name: true } } } },
          },
        });
      }

      const session = buildSessionUser(user);
      await setSessionCookie(session);

      await recordLogin({
        email: user.email,
        userId: user.id,
        success: true,
        method: "sso",
        message: created ? "Akun baru dibuat via SSO" : "Login SSO berhasil",
      });
      await recordActivity({
        userId: user.id,
        userName: user.name,
        action: created ? "sso.register" : "sso.login",
        entity: "user",
        entityId: user.id,
      });
    },
  });
}

export async function GET(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.endsWith("/logout")) {
    const cfg = await getSsoRuntimeConfig();
    if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) {
      return NextResponse.redirect(
        new URL("/login?sso_error=konfigurasi", request.url)
      );
    }
  }
  const handlers = await buildHandlers();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const handlers = await buildHandlers();
  return handlers.POST(request);
}
