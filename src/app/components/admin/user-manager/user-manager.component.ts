import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, firstValueFrom, map, Observable } from 'rxjs';
import { RepairService } from '../../../services/repair.service';
import { AuthService } from '../../../services/auth.service';

interface UserRow {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastSeen: any;
  isAdmin: boolean;
  isApproved: boolean;
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
      <p class="intro">
        Anyone can sign in with Google, Facebook or email, but they can't see or change any repair
        data until you <strong>approve</strong> them here. Admins are always approved.
      </p>

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
  private repairService = inject(RepairService);
  private authService = inject(AuthService);

  loading: { [uid: string]: boolean } = {};

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
        isAdmin: adminIds.includes(u.id),
        isApproved: adminIds.includes(u.id) || volunteerIds.includes(u.id)
      }))
        // People waiting for approval first, then alphabetical.
        .sort((a, b) => Number(a.isApproved) - Number(b.isApproved)
          || (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
    )
  );

  ngOnInit() {}

  async toggleApproved(user: UserRow) {
    if (user.isApproved && !confirm(`Remove approval for ${user.displayName || user.email || 'this user'}? They will no longer see any repair data.`)) return;
    this.loading[user.id] = true;
    try {
      const me = await firstValueFrom(this.authService.user$);
      await this.repairService.setVolunteerStatus(user.id, !user.isApproved, me?.uid);
    } catch (error) {
      console.error('Error changing approval:', error);
      alert('Could not change approval. Only admins can approve volunteers.');
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
