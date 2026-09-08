import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Ahmed AlShehri" -> "AA". Falls back gracefully for single names. */
export function initials(name: string): string {
  // Only letters count. A name carrying a bracket, a hyphen or a title would
  // otherwise put punctuation in the avatar, which reads as a rendering fault.
  const parts = name
    .split(/[\s\u00A0]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type IntlLocale = "en" | "ar";

/**
 * The BCP-47 tag to format with.
 *
 * Arabic is pinned to the Gregorian calendar and Latin digits: `ar-SA` would
 * otherwise render Hijri dates and Eastern Arabic numerals, which is not what a
 * school timetable means, and Latin digits sit correctly beside class codes
 * like 7b1.
 */
function tag(locale: IntlLocale = "en"): string {
  return locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US";
}

/** 3:42 PM, rendered in the school's timezone so every device agrees. */
export function formatTime(
  value: string | Date | null | undefined,
  timeZone?: string,
  locale: IntlLocale = "en",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

export function formatDate(
  value: string | Date,
  timeZone?: string,
  locale: IntlLocale = "en",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

/** "just now" / "4 min ago" / "منذ ٤ دقائق" — compact enough for a card. */
export function timeAgo(
  value: string | Date | null | undefined,
  now: number = Date.now(),
  locale: IntlLocale = "en",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  const relative = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto", style: "short" });

  if (seconds < 45) return relative.format(0, "second");
  if (seconds < 3600) return relative.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86_400) return relative.format(-Math.round(seconds / 3600), "hour");
  return relative.format(-Math.round(seconds / 86_400), "day");
}

/** Elapsed time as a running clock: "04:31". Used for wait timers. */
export function elapsed(value: string | Date | null | undefined, now: number = Date.now()): string {
  if (!value) return "0:00";
  const date = typeof value === "string" ? new Date(value) : value;
  const total = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Deterministic accent index so a student keeps the same avatar colour. */
export function hashToIndex(value: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % buckets;
}

export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}
