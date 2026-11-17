/**
 * Repair item lifecycle.
 *
 *   New → Investigating → Taken Home (optional, between sessions) → Completed → Collected
 *
 * `status` holds the stage. When an item is Completed (or later Collected), `outcome`
 * holds how it ended: Repaired / Partially Repaired / Unrepairable / Advice Given.
 * Keeping the outcome separate means it isn't lost once the owner collects the item.
 *
 * Older items stored the outcome directly in `status` ("Repaired", "Not Repaired"...)
 * and used "Assigned" — the helpers below read those transparently, so no data
 * migration is needed.
 */

export const STAGES = ['New', 'Investigating', 'Taken Home', 'Completed', 'Collected'] as const;
export type Stage = typeof STAGES[number];

export const OUTCOMES = ['Repaired', 'Partially Repaired', 'Unrepairable', 'Advice Given'] as const;
export type Outcome = typeof OUTCOMES[number];

export const OUTCOME_OPTIONS: { value: Outcome; icon: string }[] = [
  { value: 'Repaired',           icon: '✅' },
  { value: 'Partially Repaired', icon: '🔧' },
  { value: 'Unrepairable',       icon: '❌' },
  { value: 'Advice Given',       icon: '💬' },
];

/** Keys used for reporting/charts: the open stages plus each outcome. */
export const REPORT_KEYS = ['New', 'Investigating', 'Taken Home', ...OUTCOMES, 'Completed'] as const;

export const STATUS_COLOURS: Record<string, string> = {
  'New': '#2196f3',
  'Investigating': '#ffc107',
  'Taken Home': '#ab47bc',
  'Repaired': '#4caf50',
  'Partially Repaired': '#ff9800',
  'Advice Given': '#42a5f5',
  'Unrepairable': '#f44336',
  'Completed': '#4caf50',
  'Collected': '#78909c',
};

interface HasStatus { status?: string | null; outcome?: string | null; }

function normaliseOutcome(v: string | null | undefined): Outcome | '' {
  if (!v) return '';
  if (v === 'Not Repaired') return 'Unrepairable';
  return (OUTCOMES as readonly string[]).includes(v) ? v as Outcome : '';
}

/** The item's stage, reading legacy values too. */
export function getStage(item: HasStatus | null | undefined): Stage {
  const s = item?.status || 'New';
  if ((STAGES as readonly string[]).includes(s)) return s as Stage;
  if (s === 'Assigned') return 'Investigating';
  if (normaliseOutcome(s)) return 'Completed';
  return 'New';
}

/** The completion outcome, or '' if not completed. */
export function getOutcome(item: HasStatus | null | undefined): Outcome | '' {
  return normaliseOutcome(item?.outcome) || normaliseOutcome(item?.status);
}

/** Completed or Collected — the repair work is finished. */
export function isDone(item: HasStatus | null | undefined): boolean {
  const st = getStage(item);
  return st === 'Completed' || st === 'Collected';
}

/** Still being worked on (New, Investigating or Taken Home). */
export function isOpen(item: HasStatus | null | undefined): boolean {
  return !isDone(item);
}

/** Human label, e.g. "Investigating", "Completed · Repaired", "Collected · Unrepairable". */
export function statusLabel(item: HasStatus | null | undefined): string {
  const st = getStage(item);
  const out = getOutcome(item);
  return (st === 'Completed' || st === 'Collected') && out ? `${st} · ${out}` : st;
}

/** Key for counting in reports: the stage while open, the outcome once done. */
export function reportKey(item: HasStatus | null | undefined): string {
  return isDone(item) ? (getOutcome(item) || 'Completed') : getStage(item);
}

/** CSS class suffix shared by the status badges across the app. */
export function statusClass(item: HasStatus | null | undefined): string {
  const st = getStage(item);
  if (st === 'Collected') return 'status-collected';
  if (st === 'Completed') {
    switch (getOutcome(item)) {
      case 'Partially Repaired': return 'status-partial';
      case 'Advice Given':       return 'status-advice';
      case 'Unrepairable':       return 'status-not';
      default:                   return 'status-repaired';
    }
  }
  if (st === 'Investigating') return 'status-assigned';
  if (st === 'Taken Home') return 'status-home';
  return 'status-new';
}

/**
 * Combined value for a single status dropdown:
 * "New" | "Investigating" | "Taken Home" | "Completed|Repaired" ... | "Collected".
 */
export function statusSelectValue(item: HasStatus | null | undefined): string {
  const st = getStage(item);
  if (st === 'Completed') return `Completed|${getOutcome(item) || 'Repaired'}`;
  return st;
}

/** Turn a dropdown value back into the fields to save. Collected keeps the existing outcome. */
export function fromStatusSelectValue(value: string, item?: HasStatus | null): { status: Stage; outcome?: string } {
  if (value.startsWith('Completed|')) return { status: 'Completed', outcome: value.slice('Completed|'.length) };
  if (value === 'Collected') {
    const out = getOutcome(item);
    return out ? { status: 'Collected', outcome: out } : { status: 'Collected' };
  }
  return { status: ((STAGES as readonly string[]).includes(value) ? value : 'New') as Stage };
}

/** Options HTML for the combined dropdown, in lifecycle order. */
export const STATUS_SELECT_OPTIONS: { group?: string; value: string; label: string }[] = [
  { value: 'New', label: 'New' },
  { value: 'Investigating', label: 'Investigating' },
  { value: 'Taken Home', label: 'Taken Home' },
  ...OUTCOMES.map(o => ({ group: 'Completed', value: `Completed|${o}`, label: o })),
  { value: 'Collected', label: 'Collected' },
];

/** Stage to use when a repairer is assigned/removed (mirrors the old New ⇄ Assigned rule). */
export function stageForRepairerChange(item: HasStatus | null | undefined, hasRepairer: boolean): Stage | null {
  const st = getStage(item);
  if (hasRepairer && st === 'New') return 'Investigating';
  if (!hasRepairer && st === 'Investigating') return 'New';
  return null;
}

/** Class names used by the dashboards' status pills ("pill-…"). */
export function pillClass(item: HasStatus | null | undefined): string {
  const map: Record<string, string> = {
    'status-new': 'pill-new', 'status-assigned': 'pill-assigned', 'status-home': 'pill-home',
    'status-repaired': 'pill-repaired', 'status-partial': 'pill-partial', 'status-advice': 'pill-advice',
    'status-not': 'pill-not-repaired', 'status-collected': 'pill-collected',
  };
  return map[statusClass(item)] || '';
}
