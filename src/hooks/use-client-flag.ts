"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Reads a browser-only boolean (media queries, `navigator`, `localStorage`)
 * without a setState-in-effect round trip: the server and first client render
 * both see `serverValue`, then React swaps in the real value.
 */
export function useClientFlag(compute: () => boolean, serverValue = false): boolean {
  return useSyncExternalStore(noopSubscribe, compute, () => serverValue);
}

/** True once the component has hydrated — for portals and other DOM-only work. */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
