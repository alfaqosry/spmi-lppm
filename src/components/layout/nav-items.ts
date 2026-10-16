import {
  LayoutDashboard,
  CalendarClock,
  Building2,
  FileCheck2,
  FileSearch,
  Activity,
  ClipboardList,
  BarChart3,
  UserCog,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: SessionUser["role"][];
};

const ALL: SessionUser["role"][] = [
  "superadmin",
  "lpm_admin",
  "lpm_member",
  "auditee_head",
  "auditee_member",
];

/** Peran LPM (admin, superadmin & anggota): dapat mengelola instrumen, mengisi & verifikasi. */
const LPM: SessionUser["role"][] = ["superadmin", "lpm_admin", "lpm_member"];

/** Admin (Admin LPM & Superadmin): kelola akun, unit, siklus, dan role. */
const ADMIN: SessionUser["role"][] = ["superadmin", "lpm_admin"];

/** Hanya Superadmin: pengaturan sistem. */
const SUPERADMIN: SessionUser["role"][] = ["superadmin"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  {
    href: "/siklus",
    label: "Siklus & Periode",
    icon: CalendarClock,
    roles: ADMIN,
  },
  {
    href: "/unit",
    label: "Unit Audit",
    icon: Building2,
    roles: ADMIN,
  },
  {
    href: "/role-penempatan",
    label: "Role & Penempatan",
    icon: UserCog,
    roles: ADMIN,
  },
  {
    href: "/penetapan",
    label: "Penetapan",
    icon: FileCheck2,
    roles: ALL,
  },
  { href: "/evaluasi", label: "Evaluasi", icon: FileSearch, roles: ALL },
  { href: "/monev", label: "Monev", icon: Activity, roles: ALL },
  {
    href: "/audit",
    label: "Audit & Verifikasi",
    icon: ClipboardList,
    roles: ALL,
  },
  {
    href: "/analitik",
    label: "Analitik & Laporan",
    icon: BarChart3,
    roles: LPM,
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    icon: Settings,
    roles: SUPERADMIN,
  },
];
