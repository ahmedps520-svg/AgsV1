/**
 * How the app is wired up at build time.
 *
 * The same static bundle serves two modes:
 *
 *  • `supabase` — a real school. Every read and write goes to Postgres, where
 *    Row Level Security and the SECURITY DEFINER workflow functions enforce
 *    exactly the same rules they did when this app rendered on a server.
 *
 *  • `demo` — no Supabase project configured. The app runs against an
 *    in-browser store so the published site can be explored end to end. Demo
 *    data never leaves the device.
 */
export type AppMode = "supabase" | "demo";

export function appMode(): AppMode {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? "supabase" : "demo";
}

export const IS_DEMO = appMode() === "demo";

/** Prefix for links and assets when hosted under a repository sub-path. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
