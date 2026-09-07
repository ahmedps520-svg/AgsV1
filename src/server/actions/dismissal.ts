"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireSession } from "@/server/session";
import type { DismissalRequestRow, DismissalStatus } from "@/lib/types/database";
import { describeError, fail, ok, type ActionResult } from "./result";

const uuid = z.string().uuid("That record could not be found.");

/**
 * Every mutation below is a thin wrapper over a SECURITY DEFINER function.
 * The database owns the rules; these actions add session checks and cache
 * invalidation so server-rendered views stay in step with Realtime.
 */
function revalidateDismissalViews() {
  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidatePath("/parent");
  revalidatePath("/history");
}

/* --------------------------------------------------------- parent: I'm here */

export async function requestDismissalAction(input: {
  studentIds: string[];
  note?: string;
  vehicle?: string;
}): Promise<ActionResult<DismissalRequestRow[]>> {
  const parsed = z
    .object({
      studentIds: z.array(uuid).min(1, "Choose at least one student."),
      note: z.string().max(280).optional(),
      vehicle: z.string().max(120).optional(),
    })
    .safeParse(input);

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose at least one student.");

  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("request_dismissal", {
    p_student_ids: parsed.data.studentIds,
    p_note: parsed.data.note ?? null,
    p_vehicle: parsed.data.vehicle ?? null,
  });

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok((data ?? []) as DismissalRequestRow[]);
}

/* -------------------------------------------------------------- staff: add */

export async function addToQueueAction(input: {
  studentId: string;
  note?: string;
}): Promise<ActionResult<DismissalRequestRow>> {
  const parsed = z
    .object({ studentId: uuid, note: z.string().max(280).optional() })
    .safeParse(input);

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose a student.");

  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_add_to_queue", {
    p_student_id: parsed.data.studentId,
    p_note: parsed.data.note ?? null,
  });

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok(data as DismissalRequestRow);
}

/* --------------------------------------------------- staff: move the queue */

const MOVABLE: DismissalStatus[] = ["waiting", "called", "ready", "picked_up"];

export async function setStatusAction(input: {
  requestId: string;
  status: DismissalStatus;
}): Promise<ActionResult<DismissalRequestRow>> {
  const parsed = z
    .object({ requestId: uuid, status: z.enum(MOVABLE as [DismissalStatus, ...DismissalStatus[]]) })
    .safeParse(input);

  if (!parsed.success) return fail("That status change isn't allowed.");

  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_request_status", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
  });

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok(data as DismissalRequestRow);
}

export async function callNextAction(): Promise<ActionResult<DismissalRequestRow | null>> {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("call_next_student");

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok((data as DismissalRequestRow | null) ?? null);
}

/* ----------------------------------------------------------------- cancel */

export async function cancelRequestAction(input: {
  requestId: string;
  reason?: string;
}): Promise<ActionResult<DismissalRequestRow>> {
  const parsed = z
    .object({ requestId: uuid, reason: z.string().max(200).optional() })
    .safeParse(input);

  if (!parsed.success) return fail("That dismissal could not be found.");

  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cancel_request", {
    p_request_id: parsed.data.requestId,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok(data as DismissalRequestRow);
}

export async function endSessionAction(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_dismissal_session");

  if (error) return fail(describeError(error));

  revalidateDismissalViews();
  return ok((data as number | null) ?? 0);
}
