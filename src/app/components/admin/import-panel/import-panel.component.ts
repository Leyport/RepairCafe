import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ImportService } from '../../../services/import.service';

@Component({
  selector: 'app-import-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-section">
      <div class="section-header">
        <h3>📥 Import from Google Sheets</h3>
        <p>Browse your Drive and select a spreadsheet to import.</p>
      </div>

      <div class="import-form glass">
        <div class="auth-box" *ngIf="!accessToken">
          <p>Please connect to Google Drive to browse your files.</p>
          <button class="btn-primary" (click)="connectGoogle()">
            Connect Google Drive
          </button>
        </div>

        <ng-container *ngIf="accessToken">
          <!-- Explorer Header / Breadcrumbs -->
          <div class="explorer-header">
            <div class="breadcrumbs">
              <span class="breadcrumb-item" (click)="jumpToPath(-1)">My Drive</span>
              <span *ngFor="let item of navigationPath; let i = index" class="breadcrumb-item" (click)="jumpToPath(i)">
                <span class="separator">/</span> {{ item.name }}
              </span>
              <span class="separator" *ngIf="currentFolder.id !== 'root'">/</span>
              <span class="current-folder" *ngIf="currentFolder.id !== 'root'">{{ currentFolder.name }}</span>
            </div>
          </div>

          <!-- Explorer Content -->
          <div class="explorer-content glass-inset">
            <div class="loading-overlay" *ngIf="isLoadingFolders || isLoadingFiles">
              <div class="spinner-large"></div>
            </div>

            <!-- Folders -->
            <div class="explorer-section" *ngIf="directories.length > 0">
              <label>Folders</label>
              <div class="grid-list">
                <div class="grid-item folder" *ngFor="let dir of directories" (click)="navigateTo(dir)">
                  <span class="icon">📁</span>
                  <span class="name">{{ dir.name }}</span>
                </div>
              </div>
            </div>

            <!-- Files -->
            <div class="explorer-section">
              <label>Files</label>
              <div class="grid-list" *ngIf="files.length > 0">
                <div 
                  class="grid-item file" 
                  *ngFor="let file of files" 
                  (click)="selectedFileId = file.id; selectedFileName = file.name"
                  [class.selected]="selectedFileId === file.id">
                  <span class="icon">📊</span>
                  <span class="name">{{ file.name }}</span>
                  <span class="check" *ngIf="selectedFileId === file.id">✔</span>
                </div>
              </div>
              <div class="empty-msg" *ngIf="files.length === 0 && !isLoadingFiles">
                No spreadsheets found in this folder.
              </div>
            </div>
          </div>

          <div class="form-group" *ngIf="selectedFileId">
            <label for="collectionName">Target Collection Name</label>
            <input 
              type="text" 
              id="collectionName"
              [(ngModel)]="collectionName" 
              placeholder="e.g. ImportedTestData"
              [disabled]="isImporting">
          </div>

          <div class="button-group">
            <button 
              class="btn-import" 
              (click)="startImport()" 
              [disabled]="isImporting || !selectedFileId || !collectionName">
              <span *ngIf="!isImporting">Import "{{ selectedFileName }}"</span>
              <span *ngIf="isImporting" class="spinner-small"></span>
              <span *ngIf="isImporting">Importing...</span>
            </button>
            <button class="btn-secondary" (click)="connectGoogle()" [disabled]="isImporting">
              Refresh
            </button>
          </div>
        </ng-container>
      </div>

      <div class="import-status" *ngIf="statusMessage">
        <div class="status-card" [class.error]="isError" [class.success]="isSuccess">
          {{ statusMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .import-section {
      max-width: 800px;
    }
    .section-header h3 {
      margin: 0;
      color: var(--accent-color);
    }
    .section-header p {
      margin: 0.5rem 0 1.5rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .import-form {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .auth-box {
      text-align: center;
      padding: 2rem;
    }
    
    /* Explorer Styles */
    .explorer-header {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .breadcrumb-item {
      color: var(--accent-color);
      cursor: pointer;
      white-space: nowrap;
    }
    .breadcrumb-item:hover {
      text-decoration: underline;
    }
    .separator {
      color: rgba(255, 255, 255, 0.3);
    }
    .current-folder {
      color: white;
      font-weight: 600;
    }

    .explorer-content {
      position: relative;
      min-height: 300px;
      max-height: 450px;
      overflow-y: auto;
      padding: 1rem;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.2);
    }
    .glass-inset {
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);
    }
    .explorer-section {
      margin-bottom: 1.5rem;
    }
    .explorer-section label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 0.8rem;
    }
    
    .grid-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
    }
    .grid-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      position: relative;
    }
    .grid-item:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }
    .grid-item.selected {
      background: rgba(0, 242, 255, 0.1);
      border-color: var(--accent-color);
      box-shadow: 0 0 15px rgba(0, 242, 255, 0.2);
    }
    .grid-item .icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .grid-item .name {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.9);
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .check {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      color: var(--accent-color);
      font-weight: bold;
    }
    
    .empty-msg {
      padding: 2rem;
      text-align: center;
      color: rgba(255, 255, 255, 0.3);
      font-style: italic;
    }
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      backdrop-filter: blur(2px);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-group label {
      font-size: 0.9rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.8);
    }
    .form-group input {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.8rem 1rem;
      border-radius: 8px;
      color: white;
      outline: none;
      transition: border-color 0.3s;
    }
    .form-group input:focus {
      border-color: var(--accent-color);
    }
    
    .button-group {
      display: flex;
      gap: 1rem;
    }
    .btn-import {
      flex: 3;
      background: var(--accent-color);
      color: #000;
      border: none;
      padding: 1rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      transition: all 0.3s;
    }
    .btn-import:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      flex: 1;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 1rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .spinner-large {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-left-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .spinner-small {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-left-color: #000;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .import-status {
      margin-top: 1.5rem;
    }
    .status-card {
      padding: 1rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
    }
    .status-card.error {
      background: rgba(255, 89, 89, 0.1);
      border-color: #ff5959;
      color: #ff5959;
    }
    .status-card.success {
      background: rgba(0, 255, 127, 0.1);
      border-color: #00ff7f;
      color: #00ff7f;
    }
  `]
})
export class ImportPanelComponent {
  private authService = inject(AuthService);
  private importService = inject(ImportService);

  accessToken = '';
  directories: { id: string, name: string }[] = [];
  files: { id: string, name: string }[] = [];

  currentFolder: { id: string, name: string } = { id: 'root', name: 'My Drive' };
  navigationPath: { id: string, name: string }[] = [];

  selectedFileId = '';
  selectedFileName = '';
  collectionName = '';

  isLoadingFolders = false;
  isLoadingFiles = false;
  isImporting = false;
  statusMessage = '';
  isError = false;
  isSuccess = false;

  async connectGoogle() {
    this.statusMessage = 'Connecting to Google Drive...';
    this.isError = false;
    this.isSuccess = false;

    try {
      const { token } = await this.authService.loginWithGoogle();
      if (!token) throw new Error('Failed to get access token.');

      this.accessToken = token;
      this.statusMessage = '';
      await this.loadCurrentDirectory();

      // Auto-search for "Imports" or "Exports" on first load
      const importsFolder = this.directories.find(d =>
        d.name.toLowerCase() === 'imports' ||
        d.name.toLowerCase() === 'exports'
      );
      if (importsFolder) {
        await this.navigateTo(importsFolder);
      }
    } catch (error: any) {
      this.statusMessage = '❌ Connection Failed: ' + (error.message || 'Unknown error');
      this.isError = true;
    }
  }

  async loadCurrentDirectory() {
    this.isLoadingFolders = true;
    this.isLoadingFiles = true;
    try {
      [this.directories, this.files] = await Promise.all([
        this.importService.listFolders(this.accessToken, this.currentFolder.id),
        this.importService.listFilesByFolder(this.accessToken, this.currentFolder.id)
      ]);
    } catch (error: any) {
      this.statusMessage = '❌ Failed to load directory: ' + (error.message || 'Unknown error');
      this.isError = true;
    } finally {
      this.isLoadingFolders = false;
      this.isLoadingFiles = false;
    }
  }

  async navigateTo(dir: { id: string, name: string }) {
    this.navigationPath.push({ ...this.currentFolder });
    this.currentFolder = dir;
    this.selectedFileId = '';
    this.selectedFileName = '';
    await this.loadCurrentDirectory();
  }

  async jumpToPath(index: number) {
    if (index === -1) {
      // Jump to My Drive
      this.currentFolder = { id: 'root', name: 'My Drive' };
      this.navigationPath = [];
    } else {
      // Jump to a specific breadcrumb
      const target = this.navigationPath[index];
      this.navigationPath = this.navigationPath.slice(0, index);
      this.currentFolder = target;
    }
    this.selectedFileId = '';
    this.selectedFileName = '';
    await this.loadCurrentDirectory();
  }

  async startImport() {
    this.isImporting = true;
    this.statusMessage = 'Reading spreadsheet data...';
    this.isError = false;
    this.isSuccess = false;

    try {
      const data = await this.importService.readSheetData(this.accessToken, this.selectedFileId);
      if (!data || data.length < 2) throw new Error('Spreadsheet is empty or has no data rows.');

      this.statusMessage = `Importing ${data.length - 1} records to collection "${this.collectionName}"...`;
      const importedCount = await this.importService.importToFirestore(this.collectionName, data);

      this.statusMessage = `✅ Successfully imported ${importedCount} records to "${this.collectionName}".`;
      this.isSuccess = true;
    } catch (error: any) {
      console.error('Import failed:', error);
      this.statusMessage = '❌ Import Failed: ' + (error.message || 'Unknown error');
      this.isError = true;
    } finally {
      this.isImporting = false;
    }
  }
}
