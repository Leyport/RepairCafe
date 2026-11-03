import { RepairItem } from '../models/repair-item.model';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Saturday, 17, 05, 2025" → "2025-05-17" (sortable), or '' if unparseable. */
export function rcDayKey(rcDay: string | undefined): string {
  const parts = (rcDay || '').split(',').map(p => p.trim());
  if (parts.length < 4) return '';
  const [d, m, y] = [parts[1], parts[2], parts[3]];
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "2026-09" → "Sep 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

/** Month an item was created, as "2026-09", or ''. */
export function createdMonthKey(item: Pick<RepairItem, 'creationDate'>): string {
  const d = (item.creationDate as any)?.toDate?.();
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
}

export interface SessionFilterOptions {
  years: string[];
  months: { key: string; label: string }[];
  sessions: { key: string; label: string }[];
  createdMonths: { key: string; label: string }[];
}

/** Year / month / session / created-month choices present in the items, newest first. */
export function buildSessionFilterOptions(items: Pick<RepairItem, 'RCDay' | 'creationDate'>[]): SessionFilterOptions {
  const sessionKeys = new Set<string>();
  for (const item of items) {
    const key = rcDayKey(item.RCDay);
    if (key) sessionKeys.add(key);
  }
  const sorted = [...sessionKeys].sort().reverse();
  const createdKeys = [...new Set(items.map(createdMonthKey).filter(Boolean))].sort().reverse();
  return {
    years: [...new Set(sorted.map(k => k.slice(0, 4)))],
    months: [...new Set(sorted.map(k => k.slice(0, 7)))].map(key => ({ key, label: monthLabel(key) })),
    sessions: sorted.map(key => {
      const [y, m, d] = key.split('-');
      return { key, label: `${parseInt(d, 10)} ${monthLabel(`${y}-${m}`)}` };
    }),
    createdMonths: createdKeys.map(key => ({ key, label: monthLabel(key) })),
  };
}

/** Session filter values are 'y:2026', 'm:2026-09' or 'd:2026-09-19'. */
export function matchesSessionFilter(rcDay: string | undefined, filter: string): boolean {
  if (!filter) return true;
  const key = rcDayKey(rcDay);
  const kind = filter.slice(0, 1);
  const value = filter.slice(2);
  if (kind === 'y') return key.slice(0, 4) === value;
  if (kind === 'm') return key.slice(0, 7) === value;
  if (kind === 'd') return key === value;
  return true;
}
