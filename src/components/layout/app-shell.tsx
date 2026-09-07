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
  Settings,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { Avatar } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";
import type { MessageKey } from "@/lib/i18n/dictionary";

const ICONS = { LayoutGrid, GraduationCap, Users, UsersRound, CalendarClock, Settings } as const;

interface NavItem {
  href: string;
  labelKey: MessageKey;
  icon: keyof typeof ICONS;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/board/", labelKey: "nav.board", icon: "LayoutGrid" },
  { href: "/students", labelKey: "nav.students", icon: "GraduationCap" },
  { href: "/classrooms", labelKey: "nav.classes", icon: "Users" },
  { href: "/people", labelKey: "nav.people", icon: "UsersRound", adminOnly: true },
  { href: "/history", labelKey: "nav.history", icon: "CalendarClock" },
  { href: "/settings", labelKey: "nav.settings", icon: "Settings", adminOnly: true },
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
  const { t, dir } = useI18n();

  // Remembering *where* the drawer was opened means it closes itself on
  // navigation — including browser back — with no effect and no stale state.
  const [openedAt, setOpenedAt] = React.useState<string | null>(null);
  const menuOpen = openedAt === pathname;
  const setMenuOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  const items = NAV.filter((item) => !item.adminOnly || role === "admin");

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3" aria-label={t("nav.admin")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const clean = item.href.replace(/\/$/, "");
        const active = pathname === clean || pathname === item.href || pathname.startsWith(`${clean}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white shadow-soft"
                : "text-[var(--color-muted)] hover:bg-black/[0.05] hover:text-[var(--color-ink)] dark:hover:bg-white/[0.07]",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
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
          <p className="truncate text-[11.5px] text-[var(--color-muted)]" dir="ltr">
            {t(`role.${role}`)}
            {userEmail ? ` · ${userEmail}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-1 px-2">
        <LanguageToggle className="w-full justify-center" />
      </div>
      <SignOutButton compact className="mt-1" label={t("common.signOut")} />
    </div>
  );

  const drawerOffset = dir === "rtl" ? "100%" : "-100%";

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-[var(--color-hairline)] bg-[var(--color-surface)] lg:flex">
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
              initial={{ x: drawerOffset }}
              animate={{ x: 0 }}
              exit={{ x: drawerOffset }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="relative flex h-full w-72 flex-col bg-[var(--color-surface)] shadow-pop"
            >
              <div className="flex items-center justify-between gap-2 px-5 py-5">
                <Logo schoolName={schoolName} compact />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t("nav.closeMenu")}
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
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-hairline)] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.openMenu")}
            className="rounded-lg p-2 text-[var(--color-ink)] transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Menu className="size-5" />
          </button>
          <LogoMark className="size-8" />
          <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-[-0.02em]" title={schoolName}>
            {schoolName}
          </p>
          <LanguageToggle />
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
