/**
 * Database types for the AGS Dismissal schema.
 *
 * Kept in sync by hand with `supabase/migrations`. If you change the schema,
 * regenerate with:
 *   supabase gen types typescript --local > src/lib/types/database.ts
 */

export type UserRole = "admin" | "staff" | "parent";

export type DismissalStatus =
  | "requested"
  | "waiting"
  | "called"
  | "ready"
  | "picked_up"
  | "cancelled";

export type RequestSource = "parent_app" | "staff" | "kiosk";

export type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  dismissal_start: string | null;
  dismissal_end: string | null;
  show_queue_position: boolean;
  show_pickup_number: boolean;
  allow_parent_cancel: boolean;
  board_message: string | null;
  board_accent: string;
  created_at: string;
  updated_at: string;
}

export type ProfileRow = {
  id: string;
  school_id: string | null;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  vehicle_description: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ClassGender = "boys" | "girls" | "mixed";

export type ClassroomRow = {
  id: string;
  school_id: string;
  /** The class code teachers use: "7g1", "8b2", "KG2-A". */
  name: string;
  /** Display label, e.g. "Grade 7" or "KG 2". */
  grade: string;
  /** "KG1"–"KG3" or "1"–"12". */
  level: string;
  gender: ClassGender;
  /** "1"–"6" for grades, "A"–"F" for kindergarten. */
  section: string;
  room_number: string | null;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentRow = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  grade: string;
  classroom_id: string | null;
  pickup_number: string | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GuardianRow = {
  id: string;
  student_id: string;
  profile_id: string;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
  created_at: string;
}

export type DismissalRequestRow = {
  id: string;
  school_id: string;
  student_id: string;
  status: DismissalStatus;
  source: RequestSource;
  requested_by: string | null;
  called_by: string | null;
  released_by: string | null;
  requested_at: string;
  called_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  vehicle_description: string | null;
  note: string | null;
  dismissal_date: string;
  student_name: string;
  student_grade: string | null;
  classroom_name: string | null;
  pickup_number: string | null;
  guardian_name: string | null;
  created_at: string;
  updated_at: string;
}

/** `dismissal_queue` view — the request row plus live position information. */
export type DismissalQueueRow = DismissalRequestRow & {
  queue_position: number | null;
  queue_length: number;
};

export type DismissalEventRow = {
  id: number;
  request_id: string;
  school_id: string;
  actor_id: string | null;
  actor_name: string | null;
  from_status: DismissalStatus | null;
  to_status: DismissalStatus;
  created_at: string;
}

type Writable<T> = Omit<T, "id" | "created_at" | "updated_at">;

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: Partial<Writable<SchoolRow>> & { name: string; slug: string; id?: string };
        Update: Partial<SchoolRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<Writable<ProfileRow>> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      classrooms: {
        Row: ClassroomRow;
        Insert: Partial<Writable<ClassroomRow>> & { school_id: string; name: string };
        Update: Partial<ClassroomRow>;
        Relationships: [];
      };
      students: {
        Row: StudentRow;
        Insert: Partial<Writable<StudentRow>> & { school_id: string; first_name: string };
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      guardians: {
        Row: GuardianRow;
        Insert: Partial<Writable<GuardianRow>> & { student_id: string; profile_id: string };
        Update: Partial<GuardianRow>;
        Relationships: [];
      };
      dismissal_requests: {
        Row: DismissalRequestRow;
        Insert: Partial<Writable<DismissalRequestRow>> & { student_id: string };
        Update: Partial<DismissalRequestRow>;
        Relationships: [];
      };
      dismissal_events: {
        Row: DismissalEventRow;
        Insert: Partial<Omit<DismissalEventRow, "id" | "created_at">> & {
          request_id: string;
          school_id: string;
          to_status: DismissalStatus;
        };
        Update: Partial<DismissalEventRow>;
        Relationships: [];
      };
    };
    Views: {
      dismissal_queue: {
        Row: DismissalQueueRow;
        Relationships: [];
      };
    };
    Functions: {
      request_dismissal: {
        Args: { p_student_ids: string[]; p_note?: string | null; p_vehicle?: string | null };
        Returns: DismissalRequestRow[];
      };
      staff_add_to_queue: {
        Args: { p_student_id: string; p_note?: string | null };
        Returns: DismissalRequestRow;
      };
      staff_call_student: {
        Args: { p_student_id: string };
        Returns: DismissalRequestRow;
      };
      set_request_status: {
        Args: { p_request_id: string; p_status: DismissalStatus };
        Returns: DismissalRequestRow;
      };
      call_next_student: {
        Args: Record<string, never>;
        Returns: DismissalRequestRow | null;
      };
      cancel_request: {
        Args: { p_request_id: string; p_reason?: string | null };
        Returns: DismissalRequestRow;
      };
      end_dismissal_session: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      dismissal_status: DismissalStatus;
      request_source: RequestSource;
      class_gender: ClassGender;
    };
    CompositeTypes: Record<string, never>;
  };
}
