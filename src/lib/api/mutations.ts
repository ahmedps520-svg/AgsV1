"use client";

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { emitDataChanged } from "@/lib/api/events";
import type {
  ClassGender,
  ClassroomRow,
  DismissalRequestRow,
  DismissalStatus,
  SectionScope,
  StudentRow,
  UserRole,
} from "@/lib/types/database";
import { classCode, isKg, levelLabel } from "@/lib/classes";
import { describeError, fail, ok, type ActionResult } from "@/lib/api/result";

/**
 * Every write in the app.
 *
 * These are thin wrappers over the SECURITY DEFINER functions and RLS-guarded
 * tables. The database owns the rules — who may call a student, which section
 * an account can touch — so running them from the browser is exactly as
 * constrained as running them from a server would be.
 */

const uuid = z.string().uuid("That record could not be found.");

function done<T>(data: T): ActionResult<T> {
  emitDataChanged();
  return ok(data);
}

/* ------------------------------------------------------- parent: I'm here -- */

export async function requestDismissalAction(input: {
  studentIds: string[];
  note?: string;
  vehicle?: string;
}): Promise<ActionResult<DismissalRequestRow[]>> {
  const parsed = z
    .object({
      studentIds: z.array(uuid.or(z.string().min(1))).min(1, "Choose at least one student."),
      note: z.string().max(280).optional(),
      vehicle: z.string().max(120).optional(),
    })
    .safeParse(input);

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose at least one student.");

  try {
    const { data, error } = await createClient().rpc("request_dismissal", {
      p_student_ids: parsed.data.studentIds,
      p_note: parsed.data.note ?? null,
      p_vehicle: parsed.data.vehicle ?? null,
    });

    if (error) return fail(describeError(error));
    return done((data ?? []) as DismissalRequestRow[]);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* -------------------------------------------------------------- staff: add -- */

export async function addToQueueAction(input: {
  studentId: string;
  note?: string;
}): Promise<ActionResult<DismissalRequestRow>> {
  try {
    const { data, error } = await createClient().rpc("staff_add_to_queue", {
      p_student_id: input.studentId,
      p_note: input.note ?? null,
    });

    if (error) return fail(describeError(error));
    return done(data as DismissalRequestRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* -------------------------------------------------- staff: move the queue -- */

export async function setStatusAction(input: {
  requestId: string;
  status: DismissalStatus;
}): Promise<ActionResult<DismissalRequestRow>> {
  if (!["waiting", "called", "ready", "picked_up"].includes(input.status)) {
    return fail("That status change isn't allowed.");
  }

  try {
    const { data, error } = await createClient().rpc("set_request_status", {
      p_request_id: input.requestId,
      p_status: input.status,
    });

    if (error) return fail(describeError(error));
    return done(data as DismissalRequestRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function callNextAction(): Promise<ActionResult<DismissalRequestRow | null>> {
  try {
    const { data, error } = await createClient().rpc("call_next_student");
    if (error) return fail(describeError(error));
    return done((data as DismissalRequestRow | null) ?? null);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function cancelRequestAction(input: {
  requestId: string;
  reason?: string;
}): Promise<ActionResult<DismissalRequestRow>> {
  try {
    const { data, error } = await createClient().rpc("cancel_request", {
      p_request_id: input.requestId,
      p_reason: input.reason ?? null,
    });

    if (error) return fail(describeError(error));
    return done(data as DismissalRequestRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function endSessionAction(): Promise<ActionResult<number>> {
  try {
    const { data, error } = await createClient().rpc("end_dismissal_session");
    if (error) return fail(describeError(error));
    return done((data as number | null) ?? 0);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* -------------------------------------------------------------- students -- */

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveStudentAction(
  _prev: ActionResult<StudentRow> | null,
  formData: FormData,
): Promise<ActionResult<StudentRow>> {
  const first_name = text(formData, "first_name");
  if (!first_name) return fail("Enter the student's first name.");

  const classroomId = text(formData, "classroom_id") || null;
  const payload = {
    first_name,
    last_name: text(formData, "last_name"),
    grade: text(formData, "grade"),
    gender: (text(formData, "gender") || null) as ClassGender | null,
    classroom_id: classroomId,
    pickup_number: text(formData, "pickup_number") || null,
    notes: text(formData, "notes") || null,
    is_active: formData.get("is_active") !== "false",
  };
  const id = text(formData, "id");

  try {
    const supabase = createClient();
    const { data: profile } = await supabase.auth.getUser();
    const schoolId = await currentSchoolId();
    if (!schoolId || !profile.user) return fail("Your session has expired. Please sign in again.");

    if (classroomId) {
      const { data: room } = await supabase
        .from("classrooms")
        .select("grade")
        .eq("id", classroomId)
        .maybeSingle();
      if (room) payload.grade = room.grade;
    }

    const record = { ...payload, school_id: schoolId };
    const { data, error } = id
      ? await supabase.from("students").update(record).eq("id", id).select().single()
      : await supabase.from("students").insert(record).select().single();

    if (error) return fail(describeError(error));
    return done(data as StudentRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deleteStudentAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const { error } = await createClient().from("students").delete().eq("id", id);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* ------------------------------------------------------------ classrooms -- */

export async function saveClassroomAction(
  _prev: ActionResult<ClassroomRow> | null,
  formData: FormData,
): Promise<ActionResult<ClassroomRow>> {
  const level = text(formData, "level");
  const section = text(formData, "section").toUpperCase();
  const genderInput = text(formData, "gender") as ClassGender;
  const gender: ClassGender = isKg(level) ? "mixed" : genderInput === "girls" ? "girls" : "boys";

  if (!level) return fail("Choose a grade.");
  if (!section) return fail("Choose a section.");

  const name = classCode({ level, gender, section });
  const payload = {
    name,
    grade: levelLabel(level, "en"),
    level,
    gender,
    section,
    room_number: text(formData, "room_number") || null,
    teacher_id: text(formData, "teacher_id") || null,
  };
  const id = text(formData, "id");

  try {
    const schoolId = await currentSchoolId();
    if (!schoolId) return fail("Your session has expired. Please sign in again.");

    const supabase = createClient();
    const record = { ...payload, school_id: schoolId };
    const { data, error } = id
      ? await supabase.from("classrooms").update(record).eq("id", id).select().single()
      : await supabase.from("classrooms").insert(record).select().single();

    if (error) {
      return fail(
        (error as { code?: string }).code === "23505"
          ? "That class already exists."
          : describeError(error),
      );
    }
    return done(data as ClassroomRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deleteClassroomAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const { error } = await createClient().from("classrooms").delete().eq("id", id);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* ---------------------------------------------------- pickup permissions -- */

export async function linkGuardianAction(input: {
  studentId: string;
  profileId: string;
  relationship?: string;
  isPrimary?: boolean;
}): Promise<ActionResult<undefined>> {
  try {
    const { error } = await createClient().from("guardians").upsert(
      {
        student_id: input.studentId,
        profile_id: input.profileId,
        relationship: input.relationship || "Guardian",
        is_primary: input.isPrimary ?? false,
        can_pickup: true,
      },
      { onConflict: "student_id,profile_id" },
    );

    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function setGuardianPickupAction(input: {
  guardianId: string;
  canPickup: boolean;
}): Promise<ActionResult<undefined>> {
  try {
    const { error } = await createClient()
      .from("guardians")
      .update({ can_pickup: input.canPickup })
      .eq("id", input.guardianId);

    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function unlinkGuardianAction(guardianId: string): Promise<ActionResult<undefined>> {
  try {
    const { error } = await createClient().from("guardians").delete().eq("id", guardianId);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* ---------------------------------------------------------------- people -- */

export async function createAccountAction(
  _prev: ActionResult<{ email: string; password?: string; invited: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string; password?: string; invited: boolean }>> {
  const email = text(formData, "email").toLowerCase();
  const full_name = text(formData, "full_name");
  const role = text(formData, "role") as UserRole;
  const section_scope = (text(formData, "section_scope") || "all") as SectionScope;

  if (!full_name) return fail("Enter a full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");

  // Creating a login needs the service-role key, which can never ship in a
  // static bundle. `supabase/functions/create-account` holds it instead and
  // re-checks that the caller is an administrator of this school.
  try {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("create-account", {
      body: {
        email,
        full_name,
        role,
        section_scope,
        phone: text(formData, "phone") || null,
        vehicle_description: text(formData, "vehicle_description") || null,
      },
    });

    if (error) {
      const detail = await readFunctionError(error);
      return fail(
        detail ??
          "Could not reach the account service. Deploy supabase/functions/create-account — see DEPLOYMENT.md.",
      );
    }

    const result = data as { password?: string } | null;
    return done({ email, password: result?.password, invited: false });
  } catch (error) {
    return fail(describeError(error));
  }
}

/** Edge Function errors carry their message in the response body. */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (!context?.json) return (error as Error)?.message ?? null;
  try {
    const body = (await context.json()) as { error?: string };
    return body?.error ?? null;
  } catch {
    return (error as Error)?.message ?? null;
  }
}

/* ------------------------------------------------------- end of the year -- */

/**
 * Moves the whole school up one grade. Grade 12 leaves and is deleted, along
 * with its dismissal history — that is what AGS asked for, and it cannot be
 * undone.
 */
export async function promoteAllStudentsAction(): Promise<
  ActionResult<{ promoted: number; graduated: number; skipped: number }>
> {
  try {
    const { data, error } = await createClient().rpc("promote_all_students");
    if (error) return fail(describeError(error));
    return done(data as { promoted: number; graduated: number; skipped: number });
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function updatePersonAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const id = text(formData, "id");
  const full_name = text(formData, "full_name");
  if (!full_name) return fail("Enter a full name.");

  const payload = {
    full_name,
    role: text(formData, "role") as UserRole,
    section_scope: (text(formData, "section_scope") || "all") as SectionScope,
    phone: text(formData, "phone") || null,
    vehicle_description: text(formData, "vehicle_description") || null,
    is_active: formData.get("is_active") !== "false",
  };

  try {
    const { error } = await createClient().from("profiles").update(payload).eq("id", id);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* -------------------------------------------------------------- settings -- */

export async function updateSchoolAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const name = text(formData, "name");
  const timezone = text(formData, "timezone");
  if (!name) return fail("Enter the school name.");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    return fail("That timezone isn't recognised. Try one like Asia/Riyadh.");
  }

  const payload = {
    name,
    timezone,
    dismissal_start: text(formData, "dismissal_start") || null,
    dismissal_end: text(formData, "dismissal_end") || null,
    show_queue_position: formData.get("show_queue_position") === "on",
    show_pickup_number: formData.get("show_pickup_number") === "on",
    allow_parent_cancel: formData.get("allow_parent_cancel") === "on",
    board_message: text(formData, "board_message") || null,
  };

  try {
    const schoolId = await currentSchoolId();
    if (!schoolId) return fail("Your session has expired. Please sign in again.");

    const { error } = await createClient().from("schools").update(payload).eq("id", schoolId);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function updateOwnProfileAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const full_name = text(formData, "full_name");
  if (!full_name) return fail("Enter your name.");

  const payload = {
    full_name,
    phone: text(formData, "phone") || null,
    vehicle_description: text(formData, "vehicle_description") || null,
  };

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("Your session has expired. Please sign in again.");

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) return fail(describeError(error));
    return done(undefined);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* ------------------------------------------------------------------ auth -- */

export async function updatePasswordAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return fail("Choose a password of at least 8 characters.");
  if (password !== confirm) return fail("The two passwords don't match.");

  const { error } = await createClient().auth.updateUser({ password });
  if (error) return fail(describeError(error));
  return ok(undefined);
}

export async function sendPasswordResetAction(
  _prev: ActionResult<{ sent: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  const email = text(formData, "email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");

  const redirectTo = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/callback`;
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });

  // Respond identically whether or not the address is registered.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return fail(describeError(error));
  }
  return ok({ sent: true });
}

/* ------------------------------------------------------- class board ------ */

/** Teacher taps the icon: the student has left with their guardian. */
export async function dismissStudentAction(requestId: string) {
  return setStatusAction({ requestId, status: "picked_up" });
}

/** Undo a dismissal: the name goes back to yellow. */
export async function undoDismissAction(requestId: string) {
  return setStatusAction({ requestId, status: "called" });
}

/**
 * Fallback for a guardian who arrived without the parent app. Creates the
 * call directly in the "called" state so the tile turns yellow at once.
 */
export async function callStudentManuallyAction(
  studentId: string,
): Promise<ActionResult<DismissalRequestRow>> {
  try {
    const { data, error } = await createClient().rpc("staff_call_student", {
      p_student_id: studentId,
    });
    if (error) return fail(describeError(error));
    return done(data as DismissalRequestRow);
  } catch (error) {
    return fail(describeError(error));
  }
}

/* ----------------------------------------------------------------- utils -- */

async function currentSchoolId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  return data?.school_id ?? null;
}
