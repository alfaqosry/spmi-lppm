"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useMobileMenu } from "@/components/layout/mobile-menu";

export function Sidebar({
  user,
  branding,
}: {
  user: SessionUser;
  branding: { logo: string; shortName: string; name: string; subtitle: string };
}) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileMenu();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="surface-side fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-indigo-400/10 backdrop-blur-xl lg:flex">
        <SidebarContent items={items} pathname={pathname} branding={branding} />
      </aside>

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
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="surface-side-solid absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-indigo-400/15"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-500/10 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent
                items={items}
                pathname={pathname}
                branding={branding}
              />
            </motion.aside>
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
  branding: { logo: string; shortName: string; name: string; subtitle: string };
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-indigo-400/10 px-5">
        {branding.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo}
            alt={branding.name}
            className="h-9 w-9 shrink-0 rounded-xl border border-indigo-400/20 object-contain p-0.5"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-on-accent shadow-lg shadow-indigo-900/40">
            {branding.shortName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="leading-tight">
          <p className="truncate text-sm font-semibold text-white">
            {branding.shortName}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {branding.subtitle}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-gradient-to-r from-indigo-500/25 to-violet-500/10 text-white shadow-inner ring-1 ring-indigo-400/25"
                  : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-100"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  active ? "text-indigo-300" : "text-slate-500 group-hover:text-indigo-300"
                }`}
              />
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
