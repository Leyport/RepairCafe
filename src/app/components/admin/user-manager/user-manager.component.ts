import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, map, Observable } from 'rxjs';
import { RepairService } from '../../../services/repair.service';

interface UserRow {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastSeen: any;
  isAdmin: boolean;
}

@Component({
  selector: 'app-user-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>👤 Users</h3>
      </div>

      <div class="user-list">
        <div *ngIf="(users$ | async)?.length === 0" class="empty-state">
          No users have logged in yet.
        </div>

        <div class="user-row" *ngFor="let user of users$ | async">
          <div class="user-info">
            <div class="avatar" [style.backgroundImage]="user.photoURL ? 'url(' + user.photoURL + ')' : 'none'">
              <span *ngIf="!user.photoURL">{{ (user.displayName || user.email || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div class="user-details">
              <span class="user-name">{{ user.displayName || user.email || 'Unknown User' }}</span>
              <span class="user-email" *ngIf="user.displayName && user.email">{{ user.email }}</span>
              <span class="last-seen" *ngIf="user.lastSeen">Last seen: {{ user.lastSeen.toDate() | date:'medium' }}</span>
            </div>
          </div>
          <div class="user-actions">
            <span class="badge admin-badge" *ngIf="user.isAdmin">Admin</span>
            <button
              class="btn-toggle-admin"
              [class.revoke]="user.isAdmin"
              (click)="toggleAdmin(user)"
              [disabled]="loading[user.id]">
              {{ loading[user.id] ? '...' : (user.isAdmin ? 'Revoke Admin' : 'Make Admin') }}
            </button>
          </div>
        </div>
      </div>
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
  private repairService = inject(RepairService);

  loading: { [uid: string]: boolean } = {};

  users$: Observable<UserRow[]> = combineLatest([
    this.repairService.getUsers(),
    this.repairService.getAdmins()
  ]).pipe(
    map(([users, adminIds]) =>
      users.map(u => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
        lastSeen: u.lastSeen,
        isAdmin: adminIds.includes(u.id)
      })).sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
    )
  );

  ngOnInit() {}

  async toggleAdmin(user: UserRow) {
    this.loading[user.id] = true;
    try {
      await this.repairService.setAdminStatus(user.id, !user.isAdmin);
    } catch (error) {
      console.error('Error toggling admin:', error);
    } finally {
      this.loading[user.id] = false;
    }
  }
}
