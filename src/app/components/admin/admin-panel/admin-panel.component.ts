import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ExportService } from '../../../services/export.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-container glass">
      <div class="admin-header">
        <h2>🛠️ Admin Dashboard</h2>
        <p>Manage your Repair Cafe settings and volunteers.</p>
      </div>
      
      <!-- Section open: compact tab strip so the chosen section appears right below it -->
      <nav class="admin-tabs" *ngIf="sectionOpen">
        <a routerLink="/admin" class="tab back-tab">← All tools</a>
        <a *ngFor="let s of sections" [routerLink]="s.path" routerLinkActive="active" class="tab">
          <span class="tab-icon">{{ s.icon }}</span>{{ s.title }}
        </a>
      </nav>

      <!-- No section open: full menu of cards -->
      <nav class="admin-nav" *ngIf="!sectionOpen">
        <a *ngFor="let s of sections" [routerLink]="s.path" class="nav-card">
          <div class="card-icon">{{ s.icon }}</div>
          <div class="card-content">
            <h3>{{ s.title }}</h3>
            <p>{{ s.description }}</p>
          </div>
        </a>

        <div class="nav-card" (click)="doExport()" [class.disabled]="isExporting">
          <div class="card-icon" *ngIf="!isExporting">📊</div>
          <div class="spinner" *ngIf="isExporting"></div>
          <div class="card-content">
            <h3>Export to Google Sheets</h3>
            <p>{{ exportStatus || 'Backup all repair items to your Google Drive.' }}</p>
            <a *ngIf="exportUrl" [href]="exportUrl" target="_blank" class="export-link" (click)="$event.stopPropagation()">
              Open Spreadsheet ↗
            </a>
          </div>
        </div>
      </nav>

      <div class="admin-content" *ngIf="sectionOpen">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 2rem;
      border-radius: 16px;
      margin-top: 1rem;
    }
    @media (max-width: 600px) {
      .admin-container {
        padding: 1.2rem;
        margin-top: 0.5rem;
      }
      .admin-header h2 {
        font-size: 1.5rem;
      }
    }
    .admin-header {
      margin-bottom: 2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 1rem;
    }
    .admin-header h2 {
      margin: 0;
      color: var(--accent-color);
    }
    .admin-header p {
      margin: 0.5rem 0 0;
      color: rgba(255, 255, 255, 0.6);
    }
    .admin-nav {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .nav-card {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: all 0.3s ease;
    }
    @media (max-width: 480px) {
      .nav-card {
        padding: 1rem;
        gap: 1rem;
      }
      .card-icon {
        font-size: 2rem;
      }
      .card-content h3 {
        font-size: 1.1rem;
      }
    }
    .nav-card:hover {
      background: rgba(0, 242, 255, 0.1);
      border-color: var(--accent-color);
      transform: translateY(-4px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }
    .nav-card.disabled {
      opacity: 0.7;
      cursor: wait;
      pointer-events: none;
    }
    .export-link {
      display: inline-block;
      margin-top: 0.5rem;
      color: var(--accent-color);
      font-weight: 600;
      text-decoration: underline;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 242, 255, 0.1);
      border-left-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .card-icon {
      font-size: 2.5rem;
    }
    .card-content h3 {
      margin: 0;
      font-size: 1.2rem;
      color: var(--accent-color);
    }
    .card-content p {
      margin: 0.3rem 0 0;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .admin-content {
      padding-top: 1.5rem;
    }
    .admin-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .tab {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.75);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab:hover {
      background: rgba(0, 242, 255, 0.1);
      border-color: rgba(0, 242, 255, 0.4);
    }
    .tab.active {
      background: rgba(0, 242, 255, 0.15);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
    .back-tab {
      color: rgba(255, 255, 255, 0.55);
      border-style: dashed;
    }
  `]
})
export class AdminPanelComponent implements OnDestroy {
  private authService = inject(AuthService);
  private exportService = inject(ExportService);
  private router = inject(Router);

  sections = [
    { path: 'repairers', icon: '👥', title: 'Manage Repairers', description: 'Add or remove volunteer repairers from the system.' },
    { path: 'import', icon: '📥', title: 'Import Data', description: 'Load repair data from a Google Sheet into a new collection.' },
    { path: 'database', icon: '🗄️', title: 'Admin Explorer', description: 'Browse Firestore collections and view raw records.' },
    { path: 'users', icon: '👤', title: 'Manage Users', description: 'View logged-in users and assign admin roles.' },
    { path: 'backup', icon: '💾', title: 'Backup & Restore', description: 'Download the whole app to a spreadsheet, or restore from one.' },
    { path: 'clear', icon: '🗑️', title: 'Clear Data', description: 'Back up the whole app, then delete the data from selected collections.' },
    { path: 'version', icon: '🏷️', title: 'App Version', description: 'Update the app version number and change description.' }
  ];

  // True when a child section (e.g. /admin/users) is showing rather than the bare menu.
  sectionOpen = this.isSectionUrl(this.router.url);

  private routerSub: Subscription = this.router.events
    .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
    .subscribe(e => {
      this.sectionOpen = this.isSectionUrl(e.urlAfterRedirects);
      window.scrollTo({ top: 0 });
    });

  ngOnDestroy() {
    this.routerSub.unsubscribe();
  }

  private isSectionUrl(url: string): boolean {
    return url.split(/[?#]/)[0].replace(/\/+$/, '') !== '/admin';
  }

  isExporting = false;
  exportStatus = '';
  exportUrl = '';

  async doExport() {
    this.isExporting = true;
    this.exportStatus = 'Authenticating with Google...';
    this.exportUrl = '';

    try {
      const { token } = await this.authService.loginWithGoogle();
      if (!token) throw new Error('Failed to get access token.');

      this.exportStatus = 'Creating spreadsheet and uploading data...';
      const spreadsheetUrl = await this.exportService.exportToSheets(token);

      this.exportStatus = '✅ Export Successful!';
      this.exportUrl = spreadsheetUrl;
    } catch (error: any) {
      console.error('Export failed:', error);
      this.exportStatus = '❌ Export Failed: ' + (error.message || 'Unknown error');
    } finally {
      this.isExporting = false;
    }
  }
}
