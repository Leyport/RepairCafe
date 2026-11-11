import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService, ParsedBackup } from '../../../services/backup.service';

import { DialogService } from '../../../services/dialog.service';
// Restoring these could lock admins out or overwrite login records, so they start unticked.
const SENSITIVE_COLLECTIONS = ['admins', 'volunteers', 'users', 'sys_settings'];

@Component({
  selector: 'app-backup-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>💾 Backup &amp; Restore</h3>
      </div>

      <!-- Download -->
      <div class="panel">
        <h4>⬇️ Download whole app to spreadsheet</h4>
        <p class="hint">Saves every collection to one Excel file, one sheet per collection.</p>
        <div class="row">
          <input type="text" [(ngModel)]="downloadName" placeholder="Backup name" [disabled]="busy">
          <button class="btn" (click)="download()" [disabled]="busy || !downloadName.trim()">Download Backup</button>
        </div>
        <p class="status" *ngIf="downloadStatus">{{ downloadStatus }}</p>
      </div>

      <!-- Upload / restore -->
      <div class="panel">
        <h4>⬆️ Restore from spreadsheet</h4>
        <p class="hint">Upload a backup file made by the download above.</p>
        <input type="file" accept=".xlsx" (change)="onFileSelected($event)" [disabled]="busy" #fileInput>

        <div *ngIf="parsed" class="preview">
          <div class="meta">
            <div><span>Backup name:</span> {{ parsed.backupName || '—' }}</div>
            <div><span>Downloaded:</span> {{ parsed.downloadedAt ? (parsed.downloadedAt | date:'medium') : 'Unknown' }}</div>
            <div><span>Downloaded by:</span> {{ parsed.downloadedBy || '—' }}</div>
            <div><span>App version:</span> {{ parsed.appVersion || '—' }}</div>
          </div>

          <label class="field">
            Upload name
            <input type="text" [(ngModel)]="uploadName" placeholder="Name this upload" [disabled]="busy">
          </label>

          <div class="collections">
            <label *ngFor="let c of parsed.collections" class="check">
              <input type="checkbox" [(ngModel)]="selected[c.name]" [disabled]="busy">
              {{ c.name }} <span class="count">({{ c.docs.length }})</span>
              <span class="warn" *ngIf="isSensitive(c.name)">sensitive</span>
            </label>
          </div>

          <div class="modes">
            <label class="check">
              <input type="radio" name="mode" value="replace" [(ngModel)]="mode" [disabled]="busy">
              <strong>Replace</strong> — make each selected collection exactly match the backup (records added since are deleted)
            </label>
            <label class="check">
              <input type="radio" name="mode" value="merge" [(ngModel)]="mode" [disabled]="busy">
              <strong>Merge</strong> — overwrite records in the backup, keep everything else
            </label>
          </div>

          <label class="check">
            <input type="checkbox" [(ngModel)]="safetyBackup" [disabled]="busy">
            Download a safety backup of the current data first
          </label>

          <div class="row">
            <button class="btn danger" (click)="restore(fileInput)" [disabled]="busy || !uploadName.trim() || selectedNames().length === 0">
              Restore {{ selectedNames().length }} collection(s)
            </button>
            <button class="btn ghost" (click)="clearUpload(fileInput)" [disabled]="busy">Cancel</button>
          </div>
        </div>
        <p class="status" *ngIf="uploadStatus">{{ uploadStatus }}</p>
      </div>

      <!-- History -->
      <div class="panel">
        <h4>📜 Backup history</h4>
        <div class="empty-state" *ngIf="(log$ | async)?.length === 0">No backups downloaded or uploaded yet.</div>
        <div class="table-wrap" *ngIf="(log$ | async)?.length">
          <table>
            <thead>
              <tr><th>Type</th><th>Name</th><th>Downloaded</th><th>Uploaded</th><th>By</th><th>Records</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of log$ | async">
                <td><span class="badge" [class.up]="e.type === 'upload'" [class.clear]="e.type === 'clear'">{{ e.type === 'upload' ? 'Upload' : e.type === 'clear' ? 'Cleared' : 'Download' }}</span></td>
                <td>{{ e.name }}<div class="sub">{{ e.fileName }}</div></td>
                <td>{{ e.downloadedAt ? (e.downloadedAt.toDate() | date:'medium') : '—' }}</td>
                <td>{{ e.uploadedAt ? (e.uploadedAt.toDate() | date:'medium') : (e.type === 'clear' && e.loggedAt ? 'Cleared ' + (e.loggedAt.toDate() | date:'medium') : '—') }}<div class="sub" *ngIf="e.mode">{{ e.mode }}</div></td>
                <td>{{ e.performedBy }}</td>
                <td>{{ total(e.collections) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
      margin-bottom: 1.25rem;
    }
    .panel h4 { margin: 0 0 0.3rem; color: var(--accent-color, #00f2ff); }
    .hint { margin: 0 0 1rem; font-size: 0.85rem; color: rgba(255, 255, 255, 0.5); }
    .row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-top: 0.75rem; }
    input[type="text"] {
      flex: 1;
      min-width: 200px;
      padding: 0.55rem 0.8rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(0, 0, 0, 0.2);
      color: white;
      font-size: 0.95rem;
    }
    input[type="file"] { color: rgba(255, 255, 255, 0.7); max-width: 100%; }
    .btn {
      padding: 0.55rem 1.1rem;
      border-radius: 6px;
      border: 1px solid rgba(0, 242, 255, 0.4);
      background: rgba(0, 242, 255, 0.08);
      color: var(--accent-color, #00f2ff);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover:not(:disabled) { background: rgba(0, 242, 255, 0.18); }
    .btn.danger { border-color: rgba(255, 89, 89, 0.4); background: rgba(255, 89, 89, 0.08); color: #ff5959; }
    .btn.danger:hover:not(:disabled) { background: rgba(255, 89, 89, 0.18); }
    .btn.ghost { border-color: rgba(255, 255, 255, 0.2); background: transparent; color: rgba(255, 255, 255, 0.7); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin: 0.75rem 0 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); }
    .preview { margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem; font-size: 0.9rem; }
    .meta span { color: rgba(255, 255, 255, 0.5); }
    .field { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); }
    .collections { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem; }
    .modes { display: flex; flex-direction: column; gap: 0.4rem; }
    .check { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.9rem; color: rgba(255, 255, 255, 0.85); }
    .check input { margin-top: 0.2rem; }
    .count { color: rgba(255, 255, 255, 0.4); }
    .warn { font-size: 0.7rem; color: #ffb347; border: 1px solid rgba(255, 179, 71, 0.4); border-radius: 10px; padding: 0 0.4rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); vertical-align: top; }
    th { color: rgba(255, 255, 255, 0.5); font-weight: 600; }
    .sub { font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); }
    .badge {
      font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 20px; text-transform: uppercase;
      background: rgba(0, 242, 255, 0.15); color: var(--accent-color, #00f2ff); border: 1px solid rgba(0, 242, 255, 0.3);
    }
    .badge.clear { background: rgba(255, 89, 89, 0.15); color: #ff5959; border-color: rgba(255, 89, 89, 0.3); }
    .badge.up { background: rgba(255, 179, 71, 0.15); color: #ffb347; border-color: rgba(255, 179, 71, 0.3); }
    .empty-state {
      text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.4);
      border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.1);
    }
  `]
})
export class BackupManagerComponent {
  private dialog = inject(DialogService);
  private backupService = inject(BackupService);

  log$ = this.backupService.getBackupLog();

  busy = false;
  downloadName = this.defaultName();
  downloadStatus = '';

  parsed: ParsedBackup | null = null;
  fileName = '';
  uploadName = '';
  uploadStatus = '';
  selected: { [collection: string]: boolean } = {};
  mode: 'replace' | 'merge' = 'replace';
  safetyBackup = true;

  isSensitive(name: string): boolean {
    return SENSITIVE_COLLECTIONS.includes(name);
  }

  selectedNames(): string[] {
    return Object.keys(this.selected).filter(k => this.selected[k]);
  }

  total(collections: { [name: string]: number } | undefined): number {
    return Object.values(collections || {}).reduce((a, b) => a + b, 0);
  }

  async download() {
    this.busy = true;
    this.downloadStatus = 'Starting...';
    try {
      const entry = await this.backupService.downloadBackup(this.downloadName.trim(), msg => this.downloadStatus = msg);
      this.downloadStatus = `✅ Downloaded ${this.total(entry.collections)} records as ${entry.fileName}`;
      this.downloadName = this.defaultName();
    } catch (error: any) {
      console.error('Backup download failed:', error);
      this.downloadStatus = '❌ Download failed: ' + (error.message || 'Unknown error');
    } finally {
      this.busy = false;
    }
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.parsed = null;
    this.uploadStatus = '';
    if (!file) return;

    this.busy = true;
    this.uploadStatus = 'Reading file...';
    try {
      this.parsed = await this.backupService.parseBackupFile(file);
      this.fileName = file.name;
      this.uploadName = this.parsed.backupName ? `Restore of ${this.parsed.backupName}` : '';
      this.selected = Object.fromEntries(this.parsed.collections.map(c => [c.name, !this.isSensitive(c.name)]));
      this.uploadStatus = '';
    } catch (error: any) {
      console.error('Backup parse failed:', error);
      this.uploadStatus = '❌ ' + (error.message || 'Could not read file');
    } finally {
      this.busy = false;
    }
  }

  async restore(fileInput: HTMLInputElement) {
    if (!this.parsed) return;
    const names = this.selectedNames();
    const action = this.mode === 'replace'
      ? 'REPLACE these collections with the backup contents. Records not in the backup will be DELETED'
      : 'overwrite records in these collections with the backup contents';
    if (!(await this.dialog.confirm({
      title: 'Restore from this backup?',
      message: `This will ${action}:\n\n${names.join(', ')}`,
      confirmText: 'Restore', danger: this.mode === 'replace',
    }))) return;

    this.busy = true;
    try {
      if (this.safetyBackup) {
        this.uploadStatus = 'Downloading safety backup...';
        await this.backupService.downloadBackup(`Safety backup before ${this.uploadName.trim()}`, msg => this.uploadStatus = msg);
      }
      const entry = await this.backupService.restoreBackup(
        this.parsed, this.uploadName.trim(), this.fileName, names, this.mode, msg => this.uploadStatus = msg
      );
      this.uploadStatus = `✅ Restored ${this.total(entry.collections)} records across ${names.length} collection(s).`;
      this.parsed = null;
      fileInput.value = '';
    } catch (error: any) {
      console.error('Restore failed:', error);
      this.uploadStatus = '❌ Restore failed: ' + (error.message || 'Unknown error');
    } finally {
      this.busy = false;
    }
  }

  clearUpload(fileInput: HTMLInputElement) {
    this.parsed = null;
    this.uploadStatus = '';
    fileInput.value = '';
  }

  private defaultName(): string {
    return `Backup ${new Date().toLocaleDateString()}`;
  }
}
