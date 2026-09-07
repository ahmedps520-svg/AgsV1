"use client";

import { createClient } from "@/lib/supabase/client";
import type { DismissalQueueRow } from "@/lib/types/database";

/**
 * Browser-side reads used by the Realtime hook. They hit the same
 * `dismissal_queue` view (and the same RLS policies) as the server render, so
 * a live refresh can never widen what a user is allowed to see.
 */

export async function fetchQueue(schoolId: string, date: string): Promise<DismissalQueueRow[]> {
  const { data, error } = await createClient()
    .from("dismissal_queue")
    .select("*")
    .eq("school_id", schoolId)
    .eq("dismissal_date", date)
    .order("requested_at", { ascending: true })
    .returns<DismissalQueueRow[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchGuardianRequests(studentIds: string[]): Promise<DismissalQueueRow[]> {
  if (studentIds.length === 0) return [];

  const { data, error } = await createClient()
    .from("dismissal_queue")
    .select("*")
    .in("student_id", studentIds)
    .order("requested_at", { ascending: false })
    .limit(40)
    .returns<DismissalQueueRow[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}
