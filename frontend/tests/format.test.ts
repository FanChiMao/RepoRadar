import { describe, expect, it } from 'vitest';
import {
  clampUiScale,
  fmtDate,
  fmtShortDate,
  fmtFileSize,
  toSafeHref,
  isArrangeFilterUrl,
  isDiscussionTableDelimiter,
  parseDiscussionTableRow,
} from '../scripts/lib/format';

describe('clampUiScale', () => {
  it('clamps to the 90-120 range', () => {
    expect(clampUiScale(50)).toBe(90);
    expect(clampUiScale(999)).toBe(120);
  });

  it('snaps to the nearest multiple of 5', () => {
    expect(clampUiScale(101)).toBe(100);
    expect(clampUiScale(103)).toBe(105);
    expect(clampUiScale(100)).toBe(100);
  });
});

describe('fmtDate', () => {
  it('returns a dash for empty values', () => {
    expect(fmtDate('')).toBe('-');
    expect(fmtDate(null)).toBe('-');
    expect(fmtDate(undefined)).toBe('-');
  });

  it('passes through unparseable strings', () => {
    expect(fmtDate('not-a-date')).toBe('not-a-date');
  });

  it('formats parseable timestamps to a non-empty string', () => {
    const out = fmtDate('2026-06-11T08:30:00Z');
    expect(out).not.toBe('-');
    expect(typeof out).toBe('string');
  });
});

describe('fmtShortDate', () => {
  it('returns a dash for empty values', () => {
    expect(fmtShortDate('')).toBe('-');
    expect(fmtShortDate(null)).toBe('-');
  });

  it('passes through unparseable strings', () => {
    expect(fmtShortDate('nope')).toBe('nope');
  });

  it('formats parseable values as M/D', () => {
    expect(fmtShortDate('2026-06-11T12:00:00')).toMatch(/^\d{1,2}\/\d{1,2}$/);
  });
});

describe('fmtFileSize', () => {
  it('formats bytes', () => {
    expect(fmtFileSize(0)).toBe('0 B');
    expect(fmtFileSize(512)).toBe('512 B');
    expect(fmtFileSize(null)).toBe('0 B');
  });

  it('formats kilobytes and megabytes', () => {
    expect(fmtFileSize(2048)).toBe('2.0 KB');
    expect(fmtFileSize(1024 * 1024 * 3)).toBe('3.0 MB');
  });
});

describe('toSafeHref', () => {
  it('allows safe schemes and relative links', () => {
    expect(toSafeHref('https://example.com')).toBe('https://example.com');
    expect(toSafeHref('http://example.com')).toBe('http://example.com');
    expect(toSafeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(toSafeHref('/path')).toBe('/path');
    expect(toSafeHref('./rel')).toBe('./rel');
    expect(toSafeHref('../up')).toBe('../up');
    expect(toSafeHref('#anchor')).toBe('#anchor');
  });

  it('collapses unsafe or empty values to #', () => {
    expect(toSafeHref('javascript:alert(1)')).toBe('#');
    expect(toSafeHref('data:text/html,evil')).toBe('#');
    expect(toSafeHref('')).toBe('#');
  });

  it('trims surrounding whitespace', () => {
    expect(toSafeHref('  https://example.com  ')).toBe('https://example.com');
  });
});

describe('isArrangeFilterUrl', () => {
  it('detects GitLab issues filter URLs', () => {
    expect(isArrangeFilterUrl('https://gitlab.com/group/proj/-/issues?state=opened')).toBe(true);
  });

  it('rejects single-issue URLs and plain text', () => {
    expect(isArrangeFilterUrl('https://gitlab.com/group/proj/-/issues/42')).toBe(false);
    expect(isArrangeFilterUrl('just text')).toBe(false);
  });
});

describe('discussion table parsing', () => {
  it('recognises delimiter rows', () => {
    expect(isDiscussionTableDelimiter('| --- | :---: |')).toBe(true);
    expect(isDiscussionTableDelimiter('|:---|---:|')).toBe(true);
  });

  it('rejects non-delimiter rows', () => {
    expect(isDiscussionTableDelimiter('| Name | Value |')).toBe(false);
    expect(isDiscussionTableDelimiter('no pipes here')).toBe(false);
  });

  it('splits a row into trimmed cells', () => {
    expect(parseDiscussionTableRow('| a | b | c |')).toEqual(['a', 'b', 'c']);
    expect(parseDiscussionTableRow('x | y')).toEqual(['x', 'y']);
  });
});
