import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../services/repair.service';
import { Issue } from '../../models/issue.model';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { take, map } from 'rxjs/operators';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="issues-container">
      <header>
        <h1>Issue Tracker</h1>
        <button class="btn-primary" (click)="toggleForm()">
          {{ showForm ? 'Cancel' : 'Report Issue' }}
        </button>
      </header>

      <!-- Add Issue Form -->
      <div class="issue-form glass" *ngIf="showForm">
        <h3>Report a New Issue</h3>
        <div class="form-group">
          <label for="desc">Description</label>
          <textarea 
            id="desc" 
            [(ngModel)]="newIssueDescription" 
            placeholder="Describe the issue..."
            rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-cancel" (click)="toggleForm()">Cancel</button>
          <button class="btn-save" (click)="addIssue()" [disabled]="!newIssueDescription.trim()">Submit Issue</button>
        </div>
      </div>

      <!-- Issues List -->
      <div class="issues-list table-container glass">
        <table *ngIf="(issues$ | async)?.length; else emptyState">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th>Description</th>
              <th>Fix</th>
              <th>Date Raised</th>
              <th class="col-status-header sortable" (click)="toggleSort()">
                Status <span class="sort-icon">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let issue of sortedIssues$ | async; let i = index"
                [class.needs-fix]="!issue.fix">
              <td class="col-num">{{ i + 1 }}</td>
              <td class="col-desc" (click)="startEdit(issue)">
                <textarea *ngIf="editingId === issue.id"
                  class="inline-edit"
                  [(ngModel)]="editingDescription"
                  (blur)="saveEdit(issue)"
                  (keydown.enter)="$event.preventDefault(); saveEdit(issue)"
                  (keydown.escape)="cancelEdit()"
                  (click)="$event.stopPropagation()"
                  rows="2"></textarea>
                <span *ngIf="editingId !== issue.id" class="desc-text" title="Click to edit">{{ issue.description }}</span>
              </td>
              <td class="col-fix" (click)="startFixEdit(issue)">
                <span *ngIf="!issue.fix && editingFixId !== issue.id" class="no-fix-placeholder">
                  ⚠ No fix entered
                </span>
                <textarea *ngIf="editingFixId === issue.id"
                  class="inline-edit"
                  [(ngModel)]="editingFix"
                  (blur)="saveFix(issue)"
                  (keydown.enter)="$event.preventDefault(); saveFix(issue)"
                  (keydown.escape)="cancelFixEdit()"
                  (click)="$event.stopPropagation()"
                  rows="2"></textarea>
                <span *ngIf="issue.fix && editingFixId !== issue.id" class="fix-text" title="Click to edit">{{ issue.fix }}</span>
              </td>
              <td class="col-date">{{ issue.dateRaised?.toDate() | date:'short' }}</td>
              <td class="col-status">
                <select 
                  [ngModel]="issue.status" 
                  (ngModelChange)="updateStatus(issue, $event)"
                  [class]="'status-badge ' + issue.status.toLowerCase()">
                  <option value="New">New</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Fixed">Fixed</option>
                </select>
              </td>
              <td class="col-actions">
                <button class="btn-icon delete" (click)="deleteIssue(issue.id!)" title="Delete">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <ng-template #emptyState>
          <div class="empty-state">
            <p>No issues reported yet. 🎉</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .issues-container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2rem;
      color: white;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }

    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .issue-form {
      animation: slideDown 0.3s ease-out;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-group {
      margin-bottom: 1rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
    }

    textarea {
      width: 100%;
      padding: 0.8rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: white;
      font-family: inherit;
      resize: vertical;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }

    .btn-primary, .btn-save {
      background: var(--accent-color);
      color: black;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .btn-cancel {
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      cursor: pointer;
    }

    .table-container {
      padding: 0;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      color: rgba(255, 255, 255, 0.9);
    }

    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    th {
      background: rgba(0, 0, 0, 0.2);
      font-weight: 600;
      color: var(--accent-color);
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .col-num {
      width: 40px;
      text-align: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.85rem;
    }
    .col-desc {
      width: 30%;
      cursor: pointer;
    }
    .col-desc:hover .desc-text { color: white; }
    .desc-text {
      display: block;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.15s;
    }
    .col-desc:hover .desc-text { border-color: rgba(255,255,255,0.3); }
    .inline-edit {
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--accent-color, #00f2ff);
      border-radius: 6px;
      color: white;
      font-family: inherit;
      font-size: inherit;
      padding: 0.4rem 0.6rem;
      resize: none;
      outline: none;
      box-shadow: 0 0 0 2px rgba(0,242,255,0.15);
    }
    .col-date {
      width: 15%;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .col-status {
      width: 15%;
    }
    .col-status-header {
      width: 15%;
    }
    .sortable {
      cursor: pointer;
      user-select: none;
    }
    .sortable:hover { color: white; }
    .sort-icon { font-size: 0.7rem; margin-left: 0.3rem; opacity: 0.7; }
    .col-actions {
      width: 10%;
      text-align: right;
    }

    /* Status Select Styling */
    select.status-badge {
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      border: 1px solid transparent;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      outline: none;
      width: 100%;
    }

    select.new { background: rgba(74, 144, 226, 0.2); color: #4a90e2; border-color: rgba(74, 144, 226, 0.3); }
    select.assigned { background: rgba(241, 196, 15, 0.2); color: #f1c40f; border-color: rgba(241, 196, 15, 0.3); }
    select.fixed { background: rgba(40, 180, 99, 0.2); color: #28b463; border-color: rgba(40, 180, 99, 0.3); }
    
    option {
        background: #1a1a2e;
        color: white;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
      font-size: 1.1rem;
    }
    .btn-icon:hover {
      opacity: 1;
      transform: scale(1.1);
    }

    .col-fix {
      width: 22%;
      cursor: pointer;
    }
    .col-fix:hover .fix-text { color: white; }
    .fix-text {
      display: block;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.15s;
    }
    .col-fix:hover .fix-text { border-color: rgba(255,255,255,0.3); }
    .no-fix-placeholder {
      color: rgba(255, 180, 0, 0.7);
      font-size: 0.85rem;
      font-style: italic;
    }

    tr.needs-fix td {
      border-left: none;
    }
    tr.needs-fix td:first-child {
      border-left: 3px solid rgba(255, 180, 0, 0.6);
    }

    .empty-state {
        text-align: center;
        padding: 4rem;
        color: rgba(255, 255, 255, 0.3);
    }
  `]
})
export class IssuesComponent {
  private repairService = inject(RepairService);

  issues$: Observable<Issue[]> = this.repairService.getIssues();

  sortDir: 'asc' | 'desc' = 'asc';
  private sortDir$ = new BehaviorSubject<'asc' | 'desc'>('asc');

  private statusOrder = ['New', 'Assigned', 'Fixed'];

  sortedIssues$ = combineLatest([this.issues$, this.sortDir$]).pipe(
    map(([issues, dir]) => [...issues].sort((a, b) => {
      const ai = this.statusOrder.indexOf(a.status);
      const bi = this.statusOrder.indexOf(b.status);
      return dir === 'asc' ? ai - bi : bi - ai;
    }))
  );

  editingId: string | null = null;
  editingDescription = '';

  editingFixId: string | null = null;
  editingFix = '';

  showForm = false;
  newIssueDescription = '';

  constructor() {
    this.issues$.pipe(take(1)).subscribe(issues => {
      this.showForm = issues.length === 0;
    });
  }

  startEdit(issue: Issue) {
    this.editingId = issue.id!;
    this.editingDescription = issue.description;
    setTimeout(() => {
      const el = document.querySelector('.inline-edit') as HTMLTextAreaElement;
      if (el) { el.focus(); el.select(); }
    });
  }

  cancelEdit() {
    this.editingId = null;
    this.editingDescription = '';
  }

  async saveEdit(issue: Issue) {
    const trimmed = this.editingDescription.trim();
    if (trimmed && trimmed !== issue.description && issue.id) {
      try {
        await this.repairService.updateIssue(issue.id, { description: trimmed } as any);
      } catch (e) {
        console.error('Failed to update description:', e);
      }
    }
    this.cancelEdit();
  }

  startFixEdit(issue: Issue) {
    this.editingFixId = issue.id!;
    this.editingFix = issue.fix || '';
    setTimeout(() => {
      const els = document.querySelectorAll('.inline-edit') as NodeListOf<HTMLTextAreaElement>;
      const last = els[els.length - 1];
      if (last) { last.focus(); last.select(); }
    });
  }

  cancelFixEdit() {
    this.editingFixId = null;
    this.editingFix = '';
  }

  async saveFix(issue: Issue) {
    const trimmed = this.editingFix.trim();
    if (issue.id && trimmed !== (issue.fix || '')) {
      try {
        await this.repairService.updateIssue(issue.id, { fix: trimmed } as any);
      } catch (e) {
        console.error('Failed to update fix:', e);
      }
    }
    this.cancelFixEdit();
  }

  toggleSort() {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.sortDir$.next(this.sortDir);
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.newIssueDescription = '';
    }
  }

  async addIssue() {
    if (!this.newIssueDescription.trim()) return;

    try {
      await this.repairService.addIssue(this.newIssueDescription);
      this.toggleForm();
    } catch (error) {
      console.error('Error adding issue:', error);
      alert('Failed to report issue.');
    }
  }

  async updateStatus(issue: Issue, newStatus: string) {
    if (!issue.id) return;
    try {
      await this.repairService.updateIssue(issue.id, { status: newStatus as any });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status.');
    }
  }

  async deleteIssue(id: string) {
    if (confirm('Are you sure you want to delete this issue?')) {
      try {
        await this.repairService.deleteIssue(id);
      } catch (error) {
        console.error('Error deleting issue:', error);
        alert('Failed to delete issue.');
      }
    }
  }
}
