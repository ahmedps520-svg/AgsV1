import type {
  ClassroomRow,
  DismissalRequestRow,
  GuardianRow,
  ProfileRow,
  SchoolRow,
  StudentRow,
} from "@/lib/types/database";
import { BRAND } from "@/lib/brand";
import {
  classCode,
  GRADE_LEVELS,
  isKg,
  KG_LEVELS,
  levelLabel,
  type ClassIdentity,
} from "@/lib/classes";
import type { MessageKey } from "@/lib/i18n/dictionary";

/** Everything the demo school is seeded with. */
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

export const DEMO_ACCOUNTS: {
  id: string;
  email: string;
  role: ProfileRow["role"];
  name: string;
  blurbKey: MessageKey;
  /** Class code the teacher opens by default. */
  homeroom?: string;
}[] = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    email: "admin@ags.demo",
    role: "admin",
    name: "Layla Haddad",
    blurbKey: "login.demo.blurb.admin",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "teacher@ags.demo",
    role: "staff",
    name: "Omar Nasser",
    blurbKey: "login.demo.blurb.staff",
    homeroom: "7b1",
  },
  {
    id: "22222222-2222-4222-8222-222222222226",
    email: "teacher.girls@ags.demo",
    role: "staff",
    name: "Huda AlAmri",
    blurbKey: "login.demo.blurb.staffGirls",
    homeroom: "5g1",
  },
  {
    id: "22222222-2222-4222-8222-222222222223",
    email: "screen@ags.demo",
    role: "display",
    name: "Classroom screen",
    blurbKey: "login.demo.blurb.display",
  },
  {
    id: "22222222-2222-4222-8222-222222222224",
    email: "parent@ags.demo",
    role: "parent",
    name: "Fatima AlShehri",
    blurbKey: "login.demo.blurb.parent",
  },
  {
    id: "22222222-2222-4222-8222-222222222225",
    email: "driver@ags.demo",
    role: "parent",
    name: "Yousef Karim",
    blurbKey: "login.demo.blurb.driver",
  },
];

/* ---------------------------------------------------------- name pools -- */

const BOYS = [
  "Mohammed", "Abdullah", "Faisal", "Khalid", "Saud", "Fahad", "Turki", "Nawaf", "Omar",
  "Yousef", "Abdulrahman", "Sultan", "Bandar", "Majed", "Rayan", "Ziyad", "Hamad", "Talal",
  "Nasser", "Mishal", "Saad", "Waleed", "Ibrahim", "Yazeed", "Meshari", "Anas", "Hassan",
  "Abdulaziz", "Rakan", "Mansour",
];

const GIRLS = [
  "Sara", "Lama", "Reem", "Hind", "Maha", "Jood", "Layan", "Dana", "Shahad", "Lujain",
  "Raghad", "Ghala", "Aljohara", "Haifa", "Rawan", "Deema", "Wed", "Aseel", "Munira", "Hessa",
  "Lulwa", "Maryam", "Fatimah", "Alanoud", "Nouf", "Shaikha", "Rana", "Joury", "Taleen", "Sadeem",
];

const FAMILIES = [
  "AlQahtani", "AlGhamdi", "AlOtaibi", "AlHarbi", "AlDosari", "AlMutairi", "AlZahrani",
  "AlSubaie", "AlAmri", "AlShammari", "AlAnazi", "AlJuhani", "AlMalki", "AlRashidi", "AlYami",
  "AlBishi", "AlSaeed", "AlHazmi", "AlAsmari", "AlKhaldi", "AlTamimi", "AlSuwailem", "AlFaifi",
  "AlMansour", "AlSalem", "AlHamdan", "AlBalawi", "AlRuwaili", "AlShahrani", "AlOmari",
];

/** Small seeded PRNG so the demo roster is identical on every device. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- classes -- */

/** The classes the demo school runs: KG A–C mixed, grades 1–12 boys + girls, sections 1–2. */
function demoClassIdentities(): ClassIdentity[] {
  const list: ClassIdentity[] = [];
  for (const level of KG_LEVELS) {
    for (const section of ["A", "B", "C"]) list.push({ level, gender: "mixed", section });
  }
  for (const level of GRADE_LEVELS) {
    for (const gender of ["boys", "girls"] as const) {
      for (const section of ["1", "2"]) list.push({ level, gender, section });
    }
  }
  return list;
}

/* --------------------------------------------------------------- build -- */

export function buildDemoSnapshot(): DemoSnapshot {
  const school: SchoolRow = {
    id: SCHOOL_ID,
    name: BRAND.name,
    slug: "ags",
    logo_url: null,
    timezone: "Asia/Riyadh",
    dismissal_start: null,
    dismissal_end: null,
    show_queue_position: false,
    show_pickup_number: false,
    allow_parent_cancel: true,
    board_message: null,
    board_accent: "navy",
    created_at: now(),
    updated_at: now(),
  };

  const teacherByHomeroom = new Map(
    DEMO_ACCOUNTS.filter((account) => account.homeroom).map((account) => [account.homeroom!, account.id]),
  );

  const classrooms: ClassroomRow[] = demoClassIdentities().map((identity) => {
    const code = classCode(identity);
    return {
      id: `class-${code}`,
      school_id: SCHOOL_ID,
      name: code,
      grade: levelLabel(identity.level, "en"),
      level: identity.level,
      gender: identity.gender,
      section: identity.section,
      room_number: null,
      teacher_id: teacherByHomeroom.get(code) ?? null,
      created_at: now(),
      updated_at: now(),
    };
  });

  // The AlShehri family anchors the parent demo: two boys and a girl.
  const anchors: Record<string, [string, string][]> = {
    "7b1": [["Ahmed", "AlShehri"]],
    "3b1": [["Salman", "AlShehri"]],
    "5g1": [["Noura", "AlShehri"]],
  };

  const students: StudentRow[] = [];
  for (const room of classrooms) {
    const random = rng(room.name);
    const size = 12 + Math.floor(random() * 6); // 12–17 per class
    const seen = new Set<string>();
    const fixed = anchors[room.name] ?? [];

    const pickName = (): [string, string] => {
      const boysPool = room.gender === "girls" ? GIRLS : room.gender === "boys" ? BOYS : [...BOYS, ...GIRLS];
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const first = boysPool[Math.floor(random() * boysPool.length)];
        const family = FAMILIES[Math.floor(random() * FAMILIES.length)];
        const key = `${first} ${family}`;
        if (!seen.has(key)) {
          seen.add(key);
          return [first, family];
        }
      }
      return [boysPool[0], FAMILIES[0]];
    };

    const names: [string, string][] = [...fixed];
    while (names.length < size) names.push(pickName());

    names.forEach(([first_name, last_name], index) => {
      students.push({
        id: `student-${room.name}-${index}`,
        school_id: SCHOOL_ID,
        first_name,
        last_name,
        grade: room.grade,
        classroom_id: room.id,
        pickup_number: null,
        photo_url: null,
        notes: null,
        is_active: true,
        created_at: now(),
        updated_at: now(),
      });
    });
  }

  const profiles: ProfileRow[] = DEMO_ACCOUNTS.map((account) => ({
    id: account.id,
    school_id: SCHOOL_ID,
    role: account.role,
    full_name: account.name,
    email: account.email,
    phone: null,
    vehicle_description:
      account.email === "parent@ags.demo"
        ? "White Toyota Land Cruiser · ABC 1234"
        : account.email === "driver@ags.demo"
          ? "Grey Hyundai Sonata · XYZ 8891"
          : null,
    avatar_url: null,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  }));

  const byName = (first: string) =>
    students.find((student) => student.first_name === first && student.last_name === "AlShehri")!.id;
  const parentId = DEMO_ACCOUNTS.find((a) => a.email === "parent@ags.demo")!.id;
  const driverId = DEMO_ACCOUNTS.find((a) => a.email === "driver@ags.demo")!.id;

  const guardians: GuardianRow[] = (
    [
      [byName("Ahmed"), parentId, "Mother", true],
      [byName("Salman"), parentId, "Mother", true],
      [byName("Noura"), parentId, "Mother", true],
      [byName("Ahmed"), driverId, "Authorised driver", false],
      [byName("Salman"), driverId, "Authorised driver", false],
      [byName("Noura"), driverId, "Authorised driver", false],
    ] as [string, string, string, boolean][]
  ).map(([student_id, profile_id, relationship, is_primary], index) => ({
    id: `guardian-${index}`,
    student_id,
    profile_id,
    relationship,
    is_primary,
    can_pickup: true,
    created_at: now(),
  }));

  return { school, profiles, classrooms, students, guardians, requests: [] };
}

export { isKg };
