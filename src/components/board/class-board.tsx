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
  Search,
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
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { Avatar, LiveDot } from "@/components/ui/primitives";
import { rememberClass } from "@/components/board/class-picker";
import { BackLink } from "@/components/layout/back-link";
import type { DismissalQueueRow, StudentRow } from "@/lib/types/database";
import type { MessageKey } from "@/lib/i18n/dictionary";

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

  /**
   * The board only ever shows students something has happened to: called
   * (yellow) and gone (grey). Everyone still sitting in class is deliberately
   * absent — the teacher does not need to read 30 names to find the two that
   * matter.
   */
  const { called, dismissed, stillInClass } = React.useMemo(() => {
    if (!roster) return { called: [] as Tile[], dismissed: [] as Tile[], stillInClass: 0 };

    const latest = new Map<string, DismissalQueueRow>();
    for (const row of rows) {
      if (row.status === "cancelled") continue;
      const previous = latest.get(row.student_id);
      if (!previous || row.requested_at > previous.requested_at) latest.set(row.student_id, row);
    }

    const tiles: Tile[] = roster.map((student) => {
      const request = latest.get(student.id) ?? null;
      return { student, request, state: boardState(request) };
    });

    return {
      // Longest-waiting first: the teacher works top-left to bottom-right.
      called: tiles
        .filter((tile) => tile.state === "called")
        .sort((a, b) => (a.request?.called_at ?? "").localeCompare(b.request?.called_at ?? "")),
      // Most recently gone first, so the last action stays in view.
      dismissed: tiles
        .filter((tile) => tile.state === "dismissed")
        .sort((a, b) => (b.request?.picked_up_at ?? "").localeCompare(a.request?.picked_up_at ?? "")),
      stillInClass: tiles.filter((tile) => tile.state === "present").length,
    };
  }, [roster, rows]);

  // A board with two names on it should read from the back of the room; a
  // board with twenty has to pack them in. Size the tiles to the occupancy.
  const onBoard = called.length + dismissed.length;
  const minTile = onBoard <= 2 ? 460 : onBoard <= 6 ? 340 : onBoard <= 12 ? 280 : 230;

  const uncalled = React.useMemo(
    () =>
      (roster ?? []).filter(
        (student) =>
          !called.some((tile) => tile.student.id === student.id) &&
          !dismissed.some((tile) => tile.student.id === student.id),
      ),
    [roster, called, dismissed],
  );

  /* --------------------------------------------------------------- chime */

  const [soundOn, setSoundOn] = React.useState(false);
  const knownCalled = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    const current = new Set(called.map((tile) => tile.student.id));
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
  }, [called, soundOn]);

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
  const [callOpen, setCallOpen] = React.useState(false);

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
          <span className="tabular">{called.length}</span>
          <span className="font-medium text-[var(--board-muted)]">{t("board.called")}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-[0.8em] rounded-full bg-[var(--color-dismissed)]" aria-hidden />
          <span className="tabular">{dismissed.length}</span>
          <span className="font-medium text-[var(--board-muted)]">{t("board.dismissed")}</span>
        </span>
        <span className="font-medium text-[var(--board-muted)]">
          {t("board.stillInClass", { count: stillInClass })}
        </span>

        <button
          type="button"
          onClick={() => setCallOpen(true)}
          className="ms-auto inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-[13px] font-semibold transition hover:bg-white/[0.16]"
        >
          <Megaphone className="size-4" />
          {t("board.callSomeone")}
        </button>
      </div>

      {/* ------------------------------------------------------------- tiles */}
      <main className="flex-1 px-[3vw] py-[2vh]">
        {called.length === 0 && dismissed.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full min-h-[45vh] flex-col items-center justify-center text-center"
          >
            <motion.span
              aria-hidden
              className="mb-6 block size-3 rounded-full bg-[var(--color-called)]"
              animate={{ scale: [1, 1.9, 1], opacity: [0.9, 0.25, 0.9] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="text-[clamp(1.4rem,2.4vw,2.4rem)] font-bold">
              {roster && roster.length === 0 ? t("board.empty") : t("board.nothingYet")}
            </p>
            <p className="mt-2 max-w-md text-[var(--board-muted)]">
              {roster && roster.length === 0
                ? t("board.emptyHint", { code: room.name })
                : t("board.nothingYetHint")}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-[3vh]">
            <BoardSection
              minTile={minTile}
              title={t("board.calledSection")}
              count={called.length}
              tone="called"
              tiles={called}
              timeZone={school.timezone}
              locale={locale}
              t={t}
              pending={pending}
              onDismiss={(tile) =>
                run(
                  tile.student.id,
                  () => dismissStudentAction(tile.request!.id),
                  t("board.toast.dismissed", { name: name(tile.student) }),
                )
              }
            />
            <BoardSection
              minTile={minTile}
              title={t("board.dismissedSection")}
              count={dismissed.length}
              tone="dismissed"
              tiles={dismissed}
              timeZone={school.timezone}
              locale={locale}
              t={t}
              pending={pending}
              onUndo={(tile) =>
                run(
                  tile.student.id,
                  () => undoDismissAction(tile.request!.id),
                  t("board.toast.restored", { name: name(tile.student) }),
                )
              }
            />
          </div>
        )}
      </main>

      <CallStudentDialog
        open={callOpen}
        onClose={() => setCallOpen(false)}
        students={uncalled}
        onCall={(student) =>
          run(
            student.id,
            () => callStudentManuallyAction(student.id),
            t("board.toast.called", { name: name(student) }),
          )
        }
      />

      {/* ------------------------------------------------------------ footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-[3vw] py-[1.6vh] text-[clamp(0.8rem,1vw,1.05rem)] text-[var(--board-muted)]">
        <p>{t("board.legend")}</p>
        <p className="font-medium">
          {school.board_message
            ? school.board_message
            : stillInClass === 0 && called.length === 0 && dismissed.length > 0
              ? t("board.allDone")
              : called.length === 0
                ? t("board.waitingForCalls")
                : ""}
        </p>
      </footer>
    </div>
  );
}


/* -------------------------------------------------------------------------- */

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** One labelled band of tiles: everything called, or everything gone. */
function BoardSection({
  minTile,
  title,
  count,
  tone,
  tiles,
  timeZone,
  locale,
  t,
  pending,
  onDismiss,
  onUndo,
}: {
  minTile: number;
  title: string;
  count: number;
  tone: "called" | "dismissed";
  tiles: Tile[];
  timeZone: string;
  locale: "en" | "ar";
  t: Translate;
  pending: Set<string>;
  onDismiss?: (tile: Tile) => void;
  onUndo?: (tile: Tile) => void;
}) {
  if (tiles.length === 0) return null;

  return (
    <motion.section layout aria-label={title}>
      <h2 className="mb-[1.2vh] flex items-center gap-2.5 px-1 text-[clamp(0.72rem,1vw,1.05rem)] font-bold uppercase tracking-[0.18em] text-[var(--board-muted)]">
        <span
          aria-hidden
          className={cn(
            "size-2.5 rounded-full",
            tone === "called" ? "bg-[var(--color-called)]" : "bg-[var(--color-dismissed)]",
          )}
        />
        {title}
        <span className="tabular rounded-md bg-white/10 px-1.5 py-0.5 text-[0.9em]">{count}</span>
      </h2>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minTile}px), 1fr))`,
          ["--tile-scale" as string]: (minTile / 230).toFixed(2),
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {tiles.map(({ student, request }) => {
            const busy = pending.has(student.id);
            const full = `${student.first_name} ${student.last_name}`.trim();

            return (
              <motion.div
                key={student.id}
                layout
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.7 }}
                className={cn(
                  "tile",
                  tone === "called" ? "tile-called" : "tile-dismissed",
                  busy && "pointer-events-none opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="tile-name">{full}</p>
                  {request ? (
                    <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold opacity-80">
                      {tone === "called"
                        ? t("board.calledAt", {
                            time: formatTime(request.called_at ?? request.requested_at, timeZone, locale),
                          })
                        : t("board.dismissedAt", {
                            time: formatTime(request.picked_up_at, timeZone, locale),
                          })}
                      {tone === "called" && request.guardian_name
                        ? ` · ${t("board.calledBy", { name: request.guardian_name })}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 flex items-end justify-end">
                  {tone === "called" && onDismiss ? (
                    <button
                      type="button"
                      disabled={busy}
                      title={t("board.dismissHint", { name: student.first_name })}
                      onClick={() => onDismiss({ student, request, state: "called" })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-called-ink)] px-3.5 py-2 text-[14px] font-bold text-[var(--color-called)] shadow-soft transition hover:brightness-110 active:scale-[0.97]"
                    >
                      <DoorOpen className="size-4" />
                      {t("board.dismiss")}
                    </button>
                  ) : null}

                  {tone === "dismissed" && onUndo ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onUndo({ student, request, state: "dismissed" })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-black/10 px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/15"
                    >
                      <Undo2 className="size-4" />
                      {t("board.undoDismiss")}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/**
 * The fallback path: a guardian turns up without the app, so the teacher finds
 * the student by name and calls them by hand.
 */
function CallStudentDialog({
  open,
  onClose,
  students,
  onCall,
}: {
  open: boolean;
  onClose: () => void;
  students: StudentRow[];
  onCall: (student: StudentRow) => void;
}) {
  const { t } = useI18n();
  const [term, setTerm] = React.useState("");

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTerm("");
  }

  const results = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    const pool = [...students].sort(
      (a, b) =>
        a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name),
    );
    if (!needle) return pool.slice(0, 40);
    return pool
      .filter((student) => `${student.first_name} ${student.last_name}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [students, term]);

  return (
    <Modal open={open} onClose={onClose} title={t("board.callSomeone")} size="md">
      <div className="sticky top-0 z-10 -mx-1 bg-[var(--color-surface)] pb-3 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            data-autofocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("board.callSearch")}
            aria-label={t("common.search")}
            className="ps-10"
          />
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-muted)]">{t("board.callNoMatch")}</p>
      ) : (
        <ul className="space-y-1 pb-3">
          {results.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => {
                  onCall(student);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Avatar name={`${student.first_name} ${student.last_name}`} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {`${student.first_name} ${student.last_name}`.trim()}
                </span>
                <Megaphone className="size-4 shrink-0 text-[var(--color-muted)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
