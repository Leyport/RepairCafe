import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cd-overlay" *ngIf="dialog.current() as d" (click)="dialog.close(false)">
      <div class="cd-box" role="alertdialog" aria-modal="true" [attr.aria-label]="d.title" (click)="$event.stopPropagation()">
        <div class="cd-icon" [class.danger]="d.danger">{{ d.danger ? '🗑️' : '❓' }}</div>
        <h3 class="cd-title">{{ d.title }}</h3>
        <p class="cd-message" *ngIf="d.message">{{ d.message }}</p>
        <div class="cd-actions">
          <button type="button" class="cd-cancel" (click)="dialog.close(false)">{{ d.cancelText || 'Cancel' }}</button>
          <button type="button" class="cd-confirm" [class.danger]="d.danger" (click)="dialog.close(true)" autofocus>
            {{ d.confirmText || 'OK' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cd-overlay {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      animation: cd-fade 0.15s ease-out;
    }
    .cd-box {
      width: 100%; max-width: 400px;
      background: #1a2236; border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px; padding: 1.75rem 1.5rem 1.25rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      text-align: center; color: white;
    }
    .cd-icon {
      width: 52px; height: 52px; margin: 0 auto 0.9rem; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
      background: rgba(0, 242, 255, 0.1); border: 1px solid rgba(0, 242, 255, 0.3);
    }
    .cd-icon.danger { background: rgba(231, 76, 60, 0.12); border-color: rgba(231, 76, 60, 0.4); }
    .cd-title { margin: 0 0 0.5rem; font-size: 1.15rem; font-weight: 700; }
    .cd-message { margin: 0 0 1.4rem; color: rgba(255, 255, 255, 0.7); font-size: 0.92rem; line-height: 1.45; white-space: pre-line; }
    .cd-actions { display: flex; gap: 0.75rem; }
    .cd-actions button {
      flex: 1; padding: 0.7rem 1rem; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .cd-cancel { background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.8); }
    .cd-cancel:hover { background: rgba(255, 255, 255, 0.08); }
    .cd-confirm { background: rgba(0, 242, 255, 0.15); border: 1px solid rgba(0, 242, 255, 0.5); color: var(--accent-color); }
    .cd-confirm.danger { background: rgba(231, 76, 60, 0.85); border-color: #e74c3c; color: white; }
    .cd-confirm.danger:hover { background: #e74c3c; }
    @keyframes cd-fade { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class ConfirmDialogComponent {
  dialog = inject(DialogService);

  @HostListener('document:keydown.escape')
  onEscape() { this.dialog.close(false); }
}
