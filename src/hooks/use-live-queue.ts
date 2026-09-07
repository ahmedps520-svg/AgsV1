"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/api/config";
import { subscribeDemo } from "@/lib/api/demo-store";

export type ConnectionState = "connecting" | "live" | "offline";

interface Options<T> {
  /** Unique per view so the board, dashboard and parent app get their own channel. */
  channelName: string;
  /** PostgREST filter applied server-side, e.g. `school_id=eq.<uuid>`. */
  filter?: string;
  initial: T[];
  /** Re-reads the enriched rows. Runs through RLS like any other query. */
  load: () => Promise<T[]>;
  /** Safety net in case a websocket dies without firing an error. */
  pollMs?: number;
}

interface Result<T> {
  rows: T[];
  connection: ConnectionState;
  refresh: () => Promise<void>;
  error: string | null;
}

/**
 * Keeps a list in sync with `dismissal_requests` in real time.
 *
 * Postgres change events carry only the raw row, so instead of patching state
 * from the payload we treat each event as an invalidation and re-read the
 * `dismissal_queue` view. That keeps derived fields (queue position, snapshots,
 * RLS filtering) exactly right, and coalesces bursts — calling ten students in
 * a row costs one refetch, not ten.
 */
export function useLiveQueue<T>({
  channelName,
  filter,
  initial,
  load,
  pollMs = 30_000,
}: Options<T>): Result<T> {
  const [rows, setRows] = useState<T[]>(initial);
  // The demo store is always "connected" — there is no socket to lose.
  const [socketState, setConnection] = useState<ConnectionState>("connecting");
  const connection: ConnectionState = IS_DEMO ? "live" : socketState;
  const [error, setError] = useState<string | null>(null);

  // A fresh server render (navigation, revalidatePath) wins over local state.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setRows(initial);
  }

  const pending = useRef<number | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    // Collapse overlapping refreshes: the in-flight one loops once more instead.
    if (inFlight.current) {
      queued.current = true;
      return;
    }

    inFlight.current = true;
    try {
      do {
        queued.current = false;
        const next = await load();
        if (!mounted.current) return;
        setRows(next);
        setError(null);
      } while (queued.current && mounted.current);
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Could not refresh the queue.");
      }
    } finally {
      inFlight.current = false;
      queued.current = false;
    }
  }, [load]);

  const scheduleRefresh = useCallback(() => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      pending.current = null;
      void refresh();
    }, 120);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;

    // Demo mode: the in-browser store broadcasts across tabs, so the same
    // "call a student, watch the board move" behaviour holds without a server.
    if (IS_DEMO) {
      // Deferred a tick so the first load lands after this effect commits
      // rather than cascading a render inside it.
      queueMicrotask(() => void refresh());
      const unsubscribe = subscribeDemo(() => scheduleRefresh());
      return () => {
        mounted.current = false;
        unsubscribe();
        if (pending.current !== null) window.clearTimeout(pending.current);
      };
    }

    const supabase = createClient();

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dismissal_requests", ...(filter ? { filter } : {}) },
        () => scheduleRefresh(),
      )
      .subscribe((status) => {
        if (!mounted.current) return;

        if (status === "SUBSCRIBED") {
          setConnection("live");
          // Catch up on anything that changed while we were connecting.
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    const poll = pollMs > 0 ? window.setInterval(() => void refresh(), pollMs) : null;

    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (poll) window.clearInterval(poll);
      if (pending.current !== null) window.clearTimeout(pending.current);
      void supabase.removeChannel(channel);
    };
  }, [channelName, filter, pollMs, refresh, scheduleRefresh]);

  return { rows, connection, refresh, error };
}
