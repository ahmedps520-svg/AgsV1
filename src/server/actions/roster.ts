"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, type Session } from "@/server/session";
import type { ClassroomRow, StudentRow } from "@/lib/types/database";
import { describeError, fail, ok, type ActionResult } from "./result";

type AdminGuard =
  | { ok: false; error: string }
  | { ok: true; session: Session; schoolId: string };

async function adminSession(): Promise<AdminGuard> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (session.profile.role !== "admin") {
    return { ok: false, error: "Only school administrators can change the roster." };
  }
  if (!session.profile.school_id) {
    return { ok: false, error: "Your account is not linked to a school yet." };
  }
  return { ok: true, session, schoolId: session.profile.school_id };
}

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value === "" ? null : (value ?? null)));

/* -------------------------------------------------------------- students -- */

const studentSchema = z.object({
  first_name: z.string().trim().min(1, "Enter the student's first name.").max(80),
  last_name: z.string().trim().max(80).default(""),
  grade: z.string().trim().max(40).default(""),
  classroom_id: z.string().uuid().nullable().optional(),
  pickup_number: optionalText,
  notes: z.string().trim().max(500).optional().transform((v) => (v === "" ? null : (v ?? null))),
  is_active: z.boolean().default(true),
});

function readStudentForm(formData: FormData) {
  const classroom = String(formData.get("classroom_id") ?? "").trim();
  return studentSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name") ?? "",
    grade: formData.get("grade") ?? "",
    classroom_id: classroom === "" ? null : classroom,
    pickup_number: formData.get("pickup_number") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    is_active: formData.get("is_active") !== "false",
  });
}

export async function saveStudentAction(
  _prev: ActionResult<StudentRow> | null,
  formData: FormData,
): Promise<ActionResult<StudentRow>> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const parsed = readStudentForm(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the student details.");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();

  const payload = { ...parsed.data, school_id: guard.schoolId };
  const query = id
    ? supabase.from("students").update(payload).eq("id", id).select().single()
    : supabase.from("students").insert(payload).select().single();

  const { data, error } = await query;
  if (error) return fail(describeError(error));

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return ok(data as StudentRow);
}

export async function deleteStudentAction(id: string): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return fail(describeError(error));

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return ok();
}

/* ------------------------------------------------------------ classrooms -- */

const classroomSchema = z.object({
  name: z.string().trim().min(1, "Give the class a name, e.g. 7B.").max(60),
  grade: z.string().trim().max(40).default(""),
  room_number: optionalText,
  teacher_id: z.string().uuid().nullable().optional(),
});

export async function saveClassroomAction(
  _prev: ActionResult<ClassroomRow> | null,
  formData: FormData,
): Promise<ActionResult<ClassroomRow>> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const teacher = String(formData.get("teacher_id") ?? "").trim();
  const parsed = classroomSchema.safeParse({
    name: formData.get("name"),
    grade: formData.get("grade") ?? "",
    room_number: formData.get("room_number") ?? undefined,
    teacher_id: teacher === "" ? null : teacher,
  });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the class details.");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const payload = { ...parsed.data, school_id: guard.schoolId };

  const query = id
    ? supabase.from("classrooms").update(payload).eq("id", id).select().single()
    : supabase.from("classrooms").insert(payload).select().single();

  const { data, error } = await query;
  if (error) {
    return fail(
      (error as { code?: string }).code === "23505"
        ? "A class with that name already exists."
        : describeError(error),
    );
  }

  revalidatePath("/classrooms");
  revalidatePath("/students");
  return ok(data as ClassroomRow);
}

export async function deleteClassroomAction(id: string): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const { error } = await supabase.from("classrooms").delete().eq("id", id);
  if (error) return fail(describeError(error));

  revalidatePath("/classrooms");
  revalidatePath("/students");
  return ok();
}
