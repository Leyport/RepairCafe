import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, combineLatest, firstValueFrom, map } from 'rxjs';
import { RepairService } from '../../services/repair.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  lastSeen?: any;
}

interface PastNote {
  id: string;
  name: string;
  photoURL?: string;
  approvedAt: any;
  approvedBy: string;
}

/** How many older notifications to show before "Show older". */
const HISTORY_STEP = 10;

/**
 * Admin-only notification bell in the header. Shows people who have signed in and are
 * waiting for approval, updates live, and lets the admin approve them straight away.
 * A short pop-up also appears when someone new starts waiting while the admin is signed in.
 * Below that, "Earlier" lists past notifications that have been dealt with (who was approved,
 * by whom and when), built from the approval records so nothing extra needs storing.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bell-wrap">
      <button class="btn-bell" [class.has-items]="pending.length" (click)="toggle()"
              [title]="pending.length ? pending.length + ' waiting for approval' : 'Notifications'">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="bell-count" *ngIf="pending.length">{{ pending.length }}</span>
      </button>

      <div class="panel" *ngIf="open">
        <div class="panel-head">Waiting for approval</div>
        <div class="panel-empty" *ngIf="!pending.length">Nothing needs your attention.</div>
        <div class="note" *ngFor="let u of pending">
          <div class="avatar" [style.backgroundImage]="u.photoURL ? 'url(' + u.photoURL + ')' : 'none'">
            <span *ngIf="!u.photoURL">{{ u.name.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="note-text">
            <strong>{{ u.name }}</strong> is waiting for approval
            <span class="note-sub" *ngIf="u.email && u.email !== u.name">{{ u.email }}</span>
            <span class="note-sub" *ngIf="u.lastSeen?.toDate">Signed in {{ u.lastSeen.toDate() | date:'d MMM, HH:mm' }}</span>
          </div>
          <button class="btn-approve" [disabled]="busy[u.id]" (click)="approve(u)">{{ busy[u.id] ? '…' : 'Approve' }}</button>
        </div>
        <ng-container *ngIf="history.length">
          <div class="panel-head earlier">Earlier</div>
          <div class="note past" *ngFor="let h of history.slice(0, historyShown)">
            <div class="avatar" [style.backgroundImage]="h.photoURL ? 'url(' + h.photoURL + ')' : 'none'">
              <span *ngIf="!h.photoURL">{{ h.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="note-text">
              <strong>{{ h.name }}</strong> was approved
              <span class="note-sub">{{ h.approvedBy ? 'by ' + h.approvedBy + ' · ' : '' }}{{ h.approvedAt.toDate() | date:'d MMM yyyy, HH:mm' }}</span>
            </div>
            <span class="done-tag">✓ Done</span>
          </div>
          <button class="panel-more" *ngIf="history.length > historyShown" (click)="showOlder()">
            Show older ({{ history.length - historyShown }} more)
          </button>
        </ng-container>

        <button class="panel-link" (click)="openUsers()">Open Admin → Users</button>
      </div>
    </div>

    <div class="toast" *ngIf="toast" (click)="openPanelFromToast()">
      <span class="toast-icon">🔔</span>
      <span><strong>{{ toast }}</strong> is waiting for approval. <u>Review</u></span>
      <button class="toast-close" (click)="$event.stopPropagation(); toast = ''">✕</button>
    </div>
  `,
  styles: [`
    .bell-wrap { position: relative; }
    .btn-bell {
      position: relative; display: flex; align-items: center; justify-content: center;
      padding: 0.8rem 1rem; border-radius: 12px; cursor: pointer;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white;
      transition: all 0.2s; font-family: inherit;
    }
    .btn-bell:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
    .btn-bell.has-items { border-color: rgba(255,69,0,0.6); }
    .bell-count {
      position: absolute; top: -6px; right: -6px; min-width: 1.4em; padding: 0.1rem 0.4rem;
      border-radius: 99px; background: rgba(255,69,0,0.95); color: white;
      font-size: 0.72rem; font-weight: 700; text-align: center; box-shadow: 0 2px 5px rgba(255,69,0,0.4);
    }
    .panel {
      position: absolute; right: 0; top: calc(100% + 8px); z-index: 1500; width: 320px; max-width: calc(100vw - 32px);
      background: #14182a; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5); padding: 0.5rem; text-align: left;
      max-height: min(70vh, 560px); overflow-y: auto;
    }
    .panel-head.earlier { margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.8rem; }
    .note.past { opacity: 0.75; }
    .done-tag { flex-shrink: 0; font-size: 0.74rem; font-weight: 700; color: rgba(129,199,132,0.85); }
    .panel-more {
      display: block; width: 100%; margin-top: 0.2rem; padding: 0.45rem; border: none; border-radius: 8px;
      background: none; color: rgba(255,255,255,0.6); font-size: 0.8rem; cursor: pointer; font-family: inherit;
    }
    .panel-more:hover { color: white; background: rgba(255,255,255,0.05); }
    .panel-head { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: rgba(255,255,255,0.5); padding: 0.4rem 0.5rem 0.6rem; }
    .panel-empty { padding: 0.6rem 0.5rem 0.8rem; color: rgba(255,255,255,0.5); font-size: 0.88rem; }
    .note { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.5rem; border-radius: 8px; }
    .note + .note { border-top: 1px solid rgba(255,255,255,0.06); }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; background: rgba(0,242,255,0.15) center/cover;
      display: flex; align-items: center; justify-content: center; color: #00f2ff; font-weight: 700;
    }
    .note-text { flex: 1; min-width: 0; font-size: 0.86rem; color: rgba(255,255,255,0.85); line-height: 1.35; }
    .note-sub { display: block; font-size: 0.76rem; color: rgba(255,255,255,0.45); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-approve {
      flex-shrink: 0; background: rgba(102,187,106,0.15); border: 1px solid rgba(102,187,106,0.5); color: #81c784;
      border-radius: 8px; padding: 0.4rem 0.75rem; font-weight: 700; font-size: 0.8rem; cursor: pointer; font-family: inherit;
    }
    .btn-approve:hover:not(:disabled) { background: rgba(102,187,106,0.28); }
    .panel-link {
      display: block; width: 100%; margin-top: 0.3rem; padding: 0.55rem; border: none; border-radius: 8px;
      background: rgba(255,255,255,0.05); color: #00f2ff; font-weight: 600; font-size: 0.82rem; cursor: pointer; font-family: inherit;
    }
    .panel-link:hover { background: rgba(255,255,255,0.1); }
    .toast {
      position: fixed; right: 16px; bottom: 16px; z-index: 2500; max-width: calc(100vw - 32px);
      display: flex; align-items: center; gap: 0.6rem; padding: 0.8rem 1rem; border-radius: 12px; cursor: pointer;
      background: #1d2340; border: 1px solid rgba(255,69,0,0.6); color: white; font-size: 0.9rem;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5); animation: slideIn 0.25s ease-out;
    }
    @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
    .toast-icon { font-size: 1.2rem; }
    .toast-close { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1rem; padding: 0 0.2rem; }
    .toast-close:hover { color: white; }
    @media (max-width: 768px) { .btn-bell { padding: 0.7rem 0.9rem; } }
  `]
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private host = inject(ElementRef);

  pending: PendingUser[] = [];
  history: PastNote[] = [];
  historyShown = HISTORY_STEP;
  open = false;
  toast = '';
  busy: Record<string, boolean> = {};

  private sub?: Subscription;
  private seen: Set<string> | null = null; // null until the first load, so existing waiters don't pop up
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.sub = combineLatest([
      this.repairService.getUsers(),
      this.repairService.getAdmins(),
      this.repairService.getVolunteerRecords(),
    ]).pipe(
      map(([users, adminIds, records]) => {
        const volunteerIds = records.map(r => r.id);
        const byId = new Map(users.map(u => [u.id, u]));
        const nameOf = (uid?: string | null) => {
          const u = uid ? byId.get(uid) : undefined;
          return u ? (u.displayName || u.email || '') : '';
        };
        this.history = records
          .filter(r => r.approvedAt?.toDate)
          .map((r): PastNote => ({
            id: r.id,
            name: nameOf(r.id) || 'Someone',
            photoURL: byId.get(r.id)?.photoURL,
            approvedAt: r.approvedAt,
            approvedBy: nameOf(r.approvedBy),
          }))
          .sort((a, b) => b.approvedAt.toMillis() - a.approvedAt.toMillis());
        return users
        .filter(u => !adminIds.includes(u.id) && !volunteerIds.includes(u.id))
        .map((u): PendingUser => ({
          id: u.id,
          name: u.displayName || u.email || 'Someone',
          email: u.email || '',
          photoURL: u.photoURL,
          lastSeen: u.lastSeen,
        }))
        .sort((a, b) => (b.lastSeen?.toMillis?.() ?? 0) - (a.lastSeen?.toMillis?.() ?? 0));
      })
    ).subscribe({
      next: pending => {
        if (this.seen) {
          const newcomer = pending.find(p => !this.seen!.has(p.id));
          if (newcomer) this.showToast(newcomer.name);
        }
        this.seen = new Set(pending.map(p => p.id));
        this.pending = pending;
      },
      error: err => console.error('Notifications unavailable:', err),
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  toggle() {
    this.open = !this.open;
    if (this.open) this.historyShown = HISTORY_STEP;
  }

  /** Close the panel when clicking anywhere else on the page. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.open && !this.host.nativeElement.contains(event.target)) this.open = false;
  }

  showOlder() { this.historyShown += HISTORY_STEP; }

  openPanelFromToast() {
    this.toast = '';
    this.open = true;
  }

  async approve(u: PendingUser) {
    this.busy[u.id] = true;
    try {
      const me = await firstValueFrom(this.authService.user$);
      await this.repairService.setVolunteerStatus(u.id, true, me?.uid);
    } catch (e) {
      console.error('Approve failed:', e);
      this.dialog.error(`Couldn't approve ${u.name}. Please try again from Admin → Users.`);
    } finally {
      this.busy[u.id] = false;
    }
  }

  openUsers() {
    this.open = false;
    this.router.navigate(['/admin/users']);
  }

  private showToast(name: string) {
    this.toast = name;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 15000);
  }
}
