import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, limit, orderBy, query, where } from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, map, of, shareReplay, startWith } from 'rxjs';
import { RepairService } from './repair.service';

export type NotificationKind = 'waiting' | 'approved' | 'signin';

export const NOTIFICATION_KINDS: { value: NotificationKind; label: string; icon: string }[] = [
  { value: 'waiting',  label: 'Waiting for approval', icon: '⏳' },
  { value: 'approved', label: 'Approved',             icon: '✅' },
  { value: 'signin',   label: 'Signed in',            icon: '👋' },
];

export interface AppNotification {
  key: string;            // unique, for *ngFor tracking
  kind: NotificationKind;
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  at: Date | null;        // when it happened (waiting: when they last signed in)
  by?: string;            // approved: who approved them
  device?: string;        // signin: e.g. "iPhone · Safari"
}

/** How many sign-ins to load. The activity log only keeps 90 days anyway. */
const SIGNIN_LIMIT = 500;

/**
 * Admin notifications, built from data the app already keeps — nothing extra is stored:
 *  - waiting:  signed-in accounts with no volunteer/admin record (users collection)
 *  - approved: volunteer records (approvedAt / approvedBy)
 *  - signin:   "Opened the app" entries in the activity log
 * Only admins can read these collections, so only subscribe from admin-only screens.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private repairService = inject(RepairService);

  private signins$ = (collectionData(
    query(collection(this.firestore, 'activity'), where('type', '==', 'signin'), orderBy('at', 'desc'), limit(SIGNIN_LIMIT)),
    { idField: 'id' }
  ) as Observable<any[]>).pipe(
    catchError(err => { console.warn('Sign-in notifications unavailable:', err); return of([] as any[]); }),
    startWith([] as any[]),
  );

  /** Every notification, newest first. */
  readonly all$: Observable<AppNotification[]> = combineLatest([
    this.repairService.getUsers(),
    this.repairService.getAdmins(),
    this.repairService.getVolunteerRecords(),
    this.signins$,
  ]).pipe(
    map(([users, adminIds, records, signins]) => {
      const byId = new Map<string, any>(users.map(u => [u.id, u]));
      const volunteerIds = new Set(records.map(r => r.id));
      const nameOf = (uid?: string | null, fallback?: string | null) => {
        const u = uid ? byId.get(uid) : undefined;
        return (u?.displayName || u?.email || fallback || '').trim();
      };
      const toDate = (t: any): Date | null => (t?.toDate ? t.toDate() : null);

      const waiting: AppNotification[] = users
        .filter(u => !adminIds.includes(u.id) && !volunteerIds.has(u.id))
        .map(u => ({
          key: 'w-' + u.id, kind: 'waiting', uid: u.id,
          name: nameOf(u.id) || 'Someone', email: u.email || '', photoURL: u.photoURL,
          at: toDate(u.lastSeen),
        }));

      const approved: AppNotification[] = records
        .filter(r => r.approvedAt?.toDate)
        .map(r => ({
          key: 'a-' + r.id, kind: 'approved', uid: r.id,
          name: nameOf(r.id) || 'Someone', email: byId.get(r.id)?.email || '', photoURL: byId.get(r.id)?.photoURL,
          at: toDate(r.approvedAt), by: nameOf(r.approvedBy),
        }));

      const signedIn: AppNotification[] = signins.map(s => ({
        key: 's-' + s.id, kind: 'signin', uid: s.uid,
        name: nameOf(s.uid, s.name || s.email) || 'Someone', email: s.email || '', photoURL: byId.get(s.uid)?.photoURL,
        at: toDate(s.at), device: s.device,
      }));

      return [...waiting, ...approved, ...signedIn]
        .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
