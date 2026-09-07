"use client";

/**
 * A tiny change bus.
 *
 * With no server to call `revalidatePath`, screens that render lists need to
 * know when a mutation succeeded. Every write publishes here; page loaders
 * subscribe and refetch.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function emitDataChanged() {
  listeners.forEach((listener) => listener());
}

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
