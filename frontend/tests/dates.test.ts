import { describe, expect, it } from 'vitest';
import {
  startOfDay,
  getStartOfWeek,
  getIsoWeekValue,
  parseIsoWeekValue,
  daysBetween,
  formatGanttDate,
  mergeEarlierDate,
  mergeLaterDate,
} from '../scripts/lib/dates';

describe('startOfDay', () => {
  it('returns null for empty or invalid values', () => {
    expect(startOfDay(null)).toBeNull();
    expect(startOfDay('')).toBeNull();
    expect(startOfDay('not-a-date')).toBeNull();
  });

  it('zeroes the time portion', () => {
    const result = startOfDay(new Date(2026, 5, 11, 14, 30, 15));
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(0);
    expect(result!.getMinutes()).toBe(0);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getDate()).toBe(11);
  });
});

describe('getStartOfWeek', () => {
  it('returns the Monday of the week', () => {
    // 2026-06-11 is a Thursday; Monday of that week is 2026-06-08.
    const monday = getStartOfWeek(new Date(2026, 5, 11));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(8);
  });

  it('treats Sunday as the end of the previous week', () => {
    // 2026-06-14 is a Sunday; its week still starts 2026-06-08.
    const monday = getStartOfWeek(new Date(2026, 5, 14));
    expect(monday.getDate()).toBe(8);
  });
});

describe('ISO week round-trip', () => {
  it('formats a week label', () => {
    expect(getIsoWeekValue(new Date(2026, 5, 11))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('parses back to the Monday of the same week', () => {
    const date = new Date(2026, 5, 11);
    const label = getIsoWeekValue(date);
    const parsed = parseIsoWeekValue(label);
    expect(parsed).not.toBeNull();
    expect(parsed!.getTime()).toBe(getStartOfWeek(date).getTime());
  });

  it('rejects malformed week labels', () => {
    expect(parseIsoWeekValue('2026-06')).toBeNull();
    expect(parseIsoWeekValue('2026-W00')).toBeNull();
    expect(parseIsoWeekValue('2026-W54')).toBeNull();
    expect(parseIsoWeekValue('garbage')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween(new Date(2026, 5, 11), new Date(2026, 5, 1))).toBe(10);
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 11))).toBe(-10);
    expect(daysBetween(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0);
  });
});

describe('formatGanttDate', () => {
  it('formats as M/D', () => {
    expect(formatGanttDate(new Date(2026, 5, 11))).toBe('6/11');
  });

  it('returns a dash for missing values', () => {
    expect(formatGanttDate(null)).toBe('-');
    expect(formatGanttDate('nope')).toBe('-');
  });
});

describe('mergeEarlierDate / mergeLaterDate', () => {
  const early = new Date(2026, 0, 1);
  const late = new Date(2026, 11, 31);

  it('treats null as no constraint', () => {
    expect(mergeEarlierDate(null, early)).toBe(early);
    expect(mergeEarlierDate(early, null)).toBe(early);
    expect(mergeLaterDate(null, late)).toBe(late);
    expect(mergeLaterDate(late, null)).toBe(late);
  });

  it('picks the earlier or later of two dates', () => {
    expect(mergeEarlierDate(late, early)).toBe(early);
    expect(mergeLaterDate(early, late)).toBe(late);
  });
});
