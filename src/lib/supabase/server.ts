import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Reads the session from cookies, so every query it runs is filtered by the
 * signed-in user's Row Level Security policies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so it is safe to ignore this here.
        }
      },
    },
  });
}
