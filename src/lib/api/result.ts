import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Turns a Postgres/PostgREST error into something a teacher can act on.
 *
 * Messages raised by our own SECURITY DEFINER functions are already written
 * for humans, so those are passed through untouched.
 */
export function describeError(error: PostgrestError | Error | null | unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const pgError = error as Partial<PostgrestError> & { message?: string };
  const code = pgError.code;
  const message = pgError.message ?? "";

  switch (code) {
    case "23505":
      return message.includes("pickup_number")
        ? "That pickup number is already used by another student."
        : message.includes("already has another active")
          ? message
          : "That record already exists.";
    case "23503":
      return "A linked record is missing. Refresh the page and try again.";
    case "42501":
    case "28000":
    case "P0002":
    case "22023":
      return message || "You do not have permission to do that.";
    case "PGRST116":
      return "That record could not be found.";
    default:
      break;
  }

  if (message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return "Cannot reach the school server. Check your connection and try again.";
  }

  if (error instanceof Error) return error.message;

  return message || "Something went wrong. Please try again.";
}
