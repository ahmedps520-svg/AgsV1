"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleUser,
  DoorOpen,
  Maximize2,
  Megaphone,
  Minimize2,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { useLoad } from "@/lib/api/use-load";
import { getClassroomByCode, getClassRoster, getQueue, schoolToday } from "@/lib/api/queries";
import {
  callStudentManuallyAction,
  dismissStudentAction,
  undoDismissAction,
} from "@/lib/api/mutations";
import type { Session } from "@/lib/api/session";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { boardState, type BoardState } from "@/lib/dismissal";
import { classLabel } from "@/lib/classes";
import { cn, formatTime } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { BoardClock } from "@/components/board/board-clock";
import { playChime, unlockAudio } from "@/components/board/chime";
import { useToast } from "@/components/ui/toast";
import { LiveDot } from "@/components/ui/primitives";
import { rememberClass } from "@/components/board/class-picker";
import { BackLink } from "@/components/layout/back-link";
import type { DismissalQueueRow, StudentRow } from "@/lib/types/database";

const NO_ROWS: DismissalQueueRow[] = [];

interface Tile {
  student: StudentRow;
  request: DismissalQueueRow | null;
  state: BoardState;
}

/**
 * One class, one board.
 *
 * Every name in the class is a tile. A parent's call turns it yellow; the
 * teacher taps the door icon when the student leaves and it turns grey. The
 * same screen serves a teacher's laptop, a tablet by the door, or a wall
 * display signed in as a read-only classroom account.
 */
export function ClassBoard({ session, code }: { session: Session; code: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const school = session.school!;
  const today = schoolToday(school.timezone);

  const loadRoom = React.useCallback(() => getClassroomByCode(school.id, code), [school.id, code]);
  const { data: room, loading: roomLoading } = useLoad(loadRoom);

  const loadRoster = React.useCallback(
    () => (room ? getClassRoster(room.id) : Promise.resolve([] as StudentRow[])),
    [room],
  );
  const { data: roster } = useLoad(loadRoster, Boolean(room));

  const loadQueue = React.useCallback(() => getQueue(school.id, today), [school.id, today]);
  const { rows, connection, refresh } = useLiveQueue<DismissalQueueRow>({
    channelName: `class-board:${school.id}:${code}`,
    filter: `school_id=eq.${school.id}`,
    initial: NO_ROWS,
    load: loadQueue,
    pollMs: 20_000,
  });

  React.useEffect(() => {
    if (room) rememberClass(session.userId, room.name);
  }, [room, session.userId]);

  /* ------------------------------------------------------------- compose */

  const tiles = React.useMemo<Tile[]>(() => {
    if (!roster) return [];

    const latest = new Map<string, DismissalQueueRow>();
    for (const row of rows) {
      if (row.status === "cancelled") continue;
      const previous = latest.get(row.student_id);
      if (!previous || row.requested_at > previous.requested_at) latest.set(row.student_id, row);
    }

    const rank: Record<BoardState, number> = { called: 0, present: 1, dismissed: 2 };

    return roster
      .map((student) => {
        const request = latest.get(student.id) ?? null;
        return { student, request, state: boardState(request) };
      })
      .sort((a, b) => {
        if (a.state !== b.state) return rank[a.state] - rank[b.state];
        if (a.state === "called") {
          return (a.request?.called_at ?? "").localeCompare(b.request?.called_at ?? "");
        }
        if (a.state === "dismissed") {
          return (b.request?.picked_up_at ?? "").localeCompare(a.request?.picked_up_at ?? "");
        }
        return (
          a.student.first_name.localeCompare(b.student.first_name) ||
          a.student.last_name.localeCompare(b.student.last_name)
        );
      });
  }, [roster, rows]);

  const counts = React.useMemo(
    () => ({
      called: tiles.filter((tile) => tile.state === "called").length,
      present: tiles.filter((tile) => tile.state === "present").length,
      dismissed: tiles.filter((tile) => tile.state === "dismissed").length,
    }),
    [tiles],
  );

  /* --------------------------------------------------------------- chime */

  const [soundOn, setSoundOn] = React.useState(false);
  const knownCalled = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    const current = new Set(tiles.filter((tile) => tile.state === "called").map((tile) => tile.student.id));
    if (knownCalled.current === null) {
      knownCalled.current = current;
      return;
    }
    let fresh = false;
    current.forEach((id) => {
      if (!knownCalled.current!.has(id)) fresh = true;
    });
    knownCalled.current = current;
    if (fresh && soundOn) playChime();
  }, [tiles, soundOn]);

  /* ---------------------------------------------------------- fullscreen */

  const [fullscreen, setFullscreen] = React.useState(false);
  const [idleAt, setIdleAt] = React.useState(false);
  // Controls only fade on an unattended fullscreen board; at a desk they stay.
  const idleChrome = fullscreen && idleAt;

  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  React.useEffect(() => {
    if (!fullscreen) return;

    let timer = window.setTimeout(() => setIdleAt(true), 6000);
    const wake = () => {
      setIdleAt(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdleAt(true), 6000);
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
  }, [fullscreen]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Blocked outside a user gesture; nothing to recover.
    }
  }

  /* ------------------------------------------------------------- actions */

  const [pending, setPending] = React.useState<Set<string>>(new Set());

  async function run(studentId: string, task: () => Promise<{ ok: boolean; error?: string }>, okMessage: string) {
    setPending((current) => new Set(current).add(studentId));
    const result = await task();
    setPending((current) => {
      const next = new Set(current);
      next.delete(studentId);
      return next;
    });
    if (!result.ok) {
      toast.error(t("board.toast.failed"), result.error);
    } else {
      toast.success(okMessage);
    }
    void refresh();
  }

  const name = (student: StudentRow) => `${student.first_name} ${student.last_name}`.trim();

  /* ---------------------------------------------------------------- view */

  if (roomLoading) {
    return <div className="board-root min-h-dvh" />;
  }

  if (!room) {
    return (
      <div className="board-root flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <LogoMark className="size-16" />
        <p className="code mt-6 text-4xl font-extrabold">{code}</p>
        <p className="mt-3 max-w-md text-lg text-[var(--board-muted)]">{t("picker.noClass")}</p>
        <BackLink
          href="/board/"
          labelKey="picker.changeClass"
          tone="dark"
          className="mt-8 px-4 py-2.5 text-sm font-semibold"
        />
      </div>
    );
  }

  return (
    <div className={cn("board-root flex min-h-dvh flex-col", idleChrome && fullscreen && "board-immersive")}>
      {/* ------------------------------------------------------------ header */}
      <header className="flex flex-wrap items-start justify-between gap-4 px-[3vw] pt-[2vh]">
        <div className="flex min-w-0 items-center gap-4">
          <LogoMark className="size-[clamp(2.5rem,3.6vw,3.75rem)]" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[clamp(0.7rem,0.95vw,1rem)] font-semibold uppercase tracking-[0.16em] text-[var(--board-muted)]">
              <LiveDot connected={connection === "live"} />
              <span className="truncate">{school.name}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
              <h1 className="code text-[clamp(2rem,4.2vw,4.25rem)] font-extrabold leading-none tracking-[-0.03em]">
                {room.name}
              </h1>
              <p className="text-[clamp(0.95rem,1.4vw,1.5rem)] font-semibold text-[var(--board-muted)]">
                {classLabel(room, locale)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <BoardClock timeZone={school.timezone} />
          <div
            className={cn(
              "flex flex-wrap items-center justify-end gap-2 transition-opacity duration-500",
              idleChrome ? "opacity-0" : "opacity-100",
            )}
          >
            <LanguageToggle tone="dark" />
            <BackLink href="/board/" labelKey="picker.changeClass" tone="dark" className="px-3 py-2 text-[13px] font-semibold" />
            <button
              type="button"
              onClick={() => {
                const next = !soundOn;
                if (next && !unlockAudio()) return;
                setSoundOn(next);
                if (next) playChime();
              }}
              aria-pressed={soundOn}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-semibold hover:bg-white/[0.16]"
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {t(soundOn ? "board.chimeOn" : "board.chimeOff")}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-semibold hover:bg-white/[0.16]"
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {t(fullscreen ? "board.exitFullscreen" : "board.fullscreen")}
            </button>
            <Link
              href="/account"
              aria-label={t("common.account")}
              className="rounded-xl bg-white/10 p-2 hover:bg-white/[0.16]"
            >
              <CircleUser className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ counts */}
      <div className="mt-[1.5vh] flex flex-wrap items-center gap-x-6 gap-y-2 px-[3vw] text-[clamp(0.85rem,1.15vw,1.2rem)] font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="size-[0.8em] rounded-full bg-[var(--color-called)]" aria-hidden />
          <span className="tabular">{counts.called}</span>
          <span className="font-medium text-[var(--board-muted)]">{t("board.called")}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-[0.8em] rounded-full bg-white/70" aria-hidden />
          <span className="tabular">{counts.present}</span>
          <span className="font-medium text-[var(--board-muted)]">{t("board.inClass")}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-[0.8em] rounded-full bg-[var(--color-dismissed)]" aria-hidden />
          <span className="tabular">{counts.dismissed}</span>
          <span className="font-medium text-[var(--board-muted)]">{t("board.dismissed")}</span>
        </span>
      </div>

      {/* ------------------------------------------------------------- tiles */}
      <main className="flex-1 px-[3vw] py-[2vh]">
        {roster && roster.length === 0 ? (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center">
            <p className="text-2xl font-bold">{t("board.empty")}</p>
            <p className="mt-2 text-[var(--board-muted)]">{t("board.emptyHint", { code: room.name })}</p>
          </div>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            <AnimatePresence initial={false}>
              {tiles.map(({ student, request, state }) => {
                const busy = pending.has(student.id);
                const guardian = request?.guardian_name;
                return (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className={cn(
                      "tile",
                      state === "called" && "tile-called",
                      state === "dismissed" && "tile-dismissed",
                      busy && "opacity-70",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="tile-name">{name(student)}</p>
                      {state === "called" && request ? (
                        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold opacity-80">
                          {t("board.calledAt", {
                            time: formatTime(request.called_at ?? request.requested_at, school.timezone, locale),
                          })}
                          {guardian ? ` · ${t("board.calledBy", { name: guardian })}` : ""}
                        </p>
                      ) : null}
                      {state === "dismissed" && request ? (
                        <p className="mt-1.5 text-[13px] font-semibold opacity-80">
                          {t("board.dismissedAt", { time: formatTime(request.picked_up_at, school.timezone, locale) })}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">
                        {t(state === "called" ? "board.called" : state === "dismissed" ? "board.dismissed" : "board.inClass")}
                      </span>

                      {state === "called" && request ? (
                        <button
                          type="button"
                          disabled={busy}
                          title={t("board.dismissHint", { name: student.first_name })}
                          onClick={() =>
                            run(student.id, () => dismissStudentAction(request.id), t("board.toast.dismissed", { name: name(student) }))
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-called-ink)] px-3.5 py-2 text-[14px] font-bold text-[var(--color-called)] shadow-soft transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                        >
                          <DoorOpen className="size-4" />
                          {t("board.dismiss")}
                        </button>
                      ) : null}

                      {state === "dismissed" && request ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(student.id, () => undoDismissAction(request.id), t("board.toast.restored", { name: name(student) }))
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-black/10 px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/15 disabled:opacity-60"
                        >
                          <Undo2 className="size-4" />
                          {t("board.undoDismiss")}
                        </button>
                      ) : null}

                      {state === "present" ? (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={t("board.callManually")}
                          title={t("board.callManuallyHint")}
                          onClick={() =>
                            run(student.id, () => callStudentManuallyAction(student.id), t("board.toast.called", { name: name(student) }))
                          }
                          className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                        >
                          <Megaphone className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-[3vw] py-[1.6vh] text-[clamp(0.8rem,1vw,1.05rem)] text-[var(--board-muted)]">
        <p>{t("board.legend")}</p>
        <p className="font-medium">
          {school.board_message
            ? school.board_message
            : counts.present + counts.called === 0 && counts.dismissed > 0
              ? t("board.allDone")
              : counts.called === 0
                ? t("board.waitingForCalls")
                : ""}
        </p>
      </footer>
    </div>
  );
}
