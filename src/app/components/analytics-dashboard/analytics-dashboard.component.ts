import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { combineLatest, Subscription, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import {
  Firestore, collection, collectionData, writeBatch, doc, Timestamp
} from '@angular/fire/firestore';
import { RepairService } from '../../services/repair.service';
import { RepairItem } from '../../models/repair-item.model';

// ── Data interfaces ───────────────────────────────────────────────────────────

interface SessionOutcomes {
  complete: number;
  partial: number;
  ongoingHome: number;
  completeHome: number;
  advice: number;
  unable: number;
  willBring: number;
  paperwork: number;
  inProgress: number;
}

interface SessionCategories {
  electrical: number;
  clothing: number;
  ornament: number;
  mechanical: number;
  furniture: number;
  toy: number;
  clock: number;
  jewellery: number;
  miscellaneous: number;
}

interface Session {
  date: Date;
  dateKey: string;   // YYYY-MM-DD — used for deduplication
  year: number;
  monthLabel: string;
  fullLabel: string;
  volunteers: number;
  incidentalVisitors: number;
  visitorsWithItems: number;
  totalItems: number;
  outcomes: SessionOutcomes;
  categories: SessionCategories;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="analytics-wrap">

  <!-- ── Source selector ── -->
  <div class="source-bar">
    <button class="source-btn" [class.active]="dataSource === 'live'" (click)="switchSource('live')">
      <span class="live-dot" [class.on]="dataSource === 'live'"></span>
      Live App Data
    </button>
    <button class="source-btn" [class.active]="dataSource === 'file'" (click)="switchSource('file')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      Upload File
    </button>
  </div>

  <!-- ── Loading ── -->
  <div *ngIf="dataSource === 'live' && isLoading" class="state-screen">
    <div class="spinner"></div>
    <p>Loading repair data…</p>
  </div>

  <!-- ── Empty live ── -->
  <div *ngIf="dataSource === 'live' && !isLoading && allSessions.length === 0" class="state-screen">
    <div class="state-icon">📭</div>
    <p>No session data found.<br>Make sure you are logged in.</p>
  </div>

  <!-- ── Upload screen ── -->
  <div *ngIf="dataSource === 'file' && allSessions.length === 0" class="upload-screen">
    <div class="drop-zone"
         [class.drag-over]="isDragging"
         (click)="fileInput.click()"
         (dragover)="$event.preventDefault(); isDragging = true"
         (dragleave)="isDragging = false"
         (drop)="onFileDrop($event)">
      <div class="drop-icon">📊</div>
      <h2>Upload Repair Cafe data</h2>
      <p>
        Drop your Excel file here or click to browse.<br>
        The workbook should contain <strong>Monthly_Data</strong> sheets<br>
        (e.g. <em>Monthly_Data 2025</em>, <em>Monthly_Data 2026</em>).
      </p>
      <span class="file-badge">Supports .xlsx and .xls</span>
    </div>
    <input #fileInput type="file" accept=".xlsx,.xls" style="display:none"
           (change)="onFileSelected($event)">
  </div>

  <!-- ── Dashboard ── -->
  <div *ngIf="allSessions.length > 0" class="dashboard">

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="year-tabs">
        <button class="year-tab" [class.active]="currentYear === 'all'" (click)="selectYear('all')">All years</button>
        <button *ngFor="let y of availableYears" class="year-tab"
                [class.active]="currentYear === y" (click)="selectYear(y)">{{ y }}</button>
      </div>

      <!-- File-mode actions -->
      <ng-container *ngIf="dataSource === 'file'">
        <label class="toolbar-btn" for="analytics-file-reload">📂 New file</label>
        <input id="analytics-file-reload" type="file" accept=".xlsx,.xls" style="display:none"
               (change)="onFileSelected($event)">

        <button class="toolbar-btn import-btn"
                [class.importing]="importStatus === 'importing'"
                [class.done]="importStatus === 'done'"
                [class.errored]="importStatus === 'error'"
                [disabled]="importStatus === 'importing'"
                (click)="importToFirebase()">
          <span class="spinner-sm" *ngIf="importStatus === 'importing'"></span>
          <span *ngIf="importStatus === 'idle'">☁ Import to Firebase</span>
          <span *ngIf="importStatus === 'importing'">Importing…</span>
          <span *ngIf="importStatus === 'done'">✓ Imported</span>
          <span *ngIf="importStatus === 'error'">✗ Failed — retry</span>
        </button>
      </ng-container>

      <!-- Live badge -->
      <span *ngIf="dataSource === 'live'" class="live-badge">
        <span class="live-dot on"></span> Live
      </span>
    </div>

    <!-- Import feedback -->
    <div *ngIf="importMessage" class="import-notice"
         [class.success]="importStatus === 'done'"
         [class.error]="importStatus === 'error'">
      {{ importMessage }}
    </div>

    <!-- KPIs -->
    <div class="kpi-row">
      <div class="kpi-card kpi-sessions">
        <div class="kpi-bg-icon">📅</div>
        <div class="kpi-label">Sessions</div>
        <div class="kpi-value">{{ kpiSessions }}</div>
        <div class="kpi-sub">{{ kpiSessionsSub }}</div>
      </div>
      <div class="kpi-card kpi-items">
        <div class="kpi-bg-icon">🔧</div>
        <div class="kpi-label">Items brought in</div>
        <div class="kpi-value">{{ kpiItems | number }}</div>
        <div class="kpi-sub">{{ kpiItemsSub }}</div>
      </div>
      <div class="kpi-card kpi-success">
        <div class="kpi-bg-icon">✅</div>
        <div class="kpi-label">Success rate</div>
        <div class="kpi-value">{{ kpiSuccess }}</div>
        <div class="kpi-sub">{{ kpiSuccessSub }}</div>
      </div>
      <div class="kpi-card kpi-visitors">
        <div class="kpi-bg-icon">👥</div>
        <div class="kpi-label">Visitors</div>
        <div class="kpi-value">{{ kpiVisitors | number }}</div>
        <div class="kpi-sub">{{ kpiVisitorsSub }}</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">

      <div class="chart-card chart-full">
        <div class="chart-card-header">
          <h3>Items per Session</h3>
          <span class="chart-sub">Stacked by category — hover for details</span>
        </div>
        <div class="chart-wrap" style="height:300px">
          <canvas id="chart-sessions"></canvas>
        </div>
      </div>

      <div class="chart-row-3">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Repair Outcomes</h3>
            <span class="chart-sub">How each item was resolved</span>
          </div>
          <div class="chart-wrap" style="height:280px">
            <canvas id="chart-outcomes"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Items by Category</h3>
            <span class="chart-sub">Most frequent types</span>
          </div>
          <div class="chart-wrap" style="height:280px">
            <canvas id="chart-categories"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Success Rate per Session</h3>
            <span class="chart-sub">% successfully repaired (complete + partial)</span>
          </div>
          <div class="chart-wrap" style="height:280px">
            <canvas id="chart-success"></canvas>
          </div>
        </div>
      </div>

      <div class="chart-card chart-full">
        <div class="chart-card-header">
          <h3>Attendance per Session</h3>
          <span class="chart-sub" *ngIf="dataSource === 'file'">Visitors with items, incidental visitors and volunteers</span>
          <span class="chart-sub" *ngIf="dataSource === 'live'">Distinct visitors by name — volunteer &amp; incidental counts not recorded in app</span>
        </div>
        <div class="chart-wrap" style="height:260px">
          <canvas id="chart-visitors"></canvas>
        </div>
      </div>

    </div>
  </div>
</div>
  `,
  styles: [`
    .analytics-wrap { max-width: 1300px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

    /* ── Source bar ── */
    .source-bar { display: flex; gap: 10px; margin-bottom: 28px; }
    .source-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 22px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.5);
      cursor: pointer; font-size: 0.9rem; font-weight: 700;
      letter-spacing: 0.02em; transition: all 0.2s;
    }
    .source-btn:hover { border-color: rgba(0,242,255,0.35); color: rgba(255,255,255,0.85); }
    .source-btn.active { background: rgba(0,242,255,0.1); border-color: rgba(0,242,255,0.45); color: var(--accent-color,#00f2ff); }

    .live-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,255,255,0.2); flex-shrink: 0; transition: background 0.3s;
    }
    .live-dot.on {
      background: #ef5350;
      box-shadow: 0 0 6px rgba(239,83,80,0.7);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 4px rgba(239,83,80,0.5); }
      50%      { box-shadow: 0 0 10px rgba(239,83,80,0.9); }
    }

    /* ── State screens ── */
    .state-screen {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 50vh;
      gap: 1.5rem; color: rgba(255,255,255,0.5);
      font-size: 1rem; text-align: center; line-height: 1.7;
    }
    .state-icon { font-size: 60px; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(0,242,255,0.2); border-top-color: var(--accent-color,#00f2ff); border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Upload ── */
    .upload-screen { display: flex; justify-content: center; align-items: center; min-height: 55vh; }
    .drop-zone {
      background: rgba(255,255,255,0.04); border: 2px dashed rgba(0,242,255,0.3);
      border-radius: 24px; padding: 56px 72px; text-align: center;
      cursor: pointer; transition: all 0.25s; max-width: 480px; width: 100%; user-select: none;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: rgba(0,242,255,0.65); background: rgba(0,242,255,0.05);
      transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,242,255,0.1);
    }
    .drop-icon { font-size: 60px; margin-bottom: 14px; }
    .drop-zone h2 { font-size: 1.4rem; margin-bottom: 10px; background: linear-gradient(to right, var(--primary-color,#6366f1), var(--accent-color,#00f2ff)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .drop-zone p  { color: rgba(255,255,255,0.55); font-size: 0.88rem; line-height: 1.7; }
    .drop-zone p strong { color: rgba(255,255,255,0.85); }
    .drop-zone p em { color: var(--accent-color,#00f2ff); font-style: normal; }
    .file-badge { display: inline-block; margin-top: 16px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: rgba(255,255,255,0.5); font-size: 0.72rem; font-weight: 600; padding: 4px 14px; border-radius: 20px; }

    /* ── Toolbar ── */
    .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; flex-wrap: wrap; }
    .year-tabs { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
    .year-tab { padding: 5px 17px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); cursor: pointer; font-size: 0.83rem; font-weight: 700; transition: all 0.2s; }
    .year-tab:hover  { border-color: rgba(0,242,255,0.35); color: var(--accent-color,#00f2ff); }
    .year-tab.active { background: rgba(0,242,255,0.1); border-color: rgba(0,242,255,0.45); color: var(--accent-color,#00f2ff); }

    .toolbar-btn {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.5); padding: 5px 13px; border-radius: 8px;
      cursor: pointer; font-size: 0.78rem; font-weight: 600; transition: all 0.2s; white-space: nowrap;
    }
    .toolbar-btn:hover { background: rgba(255,255,255,0.1); color: white; }

    .import-btn {
      background: rgba(99,102,241,0.1) !important;
      border-color: rgba(99,102,241,0.35) !important;
      color: var(--primary-color,#6366f1) !important;
      display: flex; align-items: center; gap: 6px;
    }
    .import-btn:hover:not(:disabled) { background: rgba(99,102,241,0.2) !important; border-color: rgba(99,102,241,0.6) !important; color: #818cf8 !important; }
    .import-btn.importing { opacity: 0.7; cursor: not-allowed; }
    .import-btn.done { background: rgba(67,160,71,0.12) !important; border-color: rgba(67,160,71,0.4) !important; color: #81c784 !important; }
    .import-btn.errored { background: rgba(239,83,80,0.12) !important; border-color: rgba(239,83,80,0.4) !important; color: #ef9a9a !important; }
    .import-btn:disabled { cursor: not-allowed; }

    .spinner-sm { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }

    .import-notice {
      margin-bottom: 18px; padding: 10px 16px; border-radius: 10px;
      font-size: 0.83rem; font-weight: 600;
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .import-notice.success { background: rgba(67,160,71,0.1); border-color: rgba(67,160,71,0.3); color: #81c784; }
    .import-notice.error   { background: rgba(239,83,80,0.1); border-color: rgba(239,83,80,0.3); color: #ef9a9a; }

    .live-badge { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; }

    /* ── KPIs ── */
    .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 22px; }
    .kpi-card { position: relative; overflow: hidden; background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 20px 16px; transition: transform 0.2s, box-shadow 0.2s; }
    .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .kpi-sessions { border-top: 3px solid #4CAF50; }
    .kpi-items    { border-top: 3px solid #42A5F5; }
    .kpi-success  { border-top: 3px solid #FF9800; }
    .kpi-visitors { border-top: 3px solid #AB47BC; }
    .kpi-bg-icon  { position: absolute; right: 14px; top: 12px; font-size: 38px; opacity: 0.07; pointer-events: none; }
    .kpi-label    { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
    .kpi-value    { font-size: 2.3rem; font-weight: 900; color: var(--accent-color,#00f2ff); line-height: 1; letter-spacing: -1px; }
    .kpi-sub      { font-size: 0.72rem; color: rgba(255,255,255,0.38); margin-top: 6px; }

    /* ── Charts ── */
    .charts-grid  { display: flex; flex-direction: column; gap: 18px; }
    .chart-full   { width: 100%; }
    .chart-row-3  { display: grid; grid-template-columns: 5fr 4fr 4fr; gap: 18px; }
    .chart-card   { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; }
    .chart-card-header { margin-bottom: 16px; }
    .chart-card-header h3 { font-size: 0.9rem; font-weight: 800; color: var(--accent-color,#00f2ff); margin: 0 0 3px; }
    .chart-sub    { font-size: 0.72rem; color: rgba(255,255,255,0.38); }
    .chart-wrap   { position: relative; }

    @media (max-width: 1100px) { .chart-row-3 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 860px)  { .kpi-row { grid-template-columns: 1fr 1fr; } .chart-row-3 { grid-template-columns: 1fr; } }
    @media (max-width: 500px)  { .kpi-row { grid-template-columns: 1fr; } .drop-zone { padding: 36px 20px; } }
  `]
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  private cdr           = inject(ChangeDetectorRef);
  private repairService = inject(RepairService);
  private firestore     = inject(Firestore);

  dataSource: 'live' | 'file' = 'live';
  isLoading  = false;
  isDragging = false;

  allSessions: Session[]  = [];
  availableYears: number[] = [];
  currentYear: string | number = 'all';

  // KPIs
  kpiSessions = 0; kpiSessionsSub = '';
  kpiItems    = 0; kpiItemsSub    = '';
  kpiSuccess  = '0%'; kpiSuccessSub = '';
  kpiVisitors = 0; kpiVisitorsSub = '';

  // Import state
  importStatus: 'idle' | 'importing' | 'done' | 'error' = 'idle';
  importMessage = '';

  private chartInstances = new Map<string, Chart>();
  private liveSub?: Subscription;

  // ── Config ───────────────────────────────────────────────────────────────

  private readonly CAT_KEYS: (keyof SessionCategories)[] = [
    'electrical','clothing','ornament','mechanical',
    'furniture','toy','clock','jewellery','miscellaneous'
  ];
  private readonly CAT_LABELS = [
    'Electrical','Clothing & Textile','Ornament','Mechanical',
    'Furniture','Toy','Clock','Jewellery','Miscellaneous'
  ];
  private readonly CAT_COLORS = [
    '#FF7043','#E91E63','#AB47BC','#546E7A',
    '#795548','#29B6F6','#009688','#FFC107','#90A4AE'
  ];

  private readonly OUTCOME_CFG: { key: keyof SessionOutcomes; label: string; color: string }[] = [
    { key: 'complete',     label: 'Complete Repair',   color: '#43A047' },
    { key: 'partial',      label: 'Partial Repair',    color: '#8BC34A' },
    { key: 'completeHome', label: 'Complete at Home',  color: '#C5E1A5' },
    { key: 'ongoingHome',  label: 'Ongoing at Home',   color: '#FFC107' },
    { key: 'advice',       label: 'Advice Given',      color: '#42A5F5' },
    { key: 'unable',       label: 'Unable to Repair',  color: '#EF5350' },
    { key: 'willBring',    label: 'Will Bring Back',   color: '#FF9800' },
    { key: 'paperwork',    label: 'Paperwork Missing', color: '#9E9E9E' },
    { key: 'inProgress',   label: 'In Progress',       color: '#5C6BC0' },
  ];

  private readonly gridColor   = 'rgba(255,255,255,0.07)';
  private readonly tickColor   = 'rgba(255,255,255,0.5)';
  private readonly legendColor = 'rgba(255,255,255,0.65)';

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit()    { this.loadLiveData(); }
  ngOnDestroy() { this.liveSub?.unsubscribe(); this.destroyAllCharts(); }

  // ── Source switching ──────────────────────────────────────────────────────

  switchSource(source: 'live' | 'file') {
    if (source === this.dataSource) return;
    this.dataSource   = source;
    this.allSessions  = [];
    this.importStatus = 'idle';
    this.importMessage = '';
    this.destroyAllCharts();

    if (source === 'live') {
      this.loadLiveData();
    } else {
      this.liveSub?.unsubscribe();
      this.isLoading = false;
    }
  }

  // ── Live data: merge repairItems + imported_sessions ─────────────────────

  private loadLiveData() {
    this.isLoading = true;
    this.cdr.detectChanges();

    const importedCol  = collection(this.firestore, 'imported_sessions');
    const imported$    = (collectionData(importedCol) as any).pipe(catchError(() => of([])));
    const repairItems$ = this.repairService.getRepairItems().pipe(catchError(() => of([])));

    this.liveSub?.unsubscribe();
    this.liveSub = combineLatest([repairItems$, imported$]).pipe(
      map(([items, importedDocs]: [any, any]) =>
        this.mergeDataSources(items as RepairItem[], importedDocs as any[]))
    ).subscribe({
      next: (sessions) => {
        this.allSessions    = sessions;
        this.availableYears = [...new Set(sessions.map(s => s.year))].sort();
        this.currentYear    = 'all';
        this.isLoading      = false;
        this.cdr.detectChanges();

        if (sessions.length > 0) {
          this.destroyAllCharts();
          setTimeout(() => this.renderDashboard(sessions), 0);
        }
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  private mergeDataSources(items: RepairItem[], importedDocs: any[]): Session[] {
    // Sessions derived from live app data
    const appSessions = this.itemsToSessions(items);
    const appDateKeys = new Set(appSessions.map(s => s.dateKey));

    // Imported sessions — only include dates not already covered by app data
    const importedSessions = importedDocs
      .filter(d => d.dateKey && !appDateKeys.has(d.dateKey))
      .map(d => this.docToSession(d))
      .filter((s): s is Session => s !== null);

    return [...appSessions, ...importedSessions]
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private docToSession(d: any): Session | null {
    try {
      const date: Date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
      if (isNaN(date.getTime())) return null;
      return {
        date,
        dateKey:            d.dateKey,
        year:               date.getFullYear(),
        monthLabel:         date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        fullLabel:          date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        volunteers:         d.volunteers         ?? 0,
        incidentalVisitors: d.incidentalVisitors ?? 0,
        visitorsWithItems:  d.visitorsWithItems  ?? 0,
        totalItems:         d.totalItems         ?? 0,
        outcomes: { inProgress: 0, ...d.outcomes },
        categories:         d.categories         ?? this.emptyCats(),
      };
    } catch { return null; }
  }

  // ── RepairItem[] → Session[] ──────────────────────────────────────────────

  private parseRCDay(rcDay: string): Date | null {
    // Format: "Saturday, 15, 03, 2025"
    const parts = rcDay.split(',').map(p => p.trim());
    if (parts.length < 4) return null;
    const d = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private mapCategory(cat: string | undefined): keyof SessionCategories {
    const map: Record<string, keyof SessionCategories> = {
      electrical: 'electrical', textile: 'clothing', clothing: 'clothing',
      ornament: 'ornament', mechanical: 'mechanical', furniture: 'furniture',
      toy: 'toy', clock: 'clock', jewelry: 'jewellery', jewellery: 'jewellery',
      other: 'miscellaneous',
    };
    return map[(cat ?? '').toLowerCase()] ?? 'miscellaneous';
  }

  private emptyCats(): SessionCategories {
    return { electrical:0, clothing:0, ornament:0, mechanical:0, furniture:0, toy:0, clock:0, jewellery:0, miscellaneous:0 };
  }

  private itemsToSessions(items: RepairItem[]): Session[] {
    const grouped = new Map<string, RepairItem[]>();
    for (const item of items) {
      if (!item.RCDay) continue;
      const b = grouped.get(item.RCDay);
      if (b) b.push(item); else grouped.set(item.RCDay, [item]);
    }

    const sessions: Session[] = [];
    grouped.forEach((dayItems, rcDay) => {
      const date = this.parseRCDay(rcDay);
      if (!date) return;

      const cats = this.emptyCats();
      dayItems.forEach(item => cats[this.mapCategory(item.category)]++);

      const cnt = (status: string) => dayItems.filter(i => i.status === status).length;

      sessions.push({
        date,
        dateKey:            this.toDateKey(date),
        year:               date.getFullYear(),
        monthLabel:         date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        fullLabel:          date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        volunteers:         0,
        incidentalVisitors: 0,
        visitorsWithItems:  new Set(dayItems.map(i => i.owner).filter(Boolean)).size,
        totalItems:         dayItems.length,
        outcomes: {
          complete:     cnt('Repaired'),
          partial:      cnt('Partially Repaired'),
          ongoingHome:  0,
          completeHome: 0,
          advice:       cnt('Advice Given'),
          unable:       cnt('Not Repaired'),
          willBring:    0,
          paperwork:    0,
          inProgress:   dayItems.filter(i => !i.status || i.status === 'New' || i.status === 'Assigned').length,
        },
        categories: cats,
      });
    });

    return sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // ── File upload ───────────────────────────────────────────────────────────

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb       = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
      const sessions = this.parseWorkbook(wb);

      if (!sessions.length) {
        alert('No session data found.\n\nMake sure the workbook contains sheets named "Monthly_Data YYYY".');
        return;
      }

      this.allSessions    = sessions;
      this.availableYears = [...new Set(sessions.map(s => s.year))].sort();
      this.currentYear    = 'all';
      this.importStatus   = 'idle';
      this.importMessage  = '';
      this.cdr.detectChanges();

      this.destroyAllCharts();
      setTimeout(() => this.renderDashboard(this.allSessions), 0);
    };
    reader.readAsArrayBuffer(file);
  }

  private parseWorkbook(wb: XLSX.WorkBook): Session[] {
    const sessions: Session[] = [];

    for (const name of wb.SheetNames) {
      if (!name.startsWith('Monthly_Data')) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' });

      for (let i = 3; i < rows.length; i++) {
        const r          = rows[i] as unknown[];
        const dateSerial = this.n(r[1]);
        const totalItems = this.n(r[7]);
        if (!dateSerial || !totalItems) continue;

        const date = this.excelToDate(dateSerial);
        if (isNaN(date.getTime())) continue;

        sessions.push({
          date,
          dateKey:            this.toDateKey(date),
          year:               date.getFullYear(),
          monthLabel:         date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          fullLabel:          date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          volunteers:         this.n(r[2]),
          incidentalVisitors: this.n(r[3]),
          visitorsWithItems:  this.n(r[4]),
          totalItems,
          outcomes: {
            complete:     this.n(r[8]),
            partial:      this.n(r[9]),
            ongoingHome:  this.n(r[10]),
            completeHome: this.n(r[11]),
            advice:       this.n(r[12]),
            unable:       this.n(r[13]),
            willBring:    this.n(r[14]),
            paperwork:    this.n(r[15]),
            inProgress:   0,
          },
          categories: {
            electrical:    this.n(r[16]),
            clothing:      this.n(r[17]),
            ornament:      this.n(r[18]),
            mechanical:    this.n(r[19]),
            furniture:     this.n(r[20]),
            toy:           this.n(r[21]),
            clock:         this.n(r[22]),
            jewellery:     this.n(r[23]),
            miscellaneous: this.n(r[24]),
          },
        });
      }
    }

    return sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // ── Import to Firebase ────────────────────────────────────────────────────

  async importToFirebase() {
    if (!this.allSessions.length || this.importStatus === 'importing') return;

    this.importStatus  = 'importing';
    this.importMessage = `Importing ${this.allSessions.length} sessions…`;
    this.cdr.detectChanges();

    try {
      const col   = collection(this.firestore, 'imported_sessions');
      const batch = writeBatch(this.firestore);

      for (const s of this.allSessions) {
        const docRef = doc(col, s.dateKey);
        batch.set(docRef, {
          dateKey:            s.dateKey,
          date:               Timestamp.fromDate(s.date),
          volunteers:         s.volunteers,
          incidentalVisitors: s.incidentalVisitors,
          visitorsWithItems:  s.visitorsWithItems,
          totalItems:         s.totalItems,
          outcomes: {
            complete:     s.outcomes.complete,
            partial:      s.outcomes.partial,
            ongoingHome:  s.outcomes.ongoingHome,
            completeHome: s.outcomes.completeHome,
            advice:       s.outcomes.advice,
            unable:       s.outcomes.unable,
            willBring:    s.outcomes.willBring,
            paperwork:    s.outcomes.paperwork,
          },
          categories:  s.categories,
          source:      'imported',
          importedAt:  Timestamp.now(),
        });
      }

      await batch.commit();
      this.importStatus  = 'done';
      this.importMessage = `✓ ${this.allSessions.length} sessions imported — switch to Live App Data to see them combined with your repair records.`;
    } catch (e: any) {
      this.importStatus  = 'error';
      this.importMessage = `✗ Import failed: ${e?.message ?? 'Unknown error'}`;
    }

    this.cdr.detectChanges();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private n(v: unknown): number { const x = parseFloat(String(v)); return isNaN(x) ? 0 : x; }
  private excelToDate(serial: number): Date { return new Date(Math.round((serial - 25569) * 86_400_000)); }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  selectYear(year: string | number) {
    this.currentYear = year;
    const sessions   = year === 'all' ? this.allSessions : this.allSessions.filter(s => s.year === year);
    this.updateKPIs(sessions);
    this.destroyAllCharts();
    setTimeout(() => this.renderAllCharts(sessions), 0);
  }

  private renderDashboard(sessions: Session[]) {
    this.updateKPIs(sessions);
    this.renderAllCharts(sessions);
  }

  private updateKPIs(sessions: Session[]) {
    const totalItems      = sessions.reduce((s, x) => s + x.totalItems, 0);
    const totalSuccessful = sessions.reduce((s, x) => s + x.outcomes.complete + x.outcomes.partial + x.outcomes.completeHome, 0);
    const totalComplete   = sessions.reduce((s, x) => s + x.outcomes.complete + x.outcomes.completeHome, 0);
    const totalVisitors   = sessions.reduce((s, x) => s + x.visitorsWithItems, 0);
    const totalIncidental = sessions.reduce((s, x) => s + x.incidentalVisitors, 0);
    const successRate     = totalItems ? Math.round(totalSuccessful / totalItems * 100) : 0;
    const avgItems        = sessions.length ? Math.round(totalItems / sessions.length) : 0;

    this.kpiSessions    = sessions.length;
    this.kpiSessionsSub = `Avg ${avgItems} items per session`;
    this.kpiItems       = totalItems;
    this.kpiItemsSub    = `${totalComplete} fully repaired`;
    this.kpiSuccess     = successRate + '%';
    this.kpiSuccessSub  = `${totalSuccessful} of ${totalItems} items`;
    this.kpiVisitors    = totalVisitors;
    this.kpiVisitorsSub = this.dataSource === 'live'
      ? 'by distinct visitor name'
      : `+ ${totalIncidental} incidental visitors`;
  }

  // ── Charts ────────────────────────────────────────────────────────────────

  private renderAllCharts(sessions: Session[]) {
    this.renderSessionsChart(sessions);
    this.renderOutcomesChart(sessions);
    this.renderCategoriesChart(sessions);
    this.renderSuccessChart(sessions);
    this.renderVisitorsChart(sessions);
  }

  private destroyChart(id: string) { const c = this.chartInstances.get(id); if (c) { c.destroy(); this.chartInstances.delete(id); } }
  private destroyAllCharts() { this.chartInstances.forEach(c => c.destroy()); this.chartInstances.clear(); }
  private ctx(id: string): CanvasRenderingContext2D | null { return (document.getElementById(id) as HTMLCanvasElement | null)?.getContext('2d') ?? null; }

  private renderSessionsChart(sessions: Session[]) {
    this.destroyChart('sessions');
    const ctx = this.ctx('chart-sessions'); if (!ctx) return;
    const labels    = sessions.map(s => s.monthLabel);
    const fullDates = sessions.map(s => s.fullLabel);

    this.chartInstances.set('sessions', new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: this.CAT_KEYS.map((key, i) => ({
          label: this.CAT_LABELS[i], data: sessions.map(s => s.categories[key]),
          backgroundColor: this.CAT_COLORS[i], stack: 'stack', borderWidth: 0,
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: this.legendColor } },
          tooltip: { mode: 'index', callbacks: {
            title:  items => fullDates[items[0].dataIndex],
            footer: items => 'Total: ' + items.reduce((s, i) => s + (i.raw as number), 0),
          }}
        },
        scales: {
          x: { stacked: true, grid: { color: this.gridColor }, ticks: { color: this.tickColor } },
          y: { stacked: true, beginAtZero: true, grid: { color: this.gridColor }, ticks: { color: this.tickColor }, title: { display: true, text: 'Items', color: this.tickColor } }
        }
      }
    }));
  }

  private renderOutcomesChart(sessions: Session[]) {
    this.destroyChart('outcomes');
    const ctx = this.ctx('chart-outcomes'); if (!ctx) return;
    const active = this.OUTCOME_CFG
      .map(cfg => ({ ...cfg, total: sessions.reduce((s, x) => s + (x.outcomes[cfg.key] ?? 0), 0) }))
      .filter(x => x.total > 0);

    this.chartInstances.set('outcomes', new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   active.map(x => x.label),
        datasets: [{ data: active.map(x => x.total), backgroundColor: active.map(x => x.color), borderWidth: 2, borderColor: 'rgba(15,23,42,0.8)', hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: this.legendColor } },
          tooltip: { callbacks: { label: ctx => {
            const sum = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            return ` ${ctx.label}: ${ctx.raw} (${Math.round((ctx.raw as number) / sum * 100)}%)`;
          }}}
        }
      }
    }));
  }

  private renderCategoriesChart(sessions: Session[]) {
    this.destroyChart('categories');
    const ctx = this.ctx('chart-categories'); if (!ctx) return;
    const sorted = this.CAT_KEYS
      .map((key, i) => ({ label: this.CAT_LABELS[i], total: sessions.reduce((s, x) => s + x.categories[key], 0), color: this.CAT_COLORS[i] }))
      .sort((a, b) => b.total - a.total);

    this.chartInstances.set('categories', new Chart(ctx, {
      type: 'bar',
      data: { labels: sorted.map(x => x.label), datasets: [{ label: 'Items', data: sorted.map(x => x.total), backgroundColor: sorted.map(x => x.color), borderRadius: 5, borderSkipped: false }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: this.gridColor }, ticks: { color: this.tickColor }, title: { display: true, text: 'Items', color: this.tickColor } },
          y: { grid: { display: false }, ticks: { color: this.tickColor } }
        }
      }
    }));
  }

  private renderSuccessChart(sessions: Session[]) {
    this.destroyChart('success');
    const ctx = this.ctx('chart-success'); if (!ctx) return;
    const labels    = sessions.map(s => s.monthLabel);
    const fullDates = sessions.map(s => s.fullLabel);
    const rates     = sessions.map(s => s.totalItems ? Math.round((s.outcomes.complete + s.outcomes.partial + s.outcomes.completeHome) / s.totalItems * 100) : 0);

    this.chartInstances.set('success', new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Success %', data: rates, borderColor: '#43A047', backgroundColor: 'rgba(67,160,71,0.1)', fill: true, tension: 0.4, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#43A047' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => fullDates[items[0].dataIndex], label: ctx => ` Success rate: ${ctx.raw}%` } } },
        scales: {
          x: { grid: { color: this.gridColor }, ticks: { color: this.tickColor } },
          y: { beginAtZero: true, max: 100, grid: { color: this.gridColor }, ticks: { color: this.tickColor, callback: v => v + '%' } }
        }
      }
    }));
  }

  private renderVisitorsChart(sessions: Session[]) {
    this.destroyChart('visitors');
    const ctx = this.ctx('chart-visitors'); if (!ctx) return;
    const labels    = sessions.map(s => s.monthLabel);
    const fullDates = sessions.map(s => s.fullLabel);

    const mk = (label: string, key: keyof Session, color: string, dash?: number[]) => ({
      label, data: sessions.map(s => (s[key] as number) || 0),
      borderColor: color, backgroundColor: color + '18', fill: !dash, tension: 0.4,
      pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: color, borderDash: dash ?? [],
    });

    const datasets = this.dataSource === 'live'
      ? [mk('Visitors (distinct names)', 'visitorsWithItems', '#42A5F5')]
      : [
          mk('Visitors with items',  'visitorsWithItems',  '#42A5F5'),
          mk('Incidental visitors',  'incidentalVisitors', '#AB47BC'),
          mk('Volunteers',           'volunteers',          '#FF9800', [6, 3]),
        ];

    this.chartInstances.set('visitors', new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: this.legendColor } },
          tooltip: { callbacks: { title: items => fullDates[items[0].dataIndex] } }
        },
        scales: {
          x: { grid: { color: this.gridColor }, ticks: { color: this.tickColor } },
          y: { beginAtZero: true, grid: { color: this.gridColor }, ticks: { color: this.tickColor } }
        }
      }
    }));
  }
}
