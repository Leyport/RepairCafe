import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { ExportService } from '../../services/export.service';
import { ImportService } from '../../services/import.service';
import { AuthService } from '../../services/auth.service';
import { RepairItem } from '../../models/repair-item.model';
import { map, switchMap } from 'rxjs/operators';
import { Observable, take, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-rcd-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-top">
          <a routerLink="/schedule" class="back-link">← Back to Schedule</a>
          <button class="btn-export-trigger" (click)="togglePicker()" [class.active]="showPicker">
            {{ showPicker ? 'Cancel Export' : '📤 Export to Google Sheets' }}
          </button>
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
        <div class="stat-card glass">
          <div class="stat-value">{{ countByStatus(items, 'Fixed') }}</div>
          <div class="stat-label">Fixed</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-value">{{ countByStatus(items, 'Assigned') }}</div>
          <div class="stat-label">Ongoing / Assigned</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-value">{{ getCompletionRate(items) }}%</div>
          <div class="stat-label">Success Rate</div>
        </div>
      </div>

      <div class="reports-section" *ngIf="items$ | async as items">
        <div class="report-card glass">
          <h2>Status Breakdown</h2>
          <div class="status-list">
            <div class="status-item" *ngFor="let stat of getStatusBreakdown(items)">
              <span class="status-name">{{ stat.status }}</span>
              <div class="status-bar-container">
                <div class="status-bar" [style.width.%]="stat.percentage" [class]="stat.status.toLowerCase()"></div>
              </div>
              <span class="status-count">{{ stat.count }}</span>
            </div>
          </div>
        </div>

        <div class="report-card glass">
          <h2>Items List</h2>
          <div class="items-list">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Repairer</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of items">
                  <td>{{ item.displayNumber }}</td>
                  <td>{{ item.itemDescription }}</td>
                  <td><span class="status-pill" [class]="item.status?.toLowerCase()">{{ item.status }}</span></td>
                  <td>{{ item.repairer || 'Unassigned' }}</td>
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

    .status-bar.fixed { background: #4caf50; }
    .status-bar.assigned { background: #2196f3; }
    .status-bar.new { background: #ff9800; }

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
    }

    .status-pill.fixed { background: rgba(76, 175, 80, 0.2); color: #81c784; }
    .status-pill.assigned { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
    .status-pill.new { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }

    .btn-primary { background: var(--accent-color); color: black; border: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-text { background: none; border: none; color: var(--accent-color); cursor: pointer; }
    .spinner-small { width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.2); border-left-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (min-width: 900px) { .reports-section { grid-template-columns: 1fr 2fr; } }
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

  countByStatus(items: RepairItem[], status: string): number {
    return items.filter(i => i.status === status).length;
  }

  getCompletionRate(items: RepairItem[]): number {
    if (items.length === 0) return 0;
    const fixed = this.countByStatus(items, 'Fixed');
    return Math.round((fixed / items.length) * 100);
  }

  getStatusBreakdown(items: RepairItem[]) {
    const statuses = ['New', 'Assigned', 'Fixed', 'Failed', 'Cancelled'];
    const total = items.length || 1;

    return statuses.map(status => {
      const count = this.countByStatus(items, status);
      return {
        status,
        count,
        percentage: (count / total) * 100
      };
    }).filter(s => s.count > 0);
  }
}
