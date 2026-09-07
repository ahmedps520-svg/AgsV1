"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onDataChanged } from "@/lib/api/events";

interface LoadState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads page data on mount and again whenever a mutation reports a change.
 *
 * This replaces what `revalidatePath` did when the app rendered on a server:
 * a write anywhere in the app refreshes every list currently on screen. A
 * refresh keeps the previous data on screen rather than flashing a skeleton.
 */
export function useLoad<T>(load: () => Promise<T>, enabled = true): LoadState<T> {
  const [result, setResult] = useState<{ data: T | null; error: string | null } | null>(null);

  const loadRef = useRef(load);
  const mounted = useRef(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;

    mounted.current = true;

    loadRef
      .current()
      .then((data) => {
        if (mounted.current) setResult({ data, error: null });
      })
      .catch((cause: unknown) => {
        if (!mounted.current) return;
        setResult({
          data: null,
          error: cause instanceof Error ? cause.message : "Something went wrong.",
        });
      });

    return () => {
      mounted.current = false;
    };
  }, [enabled, tick]);

  useEffect(() => onDataChanged(reload), [reload]);

  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
    loading: enabled && result === null,
    reload,
  };
}
