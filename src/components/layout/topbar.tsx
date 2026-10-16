import type { SessionUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="surface-bar sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-indigo-400/10 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white sm:text-base">
          Selamat datang, {user.name.split(" ")[0]} 👋
        </p>
        <p className="truncate text-[11px] text-slate-400 sm:text-xs">
          {ROLE_LABEL[user.role]}
          {user.unitName ? ` — ${user.unitName}` : " — Lembaga Penjaminan Mutu"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} />
        <MobileMenuButton />
      </div>
    </header>
  );
}
