/**
 * Public environment access with clear, actionable failures.
 *
 * Only NEXT_PUBLIC_* variables exist in a static export — they are inlined at
 * build time. There is deliberately no accessor for a service-role key: a
 * browser bundle cannot keep a secret, so no such key is ever built in.
 */

function read(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value.trim();
}

export const publicEnv = {
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
};

/** True when both public Supabase variables are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
