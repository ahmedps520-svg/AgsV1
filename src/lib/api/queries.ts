"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  ClassroomRow,
  DismissalQueueRow,
  GuardianRow,
  ProfileRow,
  StudentRow,
  UserRole,
} from "@/lib/types/database";
import { compareClasses } from "@/lib/classes";

/**
 * Every read in the app.
 *
 * These run in the browser against Supabase, so Row Level Security is what
 * decides the result: a shared section account sees only its own classes, a
 * parent only their own children. Nothing here needs to re-check that.
 */

export type ClassroomSummary = Pick<
  ClassroomRow,
  "id" | "name" | "grade" | "level" | "gender" | "section" | "room_number"
>;

export interface StudentWithClassroom extends StudentRow {
  classroom: ClassroomSummary | null;
}

export interface GuardianStudent {
  id: string;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
  student: StudentWithClassroom | null;
}

export interface StudentGuardianLink extends GuardianRow {
  profile: Pick<ProfileRow, "id" | "full_name" | "email" | "phone"> | null;
}

/** Today's date in the school's own timezone, as `YYYY-MM-DD`. */
export function schoolToday(timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* ----------------------------------------------------------------- queue -- */

export async function getQueue(schoolId: string, date: string): Promise<DismissalQueueRow[]> {
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

export async function getHistory(schoolId: string, date: string): Promise<DismissalQueueRow[]> {
  const rows = await getQueue(schoolId, date);
  return [...rows].sort((a, b) => b.requested_at.localeCompare(a.requested_at));
}

/* --------------------------------------------------------------- parents -- */

export async function getGuardianStudents(profileId: string): Promise<GuardianStudent[]> {
  const { data, error } = await createClient()
    .from("guardians")
    .select(
      `id, relationship, is_primary, can_pickup,
       student:students ( *, classroom:classrooms ( id, name, grade, level, gender, section, room_number ) )`,
    )
    .eq("profile_id", profileId)
    .returns<GuardianStudent[]>();

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.student?.is_active)
    .sort((a, b) => (a.student?.first_name ?? "").localeCompare(b.student?.first_name ?? ""));
}

export async function getGuardianRequests(studentIds: string[]): Promise<DismissalQueueRow[]> {
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

/* ---------------------------------------------------------------- roster -- */

export async function getStudents(
  schoolId: string,
  options: { search?: string; classroomId?: string; limit?: number } = {},
): Promise<StudentWithClassroom[]> {
  let query = createClient()
    .from("students")
    .select(`*, classroom:classrooms ( id, name, grade, level, gender, section, room_number )`)
    .eq("school_id", schoolId)
    .order("first_name", { ascending: true })
    .limit(options.limit ?? 500);

  if (options.classroomId) query = query.eq("classroom_id", options.classroomId);

  const term = options.search?.replace(/[(),*"\\]/g, " ").trim();
  if (term) {
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,grade.ilike.%${term}%,pickup_number.ilike.%${term}%`,
    );
  }

  const { data, error } = await query.returns<StudentWithClassroom[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClassrooms(schoolId: string): Promise<ClassroomRow[]> {
  const { data, error } = await createClient()
    .from("classrooms")
    .select("*")
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);
  return (data ?? []).sort(compareClasses);
}

/** A single class by its code ("7g1"), or null when it isn't set up. */
export async function getClassroomByCode(
  schoolId: string,
  code: string,
): Promise<ClassroomRow | null> {
  const wanted = code.trim().toLowerCase();

  const { data, error } = await createClient()
    .from("classrooms")
    .select("*")
    .eq("school_id", schoolId)
    .ilike("name", wanted)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Every active student in one class, sorted by name. */
export async function getClassRoster(classroomId: string): Promise<StudentRow[]> {
  const { data, error } = await createClient()
    .from("students")
    .select("*")
    .eq("classroom_id", classroomId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuardiansForStudents(
  studentIds: string[],
): Promise<StudentGuardianLink[]> {
  if (studentIds.length === 0) return [];

  const { data, error } = await createClient()
    .from("guardians")
    .select(`*, profile:profiles ( id, full_name, email, phone )`)
    .in("student_id", studentIds)
    .returns<StudentGuardianLink[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ---------------------------------------------------------------- people -- */

export async function getPeople(schoolId: string, roles: UserRole[]): Promise<ProfileRow[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("*")
    .eq("school_id", schoolId)
    .in("role", roles)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface SchoolGuardianLink {
  id: string;
  profile_id: string;
  student_id: string;
  relationship: string;
  can_pickup: boolean;
  is_primary: boolean;
  student: { id: string; first_name: string; last_name: string; grade: string } | null;
}

export async function getGuardianLinksBySchool(schoolId: string): Promise<SchoolGuardianLink[]> {
  const supabase = createClient();
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId);

  if (studentsError) throw new Error(studentsError.message);
  const ids = (students ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("guardians")
    .select(
      `id, profile_id, student_id, relationship, can_pickup, is_primary,
       student:students ( id, first_name, last_name, grade )`,
    )
    .in("student_id", ids)
    .returns<SchoolGuardianLink[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}
