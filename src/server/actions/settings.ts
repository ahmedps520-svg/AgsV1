"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { describeError, fail, ok, type ActionResult } from "./result";

const timeOrNull = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{2}:\d{2}$/.test(value), "Use a time like 15:00.");

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Enter the school name.").max(120),
  timezone: z.string().trim().min(1).max(80),
  dismissal_start: timeOrNull,
  dismissal_end: timeOrNull,
  show_queue_position: z.boolean(),
  show_pickup_number: z.boolean(),
  allow_parent_cancel: z.boolean(),
  board_message: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : null)),
});

export async function updateSchoolAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");
  if (session.profile.role !== "admin") {
    return fail("Only school administrators can change dismissal settings.");
  }
  if (!session.profile.school_id) return fail("Your account is not linked to a school yet.");

  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    dismissal_start: formData.get("dismissal_start") ?? undefined,
    dismissal_end: formData.get("dismissal_end") ?? undefined,
    show_queue_position: formData.get("show_queue_position") === "on",
    show_pickup_number: formData.get("show_pickup_number") === "on",
    allow_parent_cancel: formData.get("allow_parent_cancel") === "on",
    board_message: formData.get("board_message") ?? undefined,
  });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the settings.");

  // Reject a timezone the browser can't render, so clocks never break.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone }).format(new Date());
  } catch {
    return fail("That timezone isn't recognised. Try one like Asia/Riyadh.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update(parsed.data)
    .eq("id", session.profile.school_id);

  if (error) return fail(describeError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateOwnProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.");

  const parsed = z
    .object({
      full_name: z.string().trim().min(1, "Enter your name.").max(120),
      phone: z.string().trim().max(40).optional(),
      vehicle_description: z.string().trim().max(120).optional(),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      phone: formData.get("phone") ?? undefined,
      vehicle_description: formData.get("vehicle_description") ?? undefined,
    });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      vehicle_description: parsed.data.vehicle_description || null,
    })
    .eq("id", session.userId);

  if (error) return fail(describeError(error));

  revalidatePath("/", "layout");
  return ok();
}
