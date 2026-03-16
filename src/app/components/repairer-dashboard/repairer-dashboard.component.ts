import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { RepairItem } from '../../models/repair-item.model';
import { Repairer } from '../../models/repairer.model';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-repairer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">

      <ng-container *ngIf="{ repairer: repairer$ | async, items: items$ | async } as vm">

        <!-- Header -->
        <header class="dashboard-header">
          <a routerLink="/admin/repairers" class="back-link">← Back to Repairers</a>

          <div class="repairer-hero" *ngIf="vm.repairer">
            <div class="hero-avatar">
              <img *ngIf="vm.repairer.photoUrl" [src]="vm.repairer.photoUrl" alt="avatar">
              <span *ngIf="!vm.repairer.photoUrl" class="avatar-initial">{{ vm.repairer.name.charAt(0) }}</span>
            </div>
            <div class="hero-info">
              <h1>{{ vm.repairer.name }}</h1>
              <span class="role-badge" [class.primary]="vm.repairer.isPrimary" [class.secondary]="!vm.repairer.isPrimary">
                {{ vm.repairer.isPrimary ? 'Primary Repairer' : 'Secondary Repairer' }}
              </span>
            </div>
          </div>
        </header>

        <!-- Stats -->
        <div class="stats-grid" *ngIf="vm.items">
          <div class="stat-card glass">
            <div class="stat-value">{{ vm.items.length }}</div>
            <div class="stat-label">Total Assigned</div>
          </div>
          <div class="stat-card glass stat-primary">
            <div class="stat-value">{{ countAsPrimary(vm.items) }}</div>
            <div class="stat-label">As Primary</div>
          </div>
          <div class="stat-card glass stat-helper">
            <div class="stat-value">{{ countAsHelper(vm.items) }}</div>
            <div class="stat-label">As Helper</div>
          </div>
          <div class="stat-card glass stat-completed">
            <div class="stat-value">{{ countCompleted(vm.items) }}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>

        <!-- Reports -->
        <div class="reports-section" *ngIf="vm.items">

          <!-- Donut Chart -->
          <div class="report-card glass">
            <h2>Status Distribution</h2>
            <div class="pie-wrapper" *ngIf="vm.items.length > 0; else noItems">
              <svg viewBox="0 0 160 160" class="pie-svg">
                <ng-container *ngFor="let slice of getPieSlices(vm.items)">
                  <path [attr.d]="slice.path" [attr.fill]="slice.color" class="pie-slice">
                    <title>{{ slice.status }}: {{ slice.count }}</title>
                  </path>
                </ng-container>
                <text x="80" y="75" text-anchor="middle" class="pie-center-value">{{ vm.items.length }}</text>
                <text x="80" y="93" text-anchor="middle" class="pie-center-label">items</text>
              </svg>
              <div class="pie-legend">
                <div class="legend-item" *ngFor="let slice of getPieSlices(vm.items)">
                  <span class="legend-dot" [style.background]="slice.color"></span>
                  <span class="legend-text">{{ slice.status }}</span>
                  <span class="legend-count">{{ slice.count }}</span>
                </div>
              </div>
            </div>
            <ng-template #noItems>
              <p class="empty-msg">No items assigned yet.</p>
            </ng-template>
          </div>

          <!-- Items List -->
          <div class="report-card glass items-card">
            <h2>Assigned Items</h2>
            <div class="items-list" *ngIf="vm.items.length > 0; else noItemsTable">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Description</th>
                    <th>Owner</th>
                    <th>RC Session</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of vm.items">
                    <td class="col-num">{{ item.displayNumber }}</td>
                    <td class="col-desc">{{ item.itemDescription }}</td>
                    <td class="col-meta">{{ item.owner || '—' }}</td>
                    <td class="col-meta">{{ formatRCDay(item.RCDay) }}</td>
                    <td>
                      <span class="role-pill" [class.role-primary]="item.repairer === repairerName"
                            [class.role-helper]="item.repairer !== repairerName">
                        {{ item.repairer === repairerName ? 'Primary' : 'Helper' }}
                      </span>
                    </td>
                    <td>
                      <span class="status-pill" [ngClass]="getStatusClass(item.status)">{{ item.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noItemsTable>
              <p class="empty-msg">No items assigned to this repairer yet.</p>
            </ng-template>
          </div>

        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 1.5rem;
      color: var(--accent-color);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .back-link:hover { opacity: 0.8; }

    /* Hero */
    .repairer-hero {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .hero-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      background: rgba(255,255,255,0.08);
      border: 2px solid var(--accent-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-initial { font-size: 2rem; font-weight: 700; color: var(--accent-color); }

    .hero-info h1 {
      margin: 0 0 0.5rem;
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(45deg, #fff, var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .role-badge {
      display: inline-block;
      padding: 0.2rem 0.8rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .role-badge.primary { background: rgba(0,242,255,0.15); color: var(--accent-color); border: 1px solid rgba(0,242,255,0.3); }
    .role-badge.secondary { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.15); }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .glass {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 1.5rem;
    }

    .stat-card { text-align: center; }
    .stat-value { font-size: 2.5rem; font-weight: 800; color: var(--accent-color); margin-bottom: 0.2rem; }
    .stat-label { color: rgba(255,255,255,0.6); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }

    .stat-primary { border-color: rgba(0,242,255,0.35) !important; }
    .stat-primary .stat-value { color: var(--accent-color); }
    .stat-helper { border-color: rgba(99,102,241,0.35) !important; }
    .stat-helper .stat-value { color: #818cf8; }
    .stat-completed { border-color: rgba(76,175,80,0.35) !important; }
    .stat-completed .stat-value { color: #81c784; }

    /* Reports */
    .reports-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .items-card { grid-column: 1 / -1; }
    @media (min-width: 900px) { .reports-section { grid-template-columns: 1fr 1fr; } }

    .report-card h2 {
      margin: 0 0 1.5rem;
      font-size: 1.1rem;
      color: var(--accent-color);
    }

    /* Donut chart */
    .pie-wrapper { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
    .pie-svg { width: 160px; height: 160px; flex-shrink: 0; }
    .pie-slice { transition: opacity 0.2s; }
    .pie-slice:hover { opacity: 0.8; }
    .pie-center-value { fill: white; font-size: 28px; font-weight: 800; }
    .pie-center-label { fill: rgba(255,255,255,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
    .pie-legend { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-text { flex: 1; color: rgba(255,255,255,0.8); }
    .legend-count { font-weight: 700; color: white; }

    /* Table */
    .items-list { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { padding: 0.8rem 1rem; color: rgba(255,255,255,0.4); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; }
    td { padding: 0.8rem 1rem; color: white; border-bottom: 1px solid rgba(255,255,255,0.05); }
    tr:last-child td { border-bottom: none; }

    .col-num { width: 50px; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
    .col-desc { max-width: 220px; }
    .col-meta { color: rgba(255,255,255,0.6); font-size: 0.85rem; }

    .role-pill {
      padding: 0.15rem 0.6rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .role-primary { background: rgba(0,242,255,0.15); color: var(--accent-color); }
    .role-helper { background: rgba(99,102,241,0.15); color: #818cf8; }

    .status-pill {
      padding: 0.15rem 0.6rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      white-space: nowrap;
      background: rgba(255,255,255,0.08);
    }
    .pill-new { background: rgba(33,150,243,0.2); color: #64b5f6; }
    .pill-assigned { background: rgba(255,193,7,0.2); color: #ffd54f; }
    .pill-repaired { background: rgba(76,175,80,0.2); color: #81c784; }
    .pill-advice { background: rgba(255,152,0,0.2); color: #ffb74d; }
    .pill-partial { background: rgba(255,152,0,0.2); color: #ffb74d; }
    .pill-not-repaired { background: rgba(244,67,54,0.2); color: #ef9a9a; }

    .empty-msg { color: rgba(255,255,255,0.4); font-size: 0.9rem; text-align: center; padding: 2rem 0; }
  `]
})
export class RepairerDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private repairService = inject(RepairService);

  repairerName = '';
  repairer$!: Observable<Repairer | null>;
  items$!: Observable<RepairItem[]>;

  ngOnInit() {
    const name$ = this.route.paramMap.pipe(map(p => decodeURIComponent(p.get('name') || '')));

    this.repairer$ = combineLatest([this.repairService.getRepairers(), name$]).pipe(
      map(([repairers, name]) => {
        this.repairerName = name;
        return repairers.find(r => r.name === name) ?? null;
      })
    );

    this.items$ = combineLatest([this.repairService.getRepairItems(), name$]).pipe(
      map(([items, name]) => {
        this.repairerName = name;
        return items.filter(item =>
          item.repairer === name || (item.additionalRepairers || []).includes(name)
        );
      })
    );
  }

  countAsPrimary(items: RepairItem[]): number {
    return items.filter(i => i.repairer === this.repairerName).length;
  }

  countAsHelper(items: RepairItem[]): number {
    return items.filter(i => (i.additionalRepairers || []).includes(this.repairerName)).length;
  }

  countCompleted(items: RepairItem[]): number {
    const done = ['Repaired', 'Advice Given', 'Partially Repaired', 'Not Repaired'];
    return items.filter(i => done.includes(i.status || '')).length;
  }

  formatRCDay(rcDay: string): string {
    if (!rcDay) return '—';
    const parts = rcDay.split(',').map(s => s.trim());
    if (parts.length >= 4) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const month = months[parseInt(parts[2], 10) - 1] || parts[2];
      return `${parts[1]} ${month} ${parts[3]}`;
    }
    return rcDay;
  }

  getStatusClass(status?: string): string {
    const map: Record<string, string> = {
      'New': 'pill-new', 'Assigned': 'pill-assigned', 'Repaired': 'pill-repaired',
      'Advice Given': 'pill-advice', 'Partially Repaired': 'pill-partial', 'Not Repaired': 'pill-not-repaired'
    };
    return map[status || ''] || '';
  }

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  private donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, start: number, end: number): string {
    const sweep = Math.min(end - start, 359.999);
    const a = start + sweep;
    const large = sweep > 180 ? 1 : 0;
    const os = this.polarToCartesian(cx, cy, outerR, start);
    const oe = this.polarToCartesian(cx, cy, outerR, a);
    const ie = this.polarToCartesian(cx, cy, innerR, a);
    const is_ = this.polarToCartesian(cx, cy, innerR, start);
    return `M ${os.x} ${os.y} A ${outerR} ${outerR} 0 ${large} 1 ${oe.x} ${oe.y} L ${ie.x} ${ie.y} A ${innerR} ${innerR} 0 ${large} 0 ${is_.x} ${is_.y} Z`;
  }

  getPieSlices(items: RepairItem[]) {
    const colors: Record<string, string> = {
      'New': '#2196f3', 'Assigned': '#ffc107', 'Repaired': '#4caf50',
      'Advice Given': '#ff9800', 'Partially Repaired': '#ff9800', 'Not Repaired': '#f44336'
    };
    const order = ['New', 'Assigned', 'Repaired', 'Advice Given', 'Partially Repaired', 'Not Repaired'];
    const total = items.length || 1;
    let angle = -90;
    return order
      .map(status => ({ status, count: items.filter(i => i.status === status).length }))
      .filter(s => s.count > 0)
      .map(({ status, count }) => {
        const sweep = (count / total) * 360;
        const path = this.donutSlicePath(80, 80, 70, 42, angle, angle + sweep);
        angle += sweep;
        return { path, color: colors[status] || '#888', status, count };
      });
  }
}
