import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { ExportService } from '../../services/export.service';
import { ImportService } from '../../services/import.service';
import { AuthService } from '../../services/auth.service';
import { RepairItem, toRepairPhoto } from '../../models/repair-item.model';
import { Repairer } from '../../models/repairer.model';
import { map, switchMap } from 'rxjs/operators';
import { Observable, take, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rcd-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-top">
          <a routerLink="/schedule" class="back-link">← Back to Schedule</a>
          <div class="header-buttons">
            <button class="btn-report" (click)="downloadReport(items)" *ngIf="items$ | async as items">
              📄 Download Report
            </button>
            <button class="btn-export-trigger" (click)="togglePicker()" [class.active]="showPicker">
              {{ showPicker ? 'Cancel Export' : '📤 Export to Google Sheets' }}
            </button>
          </div>
        </div>
        <h1>Session Dashboard</h1>
        <div class="session-date">{{ rcdDate }}</div>
      </header>

      <!-- Folder Picker / Export UI -->
      <div class="export-picker glass" *ngIf="showPicker">
        <h3>Select Destination Folder</h3>

        <div class="auth-box" *ngIf="!accessToken">
          <p>Please connect to Google Drive to select an export folder.</p>
          <button class="btn-primary" (click)="connectGoogle()">Connect Google Drive</button>
        </div>

        <ng-container *ngIf="accessToken">
          <div class="explorer-nav">
            <div class="breadcrumbs">
              <span class="breadcrumb-item" (click)="jumpToPath(-1)" [class.active]="currentFolder.id === 'root'">My Drive</span>
              <ng-container *ngFor="let item of navigationPath; let i = index">
                <span class="breadcrumb-item" (click)="jumpToPath(i)" *ngIf="item.id !== 'root'">
                  <span class="separator">/</span>{{ item.name }}
                </span>
              </ng-container>
              <ng-container *ngIf="currentFolder.id !== 'root'">
                <span class="separator">/</span>
                <span class="current-folder">{{ currentFolder.name }}</span>
              </ng-container>
            </div>
            <button class="btn-text" *ngIf="currentFolder.id !== 'root'" (click)="goBack()">⬅ Back</button>
          </div>

          <div class="explorer-folders glass-inset">
            <div class="loading-overlay" *ngIf="isLoadingFolders">
              <div class="spinner-small"></div>
            </div>
            <div class="folder-grid">
              <div class="folder-item" *ngFor="let dir of directories" (click)="navigateTo(dir)">
                <span class="icon">📁</span>
                <span class="name">{{ dir.name }}</span>
              </div>
            </div>
            <div class="empty-msg" *ngIf="directories.length === 0 && !isLoadingFolders">
              No folders found.
            </div>
          </div>

          <div class="export-actions">
            <div class="target-folder-info">
              Exporting to: <strong>{{ currentFolder.name }}</strong>
            </div>
            <button class="btn-primary btn-confirm-export" (click)="performExport()" [disabled]="isExporting">
              <span *ngIf="!isExporting">Confirm Export to this Folder</span>
              <span *ngIf="isExporting" class="spinner-small"></span>
              <span *ngIf="isExporting">Exporting...</span>
            </button>
          </div>
        </ng-container>

        <div class="export-status" *ngIf="statusMessage">
          <div class="status-card" [class.error]="isError" [class.success]="isSuccess">
            {{ statusMessage }}
            <a *ngIf="exportUrl" [href]="exportUrl" target="_blank" class="view-link">View Spreadsheet ↗</a>
          </div>
        </div>
      </div>

      <div class="stats-grid" *ngIf="items$ | async as items">
        <div class="stat-card glass">
          <div class="stat-value">{{ items.length }}</div>
          <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card glass stat-repaired">
          <div class="stat-value">{{ countCompleted(items) }}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card glass stat-assigned">
          <div class="stat-value">{{ countByStatus(items, 'Assigned') }}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card glass stat-new">
          <div class="stat-value">{{ countByStatus(items, 'New') }}</div>
          <div class="stat-label">Awaiting</div>
        </div>
      </div>

      <div class="reports-section" *ngIf="items$ | async as items">
        <div class="report-card glass">
          <h2>Status Breakdown</h2>
          <div class="status-list">
            <div class="status-item" *ngFor="let stat of getStatusBreakdown(items)">
              <span class="status-name">{{ stat.status }}</span>
              <div class="status-bar-container">
                <div class="status-bar" [style.width.%]="stat.percentage" [ngClass]="stat.cssClass"></div>
              </div>
              <span class="status-count">{{ stat.count }}</span>
            </div>
          </div>
        </div>

        <div class="report-card glass pie-card">
          <h2>Distribution</h2>
          <div class="pie-wrapper">
            <svg viewBox="0 0 160 160" class="pie-svg">
              <ng-container *ngFor="let slice of getPieSlices(items)">
                <path [attr.d]="slice.path" [attr.fill]="slice.color" class="pie-slice">
                  <title>{{ slice.status }}: {{ slice.count }}</title>
                </path>
              </ng-container>
              <text x="80" y="75" text-anchor="middle" class="pie-center-value">{{ items.length }}</text>
              <text x="80" y="93" text-anchor="middle" class="pie-center-label">total</text>
            </svg>
            <div class="pie-legend">
              <div class="legend-item" *ngFor="let slice of getPieSlices(items)">
                <span class="legend-dot" [style.background]="slice.color"></span>
                <span class="legend-text">{{ slice.status }}</span>
                <span class="legend-count">{{ slice.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="report-card glass items-card">
          <h2>Items List</h2>
          <div class="items-list">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Description</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Primary Repairer</th>
                  <th>Secondary Repairers</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of items">
                  <td class="col-num">{{ item.displayNumber }}</td>
                  <td>{{ item.itemDescription }}</td>
                  <td class="col-meta">{{ item.owner || '—' }}</td>
                  <td class="col-meta">{{ item.repairItem || '—' }}</td>
                  <td>
                    <select class="status-select" [ngClass]="getStatusClass(item.status)"
                      [(ngModel)]="item.status"
                      (change)="updateStatus(item)"
                      [disabled]="!!saving[item.id!]">
                      <option value="New">New</option>
                      <option value="Assigned">Assigned</option>
                      <optgroup label="Completed">
                        <option value="Repaired">Repaired</option>
                        <option value="Advice Given">Advice Given</option>
                        <option value="Partially Repaired">Partially Repaired</option>
                        <option value="Not Repaired">Not Repaired</option>
                      </optgroup>
                    </select>
                  </td>
                  <td class="col-repairer">{{ item.repairer || 'Unassigned' }}</td>
                  <td class="col-secondary">
                    <div class="secondary-chips">
                      <span class="sec-chip" *ngFor="let name of (item.additionalRepairers || [])">
                        {{ name }}
                        <button class="chip-remove" (click)="removeSecondaryRepairer(item, name)" title="Remove">×</button>
                      </span>
                      <div class="add-picker-wrapper" *ngIf="openPickerId !== item.id">
                        <button class="chip-add" (click)="openPickerId = item.id!" title="Add secondary repairer">＋</button>
                      </div>
                      <div class="add-picker-wrapper" *ngIf="openPickerId === item.id">
                        <select class="add-select" (change)="addSecondaryRepairer(item, $event)" (blur)="openPickerId = null">
                          <option value="">— pick repairer —</option>
                          <option *ngFor="let r of getAvailableRepairers(item)" [value]="r.name">{{ r.name }}</option>
                        </select>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    .dashboard-header {
      margin-bottom: 2rem;
      text-align: center;
      position: relative;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .header-buttons {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .btn-report {
      background: rgba(0, 242, 255, 0.07);
      border: 1px solid rgba(0, 242, 255, 0.25);
      color: var(--accent-color, #00f2ff);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .btn-report:hover {
      background: rgba(0, 242, 255, 0.15);
      border-color: rgba(0, 242, 255, 0.5);
    }

    .back-link {
      display: inline-block;
      margin-bottom: 1rem;
      color: var(--accent-color);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .back-link:hover { opacity: 0.8; }

    .btn-export-trigger {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .btn-export-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--accent-color);
    }

    .btn-export-trigger.active {
      background: rgba(255, 89, 89, 0.1);
      border-color: #ff5959;
      color: #ff5959;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(45deg, #fff, var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .session-date {
      color: rgba(255, 255, 255, 0.6);
      font-size: 1.2rem;
      font-weight: 600;
    }

    /* Export Picker UI */
    .export-picker {
      margin-bottom: 2rem;
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .export-picker h3 {
      margin-top: 0;
      color: var(--accent-color);
      font-size: 1.1rem;
      margin-bottom: 1.5rem;
    }

    .auth-box { text-align: center; padding: 1.5rem; }

    .explorer-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      overflow-x: auto;
    }

    .breadcrumb-item {
      color: var(--accent-color);
      cursor: pointer;
      white-space: nowrap;
    }

    .breadcrumb-item.active {
      color: white;
      pointer-events: none;
    }

    .explorer-folders {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 12px;
      padding: 1rem;
      min-height: 150px;
      max-height: 300px;
      overflow-y: auto;
      position: relative;
    }

    .folder-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 0.8rem;
    }

    .folder-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.8rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: all 0.2s;
    }

    .folder-item:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--accent-color);
    }

    .folder-item .icon { font-size: 1.5rem; margin-bottom: 0.3rem; }
    .folder-item .name { font-size: 0.8rem; text-align: center; word-break: break-all; }

    .export-actions {
      margin-top: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .target-folder-info { font-size: 0.9rem; color: rgba(255, 255, 255, 0.7); }
    .target-folder-info strong { color: white; }

    .btn-confirm-export {
      padding: 0.6rem 1.2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .export-status { margin-top: 1rem; }
    .status-card {
      padding: 0.8rem;
      border-radius: 8px;
      text-align: center;
      font-size: 0.9rem;
    }
    .status-card.success { background: rgba(0, 255, 127, 0.1); border: 1px solid #00ff7f; color: #00ff7f; }
    .status-card.error { background: rgba(255, 89, 89, 0.1); border: 1px solid #ff5959; color: #ff5959; }

    .view-link {
      display: block;
      margin-top: 0.5rem;
      font-weight: bold;
      color: white;
      text-decoration: underline;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
    }

    .glass-inset { box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }

    .stat-card { text-align: center; }

    .stat-repaired { border-color: rgba(76, 175, 80, 0.4) !important; }
    .stat-repaired .stat-value { color: #81c784; }
    .stat-assigned { border-color: rgba(255, 193, 7, 0.4) !important; }
    .stat-assigned .stat-value { color: #ffd54f; }
    .stat-new { border-color: rgba(33, 150, 243, 0.4) !important; }
    .stat-new .stat-value { color: #64b5f6; }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--accent-color);
      margin-bottom: 0.2rem;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .reports-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .items-card { grid-column: 1 / -1; }

    .report-card h2 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      font-size: 1.2rem;
      color: var(--accent-color);
    }

    /* Status Breakdown List */
    .status-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .status-name {
      width: 100px;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.8);
    }

    .status-bar-container {
      flex: 1;
      height: 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      overflow: hidden;
    }

    .status-bar {
      height: 100%;
      border-radius: 4px;
      background: var(--accent-color);
      transition: width 0.6s ease-out;
    }

    .status-bar.bar-new { background: #2196f3; }
    .status-bar.bar-assigned { background: #ffc107; }
    .status-bar.bar-repaired { background: #4caf50; }
    .status-bar.bar-advice { background: #ff9800; }
    .status-bar.bar-partial { background: #ff9800; }
    .status-bar.bar-not-repaired { background: #f44336; }

    .status-count {
      width: 30px;
      text-align: right;
      font-weight: bold;
      color: white;
    }

    /* Items List */
    .items-list { overflow-x: auto; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }

    th {
      padding: 1rem;
      color: rgba(255, 255, 255, 0.4);
      font-weight: 500;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    td {
      padding: 1rem;
      color: white;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .status-pill {
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.1);
      white-space: nowrap;
    }

    .status-pill.pill-new { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
    .status-pill.pill-assigned { background: rgba(255, 193, 7, 0.2); color: #ffd54f; }
    .status-pill.pill-repaired { background: rgba(76, 175, 80, 0.2); color: #81c784; }
    .status-pill.pill-advice { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
    .status-pill.pill-partial { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
    .status-pill.pill-not-repaired { background: rgba(244, 67, 54, 0.2); color: #ef9a9a; }

    .col-num { width: 50px; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
    .col-meta { color: rgba(255,255,255,0.6); font-size: 0.85rem; }
    .col-repairer { color: var(--accent-color, #00f2ff); font-size: 0.85rem; }
    .col-secondary { min-width: 140px; }

    .secondary-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      align-items: center;
    }

    .sec-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 0.15rem 0.5rem;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.85);
      white-space: nowrap;
    }

    .chip-remove {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0;
      line-height: 1;
      transition: color 0.15s;
    }
    .chip-remove:hover { color: #ff5959; }

    .chip-add {
      background: rgba(255, 255, 255, 0.05);
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      width: 22px;
      height: 22px;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
      flex-shrink: 0;
    }
    .chip-add:hover {
      background: rgba(0, 242, 255, 0.1);
      border-color: rgba(0, 242, 255, 0.4);
      color: var(--accent-color, #00f2ff);
    }

    .add-picker-wrapper { display: inline-flex; }

    .add-select {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 242, 255, 0.3);
      border-radius: 6px;
      color: white;
      font-size: 0.75rem;
      padding: 0.2rem 0.4rem;
      outline: none;
      max-width: 140px;
    }
    .add-select option { background: #1a1a2e; }

    .status-select {
      appearance: none;
      -webkit-appearance: none;
      border: none;
      border-radius: 12px;
      padding: 0.2rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      background-color: rgba(255, 255, 255, 0.1);
      color: rgba(255,255,255,0.8);
      outline: none;
      transition: opacity 0.2s;
      max-width: 140px;
    }
    .status-select:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-select.pill-new { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
    .status-select.pill-assigned { background: rgba(255, 193, 7, 0.2); color: #ffd54f; }
    .status-select.pill-repaired { background: rgba(76, 175, 80, 0.2); color: #81c784; }
    .status-select.pill-advice { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
    .status-select.pill-partial { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
    .status-select.pill-not-repaired { background: rgba(244, 67, 54, 0.2); color: #ef9a9a; }
    .status-select option, .status-select optgroup { background: #1a1a2e; color: white; }

    .btn-primary { background: var(--accent-color); color: black; border: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-text { background: none; border: none; color: var(--accent-color); cursor: pointer; }
    .spinner-small { width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.2); border-left-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (min-width: 900px) { .reports-section { grid-template-columns: 1fr 1fr; } }

    /* Pie chart */
    .pie-wrapper {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .pie-svg {
      width: 160px;
      height: 160px;
      flex-shrink: 0;
    }

    .pie-slice {
      transition: opacity 0.2s;
    }
    .pie-slice:hover { opacity: 0.8; }

    .pie-center-value {
      fill: white;
      font-size: 28px;
      font-weight: 800;
    }
    .pie-center-label {
      fill: rgba(255,255,255,0.5);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .pie-legend {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-text {
      flex: 1;
      color: rgba(255,255,255,0.8);
    }

    .legend-count {
      font-weight: 700;
      color: white;
    }
  `]
})
export class RcdDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private repairService = inject(RepairService);
  private exportService = inject(ExportService);
  private importService = inject(ImportService);
  private authService = inject(AuthService);

  rcdDate: string = '';
  items$!: Observable<RepairItem[]>;

  saving: { [id: string]: boolean } = {};
  repairers: Repairer[] = [];
  openPickerId: string | null = null;

  // Export State
  showPicker = false;
  accessToken = '';
  isLoadingFolders = false;
  isExporting = false;
  directories: any[] = [];
  currentFolder: { id: string, name: string } = { id: 'root', name: 'My Drive' };
  navigationPath: any[] = [];
  statusMessage = '';
  isError = false;
  isSuccess = false;
  exportUrl = '';

  ngOnInit() {
    this.repairService.getRepairers().subscribe(r => this.repairers = r);

    this.items$ = this.route.paramMap.pipe(
      map(params => params.get('date') || ''),
      switchMap(date => {
        this.rcdDate = date;
        return this.repairService.getRepairItems().pipe(
          map(items => items.filter(item => item.RCDay === date))
        );
      })
    );
  }

  togglePicker() {
    this.showPicker = !this.showPicker;
    if (this.showPicker && this.accessToken) {
      this.loadFolders();
    }
  }

  async connectGoogle() {
    try {
      const { token } = await this.authService.loginWithGoogle();
      if (token) {
        this.accessToken = token;
        await this.loadFolders();
      }
    } catch (e) {
      this.statusMessage = 'Failed to connect to Google.';
      this.isError = true;
    }
  }

  async loadFolders() {
    this.isLoadingFolders = true;
    try {
      this.directories = await this.importService.listFolders(this.accessToken, this.currentFolder.id);
    } catch (e) {
      this.statusMessage = 'Failed to load folders.';
      this.isError = true;
    } finally {
      this.isLoadingFolders = false;
    }
  }

  async navigateTo(dir: any) {
    this.navigationPath.push({ ...this.currentFolder });
    this.currentFolder = dir;
    await this.loadFolders();
  }

  async jumpToPath(index: number) {
    if (index === -1) {
      this.currentFolder = { id: 'root', name: 'My Drive' };
      this.navigationPath = [];
    } else {
      const target = this.navigationPath[index];
      this.navigationPath = this.navigationPath.slice(0, index);
      this.currentFolder = target;
    }
    await this.loadFolders();
  }

  goBack() {
    if (this.navigationPath.length > 0) {
      this.jumpToPath(this.navigationPath.length - 1);
    } else {
      this.jumpToPath(-1);
    }
  }

  async performExport() {
    this.isExporting = true;
    this.statusMessage = 'Generating spreadsheet...';
    this.isError = false;
    this.isSuccess = false;
    this.exportUrl = '';

    try {
      const items = await firstValueFrom(this.items$.pipe(take(1)));
      const title = `Repair Cafe - Session ${this.rcdDate}`;
      const url = await this.exportService.exportItemsToSheets(this.accessToken, items, title, this.currentFolder.id);

      this.exportUrl = url;
      this.statusMessage = '✅ Export completed successfully!';
      this.isSuccess = true;
    } catch (e: any) {
      this.statusMessage = '❌ Export failed: ' + (e.message || 'Unknown error');
      this.isError = true;
    } finally {
      this.isExporting = false;
    }
  }

  // ── Markdown Report ──────────────────────────────────────────────────────

  downloadReport(items: RepairItem[]) {
    const md = this.generateMarkdown(items);
    const filename = this.getReportFilename();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private getReportFilename(): string {
    // RCDay format: "Saturday, 15, 03, 2025"
    const parts = this.rcdDate.split(',').map(p => p.trim());
    if (parts.length >= 4) {
      const day = parts[1].padStart(2, '0');
      const month = parts[2].padStart(2, '0');
      const year = parts[3];
      return `repair-cafe-${year}-${month}-${day}.md`;
    }
    return `repair-cafe-session.md`;
  }

  private formatRCDateLong(): string {
    const parts = this.rcdDate.split(',').map(p => p.trim());
    if (parts.length >= 4) {
      const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const dayName = parts[0];
      const day = parseInt(parts[1], 10);
      const month = months[parseInt(parts[2], 10)] || parts[2];
      const year = parts[3];
      return `${dayName} ${day} ${month} ${year}`;
    }
    return this.rcdDate;
  }

  private generateMarkdown(items: RepairItem[]): string {
    const dateStr = this.formatRCDateLong();
    const total = items.length;
    const completed = this.countCompleted(items);
    const inProgress = this.countByStatus(items, 'Assigned');
    const awaiting = this.countByStatus(items, 'New');
    const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let md = `# Repair Cafe Session Report\n\n`;
    md += `**Date:** ${dateStr}\n\n`;
    md += `| | Count |\n|---|---|\n`;
    md += `| Total Items | ${total} |\n`;
    md += `| Completed | ${completed} |\n`;
    md += `| In Progress | ${inProgress} |\n`;
    md += `| Awaiting | ${awaiting} |\n\n`;
    md += `---\n\n`;
    md += `## Items\n\n`;

    const sorted = [...items].sort((a, b) => {
      if (a.rcDayNumber !== b.rcDayNumber) return a.rcDayNumber - b.rcDayNumber;
      return a.itemNumber - b.itemNumber;
    });

    for (const item of sorted) {
      md += `### ${item.displayNumber} — ${item.itemDescription || '(no description)'}\n\n`;
      md += `**Status:** ${item.status || 'New'}  \n`;
      if (item.owner)               md += `**Owner:** ${item.owner}  \n`;
      if (item.telephone)           md += `**Telephone:** ${item.telephone}  \n`;
      if (item.category)            md += `**Category:** ${item.category}  \n`;
      if (item.repairer)            md += `**Primary Repairer:** ${item.repairer}  \n`;
      if (item.additionalRepairers?.length)
                                    md += `**Secondary Repairers:** ${item.additionalRepairers.join(', ')}  \n`;
      if (item.make || item.model)  md += `**Make / Model:** ${[item.make, item.model].filter(Boolean).join(' — ')}  \n`;
      if (item.colour)              md += `**Colour:** ${item.colour}  \n`;
      if (item.yearOfManufacture)   md += `**Year of Manufacture:** ${item.yearOfManufacture}  \n`;
      if (item.serialNumber)        md += `**Serial Number:** ${item.serialNumber}  \n`;
      if (item.tags?.length)        md += `**Tags:** ${item.tags.join(', ')}  \n`;
      md += `\n`;

      if (item.photos?.length) {
        md += `**Photos:**\n\n`;
        const thumbs = item.photos
          .map(p => `<img src="${toRepairPhoto(p).url}" width="160" style="border-radius:6px;margin:4px;object-fit:cover;" />`)
          .join('');
        md += `<p>${thumbs}</p>\n\n`;
      }

      if (item.repairVideos?.length) {
        md += `**Repair Videos:**\n\n`;
        for (const v of item.repairVideos) {
          md += `- [${v.title}](${v.url})\n`;
        }
        md += `\n`;
      }

      md += `---\n\n`;
    }

    md += `*Generated by RepairCafe · ${generated}*\n`;
    return md;
  }

  // ─────────────────────────────────────────────────────────────────────────

  getAvailableRepairers(item: RepairItem): Repairer[] {
    const assigned = new Set([item.repairer, ...(item.additionalRepairers || [])]);
    return this.repairers.filter(r => !assigned.has(r.name));
  }

  addSecondaryRepairer(item: RepairItem, event: Event) {
    const name = (event.target as HTMLSelectElement).value;
    if (!name || !item.id) return;
    item.additionalRepairers = [...(item.additionalRepairers || []), name];
    this.openPickerId = null;
    this.repairService.updateRepairItem(item.id, { additionalRepairers: item.additionalRepairers });
  }

  removeSecondaryRepairer(item: RepairItem, name: string) {
    if (!item.id) return;
    item.additionalRepairers = (item.additionalRepairers || []).filter(n => n !== name);
    this.repairService.updateRepairItem(item.id, { additionalRepairers: item.additionalRepairers });
  }

  async updateStatus(item: RepairItem) {
    if (!item.id) return;
    this.saving[item.id] = true;
    try {
      await this.repairService.updateRepairItem(item.id, { status: item.status });
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      this.saving[item.id] = false;
    }
  }

  countByStatus(items: RepairItem[], status: string): number {
    return items.filter(i => i.status === status).length;
  }

  countCompleted(items: RepairItem[]): number {
    const completedStatuses = ['Repaired', 'Advice Given', 'Partially Repaired', 'Not Repaired'];
    return items.filter(i => completedStatuses.includes(i.status || '')).length;
  }

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  private donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
    const sweep = Math.min(endAngle - startAngle, 359.999);
    const end = startAngle + sweep;
    const large = sweep > 180 ? 1 : 0;
    const os = this.polarToCartesian(cx, cy, outerR, startAngle);
    const oe = this.polarToCartesian(cx, cy, outerR, end);
    const ie = this.polarToCartesian(cx, cy, innerR, end);
    const is_ = this.polarToCartesian(cx, cy, innerR, startAngle);
    return `M ${os.x} ${os.y} A ${outerR} ${outerR} 0 ${large} 1 ${oe.x} ${oe.y} L ${ie.x} ${ie.y} A ${innerR} ${innerR} 0 ${large} 0 ${is_.x} ${is_.y} Z`;
  }

  getPieSlices(items: RepairItem[]) {
    const colors: { [key: string]: string } = {
      'New': '#2196f3',
      'Assigned': '#ffc107',
      'Repaired': '#4caf50',
      'Advice Given': '#ff9800',
      'Partially Repaired': '#ff9800',
      'Not Repaired': '#f44336'
    };
    const breakdown = this.getStatusBreakdown(items);
    const total = items.length || 1;
    let angle = -90;
    return breakdown.map(({ status, count }) => {
      const sweep = (count / total) * 360;
      const path = this.donutSlicePath(80, 80, 70, 42, angle, angle + sweep);
      angle += sweep;
      return { path, color: colors[status] || '#888', status, count };
    });
  }

  getStatusClass(status?: string): string {
    const map: { [key: string]: string } = {
      'New': 'pill-new',
      'Assigned': 'pill-assigned',
      'Repaired': 'pill-repaired',
      'Advice Given': 'pill-advice',
      'Partially Repaired': 'pill-partial',
      'Not Repaired': 'pill-not-repaired'
    };
    return map[status || ''] || '';
  }

  getStatusBreakdown(items: RepairItem[]) {
    const statuses = [
      { status: 'New', cssClass: 'bar-new' },
      { status: 'Assigned', cssClass: 'bar-assigned' },
      { status: 'Repaired', cssClass: 'bar-repaired' },
      { status: 'Advice Given', cssClass: 'bar-advice' },
      { status: 'Partially Repaired', cssClass: 'bar-partial' },
      { status: 'Not Repaired', cssClass: 'bar-not-repaired' }
    ];
    const total = items.length || 1;

    return statuses.map(({ status, cssClass }) => {
      const count = this.countByStatus(items, status);
      return { status, cssClass, count, percentage: (count / total) * 100 };
    }).filter(s => s.count > 0);
  }
}
