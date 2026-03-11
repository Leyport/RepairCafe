import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../../services/repair.service';

@Component({
  selector: 'app-version-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>🏷️ App Version</h3>
      </div>

      <div class="version-form glass">
        <div class="form-group">
          <label for="versionInput">Version Number</label>
          <input
            id="versionInput"
            type="text"
            [(ngModel)]="version"
            placeholder="e.g. v1.23.0">
        </div>

        <div class="form-group">
          <label for="descInput">Change Description</label>
          <input
            id="descInput"
            type="text"
            [(ngModel)]="description"
            placeholder="e.g. Added user management screen">
        </div>

        <div class="form-actions">
          <span class="save-status" *ngIf="saveStatus">{{ saveStatus }}</span>
          <button class="btn-save" (click)="save()" [disabled]="saving || !version.trim()">
            {{ saving ? 'Saving...' : 'Save Version' }}
          </button>
        </div>
      </div>

      <div class="current-version" *ngIf="currentVersion">
        <span class="label">Current:</span>
        <span class="ver">{{ currentVersion.version }}</span>
        <span class="desc" *ngIf="currentVersion.description">— {{ currentVersion.description }}</span>
      </div>
    </div>
  `,
  styles: [`
    .manager-section {
      max-width: 600px;
    }
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .section-header h3 {
      margin: 0;
      color: white;
    }
    .version-form {
      padding: 1.5rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.9rem;
    }
    input {
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: white;
      font-size: 1rem;
    }
    input:focus {
      outline: none;
      border-color: var(--accent-color, #00f2ff);
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 1rem;
    }
    .save-status {
      font-size: 0.9rem;
      color: var(--accent-color, #00f2ff);
    }
    .btn-save {
      background: var(--accent-color, #00f2ff);
      color: #000;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .current-version {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.4);
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .ver {
      color: var(--accent-color, #00f2ff);
      font-weight: 600;
    }
  `]
})
export class VersionManagerComponent implements OnInit {
  private repairService = inject(RepairService);

  version = '';
  description = '';
  saving = false;
  saveStatus = '';
  currentVersion: { version: string, description: string } | null = null;

  ngOnInit() {
    this.repairService.getAppVersion().subscribe(v => {
      this.currentVersion = v;
      if (!this.version) {
        this.version = v.version;
        this.description = v.description || '';
      }
    });
  }

  async save() {
    if (!this.version.trim()) return;
    this.saving = true;
    this.saveStatus = '';
    try {
      await this.repairService.updateAppVersion(this.version.trim(), this.description.trim());
      this.saveStatus = '✅ Saved';
      setTimeout(() => this.saveStatus = '', 3000);
    } catch (error) {
      console.error('Error saving version:', error);
      this.saveStatus = '❌ Failed to save';
    } finally {
      this.saving = false;
    }
  }
}
