// Pure date helpers shared by the renderer. No DOM or app-state access, so they
// can be unit-tested in isolation (see frontend/tests/dates.test.ts).

/** Normalize a value to local midnight, or null when it is not a valid date. */
export function startOfDay(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Monday of the ISO week containing the given date (local time). */
export function getStartOfWeek(value: Date): Date {
  const date = startOfDay(value) ?? new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/** ISO-8601 week label, e.g. `2026-W24`. */
export function getIsoWeekValue(date: Date): string {
  const target = getStartOfWeek(date);
  const thursday = new Date(target);
  thursday.setDate(target.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekStart = getStartOfWeek(firstThursday);
  const week = Math.round((thursday.getTime() - firstWeekStart.getTime()) / 86400000 / 7) + 1;
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Parse an ISO week label back to the Monday of that week, or null if invalid. */
export function parseIsoWeekValue(value: string): Date | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = getStartOfWeek(jan4);
  const monday = new Date(firstWeekStart);
  monday.setDate(firstWeekStart.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Whole-day difference between two dates (left - right). */
export function daysBetween(left: Date, right: Date): number {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

/** `M/D` label for a date-like value, or `-` when missing/invalid. */
export function formatGanttDate(value: Date | string | null | undefined): string {
  const date = startOfDay(value);
  if (!date) return '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Return whichever date is earlier, treating null as "no constraint". */
export function mergeEarlierDate(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.getTime() < current.getTime() ? candidate : current;
}

/** Return whichever date is later, treating null as "no constraint". */
export function mergeLaterDate(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.getTime() > current.getTime() ? candidate : current;
}
