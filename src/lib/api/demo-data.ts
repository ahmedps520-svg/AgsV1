import type {
  ClassroomRow,
  DismissalRequestRow,
  GuardianRow,
  ProfileRow,
  SchoolRow,
  StudentRow,
} from "@/lib/types/database";
import { BRAND } from "@/lib/brand";

/** Everything the demo school is seeded with. Mirrors `supabase/seed.sql`. */
export interface DemoSnapshot {
  school: SchoolRow;
  profiles: ProfileRow[];
  classrooms: ClassroomRow[];
  students: StudentRow[];
  guardians: GuardianRow[];
  requests: DismissalRequestRow[];
}

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const now = () => new Date().toISOString();

function profile(
  id: string,
  role: ProfileRow["role"],
  full_name: string,
  email: string,
  extra: Partial<ProfileRow> = {},
): ProfileRow {
  return {
    id,
    school_id: SCHOOL_ID,
    role,
    full_name,
    email,
    phone: null,
    vehicle_description: null,
    avatar_url: null,
    is_active: true,
    created_at: now(),
    updated_at: now(),
    ...extra,
  };
}

export const DEMO_ACCOUNTS = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    email: "admin@ags.demo",
    role: "admin" as const,
    name: "Layla Haddad",
    blurb: "Manage the roster, accounts and dismissal settings.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "teacher@ags.demo",
    role: "staff" as const,
    name: "Omar Nasser",
    blurb: "Run the live dismissal queue.",
  },
  {
    id: "22222222-2222-4222-8222-222222222223",
    email: "board@ags.demo",
    role: "display" as const,
    name: "Main Lobby Screen",
    blurb: "The read-only hallway display.",
  },
  {
    id: "22222222-2222-4222-8222-222222222224",
    email: "parent@ags.demo",
    role: "parent" as const,
    name: "Fatima AlShehri",
    blurb: "Parent of Ahmed (Grade 7) and Salman (Grade 3).",
  },
  {
    id: "22222222-2222-4222-8222-222222222225",
    email: "driver@ags.demo",
    role: "parent" as const,
    name: "Yousef Karim",
    blurb: "Authorised driver for the AlShehri family.",
  },
];

const ROOMS: [string, string, string][] = [
  ["7B", "Grade 7", "B-204"],
  ["7A", "Grade 7", "B-202"],
  ["3C", "Grade 3", "A-110"],
  ["3A", "Grade 3", "A-104"],
  ["KG2", "KG 2", "A-011"],
  ["5A", "Grade 5", "B-118"],
];

const PUPILS: [string, string, string, string, string][] = [
  ["Ahmed", "AlShehri", "Grade 7", "7B", "104"],
  ["Salman", "AlShehri", "Grade 3", "3C", "104"],
  ["Noor", "Rahman", "Grade 7", "7A", "211"],
  ["Zayd", "Hassan", "Grade 3", "3A", "307"],
  ["Maryam", "Idris", "KG 2", "KG2", "412"],
  ["Layan", "Othman", "Grade 5", "5A", "158"],
  ["Bilal", "Farouk", "Grade 5", "5A", "162"],
  ["Hana", "Mansour", "Grade 7", "7B", "190"],
  ["Tariq", "Aziz", "KG 2", "KG2", "223"],
  ["Sara", "Nabil", "Grade 3", "3C", "275"],
];

export function buildDemoSnapshot(): DemoSnapshot {
  const school: SchoolRow = {
    id: SCHOOL_ID,
    name: BRAND.name,
    slug: "ags",
    logo_url: null,
    timezone: "Asia/Riyadh",
    dismissal_start: "15:00",
    dismissal_end: "16:00",
    show_queue_position: true,
    show_pickup_number: true,
    allow_parent_cancel: true,
    board_message: "Please stay in your vehicle until your student is walked out.",
    board_accent: "navy",
    created_at: now(),
    updated_at: now(),
  };

  const classrooms: ClassroomRow[] = ROOMS.map(([name, grade, room_number], index) => ({
    id: `c0000000-0000-4000-8000-00000000000${index}`,
    school_id: SCHOOL_ID,
    name,
    grade,
    room_number,
    teacher_id: name === "7B" ? DEMO_ACCOUNTS[1].id : null,
    created_at: now(),
    updated_at: now(),
  }));

  const students: StudentRow[] = PUPILS.map(
    ([first_name, last_name, grade, room, pickup_number], index) => ({
      id: `50000000-0000-4000-8000-00000000000${index}`,
      school_id: SCHOOL_ID,
      first_name,
      last_name,
      grade,
      classroom_id: classrooms.find((c) => c.name === room)?.id ?? null,
      pickup_number,
      photo_url: null,
      notes: null,
      is_active: true,
      created_at: now(),
      updated_at: now(),
    }),
  );

  const profiles: ProfileRow[] = DEMO_ACCOUNTS.map((account) =>
    profile(account.id, account.role, account.name, account.email, {
      vehicle_description:
        account.email === "parent@ags.demo"
          ? "White Toyota Land Cruiser · ABC 1234"
          : account.email === "driver@ags.demo"
            ? "Grey Hyundai Sonata · XYZ 8891"
            : null,
    }),
  );

  const ahmed = students[0].id;
  const salman = students[1].id;
  const parentId = DEMO_ACCOUNTS[3].id;
  const driverId = DEMO_ACCOUNTS[4].id;

  const guardians: GuardianRow[] = [
    [ahmed, parentId, "Mother", true],
    [salman, parentId, "Mother", true],
    [ahmed, driverId, "Authorised driver", false],
    [salman, driverId, "Authorised driver", false],
  ].map(([student_id, profile_id, relationship, is_primary], index) => ({
    id: `90000000-0000-4000-8000-00000000000${index}`,
    student_id: student_id as string,
    profile_id: profile_id as string,
    relationship: relationship as string,
    is_primary: is_primary as boolean,
    can_pickup: true,
    created_at: now(),
  }));

  return { school, profiles, classrooms, students, guardians, requests: [] };
}
