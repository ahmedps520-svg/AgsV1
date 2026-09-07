"use client";

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/api/config";
import { emitDataChanged } from "@/lib/api/events";
import {
  demoCallNext,
  demoCancel,
  demoCreateRequest,
  demoCurrentProfile,
  demoEndSession,
  demoMutate,
  demoSetStatus,
  demoState,
  demoUuid,
} from "@/lib/api/demo-store";
import type {
  ClassroomRow,
  DismissalRequestRow,
  DismissalStatus,
  StudentRow,
  UserRole,
} from "@/lib/types/database";
import { describeError, fail, ok, type ActionResult } from "@/lib/api/result";

/**
 * Every write in the app.
 *
 * In `supabase` mode these are thin wrappers over the SECURITY DEFINER
 * functions and RLS-guarded tables — the database owns the rules, so calling
 * them from the browser is exactly as constrained as calling them from a
 * server. In `demo` mode they mutate the in-browser school, re-implementing the
 * same role checks so the demo behaves honestly.
 */

const uuid = z.string().uuid("That record could not be found.");

function done<T>(data: T): ActionResult<T> {
  emitDataChanged();
  return ok(data);
}

function actor() {
  const profile = demoCurrentProfile();
  if (!profile) throw new Error("Your session has expired. Please sign in again.");
  return profile;
}

function requireDemoStaff() {
  const profile = actor();
  if (profile.role !== "admin" && profile.role !== "staff") {
    throw new Error("Only school staff can manage the dismissal queue.");
  }
  return profile;
}

function requireDemoAdmin() {
  const profile = actor();
  if (profile.role !== "admin") {
    throw new Error("Only school administrators can change this.");
  }
  return profile;
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
    if (IS_DEMO) {
      const profile = actor();
      const state = demoState();

      const rows = parsed.data.studentIds.map((studentId) => {
        const link = state.guardians.find(
          (candidate) => candidate.student_id === studentId && candidate.profile_id === profile.id,
        );
        if (!link?.can_pickup) {
          throw new Error("You are not authorised to pick up this student.");
        }
        return demoCreateRequest({
          studentId,
          status: "requested",
          source: "parent_app",
          requestedBy: profile.id,
          note: parsed.data.note ?? null,
          vehicle: parsed.data.vehicle ?? profile.vehicle_description ?? null,
        });
      });

      return done(rows);
    }

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
    if (IS_DEMO) {
      const profile = requireDemoStaff();
      return done(
        demoCreateRequest({
          studentId: input.studentId,
          status: "waiting",
          source: "staff",
          requestedBy: profile.id,
          note: input.note ?? null,
        }),
      );
    }

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
    if (IS_DEMO) {
      const profile = requireDemoStaff();
      return done(demoSetStatus(input.requestId, input.status, profile.id));
    }

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
    if (IS_DEMO) {
      const profile = requireDemoStaff();
      return done(demoCallNext(demoState().school.id, profile.id));
    }

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
    if (IS_DEMO) {
      const profile = actor();
      const state = demoState();
      const row = state.requests.find((candidate) => candidate.id === input.requestId);
      if (!row) return fail("That dismissal request could not be found.");

      if (profile.role === "parent") {
        if (!state.school.allow_parent_cancel) {
          return fail("Your school asks that you contact the office to cancel a pickup.");
        }
        if (!["requested", "waiting"].includes(row.status)) {
          return fail("Your student has already been called — please speak to a staff member.");
        }
      }

      return done(demoCancel(input.requestId, input.reason));
    }

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
    if (IS_DEMO) {
      requireDemoStaff();
      return done(demoEndSession(demoState().school.id));
    }

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

  const payload = {
    first_name,
    last_name: text(formData, "last_name"),
    grade: text(formData, "grade"),
    classroom_id: text(formData, "classroom_id") || null,
    pickup_number: text(formData, "pickup_number") || null,
    notes: text(formData, "notes") || null,
    is_active: formData.get("is_active") !== "false",
  };
  const id = text(formData, "id");

  try {
    if (IS_DEMO) {
      requireDemoAdmin();
      return done(
        demoMutate((state) => {
          if (id) {
            const student = state.students.find((candidate) => candidate.id === id);
            if (!student) throw new Error("That student could not be found.");
            Object.assign(student, payload, { updated_at: new Date().toISOString() });
            return student;
          }

          const student: StudentRow = {
            id: demoUuid(),
            school_id: state.school.id,
            photo_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          };
          state.students = [...state.students, student];
          return student;
        }),
      );
    }

    const supabase = createClient();
    const { data: profile } = await supabase.auth.getUser();
    const schoolId = await currentSchoolId();
    if (!schoolId || !profile.user) return fail("Your session has expired. Please sign in again.");

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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        state.students = state.students.filter((student) => student.id !== id);
        state.guardians = state.guardians.filter((link) => link.student_id !== id);
        state.requests = state.requests.filter((row) => row.student_id !== id);
      });
      return done(undefined);
    }

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
  const name = text(formData, "name");
  if (!name) return fail("Give the class a name, e.g. 7B.");

  const payload = {
    name,
    grade: text(formData, "grade"),
    room_number: text(formData, "room_number") || null,
    teacher_id: text(formData, "teacher_id") || null,
  };
  const id = text(formData, "id");

  try {
    if (IS_DEMO) {
      requireDemoAdmin();
      return done(
        demoMutate((state) => {
          const clash = state.classrooms.find(
            (room) => room.name.toLowerCase() === name.toLowerCase() && room.id !== id,
          );
          if (clash) throw new Error("A class with that name already exists.");

          if (id) {
            const room = state.classrooms.find((candidate) => candidate.id === id);
            if (!room) throw new Error("That class could not be found.");
            Object.assign(room, payload, { updated_at: new Date().toISOString() });
            return room;
          }

          const room: ClassroomRow = {
            id: demoUuid(),
            school_id: state.school.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          };
          state.classrooms = [...state.classrooms, room];
          return room;
        }),
      );
    }

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
          ? "A class with that name already exists."
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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        state.classrooms = state.classrooms.filter((room) => room.id !== id);
        state.students = state.students.map((student) =>
          student.classroom_id === id ? { ...student, classroom_id: null } : student,
        );
      });
      return done(undefined);
    }

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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        const existing = state.guardians.find(
          (link) => link.student_id === input.studentId && link.profile_id === input.profileId,
        );
        if (existing) {
          existing.relationship = input.relationship || "Guardian";
          existing.can_pickup = true;
          return;
        }
        state.guardians = [
          ...state.guardians,
          {
            id: demoUuid(),
            student_id: input.studentId,
            profile_id: input.profileId,
            relationship: input.relationship || "Guardian",
            is_primary: input.isPrimary ?? false,
            can_pickup: true,
            created_at: new Date().toISOString(),
          },
        ];
      });
      return done(undefined);
    }

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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        const link = state.guardians.find((candidate) => candidate.id === input.guardianId);
        if (link) link.can_pickup = input.canPickup;
      });
      return done(undefined);
    }

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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        state.guardians = state.guardians.filter((link) => link.id !== guardianId);
      });
      return done(undefined);
    }

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

  if (!full_name) return fail("Enter a full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");

  if (IS_DEMO) {
    try {
      requireDemoAdmin();
      demoMutate((state) => {
        state.profiles = [
          ...state.profiles,
          {
            id: demoUuid(),
            school_id: state.school.id,
            role,
            full_name,
            email,
            phone: text(formData, "phone") || null,
            vehicle_description: text(formData, "vehicle_description") || null,
            avatar_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
      return done({ email, invited: false, password: "demo-account (no password needed)" });
    } catch (error) {
      return fail(describeError(error));
    }
  }

  // Creating a login needs the Supabase service-role key, which can never be
  // shipped in a static bundle — anyone could read it. Account provisioning
  // therefore happens in the Supabase dashboard. See DEPLOYMENT.md.
  return fail(
    "Creating logins requires a server-side key, so it is done from the Supabase dashboard: " +
      "Authentication → Users → Add user, with user metadata { \"role\": \"" +
      role +
      "\", \"full_name\": \"" +
      full_name +
      "\", \"school_id\": \"<your school id>\" }. DEPLOYMENT.md has the full steps.",
  );
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
    phone: text(formData, "phone") || null,
    vehicle_description: text(formData, "vehicle_description") || null,
    is_active: formData.get("is_active") !== "false",
  };

  try {
    if (IS_DEMO) {
      const admin = requireDemoAdmin();
      if (id === admin.id && payload.role !== "admin") {
        return fail("You cannot remove your own administrator access.");
      }
      demoMutate((state) => {
        const person = state.profiles.find((candidate) => candidate.id === id);
        if (person) Object.assign(person, payload, { updated_at: new Date().toISOString() });
      });
      return done(undefined);
    }

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
    if (IS_DEMO) {
      requireDemoAdmin();
      demoMutate((state) => {
        Object.assign(state.school, payload, { updated_at: new Date().toISOString() });
      });
      return done(undefined);
    }

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
    if (IS_DEMO) {
      const profile = actor();
      demoMutate((state) => {
        const person = state.profiles.find((candidate) => candidate.id === profile.id);
        if (person) Object.assign(person, payload, { updated_at: new Date().toISOString() });
      });
      return done(undefined);
    }

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

  if (IS_DEMO) return fail("Passwords aren't used in the demo — pick any account to explore.");

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

  if (IS_DEMO) return ok({ sent: true });

  const redirectTo = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/callback`;
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });

  // Respond identically whether or not the address is registered.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return fail(describeError(error));
  }
  return ok({ sent: true });
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
