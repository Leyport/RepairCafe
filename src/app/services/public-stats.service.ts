import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, getDoc, setDoc } from '@angular/fire/firestore';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, debounceTime, filter, map, switchMap } from 'rxjs/operators';
import { RepairItem } from '../models/repair-item.model';
import { rcDayKey } from '../utils/rc-day';
import { RepairService } from './repair.service';
import { AuthService } from './auth.service';

/**
 * Anonymous, counts-only summary of each session, published so the public /stats page (and
 * other websites embedding it) never need access to the repair items, which hold visitors'
 * names and phone numbers.
 */
export const PUBLIC_STATS_DOC = 'public_stats/sessions';

export interface PublicSessionStats {
  date: string;          // YYYY-MM-DD
  items: number;
  visitors: number;
  repaired: number;
  partlyRepaired: number;
  advice: number;
  notRepaired: number;
  inProgress: number;
  categories: Record<string, number>;
}

export interface PublicStats {
  updated: string;       // ISO timestamp
  sessions: PublicSessionStats[];   // newest first
}

const CATEGORY_NAMES: Record<string, string> = {
  electrical: 'Electrical', electronics: 'Electrical', textile: 'Textiles', textiles: 'Textiles',
  clothing: 'Textiles', fabric: 'Textiles', ornament: 'Ornaments', mechanical: 'Mechanical',
  furniture: 'Furniture', toy: 'Toys', clock: 'Clocks', jewelry: 'Jewellery', jewellery: 'Jewellery',
  bicycle: 'Bicycles',
};

function categoryName(cat: string | undefined): string {
  return CATEGORY_NAMES[(cat || '').trim().toLowerCase()] ?? 'Other';
}

export function buildPublicStats(items: RepairItem[]): PublicSessionStats[] {
  const bySession = new Map<string, RepairItem[]>();
  for (const item of items) {
    const key = rcDayKey(item.RCDay);
    if (!key) continue;
    const list = bySession.get(key);
    if (list) list.push(item); else bySession.set(key, [item]);
  }

  return [...bySession.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const count = (status: string) => list.filter(i => i.status === status).length;
      const categories: Record<string, number> = {};
      for (const i of list) {
        const name = categoryName(i.category);
        categories[name] = (categories[name] || 0) + 1;
      }
      return {
        date,
        items: list.length,
        visitors: new Set(list.map(i => (i.owner || '').trim().toLowerCase()).filter(Boolean)).size,
        repaired: count('Repaired'),
        partlyRepaired: count('Partially Repaired'),
        advice: count('Advice Given'),
        notRepaired: count('Not Repaired'),
        inProgress: list.filter(i => !i.status || i.status === 'New' || i.status === 'Assigned').length,
        categories,
      };
    });
}

@Injectable({ providedIn: 'root' })
export class PublicStatsService {
  private firestore = inject(Firestore);
  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private ref = doc(this.firestore, PUBLIC_STATS_DOC);
  private lastPublished = '';

  /** The published summary, for the public page. Emits null if nothing has been published yet. */
  getStats(): Observable<PublicStats | null> {
    return docData(this.ref).pipe(
      map(d => (d as PublicStats) ?? null),
      catchError(() => of(null))
    );
  }

  /**
   * While an approved volunteer is signed in, keep the published summary in step with the repair items.
   * Only writes when the numbers actually change.
   */
  startAutoPublish(): Subscription {
    return this.authService.access$.pipe(
      switchMap(a => (a === 'approved' ? this.repairService.getRepairItems() : of(null))),
      filter((items): items is RepairItem[] => items !== null),
      debounceTime(3000),
    ).subscribe(items => this.publish(items).catch(err => console.warn('Could not publish stats', err)));
  }

  private async publish(items: RepairItem[]): Promise<void> {
    const sessions = buildPublicStats(items);
    const fingerprint = JSON.stringify(sessions);
    if (fingerprint === this.lastPublished) return;
    if (!this.lastPublished) {
      // First check this visit: compare with what's already published to avoid a needless write.
      const current = (await getDoc(this.ref)).data() as PublicStats | undefined;
      if (current && JSON.stringify(current.sessions) === fingerprint) {
        this.lastPublished = fingerprint;
        return;
      }
    }
    await setDoc(this.ref, { updated: new Date().toISOString(), sessions });
    this.lastPublished = fingerprint;
  }
}
