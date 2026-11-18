import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { AppNotification, NOTIFICATION_KINDS, NotificationKind, NotificationService } from '../../services/notification.service';
import { RepairService } from '../../services/repair.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';

type AgeFilter = 'today' | '7' | '30' | 'all';

const PAGE_STEP = 50;

/** Admin-only list of every notification, with filters for person, type and age. */
@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="head">
        <h2>🔔 Notifications</h2>
        <a routerLink="/admin/users" class="head-link">Admin → Users</a>
      </div>

      <div class="type-chips">
        <button class="chip" [class.active]="kind === ''" (click)="setKind('')">All <span class="n">{{ countFor('') }}</span></button>
        <button class="chip" *ngFor="let k of kinds" [class.active]="kind === k.value" (click)="setKind(k.value)">
          {{ k.icon }} {{ k.label }} <span class="n">{{ countFor(k.value) }}</span>
        </button>
      </div>

      <div class="filters">
        <label class="f">
          <span>Person</span>
          <input type="search" [(ngModel)]="person" (ngModelChange)="apply()" list="notif-people"
                 placeholder="Name or email" autocomplete="off">
          <datalist id="notif-people"><option *ngFor="let p of people" [value]="p"></option></datalist>
        </label>
        <label class="f">
          <span>Type</span>
          <select [(ngModel)]="kind" (ngModelChange)="apply()">
            <option value="">All types</option>
            <option *ngFor="let k of kinds" [value]="k.value">{{ k.label }}</option>
          </select>
        </label>
        <label class="f">
          <span>How old</span>
          <select [(ngModel)]="age" (ngModelChange)="apply()">
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">Any time</option>
          </select>
        </label>
        <button class="btn-clear" *ngIf="isFiltered" (click)="clear()">Clear filters</button>
      </div>

      <div class="summary" *ngIf="loaded">
        {{ filtered.length }} notification{{ filtered.length === 1 ? '' : 's' }}
        <span *ngIf="isFiltered"> of {{ all.length }}</span>
      </div>

      <div class="empty" *ngIf="loaded && !filtered.length">No notifications match these filters.</div>
      <div class="empty" *ngIf="!loaded">Loading…</div>

      <div class="list">
        <ng-container *ngFor="let n of filtered.slice(0, shown); let i = index; trackBy: trackKey">
          <div class="day" *ngIf="i === 0 || dayKey(n) !== dayKey(filtered[i - 1])">{{ dayLabel(n) }}</div>
          <div class="note" [class.waiting]="n.kind === 'waiting'">
            <div class="avatar" [style.backgroundImage]="n.photoURL ? 'url(' + n.photoURL + ')' : 'none'">
              <span *ngIf="!n.photoURL">{{ n.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="text">
              <div>
                <strong class="name" (click)="filterPerson(n)" title="Show only {{ n.name }}">{{ n.name }}</strong>
                {{ describe(n) }}
              </div>
              <div class="sub">
                <span class="tag" [ngClass]="'tag-' + n.kind">{{ kindLabel(n.kind) }}</span>
                <span *ngIf="n.at">{{ n.at | date:'HH:mm' }}</span>
                <span *ngIf="n.kind === 'approved' && n.by">· by {{ n.by }}</span>
                <span *ngIf="n.kind === 'signin' && n.device">· {{ n.device }}</span>
                <span *ngIf="n.email && n.email !== n.name" class="email">· {{ n.email }}</span>
              </div>
            </div>
            <button *ngIf="n.kind === 'waiting'" class="btn-approve" [disabled]="busy[n.uid]" (click)="approve(n)">
              {{ busy[n.uid] ? '…' : 'Approve' }}
            </button>
          </div>
        </ng-container>
      </div>

      <button class="btn-more" *ngIf="filtered.length > shown" (click)="shown = shown + step">
        Show older ({{ filtered.length - shown }} more)
      </button>

      <p class="foot">Sign-ins come from the activity log, which keeps 90 days.</p>
    </div>
  `,
  styles: [`
    .page { max-width: 820px; margin: 0 auto; padding: 1.5rem 1rem 4rem; color: white; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.5rem; }
    .head-link { color: #00f2ff; font-size: 0.88rem; text-decoration: none; }
    .head-link:hover { text-decoration: underline; }

    .type-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
    .chip {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
      border-radius: 99px; padding: 0.35rem 0.8rem; font-size: 0.84rem; cursor: pointer; font-family: inherit;
    }
    .chip.active { background: rgba(0,242,255,0.12); border-color: rgba(0,242,255,0.5); color: #00f2ff; font-weight: 700; }
    .chip .n { opacity: 0.6; margin-left: 0.2rem; font-weight: 400; }

    .filters { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: flex-end; margin-bottom: 0.8rem; }
    .f { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: rgba(255,255,255,0.55); flex: 1 1 160px; }
    .f input, .f select {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: white;
      border-radius: 8px; padding: 0.5rem 0.6rem; font-size: 0.9rem; font-family: inherit;
    }
    .f select option { background: #14182a; }
    .btn-clear {
      background: none; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.75);
      border-radius: 8px; padding: 0.5rem 0.8rem; cursor: pointer; font-family: inherit; font-size: 0.85rem;
    }
    .btn-clear:hover { color: white; border-color: rgba(255,255,255,0.4); }

    .summary { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-bottom: 0.4rem; }
    .empty { padding: 2rem 0; text-align: center; color: rgba(255,255,255,0.5); }

    .list { display: flex; flex-direction: column; }
    .day {
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: rgba(255,255,255,0.45); padding: 1rem 0.2rem 0.4rem;
    }
    .note {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.8rem; border-radius: 10px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 0.35rem;
    }
    .note.waiting { border-color: rgba(255,69,0,0.55); background: rgba(255,69,0,0.07); }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background: rgba(0,242,255,0.15) center/cover;
      display: flex; align-items: center; justify-content: center; color: #00f2ff; font-weight: 700;
    }
    .text { flex: 1; min-width: 0; font-size: 0.9rem; line-height: 1.4; }
    .name { cursor: pointer; }
    .name:hover { text-decoration: underline; }
    .sub { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; font-size: 0.76rem; color: rgba(255,255,255,0.5); margin-top: 0.15rem; }
    .email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .tag { font-size: 0.68rem; font-weight: 700; padding: 0.05rem 0.45rem; border-radius: 99px; border: 1px solid; }
    .tag-waiting  { color: #ffab91; border-color: rgba(255,112,67,0.5); }
    .tag-approved { color: #81c784; border-color: rgba(102,187,106,0.5); }
    .tag-signin   { color: #90caf9; border-color: rgba(66,165,245,0.5); }
    .btn-approve {
      flex-shrink: 0; background: rgba(102,187,106,0.15); border: 1px solid rgba(102,187,106,0.5); color: #81c784;
      border-radius: 8px; padding: 0.45rem 0.85rem; font-weight: 700; font-size: 0.82rem; cursor: pointer; font-family: inherit;
    }
    .btn-approve:hover:not(:disabled) { background: rgba(102,187,106,0.28); }
    .btn-more {
      display: block; margin: 0.8rem auto 0; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
      color: white; border-radius: 8px; padding: 0.55rem 1.1rem; cursor: pointer; font-family: inherit;
    }
    .foot { margin-top: 1.5rem; font-size: 0.75rem; color: rgba(255,255,255,0.35); text-align: center; }
  `]
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  private notifications = inject(NotificationService);
  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private dialog = inject(DialogService);

  readonly kinds = NOTIFICATION_KINDS;
  readonly step = PAGE_STEP;

  all: AppNotification[] = [];
  filtered: AppNotification[] = [];
  people: string[] = [];
  loaded = false;
  shown = PAGE_STEP;
  busy: Record<string, boolean> = {};

  person = '';
  kind: NotificationKind | '' = '';
  age: AgeFilter = '7';

  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.notifications.all$.subscribe(all => {
      this.all = all;
      this.people = [...new Set(all.map(n => n.name))].sort((a, b) => a.localeCompare(b));
      this.loaded = true;
      this.apply(false);
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  get isFiltered(): boolean { return !!this.person || !!this.kind || this.age !== 'all'; }

  setKind(k: NotificationKind | '') { this.kind = k; this.apply(); }

  filterPerson(n: AppNotification) { this.person = n.name; this.apply(); }

  clear() { this.person = ''; this.kind = ''; this.age = 'all'; this.apply(); }

  /** Re-filter. Changing a filter goes back to the first page; live updates keep the place. */
  apply(resetPage = true) {
    if (resetPage) this.shown = PAGE_STEP;
    this.filtered = this.matchingPersonAndAge().filter(n => !this.kind || n.kind === this.kind);
  }

  /** Count for each type chip, using the person and age filters. */
  countFor(kind: NotificationKind | ''): number {
    return this.matchingPersonAndAge().filter(n => !kind || n.kind === kind).length;
  }

  private matchingPersonAndAge(): AppNotification[] {
    const term = this.person.trim().toLowerCase();
    const since = this.sinceTime();
    return this.all.filter(n =>
      // People waiting for approval always show — they still need dealing with.
      (n.kind === 'waiting' || since === null || (n.at?.getTime() ?? 0) >= since) &&
      (!term || n.name.toLowerCase().includes(term) || n.email.toLowerCase().includes(term)));
  }

  private sinceTime(): number | null {
    if (this.age === 'all') return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (this.age !== 'today') start.setDate(start.getDate() - (Number(this.age) - 1));
    return start.getTime();
  }

  describe(n: AppNotification): string {
    switch (n.kind) {
      case 'waiting':  return 'is waiting for approval';
      case 'approved': return 'was approved';
      default:         return 'signed in';
    }
  }

  kindLabel(k: NotificationKind): string {
    return this.kinds.find(x => x.value === k)?.label ?? k;
  }

  dayKey(n: AppNotification): string {
    return n.at ? n.at.toDateString() : '';
  }

  dayLabel(n: AppNotification): string {
    if (!n.at) return 'Unknown date';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(n.at); d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return n.at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  trackKey = (_: number, n: AppNotification) => n.key;

  async approve(n: AppNotification) {
    this.busy[n.uid] = true;
    try {
      const me = await firstValueFrom(this.authService.user$);
      await this.repairService.setVolunteerStatus(n.uid, true, me?.uid);
    } catch (e) {
      console.error('Approve failed:', e);
      this.dialog.error(`Couldn't approve ${n.name}. Please try again from Admin → Users.`);
    } finally {
      this.busy[n.uid] = false;
    }
  }
}
