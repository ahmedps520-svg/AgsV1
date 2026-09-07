import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ClassroomRow,
  DismissalQueueRow,
  GuardianRow,
  StudentRow,
} from "@/lib/types/database";

/** Today's date in the school's own timezone, as `YYYY-MM-DD`. */
export function schoolToday(timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface StudentWithClassroom extends StudentRow {
  classroom: Pick<ClassroomRow, "id" | "name" | "grade" | "room_number"> | null;
}

export interface GuardianStudent {
  id: string;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
  student: StudentWithClassroom | null;
}

/** The full queue for a school on a given day (staff dashboard + board). */
export async function getQueue(
  schoolId: string,
  date: string,
): Promise<DismissalQueueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dismissal_queue")
    .select("*")
    .eq("school_id", schoolId)
    .eq("dismissal_date", date)
    .order("requested_at", { ascending: true })
    .returns<DismissalQueueRow[]>();

  if (error) throw error;
  return data ?? [];
}

/** Students a parent/driver is authorised to collect. */
export async function getGuardianStudents(profileId: string): Promise<GuardianStudent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .select(
      `id, relationship, is_primary, can_pickup,
       student:students (
         *,
         classroom:classrooms ( id, name, grade, room_number )
       )`,
    )
    .eq("profile_id", profileId)
    .returns<GuardianStudent[]>();

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.student?.is_active)
    .sort((a, b) => (a.student?.first_name ?? "").localeCompare(b.student?.first_name ?? ""));
}

/** Every dismissal touching this guardian's students, newest first. */
export async function getGuardianRequests(studentIds: string[]): Promise<DismissalQueueRow[]> {
  if (studentIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dismissal_queue")
    .select("*")
    .in("student_id", studentIds)
    .order("requested_at", { ascending: false })
    .limit(40)
    .returns<DismissalQueueRow[]>();

  if (error) throw error;
  return data ?? [];
}

/** Roster search used by "Add to queue" and the students admin page. */
export async function getStudents(
  schoolId: string,
  options: { search?: string; classroomId?: string; limit?: number } = {},
): Promise<StudentWithClassroom[]> {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select(`*, classroom:classrooms ( id, name, grade, room_number )`)
    .eq("school_id", schoolId)
    .order("first_name", { ascending: true })
    .limit(options.limit ?? 500);

  if (options.classroomId) query = query.eq("classroom_id", options.classroomId);

  const term = options.search?.trim();
  if (term) {
    const safe = term.replace(/[(),*"\\]/g, " ").trim();
    if (safe) {
      query = query.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,grade.ilike.%${safe}%,pickup_number.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query.returns<StudentWithClassroom[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getClassrooms(schoolId: string): Promise<ClassroomRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classrooms")
    .select("*")
    .eq("school_id", schoolId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface StudentGuardianLink extends GuardianRow {
  profile: { id: string; full_name: string; email: string | null; phone: string | null } | null;
}

/** Pickup permissions for a set of students (admin + staff context cards). */
export async function getGuardiansForStudents(
  studentIds: string[],
): Promise<StudentGuardianLink[]> {
  if (studentIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .select(`*, profile:profiles ( id, full_name, email, phone )`)
    .in("student_id", studentIds)
    .returns<StudentGuardianLink[]>();

  if (error) throw error;
  return data ?? [];
}

/** Historical dismissals for the history page. */
export async function getHistory(
  schoolId: string,
  date: string,
): Promise<DismissalQueueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dismissal_queue")
    .select("*")
    .eq("school_id", schoolId)
    .eq("dismissal_date", date)
    .order("requested_at", { ascending: false })
    .returns<DismissalQueueRow[]>();

  if (error) throw error;
  return data ?? [];
}
