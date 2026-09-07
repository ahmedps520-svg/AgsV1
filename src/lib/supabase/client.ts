"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client. A single instance is shared across the app so that
 * every Realtime subscription rides one websocket.
 */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return cached;
}
