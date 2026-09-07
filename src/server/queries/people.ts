import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, UserRole } from "@/lib/types/database";

export async function getPeople(
  schoolId: string,
  roles: UserRole[],
): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("school_id", schoolId)
    .in("role", roles)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Guardian links keyed by parent profile id, for the People page. */
export async function getGuardianLinksBySchool(schoolId: string): Promise<
  {
    id: string;
    profile_id: string;
    student_id: string;
    relationship: string;
    can_pickup: boolean;
    is_primary: boolean;
    student: { id: string; first_name: string; last_name: string; grade: string } | null;
  }[]
> {
  const supabase = await createClient();
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId);

  if (studentsError) throw studentsError;
  const ids = (students ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("guardians")
    .select(
      `id, profile_id, student_id, relationship, can_pickup, is_primary,
       student:students ( id, first_name, last_name, grade )`,
    )
    .in("student_id", ids)
    .returns<
      {
        id: string;
        profile_id: string;
        student_id: string;
        relationship: string;
        can_pickup: boolean;
        is_primary: boolean;
        student: { id: string; first_name: string; last_name: string; grade: string } | null;
      }[]
    >();

  if (error) throw error;
  return data ?? [];
}
