import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ExportService } from '../../../services/export.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <div class="admin-container glass">
      <div class="admin-header">
        <h2>🛠️ Admin Dashboard</h2>
        <p>Manage your Repair Cafe settings and volunteers.</p>
      </div>
      
      <nav class="admin-nav">
        <a routerLink="repairers" routerLinkActive="active" class="nav-card">
          <div class="card-icon">👥</div>
          <div class="card-content">
            <h3>Manage Repairers</h3>
            <p>Add or remove volunteer repairers from the system.</p>
          </div>
        </a>

        <a routerLink="import" routerLinkActive="active" class="nav-card">
          <div class="card-icon">📥</div>
          <div class="card-content">
            <h3>Import Data</h3>
            <p>Load repair data from a Google Sheet into a new collection.</p>
          </div>
        </a>

        <a routerLink="database" routerLinkActive="active" class="nav-card">
          <div class="card-icon">🗄️</div>
          <div class="card-content">
            <h3>Admin Explorer</h3>
            <p>Browse Firestore collections and view raw records.</p>
          </div>
        </a>
        
        <a routerLink="users" routerLinkActive="active" class="nav-card">
          <div class="card-icon">👤</div>
          <div class="card-content">
            <h3>Manage Users</h3>
            <p>View logged-in users and assign admin roles.</p>
          </div>
        </a>

        <a routerLink="version" routerLinkActive="active" class="nav-card">
          <div class="card-icon">🏷️</div>
          <div class="card-content">
            <h3>App Version</h3>
            <p>Update the app version number and change description.</p>
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

      <div class="admin-content">
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
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  `]
})
export class AdminPanelComponent {
  private authService = inject(AuthService);
  private exportService = inject(ExportService);

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
