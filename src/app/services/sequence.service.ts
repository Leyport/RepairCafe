import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, doc, getDocs, query, orderBy, limit, runTransaction, writeBatch, Timestamp
} from '@angular/fire/firestore';
import { rcDayKey } from '../utils/rc-day';

/**
 * Permanent reference numbers for repair items.
 *
 * Each repair item gets a `sequenceNumber` (1, 2, 3, ...) the first time it is saved. Unlike
 * `displayNumber`/`itemNumber`, which restart every session and change if an item is moved to
 * another session, the sequence number is never changed or reused. The next free number is kept
 * in `sys_counters/repairItems`.
 */
export const SEQUENCE_FIELD = 'sequenceNumber';
export const COUNTER_COLLECTION = 'sys_counters';
const REPAIR_COLLECTION = 'repairItems';

@Injectable({ providedIn: 'root' })
export class SequenceService {
  private firestore = inject(Firestore);

  /** Reserves `count` consecutive numbers and returns the first one. */
  async reserve(count: number): Promise<number> {
    if (count <= 0) return 0;
    // Never hand out a number already in use, even if the counter was cleared or an old backup
    // was restored: always start above the highest number on any item.
    const highest = await this.highestUsed();
    const counterRef = doc(this.firestore, COUNTER_COLLECTION, REPAIR_COLLECTION);
    return runTransaction(this.firestore, async tx => {
      const snap = await tx.get(counterRef);
      const stored = snap.exists() ? Number(snap.data()['next']) || 1 : 1;
      const first = Math.max(stored, highest + 1);
      tx.set(counterRef, { next: first + count, updatedAt: Timestamp.now() }, { merge: true });
      return first;
    });
  }

  /** Sequence numbers already held by documents in a collection, by document ID. */
  async existingNumbers(collectionName: string): Promise<Map<string, number>> {
    const snap = await getDocs(collection(this.firestore, collectionName));
    const result = new Map<string, number>();
    snap.forEach(d => {
      const n = d.data()[SEQUENCE_FIELD];
      if (typeof n === 'number') result.set(d.id, n);
    });
    return result;
  }

  /**
   * Gives every repair item that has no sequence number one, oldest session first, so the
   * numbers follow the order items were brought in. Items that already have one are untouched.
   */
  async assignMissing(onProgress?: (msg: string) => void): Promise<number> {
    const snap = await getDocs(collection(this.firestore, REPAIR_COLLECTION));
    const missing = snap.docs
      .filter(d => typeof d.data()[SEQUENCE_FIELD] !== 'number')
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          session: rcDayKey(data['RCDay']) || '9999',
          item: Number(data['itemNumber']) || 0,
          created: data['creationDate']?.toMillis?.() ?? 0,
        };
      })
      .sort((a, b) => a.session.localeCompare(b.session) || a.item - b.item || a.created - b.created);

    if (missing.length === 0) return 0;
    const first = await this.reserve(missing.length);

    for (let i = 0; i < missing.length; i += 450) {
      onProgress?.(`Numbering items ${i + 1}–${Math.min(i + 450, missing.length)} of ${missing.length}...`);
      const batch = writeBatch(this.firestore);
      missing.slice(i, i + 450).forEach((m, j) =>
        batch.update(doc(this.firestore, REPAIR_COLLECTION, m.id), { [SEQUENCE_FIELD]: first + i + j }));
      await batch.commit();
    }
    return missing.length;
  }

  private async highestUsed(): Promise<number> {
    const q = query(collection(this.firestore, REPAIR_COLLECTION), orderBy(SEQUENCE_FIELD, 'desc'), limit(1));
    const snap = await getDocs(q);
    const n = snap.docs[0]?.data()[SEQUENCE_FIELD];
    return typeof n === 'number' ? n : 0;
  }
}
