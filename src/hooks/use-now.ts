"use client";

import { useEffect, useState } from "react";

/**
 * A ticking clock value. Used for the board clock and for "4m ago" labels,
 * which must keep counting even when nothing changes on the server.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
