import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../services/repair.service';
import { AuthService } from '../../services/auth.service';
import { Issue } from '../../models/issue.model';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { take, map } from 'rxjs/operators';

interface IssueStats {
  total: number;
  newCount: number;
  assignedCount: number;
  fixedCount: number;
  newPct: number;
  assignedPct: number;
  fixedPct: number;
}

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="issues-container">
      <header>
        <h1>Issue Tracker</h1>
        <div class="header-actions">
          <button class="btn-report" (click)="toggleReport()" title="View &amp; read issues report">
            {{ showReport ? 'Close Report' : '📋 Issue Report' }}
          </button>
          <button class="btn-primary" (click)="toggleForm()">
            {{ showForm ? 'Cancel' : 'Report Issue' }}
          </button>
        </div>
      </header>

      <!-- Issue Report Panel -->
      <div class="report-panel glass" *ngIf="showReport">
        <div class="report-header">
          <h3>Issues Report</h3>
          <div class="report-controls">
            <button class="btn-speak" (click)="toggleSpeech()" [class.speaking]="isSpeaking">
              {{ isSpeaking ? '⏹ Stop' : '🔊 Read Aloud' }}
            </button>
          </div>
        </div>
        <div class="report-body" *ngIf="(issues$ | async) as issues">
          <p class="report-summary">
            Total issues: {{ issues.length }} —
            New: {{ countByStatus(issues, 'New') }},
            Assigned: {{ countByStatus(issues, 'Assigned') }},
            Fixed: {{ countByStatus(issues, 'Fixed') }}.
          </p>
          <div class="report-section" *ngFor="let group of getReportGroups(issues)">
            <h4 [class]="'group-heading ' + group.status.toLowerCase()">{{ group.status }} ({{ group.items.length }})</h4>
            <ol>
              <li *ngFor="let issue of group.items">
                <span class="ri-desc">{{ issue.description }}</span>
                <span class="ri-meta">
                  Raised {{ issue.dateRaised?.toDate() | date:'mediumDate' }}
                  <ng-container *ngIf="issue.raisedBy"> by {{ issue.raisedBy }}</ng-container>.
                  <ng-container *ngIf="issue.fix"> Fix: {{ issue.fix }}.</ng-container>
                </span>
              </li>
            </ol>
          </div>
          <p class="report-empty" *ngIf="issues.length === 0">No issues on record.</p>
        </div>
      </div>

      <!-- Dashboard -->
      <div class="dashboard glass" *ngIf="(stats$ | async) as stats">
        <div class="stat-cards">
          <div class="stat-card total">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-card new-card">
            <div class="stat-value">{{ stats.newCount }}</div>
            <div class="stat-label">New</div>
          </div>
          <div class="stat-card assigned-card">
            <div class="stat-value">{{ stats.assignedCount }}</div>
            <div class="stat-label">Assigned</div>
          </div>
          <div class="stat-card fixed-card">
            <div class="stat-value">{{ stats.fixedCount }}</div>
            <div class="stat-label">Fixed</div>
          </div>
        </div>
        <div class="progress-section" *ngIf="stats.total > 0">
          <div class="progress-label">Status Breakdown</div>
          <div class="progress-bar">
            <div class="bar-new"     [style.width.%]="stats.newPct"      title="New: {{ stats.newCount }}"></div>
            <div class="bar-assigned" [style.width.%]="stats.assignedPct" title="Assigned: {{ stats.assignedCount }}"></div>
            <div class="bar-fixed"   [style.width.%]="stats.fixedPct"    title="Fixed: {{ stats.fixedCount }}"></div>
          </div>
          <div class="progress-legend">
            <span class="legend-new">&#9632; New {{ stats.newPct | number:'1.0-0' }}%</span>
            <span class="legend-assigned">&#9632; Assigned {{ stats.assignedPct | number:'1.0-0' }}%</span>
            <span class="legend-fixed">&#9632; Fixed {{ stats.fixedPct | number:'1.0-0' }}%</span>
          </div>
        </div>
      </div>

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
      <div class="issues-list table-container glass" *ngIf="(issueNumbers$ | async) as numMap">
        <table *ngIf="(issues$ | async)?.length; else emptyState">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th>Description</th>
              <th>Fix</th>
              <th>Date Raised</th>
              <th>Raised By</th>
              <th class="col-status-header sortable" (click)="toggleSort()">
                Status <span class="sort-icon">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let issue of sortedIssues$ | async"
                [class.needs-fix]="!issue.fix">
              <td class="col-num">{{ numMap.get(issue.id!) }}</td>
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
              <td class="col-date">{{ issue.dateRaised?.toDate() | date:'dd/MM/yy' }}</td>
              <td class="col-raised-by">{{ issue.raisedBy || '—' }}</td>
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

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .btn-report {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-report:hover { background: rgba(255, 255, 255, 0.14); }

    /* Report Panel */
    .report-panel {
      margin-bottom: 1.5rem;
      animation: slideDown 0.3s ease-out;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .report-header h3 {
      color: white;
      font-size: 1.1rem;
      margin: 0;
    }
    .btn-speak {
      background: rgba(0, 180, 255, 0.15);
      color: #00b4ff;
      border: 1px solid rgba(0, 180, 255, 0.3);
      padding: 0.45rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-speak:hover { background: rgba(0, 180, 255, 0.25); }
    .btn-speak.speaking {
      background: rgba(255, 80, 80, 0.15);
      color: #ff5050;
      border-color: rgba(255, 80, 80, 0.3);
    }
    .report-summary {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      margin: 0 0 1.25rem 0;
    }
    .report-section { margin-bottom: 1.25rem; }
    .group-heading {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin: 0 0 0.5rem 0;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      display: inline-block;
    }
    .group-heading.new      { background: rgba(74,144,226,0.15); color: #4a90e2; }
    .group-heading.assigned { background: rgba(241,196,15,0.15); color: #f1c40f; }
    .group-heading.fixed    { background: rgba(40,180,99,0.15);  color: #28b463; }
    ol {
      margin: 0;
      padding-left: 1.4rem;
    }
    ol li {
      color: rgba(255,255,255,0.85);
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .ri-desc { display: block; }
    .ri-meta {
      display: block;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.45);
    }
    .report-empty {
      color: rgba(255,255,255,0.35);
      text-align: center;
      padding: 1rem 0;
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

    /* Dashboard */
    .dashboard {
      margin-bottom: 1.5rem;
    }
    .stat-cards {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .stat-card {
      flex: 1;
      text-align: center;
      padding: 1rem 0.5rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
    }
    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0.35rem;
      opacity: 0.7;
    }
    .stat-card.total       { background: rgba(255,255,255,0.06); color: white; }
    .stat-card.new-card    { background: rgba(74,144,226,0.15);  color: #4a90e2; border-color: rgba(74,144,226,0.3); }
    .stat-card.assigned-card { background: rgba(241,196,15,0.15); color: #f1c40f; border-color: rgba(241,196,15,0.3); }
    .stat-card.fixed-card  { background: rgba(40,180,99,0.15);   color: #28b463; border-color: rgba(40,180,99,0.3); }

    .progress-section { }
    .progress-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.5);
      margin-bottom: 0.5rem;
    }
    .progress-bar {
      display: flex;
      height: 10px;
      border-radius: 6px;
      overflow: hidden;
      background: rgba(255,255,255,0.06);
    }
    .bar-new      { background: #4a90e2; transition: width 0.4s ease; }
    .bar-assigned { background: #f1c40f; transition: width 0.4s ease; }
    .bar-fixed    { background: #28b463; transition: width 0.4s ease; }
    .progress-legend {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.5rem;
      font-size: 0.78rem;
    }
    .legend-new      { color: #4a90e2; }
    .legend-assigned { color: #f1c40f; }
    .legend-fixed    { color: #28b463; }

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
      width: 22%;
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
      width: 7%;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .col-raised-by {
      width: 12%;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
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
      width: 43%;
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
  private authService = inject(AuthService);

  issues$: Observable<Issue[]> = this.repairService.getIssues();

  stats$: Observable<IssueStats> = this.issues$.pipe(
    map(issues => {
      const total = issues.length;
      const newCount = issues.filter(i => i.status === 'New').length;
      const assignedCount = issues.filter(i => i.status === 'Assigned').length;
      const fixedCount = issues.filter(i => i.status === 'Fixed').length;
      return {
        total,
        newCount,
        assignedCount,
        fixedCount,
        newPct:      total ? (newCount      / total) * 100 : 0,
        assignedPct: total ? (assignedCount / total) * 100 : 0,
        fixedPct:    total ? (fixedCount    / total) * 100 : 0,
      };
    })
  );

  // Permanent sequence numbers keyed by issue id, ordered by dateRaised asc
  issueNumbers$: Observable<Map<string, number>> = this.issues$.pipe(
    map(issues => {
      const sorted = [...issues].sort((a, b) => {
        const ta = a.dateRaised?.toMillis?.() ?? 0;
        const tb = b.dateRaised?.toMillis?.() ?? 0;
        return ta - tb;
      });
      const map = new Map<string, number>();
      sorted.forEach((issue, idx) => { if (issue.id) map.set(issue.id, idx + 1); });
      return map;
    })
  );

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

  showReport = false;
  isSpeaking = false;
  private utterance: SpeechSynthesisUtterance | null = null;

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
      const user = await this.authService.user$.pipe(take(1)).toPromise();
      const raisedBy = user?.displayName || user?.email || undefined;
      await this.repairService.addIssue(this.newIssueDescription, raisedBy);
      this.toggleForm();
    } catch (error) {
      console.error('Error adding issue:', error);
      alert('Failed to report issue.');
    }
  }

  toggleReport() {
    this.showReport = !this.showReport;
    if (!this.showReport) this.stopSpeech();
  }

  countByStatus(issues: Issue[], status: string): number {
    return issues.filter(i => i.status === status).length;
  }

  getReportGroups(issues: Issue[]): { status: string; items: Issue[] }[] {
    return (['New', 'Assigned', 'Fixed'] as const)
      .map(status => ({ status, items: issues.filter(i => i.status === status) }))
      .filter(g => g.items.length > 0);
  }

  toggleSpeech() {
    if (this.isSpeaking) { this.stopSpeech(); return; }
    this.issues$.pipe(take(1)).subscribe(issues => this.speak(issues));
  }

  private speak(issues: Issue[]) {
    if (!('speechSynthesis' in window)) { alert('Text-to-speech is not supported in this browser.'); return; }
    const lines: string[] = [
      `Issue tracker report. Total issues: ${issues.length}.`,
      `New: ${this.countByStatus(issues, 'New')}.`,
      `Assigned: ${this.countByStatus(issues, 'Assigned')}.`,
      `Fixed: ${this.countByStatus(issues, 'Fixed')}.`,
    ];
    for (const group of this.getReportGroups(issues)) {
      lines.push(`${group.status} issues. ${group.items.length} item${group.items.length !== 1 ? 's' : ''}.`);
      group.items.forEach((issue, idx) => {
        let text = `Item ${idx + 1}: ${issue.description}.`;
        if (issue.raisedBy) text += ` Raised by ${issue.raisedBy}.`;
        if (issue.fix) text += ` Fix: ${issue.fix}.`;
        lines.push(text);
      });
    }
    const fullText = lines.join(' ');
    this.utterance = new SpeechSynthesisUtterance(fullText);
    this.utterance.rate = 0.95;
    this.utterance.onend = () => { this.isSpeaking = false; };
    this.utterance.onerror = () => { this.isSpeaking = false; };
    this.isSpeaking = true;
    window.speechSynthesis.speak(this.utterance);
  }

  private stopSpeech() {
    window.speechSynthesis?.cancel();
    this.isSpeaking = false;
    this.utterance = null;
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
