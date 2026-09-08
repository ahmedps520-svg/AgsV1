/**
 * Supabase connection details, baked in at build time.
 *
 * Both values are public by design: the anon key is meant to sit in the
 * browser, and every request it makes is filtered by Row Level Security. The
 * service-role key is never referenced here and must never reach the bundle.
 */
export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export const IS_CONFIGURED = isConfigured();

/** Prefix for links and assets when hosted under a repository sub-path. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
