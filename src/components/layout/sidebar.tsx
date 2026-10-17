"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useMobileMenu } from "@/components/layout/mobile-menu";
import { Logo } from "@/components/ui/logo";
import { useFocusTrap, useScrollLock } from "@/components/ui/use-focus-trap";

type Branding = {
  logo: string;
  shortName: string;
  name: string;
  subtitle: string;
};

export const MOBILE_NAV_ID = "navigasi-mobile";

export function Sidebar({
  user,
  branding,
}: {
  user: SessionUser;
  branding: Branding;
}) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileMenu();
  const drawerRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));
  useScrollLock(open);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <>
      {/* Sidebar desktop */}
      <div className="surface-side fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-indigo-400/10 backdrop-blur-xl lg:flex">
        <SidebarContent items={items} pathname={pathname} branding={branding} />
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={drawerRef}
              id={MOBILE_NAV_ID}
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              tabIndex={-1}
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="surface-side-solid absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-indigo-400/15 focus:outline-none"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="absolute right-2 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <SidebarContent
                items={items}
                pathname={pathname}
                branding={branding}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({
  items,
  pathname,
  branding,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
  branding: Branding;
}) {
  return (
    <>
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-indigo-400/10 px-5 pr-14 lg:pr-5"
      >
        <Logo
          src={branding.logo}
          name={branding.name}
          shortName={branding.shortName}
          size={36}
          decorative
          className="rounded-xl"
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">
            {branding.shortName}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {branding.subtitle}
          </span>
        </span>
      </Link>

      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-gradient-to-r from-indigo-500/25 to-violet-500/10 font-medium text-white shadow-inner ring-1 ring-indigo-400/25"
                      : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-100"
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active
                        ? "text-indigo-300"
                        : "text-slate-500 group-hover:text-indigo-300"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-indigo-400/10 px-5 py-3 text-xs text-slate-500">
        <Link
          href="/kebijakan-privasi"
          className="hover:text-indigo-300 hover:underline"
        >
          Kebijakan Privasi
        </Link>
        <span aria-hidden="true"> · </span>
        <Link
          href="/syarat-ketentuan"
          className="hover:text-indigo-300 hover:underline"
        >
          Syarat &amp; Ketentuan
        </Link>
      </div>
    </>
  );
}
