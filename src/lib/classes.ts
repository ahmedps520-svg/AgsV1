/**
 * How AGS names its classes.
 *
 *   KG1–KG3   mixed, lettered sections     → "KG2-A"
 *   Grade 1–12 boys and girls separately,
 *             numbered sections 1–6        → "7g1"  (grade 7, girls, section 1)
 *                                            "8b2"  (grade 8, boys,  section 2)
 */
import type { ClassroomRow } from "@/lib/types/database";
import type { Locale } from "@/lib/i18n/dictionary";

export type ClassGender = "boys" | "girls" | "mixed";

export const KG_LEVELS = ["KG1", "KG2", "KG3"] as const;
export const GRADE_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export const ALL_LEVELS = [...KG_LEVELS, ...GRADE_LEVELS] as const;
export const KG_SECTIONS = ["A", "B", "C", "D", "E", "F"] as const;
export const GRADE_SECTIONS = ["1", "2", "3", "4", "5", "6"] as const;

export type Level = (typeof ALL_LEVELS)[number];

export interface ClassIdentity {
  level: string;
  gender: ClassGender;
  section: string;
}

export function isKg(level: string): boolean {
  return level.toUpperCase().startsWith("KG");
}

export function classCode({ level, gender, section }: ClassIdentity): string {
  if (isKg(level)) return `${level.toUpperCase()}-${section.toUpperCase()}`;
  return `${level}${gender === "girls" ? "g" : "b"}${section}`;
}

export function parseClassCode(code: string): ClassIdentity | null {
  const kg = /^KG([1-3])-?([A-Z])$/i.exec(code.trim());
  if (kg) return { level: `KG${kg[1]}`, gender: "mixed", section: kg[2].toUpperCase() };

  const grade = /^(1[0-2]|[1-9])([bg])([1-6])$/i.exec(code.trim());
  if (grade) {
    return {
      level: grade[1],
      gender: grade[2].toLowerCase() === "g" ? "girls" : "boys",
      section: grade[3],
    };
  }
  return null;
}

const ARABIC_ORDINALS: Record<string, string> = {
  "1": "الأول",
  "2": "الثاني",
  "3": "الثالث",
  "4": "الرابع",
  "5": "الخامس",
  "6": "السادس",
  "7": "السابع",
  "8": "الثامن",
  "9": "التاسع",
  "10": "العاشر",
  "11": "الحادي عشر",
  "12": "الثاني عشر",
};

/** "Grade 7" / "KG 2" — or "الصف السابع" / "روضة 2". */
export function levelLabel(level: string, locale: Locale): string {
  if (isKg(level)) {
    const n = level.replace(/\D/g, "");
    return locale === "ar" ? `روضة ${n}` : `KG ${n}`;
  }
  return locale === "ar" ? `الصف ${ARABIC_ORDINALS[level] ?? level}` : `Grade ${level}`;
}

export function genderLabel(gender: ClassGender, locale: Locale): string {
  const labels: Record<ClassGender, [string, string]> = {
    boys: ["Boys", "بنين"],
    girls: ["Girls", "بنات"],
    mixed: ["Mixed", "مختلط"],
  };
  return labels[gender][locale === "ar" ? 1 : 0];
}

export function sectionLabel(section: string, locale: Locale): string {
  return locale === "ar" ? `شعبة ${section}` : `Section ${section}`;
}

/** "Grade 7 · Girls · Section 1" */
export function classLabel(cls: ClassIdentity, locale: Locale): string {
  const parts = [levelLabel(cls.level, locale)];
  if (!isKg(cls.level)) parts.push(genderLabel(cls.gender, locale));
  parts.push(sectionLabel(cls.section, locale));
  return parts.join(" · ");
}

/** Stable ordering: KG first, then grades ascending, boys before girls, then section. */
export function compareClasses(a: ClassIdentity, b: ClassIdentity): number {
  const rank = (level: string) => (isKg(level) ? Number(level.replace(/\D/g, "")) - 10 : Number(level));
  return (
    rank(a.level) - rank(b.level) ||
    a.gender.localeCompare(b.gender) ||
    a.section.localeCompare(b.section, undefined, { numeric: true })
  );
}

export function identityOf(room: Pick<ClassroomRow, "level" | "gender" | "section">): ClassIdentity {
  return { level: room.level, gender: room.gender, section: room.section };
}
