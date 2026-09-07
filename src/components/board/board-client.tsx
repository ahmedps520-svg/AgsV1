"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Hash,
  Maximize2,
  Megaphone,
  Minimize2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { LiveDot } from "@/components/ui/primitives";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { fetchQueue } from "@/lib/live-queries";
import { BoardClock } from "@/components/board/board-clock";
import { playChime, unlockAudio } from "@/components/board/chime";
import { studentSubtitle } from "@/lib/dismissal";
import { cn, formatTime } from "@/lib/utils";
import type { DismissalQueueRow, SchoolRow } from "@/lib/types/database";

const RECENT_LIMIT = 6;

export function BoardClient({
  school,
  initialQueue,
  today,
}: {
  school: SchoolRow;
  initialQueue: DismissalQueueRow[];
  today: string;
}) {
  const load = React.useCallback(() => fetchQueue(school.id, today), [school.id, today]);

  const { rows, connection } = useLiveQueue<DismissalQueueRow>({
    channelName: `dismissal-board:${school.id}`,
    filter: `school_id=eq.${school.id}`,
    initial: initialQueue,
    load,
    pollMs: 20_000,
  });

  const [soundOn, setSoundOn] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [idleChrome, setIdleChrome] = React.useState(false);

  /* ------------------------------------------------------------ selection */

  const called = React.useMemo(
    () =>
      rows
        .filter((row) => row.status === "called" && row.called_at)
        .sort((a, b) => new Date(b.called_at!).getTime() - new Date(a.called_at!).getTime()),
    [rows],
  );

  const ready = React.useMemo(
    () =>
      rows
        .filter((row) => row.status === "ready" && row.ready_at)
        .sort((a, b) => new Date(b.ready_at!).getTime() - new Date(a.ready_at!).getTime()),
    [rows],
  );

  // The hero is the most recently called student; if none is mid-call we fall
  // back to the newest student standing ready at the door.
  const hero = called[0] ?? ready[0] ?? null;

  const recent = React.useMemo(
    () =>
      rows
        .filter((row) => row.called_at && row.id !== hero?.id && row.status !== "cancelled")
        .sort((a, b) => new Date(b.called_at!).getTime() - new Date(a.called_at!).getTime())
        .slice(0, RECENT_LIMIT),
    [rows, hero?.id],
  );

  const waitingCount = rows.filter(
    (row) => row.status === "waiting" || row.status === "requested",
  ).length;

  /* ---------------------------------------------------------------- chime */

  const lastHeroId = React.useRef<string | null>(hero?.id ?? null);
  React.useEffect(() => {
    if (hero?.id && hero.id !== lastHeroId.current) {
      lastHeroId.current = hero.id;
      if (soundOn) playChime();
    }
    if (!hero) lastHeroId.current = null;
  }, [hero?.id, hero, soundOn]);

  /* ----------------------------------------------------------- fullscreen */

  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers block this outside a user gesture; nothing to recover.
    }
  }

  // Fade the controls away on an unattended display.
  React.useEffect(() => {
    let timer = window.setTimeout(() => setIdleChrome(true), 6000);
    const wake = () => {
      setIdleChrome(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdleChrome(true), 6000);
    };

    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  const heroTime = hero?.status === "ready" ? hero.ready_at : hero?.called_at;

  return (
    <div
      className={cn(
        "board-root flex min-h-dvh flex-col",
        idleChrome && fullscreen && "board-immersive",
      )}
    >
      {/* ------------------------------------------------------------ header */}
      <header className="flex items-center justify-between gap-6 px-[3vw] pt-[2.5vh]">
        <div className="flex min-w-0 items-center gap-4">
          <LogoMark className="size-[clamp(2.25rem,3.4vw,3.5rem)] rounded-2xl" />
          <div className="min-w-0">
            <p className="truncate text-[clamp(1.1rem,2.1vw,2.15rem)] font-bold leading-tight tracking-[-0.02em]">
              {school.name}
            </p>
            <p className="flex items-center gap-2 text-[clamp(0.7rem,0.95vw,1rem)] font-semibold uppercase tracking-[0.18em] text-[var(--board-muted)]">
              <LiveDot connected={connection === "live"} />
              Dismissal board
            </p>
          </div>
        </div>

        <BoardClock timeZone={school.timezone} />
      </header>

      {/* --------------------------------------------------------- main area */}
      <main className="flex min-h-0 flex-1 flex-col gap-[2vh] px-[3vw] py-[2.5vh] xl:flex-row xl:gap-[2.5vw]">
        {/* Hero */}
        <section
          aria-live="polite"
          aria-atomic="true"
          className="flex min-w-0 flex-1 flex-col justify-center"
        >
          <AnimatePresence mode="wait">
            {hero ? (
              <motion.div
                key={hero.id}
                initial={{ opacity: 0, y: 34, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -22, filter: "blur(8px)" }}
                transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
                className="min-w-0"
              >
                <motion.p
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="flex items-center gap-3 text-[clamp(0.85rem,1.5vw,1.6rem)] font-bold uppercase tracking-[0.28em] text-brand-300"
                >
                  <Megaphone className="size-[1em]" />
                  {hero.status === "ready" ? "Ready for pickup" : "Now dismissing"}
                </motion.p>

                <h1 className="board-hero-name mt-[2.5vh]">{hero.student_name}</h1>

                <p className="board-hero-sub mt-[2vh] font-semibold text-[var(--board-muted)]">
                  {studentSubtitle(hero) || "Ready at the pickup point"}
                </p>

                <div className="mt-[3vh] flex flex-wrap items-center gap-x-6 gap-y-3">
                  <p className="tabular text-[clamp(1rem,1.9vw,2rem)] font-medium text-[var(--board-muted)]">
                    Called at{" "}
                    <span className="font-bold text-[var(--board-ink)]">
                      {formatTime(heroTime, school.timezone)}
                    </span>
                  </p>

                  {school.show_pickup_number && hero.pickup_number ? (
                    <span className="tabular inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-[clamp(1rem,1.9vw,2rem)] font-extrabold">
                      <Hash className="size-[0.85em] opacity-60" />
                      {hero.pickup_number}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p className="text-[clamp(0.85rem,1.5vw,1.6rem)] font-bold uppercase tracking-[0.28em] text-brand-300">
                  Dismissal board
                </p>
                <h1 className="board-idle-title mt-[2.5vh] font-extrabold">
                  {waitingCount > 0 ? "Getting ready…" : "No students called yet"}
                </h1>
                <p className="board-hero-sub mt-[2vh] max-w-[22ch] font-medium text-[var(--board-muted)]">
                  {waitingCount > 0
                    ? `${waitingCount} ${waitingCount === 1 ? "family is" : "families are"} waiting. Names appear here the moment they're called.`
                    : "When staff call a student, their name appears here instantly."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Rail */}
        <aside className="flex w-full shrink-0 flex-col gap-[1.5vh] xl:w-[30vw] xl:max-w-[28rem]">
          {ready.length > 0 ? (
            <BoardList
              title="At the pickup point"
              tone="emerald"
              rows={hero && hero.status === "ready" ? ready.slice(1) : ready}
              timeZone={school.timezone}
              timeField="ready_at"
              showPickupNumber={school.show_pickup_number}
            />
          ) : null}

          <BoardList
            title="Recently called"
            tone="brand"
            rows={recent}
            timeZone={school.timezone}
            timeField="called_at"
            showPickupNumber={school.show_pickup_number}
            emptyLabel="Nothing called yet"
          />
        </aside>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-[3vw] py-[2vh]">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[clamp(0.8rem,1.15vw,1.25rem)] font-semibold">
          <span className="inline-flex items-center gap-2.5">
            <Users className="size-[1.1em] text-amber-400" />
            <span className="tabular">{waitingCount}</span>
            <span className="font-medium text-[var(--board-muted)]">waiting</span>
          </span>
          <span className="inline-flex items-center gap-2.5">
            <Megaphone className="size-[1.1em] text-brand-300" />
            <span className="tabular">{called.length}</span>
            <span className="font-medium text-[var(--board-muted)]">called</span>
          </span>
          <span className="inline-flex items-center gap-2.5">
            <span className="size-[0.7em] rounded-full bg-emerald-400" aria-hidden />
            <span className="tabular">{ready.length}</span>
            <span className="font-medium text-[var(--board-muted)]">ready</span>
          </span>

          {school.board_message ? (
            <span className="max-w-[46ch] font-medium text-[var(--board-muted)]">
              {school.board_message}
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-2 transition-opacity duration-500",
            idleChrome ? "opacity-0" : "opacity-100",
          )}
        >
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              if (next && !unlockAudio()) return;
              setSoundOn(next);
              if (next) playChime();
            }}
            aria-pressed={soundOn}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-semibold transition hover:bg-white/[0.16]"
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {soundOn ? "Chime on" : "Chime off"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-semibold transition hover:bg-white/[0.16]"
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BoardList({
  title,
  rows,
  timeZone,
  timeField,
  tone,
  showPickupNumber,
  emptyLabel,
}: {
  title: string;
  rows: DismissalQueueRow[];
  timeZone: string;
  timeField: "called_at" | "ready_at";
  tone: "brand" | "emerald";
  showPickupNumber: boolean;
  emptyLabel?: string;
}) {
  if (rows.length === 0 && !emptyLabel) return null;

  return (
    <section className="min-h-0 flex-1 rounded-3xl bg-[var(--board-elevated)]/70 p-[1.6vh] ring-1 ring-white/10 backdrop-blur-sm">
      <h2 className="px-2 text-[clamp(0.68rem,0.9vw,0.95rem)] font-bold uppercase tracking-[0.2em] text-[var(--board-muted)]">
        {title}
      </h2>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-[clamp(0.85rem,1.1vw,1.15rem)] text-[var(--board-muted)]">
          {emptyLabel}
        </p>
      ) : (
        <ul className="mt-[1vh] space-y-[0.7vh]">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.li
                key={row.id}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-[1vh]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    tone === "emerald" ? "bg-emerald-400" : "bg-brand-400",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[clamp(1rem,1.5vw,1.6rem)] font-bold leading-tight">
                    {row.student_name}
                  </span>
                  <span className="block truncate text-[clamp(0.72rem,0.95vw,1.05rem)] text-[var(--board-muted)]">
                    {studentSubtitle(row)}
                  </span>
                </span>

                {showPickupNumber && row.pickup_number ? (
                  <span className="tabular shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[clamp(0.72rem,0.95vw,1.05rem)] font-bold">
                    {row.pickup_number}
                  </span>
                ) : null}

                <span className="tabular shrink-0 text-[clamp(0.72rem,0.95vw,1.05rem)] font-semibold text-[var(--board-muted)]">
                  {formatTime(row[timeField], timeZone)}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
