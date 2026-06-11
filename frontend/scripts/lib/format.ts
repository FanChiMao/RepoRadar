// Pure formatting / parsing helpers shared by the renderer. No DOM or app-state
// access, so they can be unit-tested in isolation (see frontend/tests).

/** Clamp a UI scale percentage to the supported 90–120 range, snapped to 5. */
export function clampUiScale(value: number): number {
  return Math.min(120, Math.max(90, Math.round(value / 5) * 5));
}

/** Locale date-time string, `-` when empty, or the raw value when unparseable. */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-TW', { hour12: false });
}

/** `M/D` date string, `-` when empty, or the raw value when unparseable. */
export function fmtShortDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Human-readable file size (B / KB / MB). */
export function fmtFileSize(bytes: number | null | undefined): string {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Allow only safe link schemes; everything else collapses to `#`. */
export function toSafeHref(url: string): string {
  const trimmed = (url || '').trim();
  const normalized = trimmed.toLowerCase();
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('#')
  ) {
    return trimmed;
  }
  return '#';
}

/** True when the Arrange input looks like a GitLab issues filter URL. */
export function isArrangeFilterUrl(value: string): boolean {
  return /\/-\/issues\?/.test(value.trim());
}

/** True when a markdown line is a table delimiter row (e.g. `|---|:--:|`). */
export function isDiscussionTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** Split a markdown table row into trimmed cell values. */
export function parseDiscussionTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
