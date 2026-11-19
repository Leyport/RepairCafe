import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { RepairService } from '../../services/repair.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { AppNotification, NotificationService } from '../../services/notification.service';

/** How many recent sign-ins / approvals to show in the drop-down. */
const RECENT_COUNT = 6;

/**
 * Admin-only notification bell in the header. Shows people who have signed in and are
 * waiting for approval, updates live, and lets the admin approve them straight away.
 * A short pop-up also appears when someone new starts waiting while the admin is signed in.
 * Below that are the latest sign-ins and approvals, with a link to the full Notifications page.
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

      <div class="panel" *ngIf="open" [class.mobile]="mobileTop !== null"
           [style.top.px]="mobileTop" [style.maxHeight]="mobileTop !== null ? 'calc(100dvh - ' + (mobileTop + 12) + 'px)' : null">
        <div class="panel-head">Waiting for approval</div>
        <div class="panel-empty" *ngIf="!pending.length">Nothing needs your attention.</div>
        <div class="note" *ngFor="let u of pending; trackBy: trackKey">
          <div class="avatar" [style.backgroundImage]="u.photoURL ? 'url(' + u.photoURL + ')' : 'none'">
            <span *ngIf="!u.photoURL">{{ u.name.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="note-text">
            <strong>{{ u.name }}</strong> is waiting for approval
            <span class="note-sub" *ngIf="u.email && u.email !== u.name">{{ u.email }}</span>
            <span class="note-sub" *ngIf="u.at">Signed in {{ u.at | date:'d MMM, HH:mm' }}</span>
          </div>
          <button class="btn-approve" [disabled]="busy[u.uid]" (click)="approve(u)">{{ busy[u.uid] ? '…' : 'Approve' }}</button>
        </div>
        <ng-container *ngIf="recent.length">
          <div class="panel-head earlier">Recent</div>
          <div class="note past" *ngFor="let n of recent; trackBy: trackKey">
            <div class="avatar" [style.backgroundImage]="n.photoURL ? 'url(' + n.photoURL + ')' : 'none'">
              <span *ngIf="!n.photoURL">{{ n.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="note-text">
              <strong>{{ n.name }}</strong> {{ n.kind === 'signin' ? 'signed in' : 'was approved' }}
              <span class="note-sub">{{ n.kind === 'approved' && n.by ? 'by ' + n.by + ' · ' : '' }}{{ n.kind === 'signin' && n.device ? n.device + ' · ' : '' }}{{ n.at | date:'d MMM, HH:mm' }}</span>
            </div>
            <span class="kind-icon">{{ n.kind === 'signin' ? '👋' : '✅' }}</span>
          </div>
        </ng-container>

        <button class="panel-link" (click)="openAll()">See all notifications →</button>
        <button class="panel-link secondary" (click)="openUsers()">Open Admin → Users</button>
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
    /* Phones: the bell isn't at the right-hand edge, so pin the panel to the screen instead of the bell. */
    .panel.mobile { position: fixed; left: 12px; right: 12px; width: auto; max-width: none; }
    .panel-head.earlier { margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.8rem; }
    .note.past { opacity: 0.75; }
    .kind-icon { flex-shrink: 0; font-size: 0.95rem; }
    .panel-link.secondary { color: rgba(255,255,255,0.6); background: none; margin-top: 0.1rem; }
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
  private notifications = inject(NotificationService);
  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private host = inject(ElementRef);

  pending: AppNotification[] = [];
  recent: AppNotification[] = [];
  open = false;
  toast = '';
  busy: Record<string, boolean> = {};

  private sub?: Subscription;
  private seen: Set<string> | null = null; // null until the first load, so existing waiters don't pop up
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.sub = this.notifications.all$.subscribe({
      next: all => {
        const pending = all.filter(n => n.kind === 'waiting');
        if (this.seen) {
          const newcomer = pending.find(p => !this.seen!.has(p.uid));
          if (newcomer) this.showToast(newcomer.name);
        }
        this.seen = new Set(pending.map(p => p.uid));
        this.pending = pending;
        this.recent = all.filter(n => n.kind !== 'waiting').slice(0, RECENT_COUNT);
      },
      error: err => console.error('Notifications unavailable:', err),
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  /** Screen position for the panel on phones (null = normal drop-down under the bell). */
  mobileTop: number | null = null;

  toggle() {
    this.open = !this.open;
    if (this.open) this.placePanel();
  }

  /** On narrow screens, place the panel full-width just below the bell. */
  private placePanel() {
    if (window.innerWidth > 600) { this.mobileTop = null; return; }
    const rect = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
    this.mobileTop = Math.max(8, Math.round(rect.bottom + 8));
  }

  @HostListener('window:resize')
  onResize() { if (this.open) this.placePanel(); }

  /** A fixed panel would float away from the bell when the page scrolls, so close it. */
  @HostListener('window:scroll')
  onScroll() { if (this.open && this.mobileTop !== null) this.open = false; }

  trackKey = (_: number, n: AppNotification) => n.key;

  /** Close the panel when clicking anywhere else on the page. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.open && !this.host.nativeElement.contains(event.target)) this.open = false;
  }

  openPanelFromToast() {
    this.toast = '';
    this.open = true;
    this.placePanel();
  }

  async approve(u: AppNotification) {
    this.busy[u.uid] = true;
    try {
      const me = await firstValueFrom(this.authService.user$);
      await this.repairService.setVolunteerStatus(u.uid, true, me?.uid);
    } catch (e) {
      console.error('Approve failed:', e);
      this.dialog.error(`Couldn't approve ${u.name}. Please try again from Admin → Users.`);
    } finally {
      this.busy[u.uid] = false;
    }
  }

  openAll() {
    this.open = false;
    this.router.navigate(['/notifications']);
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
