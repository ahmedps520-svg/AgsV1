"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleUser, GraduationCap, Settings2, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { useLoad } from "@/lib/api/use-load";
import { getClassrooms, getStudents } from "@/lib/api/queries";
import type { Session } from "@/lib/api/session";
import {
  classCode,
  classLabel,
  GRADE_LEVELS,
  GRADE_SECTIONS,
  isKg,
  KG_LEVELS,
  KG_SECTIONS,
  levelLabel,
  type ClassGender,
} from "@/lib/classes";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { ClassroomRow } from "@/lib/types/database";

const LAST_CLASS_KEY = "ags-dismissal:last-class";

export function rememberClass(userId: string, code: string) {
  try {
    window.localStorage.setItem(`${LAST_CLASS_KEY}:${userId}`, code);
  } catch {
    // Preference simply won't persist.
  }
}

function recallClass(userId: string): string | null {
  try {
    return window.localStorage.getItem(`${LAST_CLASS_KEY}:${userId}`);
  } catch {
    return null;
  }
}

/**
 * Grade → boys/girls → section. Every class has its own board, so this is the
 * first thing a teacher sees after signing in.
 */
export function ClassPicker({ session }: { session: Session }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const school = session.school!;

  const load = React.useCallback(async () => {
    const [classrooms, students] = await Promise.all([
      getClassrooms(school.id),
      getStudents(school.id, { limit: 5000 }),
    ]);
    const counts: Record<string, number> = {};
    for (const student of students) {
      if (student.classroom_id && student.is_active) {
        counts[student.classroom_id] = (counts[student.classroom_id] ?? 0) + 1;
      }
    }
    return { classrooms, counts };
  }, [school.id]);

  const { data, loading } = useLoad(load);

  const [level, setLevel] = React.useState<string | null>(null);
  const [gender, setGender] = React.useState<ClassGender | null>(null);
  const [section, setSection] = React.useState<string | null>(null);

  const classrooms = React.useMemo(() => data?.classrooms ?? [], [data]);
  const byCode = React.useMemo(
    () => new Map(classrooms.map((room) => [room.name.toLowerCase(), room])),
    [classrooms],
  );

  // A shared section login only reads its own half of the school, so offer
  // exactly the levels and genders it can actually open — an account that will
  // never see a girls' class should not be shown the button.
  const available = React.useMemo(() => {
    const levels = new Set<string>();
    const genders = new Map<string, Set<ClassGender>>();
    for (const room of classrooms) {
      levels.add(room.level);
      if (!genders.has(room.level)) genders.set(room.level, new Set());
      genders.get(room.level)!.add(room.gender);
    }
    return { levels, genders };
  }, [classrooms]);

  // True only when this account can actually reach both halves of the school.
  const splitBySection = [...available.genders.values()].some(
    (set) => set.has("boys") && set.has("girls"),
  );

  const kgLevels = KG_LEVELS.filter((value) => available.levels.has(value));
  const gradeLevels = GRADE_LEVELS.filter((value) => available.levels.has(value));
  const levelGenders = level ? [...(available.genders.get(level) ?? [])] : [];

  // Kindergarten is mixed, and a boys-only account has nothing to choose
  // between — in both cases skip the step rather than show one button.
  const effectiveGender: ClassGender | null =
    level && isKg(level)
      ? "mixed"
      : levelGenders.length === 1
        ? levelGenders[0]
        : gender;
  const sections = level ? (isKg(level) ? KG_SECTIONS : GRADE_SECTIONS) : [];

  const chosenCode =
    level && effectiveGender && section
      ? classCode({ level, gender: effectiveGender, section })
      : null;
  const chosenRoom = chosenCode ? byCode.get(chosenCode.toLowerCase()) ?? null : null;

  // The teacher's own classes, plus the last one opened on this device.
  const mine = React.useMemo(() => {
    const own = classrooms.filter((room) => room.teacher_id === session.userId);
    const last = recallClass(session.userId);
    const lastRoom = last ? byCode.get(last.toLowerCase()) : null;
    const list: ClassroomRow[] = [...own];
    if (lastRoom && !list.some((room) => room.id === lastRoom.id)) list.push(lastRoom);
    return list;
  }, [classrooms, byCode, session.userId]);

  function open(code: string) {
    rememberClass(session.userId, code);
    router.push(`/board/?c=${encodeURIComponent(code)}`);
  }

  const chip = (active: boolean, disabled = false) =>
    cn(
      "tabular min-w-12 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition",
      "ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-brand-500",
      disabled && "cursor-not-allowed opacity-35",
      active
        ? "bg-brand-600 text-white ring-brand-600 shadow-soft"
        : "bg-[var(--color-surface)] text-[var(--color-ink)] ring-[var(--color-hairline)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
    );

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)]">
      <header className="glass sticky top-0 z-30 border-b border-[var(--color-hairline)] px-4 py-3">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <Logo schoolName={school.name} compact className="min-w-0 flex-1" />
          <LanguageToggle />
          {/* The picker sits outside the admin shell, so this is an
              administrator's only way back into the management screens. */}
          {session.profile.role === "admin" ? (
            <Link
              href="/students"
              aria-label={t("nav.admin")}
              className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
            >
              <Settings2 className="size-5" />
              <span className="hidden sm:inline">{t("nav.admin")}</span>
            </Link>
          ) : null}
          <Link
            href="/account"
            aria-label={t("common.account")}
            className="rounded-xl p-2 text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
          >
            <CircleUser className="size-5" />
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t("picker.title")}</h1>
        <p className="mt-1.5 text-[15px] text-[var(--color-muted)]">
          {t(splitBySection ? "picker.subtitle" : "picker.subtitleOneSection")}
        </p>

        {loading ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : (
          <>
            {mine.length > 0 ? (
              <section className="mt-7" aria-label={t("picker.recent")}>
                <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  <Star className="size-3.5 text-gold-600" />
                  {t("picker.recent")}
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {mine.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => open(room.name)}
                      className="surface-card group flex items-center gap-3 px-4 py-3 text-start transition hover:shadow-lift"
                    >
                      <span className="code text-xl font-extrabold tracking-tight text-brand-700 dark:text-brand-300">
                        {room.name}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">{classLabel(room, locale)}</span>
                        <span className="block text-[12px] text-[var(--color-muted)]">
                          {t("picker.studentsCount", { count: data?.counts[room.id] ?? 0 })}
                        </span>
                      </span>
                      <ArrowRight className="ms-1 size-4 text-[var(--color-muted)] transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Step 1 — level */}
            <section className="mt-8">
              {kgLevels.length > 0 ? (
                <>
              <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                {t("picker.kindergarten")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {kgLevels.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={chip(level === value)}
                    onClick={() => {
                      setLevel(value);
                      setGender(null);
                      setSection(null);
                    }}
                  >
                    {levelLabel(value, locale)}
                  </button>
                ))}
              </div>
                </>
              ) : null}

              {gradeLevels.length > 0 ? (
                <>
              <h2 className={cn(
                "mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]",
                kgLevels.length > 0 && "mt-6",
              )}>
                {t("picker.grades")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {gradeLevels.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={chip(level === value)}
                    onClick={() => {
                      setLevel(value);
                      setSection(null);
                    }}
                    aria-label={levelLabel(value, locale)}
                  >
                    {value}
                  </button>
                ))}
              </div>
                </>
              ) : null}
            </section>

            {/* Step 2 — boys / girls */}
            {level && !isKg(level) && levelGenders.length > 1 ? (
              <section className="mt-7 animate-[rise_0.4s_ease-out_both]">
                <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  {t("classes.gender")}
                </h2>
                <div className="grid max-w-md grid-cols-2 gap-2.5">
                  {(["boys", "girls"] as const)
                    .filter((value) => levelGenders.includes(value))
                    .map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setGender(value);
                        setSection(null);
                      }}
                      className={cn(
                        "rounded-2xl px-4 py-4 text-lg font-bold transition ring-1 ring-inset",
                        gender === value
                          ? "bg-brand-600 text-white ring-brand-600 shadow-soft"
                          : "bg-[var(--color-surface)] ring-[var(--color-hairline)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                      )}
                    >
                      {t(value === "boys" ? "picker.boys" : "picker.girls")}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Step 3 — section */}
            {level && effectiveGender ? (
              <section className="mt-7 animate-[rise_0.4s_ease-out_both]">
                <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  {t("picker.section")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {sections.map((value) => {
                    const code = classCode({ level, gender: effectiveGender, section: value });
                    const room = byCode.get(code.toLowerCase());
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!room}
                        title={room ? code : t("picker.noClass")}
                        className={cn(chip(section === value, !room), "flex-col gap-0 py-2")}
                        onClick={() => setSection(value)}
                      >
                        <span className="code text-base">{code}</span>
                        <span className="text-[11px] font-medium opacity-70">
                          {room ? t("picker.studentsCount", { count: data?.counts[room.id] ?? 0 }) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {sections.every((value) => !byCode.get(classCode({ level, gender: effectiveGender, section: value }).toLowerCase())) ? (
                  <p className="mt-3 text-[13px] text-[var(--color-muted)]">{t("picker.noClass")}</p>
                ) : null}
              </section>
            ) : null}

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="xl" disabled={!chosenRoom} onClick={() => chosenRoom && open(chosenRoom.name)}>
                <GraduationCap className="size-5" />
                {t("picker.open")}
                {chosenCode ? <span className="code ms-1 rounded-lg bg-white/15 px-2 py-0.5 text-base">{chosenCode}</span> : null}
              </Button>
              <SignOutButton />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
