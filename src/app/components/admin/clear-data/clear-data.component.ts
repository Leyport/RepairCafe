import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../../../services/backup.service';

// Clearing these could lock admins out, wipe login records or restart reference numbers, so they start unticked.
const SENSITIVE_COLLECTIONS = ['admins', 'volunteers', 'users', 'sys_settings', 'sys_counters'];
const CONFIRM_WORD = 'DELETE';

@Component({
  selector: 'app-clear-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>🗑️ Clear Data</h3>
      </div>

      <div class="panel">
        <p class="hint">
          Deletes every record in the selected collections. A full backup spreadsheet of the whole app is
          always downloaded first, so the data can be put back later with <strong>Backup &amp; Restore</strong>.
        </p>

        <div class="empty-state" *ngIf="loading">Counting records...</div>

        <ng-container *ngIf="!loading">
          <div class="collections">
            <label *ngFor="let c of collections" class="check">
              <input type="checkbox" [(ngModel)]="selected[c.name]" [disabled]="busy">
              {{ c.name }} <span class="count">({{ c.count }})</span>
              <span class="warn" *ngIf="isSensitive(c.name)">sensitive</span>
            </label>
          </div>

          <label class="field">
            Name for this clear-down
            <input type="text" [(ngModel)]="clearName" [disabled]="busy">
          </label>

          <label class="field">
            Type <strong>{{ confirmWord }}</strong> to confirm
            <input type="text" [(ngModel)]="confirmText" [disabled]="busy" autocomplete="off">
          </label>

          <div class="row">
            <button class="btn danger" (click)="clear()"
              [disabled]="busy || confirmText !== confirmWord || !clearName.trim() || selectedNames().length === 0">
              Back up &amp; clear {{ selectedRecordCount() }} record(s)
            </button>
          </div>
        </ng-container>

        <p class="status" *ngIf="status">{{ status }}</p>
      </div>
    </div>
  `,
  styles: [`
    .manager-section { max-width: 900px; }
    .section-header h3 { margin: 0 0 1.5rem; color: white; }
    .panel {
      padding: 1.25rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .hint { margin: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.6); line-height: 1.5; }
    .collections { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem; }
    .check { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.9rem; color: rgba(255, 255, 255, 0.85); }
    .check input { margin-top: 0.2rem; }
    .count { color: rgba(255, 255, 255, 0.4); }
    .warn { font-size: 0.7rem; color: #ffb347; border: 1px solid rgba(255, 179, 71, 0.4); border-radius: 10px; padding: 0 0.4rem; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); }
    input[type="text"] {
      max-width: 400px;
      padding: 0.55rem 0.8rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(0, 0, 0, 0.2);
      color: white;
      font-size: 0.95rem;
    }
    .row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn {
      padding: 0.55rem 1.1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn.danger { border: 1px solid rgba(255, 89, 89, 0.4); background: rgba(255, 89, 89, 0.08); color: #ff5959; }
    .btn.danger:hover:not(:disabled) { background: rgba(255, 89, 89, 0.18); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); }
    .empty-state {
      text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.4);
      border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.1);
    }
  `]
})
export class ClearDataComponent implements OnInit {
  private backupService = inject(BackupService);

  readonly confirmWord = CONFIRM_WORD;

  loading = true;
  busy = false;
  status = '';
  collections: { name: string; count: number }[] = [];
  selected: { [collection: string]: boolean } = {};
  clearName = this.defaultName();
  confirmText = '';

  async ngOnInit() {
    await this.loadCounts();
  }

  isSensitive(name: string): boolean {
    return SENSITIVE_COLLECTIONS.includes(name);
  }

  selectedNames(): string[] {
    return Object.keys(this.selected).filter(k => this.selected[k]);
  }

  selectedRecordCount(): number {
    return this.collections.filter(c => this.selected[c.name]).reduce((sum, c) => sum + c.count, 0);
  }

  async clear() {
    const names = this.selectedNames();
    if (!confirm(`Permanently delete all records in:\n\n${names.join(', ')}\n\nA backup will be downloaded first. Continue?`)) return;

    this.busy = true;
    try {
      this.status = 'Downloading backup...';
      const backup = await this.backupService.downloadBackup(`Backup before ${this.clearName.trim()}`, msg => this.status = msg);

      const entry = await this.backupService.clearCollections(this.clearName.trim(), backup.fileName, names, msg => this.status = msg);
      const total = Object.values(entry.collections).reduce((a, b) => a + b, 0);
      this.status = `✅ Deleted ${total} records. Backup saved as ${backup.fileName}`;
      this.confirmText = '';
      this.clearName = this.defaultName();
      await this.loadCounts();
    } catch (error: any) {
      console.error('Clear data failed:', error);
      this.status = '❌ Failed: ' + (error.message || 'Unknown error') + '. If the backup did not download, nothing was deleted.';
    } finally {
      this.busy = false;
    }
  }

  private async loadCounts() {
    this.loading = true;
    try {
      const names = await this.backupService.listCollections();
      this.collections = await Promise.all(names.map(async name => ({ name, count: await this.backupService.countCollection(name) })));
      this.selected = Object.fromEntries(this.collections.map(c => [c.name, !this.isSensitive(c.name)]));
    } catch (error: any) {
      console.error('Failed to count collections:', error);
      this.status = '❌ Could not load collections: ' + (error.message || 'Unknown error');
    } finally {
      this.loading = false;
    }
  }

  private defaultName(): string {
    return `Clear-down ${new Date().toLocaleDateString()}`;
  }
}
