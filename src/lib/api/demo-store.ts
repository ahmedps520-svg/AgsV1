"use client";

import { buildDemoSnapshot, DEMO_ACCOUNTS, type DemoSnapshot } from "@/lib/api/demo-data";
import { emitDataChanged } from "@/lib/api/events";
import type {
  DismissalQueueRow,
  DismissalRequestRow,
  DismissalStatus,
  ProfileRow,
} from "@/lib/types/database";

/**
 * The demo backend: a complete school that lives in the visitor's browser.
 *
 * State is persisted to localStorage and broadcast over BroadcastChannel, so
 * opening the board in one tab and the dashboard in another reproduces the real
 * multi-device behaviour — calling a student really does move the board — while
 * nothing is ever sent anywhere.
 */

const STORAGE_KEY = "ags-dismissal:demo-v1";
const SESSION_KEY = "ags-dismissal:demo-session-v1";
const CHANNEL = "ags-dismissal:demo";

/**
 * The school lives in localStorage (shared by every tab) but the signed-in
 * demo persona lives in sessionStorage (per tab). That way one browser can be
 * a teacher in one tab, a parent in another and the lobby board in a third —
 * which is the whole point of the demo.
 */
function sessionStore(): Storage | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

type Listener = () => void;

let snapshot: DemoSnapshot | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function isBrowser() {
  return typeof window !== "undefined";
}

function load(): DemoSnapshot {
  if (snapshot) return snapshot;

  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        snapshot = JSON.parse(raw) as DemoSnapshot;
        return snapshot;
      }
    } catch {
      // Corrupt or unavailable storage — fall through to a fresh school.
    }
  }

  snapshot = buildDemoSnapshot();
  return snapshot;
}

function persist({ broadcast = true }: { broadcast?: boolean } = {}) {
  if (!isBrowser() || !snapshot) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked; the in-memory copy still works for this tab.
  }

  if (broadcast) openChannel()?.postMessage({ type: "changed" });
  listeners.forEach((listener) => listener());
  emitDataChanged();
}

function openChannel(): BroadcastChannel | null {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") return null;
  if (channel) return channel;

  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (event.data?.type !== "changed") return;
    // Another tab wrote: drop our copy and re-read from storage.
    snapshot = null;
    load();
    listeners.forEach((listener) => listener());
    emitDataChanged();
  };
  return channel;
}

export function subscribeDemo(listener: Listener): () => void {
  listeners.add(listener);
  openChannel();

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = null;
      load();
      listener();
    }
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

export function resetDemo() {
  snapshot = buildDemoSnapshot();
  persist();
}

export function demoState(): DemoSnapshot {
  return load();
}

/* ------------------------------------------------------------------ auth -- */

export function demoSignIn(email: string): ProfileRow | null {
  const account = DEMO_ACCOUNTS.find(
    (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account) return null;

  const state = load();
  const person = state.profiles.find((candidate) => candidate.id === account.id) ?? null;
  if (!person) return null;

  try {
    sessionStore()?.setItem(SESSION_KEY, person.id);
  } catch {
    // Session simply won't survive a reload.
  }
  return person;
}

export function demoCurrentProfile(): ProfileRow | null {
  if (!isBrowser()) return null;
  try {
    const id = sessionStore()?.getItem(SESSION_KEY);
    if (!id) return null;
    return load().profiles.find((person) => person.id === id) ?? null;
  } catch {
    return null;
  }
}

export function demoSignOut() {
  try {
    sessionStore()?.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/* ---------------------------------------------------------------- helpers -- */

export function demoToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

function uuid(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Adds the live position fields the `dismissal_queue` view computes in SQL. */
export function withQueuePosition(rows: DismissalRequestRow[]): DismissalQueueRow[] {
  const waiting = rows
    .filter((row) => row.status === "requested" || row.status === "waiting")
    .sort((a, b) => a.requested_at.localeCompare(b.requested_at));

  return rows.map((row) => ({
    ...row,
    queue_position:
      row.status === "requested" || row.status === "waiting"
        ? waiting.findIndex((candidate) => candidate.id === row.id) + 1
        : null,
    queue_length: waiting.length,
  }));
}

function snapshotStudent(studentId: string, requestedBy: string | null) {
  const state = load();
  const student = state.students.find((candidate) => candidate.id === studentId);
  if (!student) throw new Error("That student could not be found.");

  const classroom = state.classrooms.find((candidate) => candidate.id === student.classroom_id);
  const guardian = state.profiles.find((candidate) => candidate.id === requestedBy);

  return {
    school_id: student.school_id,
    student_name: `${student.first_name} ${student.last_name}`.trim(),
    student_grade: student.grade,
    classroom_name: classroom?.name ?? null,
    pickup_number: student.pickup_number,
    guardian_name: guardian?.full_name ?? null,
  };
}

function activeRequestFor(studentId: string): DismissalRequestRow | undefined {
  return load().requests.find(
    (row) =>
      row.student_id === studentId &&
      ["requested", "waiting", "called", "ready"].includes(row.status),
  );
}

/* -------------------------------------------------------------- mutations -- */

export function demoCreateRequest(input: {
  studentId: string;
  status: DismissalStatus;
  source: DismissalRequestRow["source"];
  requestedBy: string | null;
  note?: string | null;
  vehicle?: string | null;
}): DismissalRequestRow {
  const existing = activeRequestFor(input.studentId);
  if (existing) return existing;

  const state = load();
  const meta = snapshotStudent(input.studentId, input.requestedBy);
  const timestamp = new Date().toISOString();

  const row: DismissalRequestRow = {
    id: uuid(),
    student_id: input.studentId,
    status: input.status,
    source: input.source,
    requested_by: input.requestedBy,
    called_by: null,
    released_by: null,
    requested_at: timestamp,
    called_at: null,
    ready_at: null,
    picked_up_at: null,
    cancelled_at: null,
    cancel_reason: null,
    vehicle_description: input.vehicle ?? null,
    note: input.note ?? null,
    dismissal_date: demoToday(state.school.timezone),
    created_at: timestamp,
    updated_at: timestamp,
    ...meta,
  };

  state.requests = [...state.requests, row];
  persist();
  return row;
}

/** Mirrors `set_request_status()`, including clearing timestamps on undo. */
export function demoSetStatus(
  requestId: string,
  status: DismissalStatus,
  actorId: string | null,
): DismissalRequestRow {
  const state = load();
  const row = state.requests.find((candidate) => candidate.id === requestId);
  if (!row) throw new Error("That dismissal request could not be found.");

  const clash = state.requests.find(
    (candidate) =>
      candidate.id !== requestId &&
      candidate.student_id === row.student_id &&
      ["requested", "waiting", "called", "ready"].includes(candidate.status),
  );
  if (clash && ["waiting", "called", "ready"].includes(status)) {
    throw new Error("That student already has another active dismissal in the queue.");
  }

  const stamp = new Date().toISOString();

  row.status = status;
  row.called_at = status === "waiting" ? null : status === "called" ? stamp : (row.called_at ?? stamp);
  row.called_by = status === "waiting" ? null : status === "called" ? actorId : (row.called_by ?? actorId);
  row.ready_at =
    status === "waiting" || status === "called" ? null : status === "ready" ? stamp : (row.ready_at ?? stamp);
  row.picked_up_at = status === "picked_up" ? stamp : null;
  row.released_by = status === "picked_up" ? actorId : null;
  row.cancelled_at = null;
  row.cancel_reason = null;
  row.updated_at = stamp;

  persist();
  return row;
}

export function demoCancel(requestId: string, reason?: string | null): DismissalRequestRow {
  const state = load();
  const row = state.requests.find((candidate) => candidate.id === requestId);
  if (!row) throw new Error("That dismissal request could not be found.");
  if (row.status === "picked_up" || row.status === "cancelled") {
    throw new Error("That dismissal is already closed.");
  }

  row.status = "cancelled";
  row.cancelled_at = new Date().toISOString();
  row.cancel_reason = reason?.trim() || null;
  row.updated_at = row.cancelled_at;

  persist();
  return row;
}

export function demoCallNext(schoolId: string, actorId: string | null): DismissalRequestRow | null {
  const state = load();
  const next = state.requests
    .filter(
      (row) =>
        row.school_id === schoolId && (row.status === "requested" || row.status === "waiting"),
    )
    .sort((a, b) => a.requested_at.localeCompare(b.requested_at))[0];

  if (!next) return null;
  return demoSetStatus(next.id, "called", actorId);
}

export function demoEndSession(schoolId: string): number {
  const state = load();
  let count = 0;

  for (const row of state.requests) {
    if (
      row.school_id === schoolId &&
      ["requested", "waiting", "called", "ready"].includes(row.status)
    ) {
      row.status = "cancelled";
      row.cancelled_at = new Date().toISOString();
      row.cancel_reason = "Dismissal session ended";
      row.updated_at = row.cancelled_at;
      count += 1;
    }
  }

  persist();
  return count;
}

/** Generic table write used by the roster, people and settings screens. */
export function demoMutate<T>(mutator: (state: DemoSnapshot) => T): T {
  const state = load();
  const result = mutator(state);
  persist();
  return result;
}

export { uuid as demoUuid };
