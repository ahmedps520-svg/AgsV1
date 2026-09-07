"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  GraduationCap,
  LayoutGrid,
  Menu,
  MonitorSpeaker,
  Settings,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

const ICONS = {
  LayoutGrid,
  MonitorSpeaker,
  GraduationCap,
  Users,
  UsersRound,
  CalendarClock,
  Settings,
} as const;

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  adminOnly?: boolean;
  external?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dismissal", icon: "LayoutGrid" },
  { href: "/board", label: "Display board", icon: "MonitorSpeaker", external: true },
  { href: "/students", label: "Students", icon: "GraduationCap" },
  { href: "/classrooms", label: "Classes", icon: "Users" },
  { href: "/people", label: "People", icon: "UsersRound", adminOnly: true },
  { href: "/history", label: "History", icon: "CalendarClock" },
  { href: "/settings", label: "Settings", icon: "Settings", adminOnly: true },
];

export function AppShell({
  schoolName,
  userName,
  userEmail,
  role,
  children,
}: {
  schoolName: string;
  userName: string;
  userEmail: string | null;
  role: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Remembering *where* the drawer was opened means it closes itself on
  // navigation — including browser back — with no effect and no stale state.
  const [openedAt, setOpenedAt] = React.useState<string | null>(null);
  const menuOpen = openedAt === pathname;
  const setMenuOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  const items = NAV.filter((item) => !item.adminOnly || role === "admin");

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white shadow-soft"
                : "text-[var(--color-muted)] hover:bg-black/[0.05] hover:text-[var(--color-ink)] dark:hover:bg-white/[0.07]",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.external ? (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-60">
                TV
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-[var(--color-hairline)] p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <Avatar name={userName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{userName}</p>
          <p className="truncate text-[11.5px] text-[var(--color-muted)]">
            <span className="capitalize">{role === "admin" ? "Administrator" : role}</span>
            {userEmail ? ` · ${userEmail}` : ""}
          </p>
        </div>
      </div>
      <SignOutButton compact className="mt-1" />
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--color-surface)] lg:flex">
        <div className="min-w-0 px-5 py-5">
          <Logo schoolName={schoolName} compact />
        </div>
        {nav}
        {account}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="relative flex h-full w-72 flex-col bg-[var(--color-surface)] shadow-pop"
            >
              <div className="flex items-center justify-between gap-2 px-5 py-5">
                <Logo schoolName={schoolName} compact />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="size-5" />
                </button>
              </div>
              {nav}
              {account}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-hairline)] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-[var(--color-ink)] transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Menu className="size-5" />
          </button>
          <LogoMark className="size-8" />
          <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-[-0.02em]" title={schoolName}>
            {schoolName}
          </p>
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
