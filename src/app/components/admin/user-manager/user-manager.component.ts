import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable } from 'rxjs';
import { RepairService } from '../../../services/repair.service';
import { AuthService } from '../../../services/auth.service';

import { DialogService } from '../../../services/dialog.service';
import { Functions } from '@angular/fire/functions';
import { httpsCallable } from 'firebase/functions';
interface UserRow {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastSeen: any;
  lastPage?: string;
  lastDevice?: string;
  isAdmin: boolean;
  isApproved: boolean;
}

type StatusFilter = 'all' | 'waiting' | 'approved' | 'admin';
type SeenFilter = '' | '7' | '30' | '90' | 'old';

@Component({
  selector: 'app-user-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>👤 Users</h3>
      </div>
      <p class="intro">
        Anyone can sign in with Google or email, but they can't see or change any repair
        data until you <strong>approve</strong> them here. Admins are always approved.
      </p>

      <ng-container *ngIf="view$ | async as v">
      <div class="filters">
        <div class="chips">
          <button class="chip" *ngFor="let s of statusOptions" [class.active]="status === s.value" (click)="setStatus(s.value)">
            {{ s.label }} <span class="n">{{ v.counts[s.value] }}</span>
          </button>
        </div>
        <div class="filter-row">
          <input type="search" class="f-input" placeholder="Search name or email" autocomplete="off"
                 [ngModel]="search" (ngModelChange)="setSearch($event)">
          <select class="f-input f-select" [ngModel]="seen" (ngModelChange)="setSeen($event)" title="Last seen">
            <option value="">Last seen: any time</option>
            <option value="7">Seen in the last 7 days</option>
            <option value="30">Seen in the last 30 days</option>
            <option value="90">Seen in the last 90 days</option>
            <option value="old">Not seen for 90+ days</option>
          </select>
          <button class="btn-clear" *ngIf="isFiltered" (click)="clearFilters()">Clear</button>
        </div>
        <div class="f-summary" *ngIf="isFiltered">Showing {{ v.users.length }} of {{ v.total }} users</div>
      </div>

      <div class="user-list">
        <div *ngIf="v.total === 0" class="empty-state">
          No users have logged in yet.
        </div>
        <div *ngIf="v.total > 0 && v.users.length === 0" class="empty-state">
          No users match these filters.
        </div>

        <div class="user-row" *ngFor="let user of v.users; trackBy: trackId">
          <div class="user-info">
            <div class="avatar" [style.backgroundImage]="user.photoURL ? 'url(' + user.photoURL + ')' : 'none'">
              <span *ngIf="!user.photoURL">{{ (user.displayName || user.email || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div class="user-details">
              <span class="user-name">{{ user.displayName || user.email || 'Unknown User' }}</span>
              <span class="user-email" *ngIf="user.displayName && user.email">{{ user.email }}</span>
              <span class="last-seen" *ngIf="user.lastSeen">Last seen: {{ user.lastSeen.toDate() | date:'medium' }}</span>
              <span class="last-seen" *ngIf="user.lastPage">Last used: {{ user.lastPage }}<ng-container *ngIf="user.lastDevice"> · {{ user.lastDevice }}</ng-container></span>
            </div>
          </div>
          <div class="user-actions">
            <span class="badge admin-badge" *ngIf="user.isAdmin">Admin</span>
            <ng-container *ngIf="!user.isAdmin">
              <span class="badge pending-badge" *ngIf="!user.isApproved">Waiting for approval</span>
              <button class="btn-toggle-admin" [class.approve]="!user.isApproved" [class.revoke]="user.isApproved"
                      (click)="toggleApproved(user)" [disabled]="loading[user.id]">
                {{ loading[user.id] ? '...' : (user.isApproved ? 'Remove approval' : 'Approve') }}
              </button>
            </ng-container>
            <button
              class="btn-toggle-admin"
              [class.revoke]="user.isAdmin"
              (click)="toggleAdmin(user)"
              [disabled]="loading[user.id]">
              {{ loading[user.id] ? '...' : (user.isAdmin ? 'Revoke Admin' : 'Make Admin') }}
            </button>
            <button *ngIf="user.id !== myUid" class="btn-delete" (click)="deleteUser(user)"
                    [disabled]="loading[user.id]" title="Delete this user">🗑</button>
          </div>
        </div>
      </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .manager-section {
      max-width: 700px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .section-header h3 {
      margin: 0;
      color: white;
    }
    .user-list {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .user-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      gap: 1rem;
    }
    @media (max-width: 500px) {
      .user-row {
        flex-direction: column;
        align-items: flex-start;
      }
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }
    .avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      background-color: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.7);
      flex-shrink: 0;
    }
    .user-details {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }
    .user-name {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }
    .user-email {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.5);
    }
    .last-seen {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.35);
    }
    .user-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .admin-badge {
      background: rgba(0, 242, 255, 0.15);
      color: var(--accent-color, #00f2ff);
      border: 1px solid rgba(0, 242, 255, 0.3);
    }
    .btn-toggle-admin {
      padding: 0.45rem 1rem;
      border-radius: 6px;
      border: 1px solid rgba(0, 242, 255, 0.4);
      background: rgba(0, 242, 255, 0.08);
      color: var(--accent-color, #00f2ff);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-toggle-admin:hover:not(:disabled) {
      background: rgba(0, 242, 255, 0.18);
    }
    .btn-toggle-admin.revoke {
      border-color: rgba(255, 89, 89, 0.4);
      background: rgba(255, 89, 89, 0.08);
      color: #ff5959;
    }
    .btn-toggle-admin.revoke:hover:not(:disabled) {
      background: rgba(255, 89, 89, 0.18);
    }
    .btn-toggle-admin:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .user-actions { flex-wrap: wrap; }
    .filters { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
      border-radius: 99px; padding: 0.35rem 0.8rem; font-size: 0.84rem; cursor: pointer; font-family: inherit;
    }
    .chip.active { background: rgba(0,242,255,0.12); border-color: rgba(0,242,255,0.5); color: #00f2ff; font-weight: 700; }
    .chip .n { opacity: 0.6; margin-left: 0.2rem; font-weight: 400; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .f-input {
      flex: 1 1 200px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: white;
      border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.9rem; font-family: inherit;
    }
    .f-select { flex: 0 1 230px; }
    .f-select option { background: #14182a; }
    .btn-clear {
      background: none; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.75);
      border-radius: 8px; padding: 0.5rem 0.8rem; cursor: pointer; font-family: inherit; font-size: 0.85rem;
    }
    .f-summary { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
    .btn-delete {
      padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid rgba(255, 89, 89, 0.35);
      background: none; color: #ff5959; font-size: 0.95rem; cursor: pointer; line-height: 1;
    }
    .btn-delete:hover:not(:disabled) { background: rgba(255, 89, 89, 0.15); }
    .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
    .intro { margin: -0.75rem 0 1.25rem; font-size: 0.88rem; color: rgba(255,255,255,0.55); line-height: 1.5; }
    .intro strong { color: white; }
    .pending-badge {
      background: rgba(255, 183, 77, 0.15);
      color: #ffb74d;
      border: 1px solid rgba(255, 183, 77, 0.35);
    }
    .btn-toggle-admin.approve {
      border-color: rgba(102, 187, 106, 0.5);
      background: rgba(102, 187, 106, 0.12);
      color: #81c784;
    }
    .btn-toggle-admin.approve:hover:not(:disabled) { background: rgba(102, 187, 106, 0.22); }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.1);
    }
  `]
})
export class UserManagerComponent implements OnInit {
  private dialog = inject(DialogService);
  private repairService = inject(RepairService);
  private authService = inject(AuthService);

  private functions = inject(Functions);

  loading: { [uid: string]: boolean } = {};
  /** The signed-in admin — they can't delete themselves. */
  myUid: string | null = null;

  users$: Observable<UserRow[]> = combineLatest([
    this.repairService.getUsers(),
    this.repairService.getAdmins(),
    this.repairService.getVolunteers()
  ]).pipe(
    map(([users, adminIds, volunteerIds]) =>
      users.map(u => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
        lastSeen: u.lastSeen,
        lastPage: u.lastPage,
        lastDevice: u.lastDevice,
        isAdmin: adminIds.includes(u.id),
        isApproved: adminIds.includes(u.id) || volunteerIds.includes(u.id)
      }))
        // People waiting for approval first, then alphabetical.
        .sort((a, b) => Number(a.isApproved) - Number(b.isApproved)
          || (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
    )
  );

  // ---- Filters ----
  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'waiting', label: '⏳ Waiting' },
    { value: 'approved', label: '✅ Approved' },
    { value: 'admin', label: '🛡 Admins' },
  ];
  status: StatusFilter = 'all';
  search = '';
  seen: SeenFilter = '';
  private filter$ = new BehaviorSubject<void>(undefined);

  get isFiltered(): boolean { return this.status !== 'all' || !!this.search.trim() || !!this.seen; }

  setStatus(v: StatusFilter) { this.status = v; this.filter$.next(); }
  setSearch(v: string) { this.search = v || ''; this.filter$.next(); }
  setSeen(v: SeenFilter) { this.seen = v; this.filter$.next(); }
  clearFilters() { this.status = 'all'; this.search = ''; this.seen = ''; this.filter$.next(); }

  trackId = (_: number, u: UserRow) => u.id;

  view$ = combineLatest([this.users$, this.filter$]).pipe(
    map(([users]) => {
      const term = this.search.trim().toLowerCase();
      const now = Date.now();
      const daysSince = (u: UserRow) => u.lastSeen?.toMillis ? (now - u.lastSeen.toMillis()) / 86400000 : Infinity;
      const bySearchAndSeen = users.filter(u =>
        (!term || (u.displayName || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)) &&
        (!this.seen || (this.seen === 'old' ? daysSince(u) > 90 : daysSince(u) <= Number(this.seen))));
      const matches = (u: UserRow, s: StatusFilter) =>
        s === 'all' || (s === 'waiting' && !u.isApproved) || (s === 'approved' && u.isApproved && !u.isAdmin) || (s === 'admin' && u.isAdmin);
      const counts = Object.fromEntries(this.statusOptions.map(o => [o.value, bySearchAndSeen.filter(u => matches(u, o.value)).length])) as Record<StatusFilter, number>;
      return { users: bySearchAndSeen.filter(u => matches(u, this.status)), counts, total: users.length };
    })
  );

  ngOnInit() {
    this.authService.user$.subscribe(u => (this.myUid = u?.uid ?? null));
  }

  async deleteUser(user: UserRow) {
    const name = user.displayName || user.email || 'this user';
    const ok = await this.dialog.confirm({
      title: `Delete ${name}?`,
      message: 'This deletes their sign-in account, their approval' + (user.isAdmin ? ' and admin access' : '') +
        ' and their entries in the activity log. Repair records they worked on are kept.\n\n' +
        'If they sign in again with Google they will appear as a new person waiting for approval.',
      confirmText: 'Delete user', danger: true,
    });
    if (!ok) return;
    this.loading[user.id] = true;
    try {
      await httpsCallable(this.functions, 'deleteUserAccount')({ uid: user.id });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      this.dialog.error(error?.message ? `Couldn't delete ${name}: ${error.message}` : `Couldn't delete ${name}. Please try again.`);
    } finally {
      this.loading[user.id] = false;
    }
  }

  async toggleApproved(user: UserRow) {
    if (user.isApproved && !(await this.dialog.confirm({
      title: `Remove approval for ${user.displayName || user.email || 'this user'}?`,
      message: 'They will no longer be able to see any repair information.',
      confirmText: 'Remove approval', danger: true,
    }))) return;
    this.loading[user.id] = true;
    try {
      const me = await firstValueFrom(this.authService.user$);
      await this.repairService.setVolunteerStatus(user.id, !user.isApproved, me?.uid);
    } catch (error) {
      console.error('Error changing approval:', error);
      this.dialog.error("Couldn't change approval. Only admins can approve volunteers.");
    } finally {
      this.loading[user.id] = false;
    }
  }

  async toggleAdmin(user: UserRow) {
    this.loading[user.id] = true;
    try {
      // Someone who stops being an admin stays an approved volunteer rather than being locked out.
      if (user.isAdmin) {
        const me = await firstValueFrom(this.authService.user$);
        await this.repairService.setVolunteerStatus(user.id, true, me?.uid);
      }
      await this.repairService.setAdminStatus(user.id, !user.isAdmin);
    } catch (error) {
      console.error('Error toggling admin:', error);
    } finally {
      this.loading[user.id] = false;
    }
  }
}
