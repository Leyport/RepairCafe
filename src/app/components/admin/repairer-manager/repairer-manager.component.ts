import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { Router } from '@angular/router';
import { RepairService } from '../../../services/repair.service';
import { AuthService } from '../../../services/auth.service';
import { Repairer } from '../../../models/repairer.model';
import { RepairerFormComponent } from '../repairer-form/repairer-form.component';

import { DialogService } from '../../../services/dialog.service';
type TypeFilter = 'all' | 'primary' | 'secondary';

@Component({
  selector: 'app-repairer-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RepairerFormComponent],
  // RouterModule not needed — navigation is via Router.navigate()
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>👥 Volunteer Repairers</h3>
        <button class="btn-primary" (click)="openAddForm()">
          Add New Repairer
        </button>
      </div>

      <ng-container *ngIf="view$ | async as v">
      <div class="filters">
        <div class="chips">
          <button class="chip" *ngFor="let t of typeOptions" [class.active]="type === t.value" (click)="setType(t.value)">
            {{ t.label }} <span class="n">{{ v.counts[t.value] }}</span>
          </button>
        </div>
        <div class="filter-row">
          <input type="search" class="f-input" placeholder="Search name, email or phone" autocomplete="off"
                 [ngModel]="search" (ngModelChange)="setSearch($event)">
          <select class="f-input f-select" [ngModel]="emailFilter" (ngModelChange)="setEmail($event)"
                  title="An email lets My Repairs recognise the repairer when they sign in">
            <option value="">Email: any</option>
            <option value="has">Has an email</option>
            <option value="none">No email</option>
          </select>
          <button class="btn-clear" *ngIf="isFiltered" (click)="clearFilters()">Clear</button>
        </div>
        <div class="f-summary" *ngIf="isFiltered">Showing {{ v.list.length }} of {{ v.total }} repairers</div>
      </div>

      <div class="repairer-list">
        <div *ngIf="v.total === 0" class="empty-state">
          No repairers added yet.
        </div>
        <div *ngIf="v.total > 0 && v.list.length === 0" class="empty-state">
          No repairers match these filters.
        </div>

        <div class="repairer-row" *ngFor="let repairer of v.list" (click)="openEditForm(repairer)">
          <div class="repairer-info">
            <div class="avatar" [style.backgroundImage]="repairer.photoUrl ? 'url(' + repairer.photoUrl + ')' : 'none'">
              <span *ngIf="!repairer.photoUrl">{{ repairer.name.charAt(0) }}</span>
            </div>
            <span class="repairer-name">{{ repairer.name }}</span>
            <span class="badge primary-badge" *ngIf="repairer.isPrimary">Primary</span>
            <span class="badge secondary-badge" *ngIf="!repairer.isPrimary">Secondary</span>
          </div>
          <div class="row-actions">
            <button class="btn-dashboard" (click)="openDashboard(repairer, $event)" title="View Dashboard">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="6" height="10" rx="1"></rect>
                <rect x="10" y="3" width="12" height="6" rx="1"></rect>
                <rect x="10" y="13" width="12" height="8" rx="1"></rect>
                <rect x="2" y="17" width="6" height="4" rx="1"></rect>
              </svg>
            </button>
            <button
              *ngIf="(isAdmin$ | async)"
              class="btn-toggle-primary"
              [class.is-primary]="repairer.isPrimary"
              (click)="togglePrimary(repairer, $event)"
              [disabled]="loading[repairer.id!]"
              [title]="repairer.isPrimary ? 'Make Secondary' : 'Make Primary'">
              {{ loading[repairer.id!] ? '...' : (repairer.isPrimary ? 'Make Secondary' : 'Make Primary') }}
            </button>
            <button class="btn-delete" (click)="deleteRepairer(repairer, $event)" title="Remove repairer">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      </ng-container>
    </div>

    <app-repairer-form
      *ngIf="showForm"
      [repairer]="selectedRepairer"
      [isAdmin]="(isAdmin$ | async) === true"
      (closeEvent)="closeForm()"
      (saveEvent)="onSave($event)"
      (deleteEvent)="onDelete($event)">
    </app-repairer-form>
  `,
  styles: [`
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
    .f-select { flex: 0 1 170px; }
    .f-select option { background: #14182a; }
    .btn-clear {
      background: none; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.75);
      border-radius: 8px; padding: 0.5rem 0.8rem; cursor: pointer; font-family: inherit; font-size: 0.85rem;
    }
    .f-summary { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
    .manager-section {
      max-width: 600px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 600px) {
      .section-header {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }
      .section-header h3 {
        font-size: 1.2rem;
      }
    }
    .section-header h3 {
      margin: 0;
      color: white;
    }
    .repairer-list {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .repairer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .repairer-row:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateX(5px);
    }
    .repairer-info {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      background-color: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.7);
      flex-shrink: 0;
    }
    .repairer-name {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.9);
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .primary-badge {
      background: rgba(0, 242, 255, 0.15);
      color: var(--accent-color, #00f2ff);
      border: 1px solid rgba(0, 242, 255, 0.3);
    }
    .secondary-badge {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .row-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .btn-toggle-primary {
      padding: 0.35rem 0.85rem;
      border-radius: 6px;
      border: 1px solid rgba(0, 242, 255, 0.4);
      background: rgba(0, 242, 255, 0.08);
      color: var(--accent-color, #00f2ff);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-toggle-primary:hover:not(:disabled) {
      background: rgba(0, 242, 255, 0.18);
    }
    .btn-toggle-primary.is-primary {
      border-color: rgba(255, 200, 0, 0.4);
      background: rgba(255, 200, 0, 0.08);
      color: #ffc800;
    }
    .btn-toggle-primary.is-primary:hover:not(:disabled) {
      background: rgba(255, 200, 0, 0.18);
    }
    .btn-toggle-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-dashboard {
      background: none;
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      padding: 0.45rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .btn-dashboard:hover {
      background: rgba(0,242,255,0.08);
      border-color: rgba(0,242,255,0.3);
      color: var(--accent-color, #00f2ff);
    }
    .btn-delete {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .btn-delete:hover {
      background: rgba(255, 89, 89, 0.1);
      color: #ff5959;
    }
    .btn-primary {
      background: var(--accent-color, #00f2ff);
      color: #000;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:hover {
      opacity: 0.9;
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
export class RepairerManagerComponent {
  private dialog = inject(DialogService);
  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private router = inject(Router);

  repairers$ = this.repairService.getRepairers();
  isAdmin$ = this.authService.isAdmin$;

  // ---- Filters ----
  readonly typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
  ];
  type: TypeFilter = 'all';
  search = '';
  emailFilter: '' | 'has' | 'none' = '';
  private filter$ = new BehaviorSubject<void>(undefined);

  get isFiltered(): boolean { return this.type !== 'all' || !!this.search.trim() || !!this.emailFilter; }
  setType(v: TypeFilter) { this.type = v; this.filter$.next(); }
  setSearch(v: string) { this.search = v || ''; this.filter$.next(); }
  setEmail(v: '' | 'has' | 'none') { this.emailFilter = v; this.filter$.next(); }
  clearFilters() { this.type = 'all'; this.search = ''; this.emailFilter = ''; this.filter$.next(); }

  view$ = combineLatest([this.repairers$, this.filter$]).pipe(
    map(([repairers]) => {
      const term = this.search.trim().toLowerCase();
      const digits = /[a-z]/.test(term) ? '' : term.replace(/\D/g, ''); // phone search only for number-like input
      const base = repairers.filter(r => {
        const hasEmail = !!(r.email || '').trim();
        if (this.emailFilter === 'has' && !hasEmail) return false;
        if (this.emailFilter === 'none' && hasEmail) return false;
        if (!term) return true;
        return (r.name || '').toLowerCase().includes(term) ||
          (r.email || '').toLowerCase().includes(term) ||
          (!!digits && (r.telephone || '').replace(/\D/g, '').includes(digits));
      });
      const matches = (r: Repairer, t: TypeFilter) => t === 'all' || (t === 'primary') === !!r.isPrimary;
      const counts = Object.fromEntries(this.typeOptions.map(o => [o.value, base.filter(r => matches(r, o.value)).length])) as Record<TypeFilter, number>;
      return { list: base.filter(r => matches(r, this.type)), counts, total: repairers.length };
    })
  );

  showForm = false;
  selectedRepairer: Repairer | null = null;
  loading: { [id: string]: boolean } = {};

  openDashboard(repairer: Repairer, event: MouseEvent) {
    event.stopPropagation();
    this.router.navigate(['/repairer-dashboard', encodeURIComponent(repairer.name)]);
  }

  openAddForm() {
    this.selectedRepairer = null;
    this.showForm = true;
  }

  openEditForm(repairer: Repairer) {
    this.selectedRepairer = repairer;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.selectedRepairer = null;
  }

  async onSave(event: { id?: string, name: string, photoUrl?: string, isPrimary: boolean, email: string, telephone: string }) {
    try {
      if (event.id) {
        await this.repairService.updateRepairer(event.id, {
          name: event.name,
          photoUrl: event.photoUrl,
          isPrimary: event.isPrimary,
          email: event.email,
          telephone: event.telephone
        });
      } else {
        await this.repairService.addRepairer(event.name, event.photoUrl, event.isPrimary, event.telephone, event.email);
      }
      this.closeForm();
    } catch (error) {
      console.error('Error saving repairer:', error);
    }
  }

  async onDelete(id: string) {
    try {
      await this.repairService.deleteRepairer(id);
      this.closeForm();
    } catch (error) {
      console.error('Error deleting repairer:', error);
    }
  }

  async togglePrimary(repairer: Repairer, event: MouseEvent) {
    event.stopPropagation();
    this.loading[repairer.id!] = true;
    try {
      await this.repairService.updateRepairer(repairer.id!, { isPrimary: !repairer.isPrimary });
    } catch (error) {
      console.error('Error updating repairer:', error);
    } finally {
      this.loading[repairer.id!] = false;
    }
  }

  async deleteRepairer(repairer: Repairer, event: MouseEvent) {
    event.stopPropagation();
    if (await this.dialog.confirm({
      title: `Remove ${repairer.name}?`,
      message: 'They will be taken off the list of repairers.',
      confirmText: 'Remove', cancelText: 'Keep', danger: true,
    })) {
      try {
        await this.repairService.deleteRepairer(repairer.id!);
      } catch (error) {
        console.error('Error deleting repairer:', error);
      }
    }
  }
}
