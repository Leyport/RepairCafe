import { Component, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ImportService } from '../../../services/import.service';
import { RepairService } from '../../../services/repair.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-import-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-section">

      <!-- Local File Upload -->
      <div class="section-header">
        <h3>📂 Import from Local File</h3>
        <p>Upload an Excel (.xlsx) or CSV file directly from your computer.</p>
      </div>

      <div
        class="drop-zone glass"
        [class.drag-over]="isDragOver"
        (dragover)="onDragOver($event)"
        (dragleave)="isDragOver = false"
        (drop)="onDrop($event)">
        <input #fileInput type="file" accept=".xlsx,.xls,.csv" style="display:none" (change)="onFileSelected($event)">
        <div class="drop-content" *ngIf="!localFileName">
          <span class="drop-icon">📄</span>
          <p>Drag &amp; drop a file here, or</p>
          <button class="btn-primary" (click)="fileInput.click()">Browse Files</button>
          <p class="drop-hint">.xlsx, .xls or .csv</p>
        </div>
        <div class="drop-content" *ngIf="localFileName">
          <span class="drop-icon">✅</span>
          <p class="file-chosen">{{ localFileName }}</p>
          <button class="btn-text" (click)="clearLocalFile(); fileInput.value = ''">Remove</button>
        </div>
      </div>

      <!-- Reuse the same mapping + import UI for local files -->
      <ng-container *ngIf="localFileName">
        <div class="form-group" style="margin-top:1rem">
          <label for="localCollectionName">Target Collection Name</label>
          <input
            type="text"
            id="localCollectionName"
            [(ngModel)]="collectionName"
            placeholder="e.g. ImportedTestData"
            [disabled]="isImporting">
        </div>

        <div class="mapper-section" *ngIf="collectionName">
          <button class="btn-secondary" (click)="analyzeLocalFile()" *ngIf="fileHeaders.length === 0" [disabled]="isImporting">
            Analyze File &amp; Map Columns
          </button>

          <div class="mapping-grid" *ngIf="fileHeaders.length > 0">
            <p class="mapping-instruction">Map your spreadsheet columns to Repair Attributes:</p>
            <div class="mapping-row header-row">
              <span>Spreadsheet Column</span>
              <span>Target Attribute</span>
            </div>
            <div class="mapping-row" *ngFor="let header of fileHeaders; let i = index">
              <div class="col-info">
                <span class="badger">{{ header }}</span>
                <span class="sample-val" *ngIf="sampleRow[i]">{{ sampleRow[i] | slice:0:40 }}{{ sampleRow[i].length > 40 ? '…' : '' }}</span>
              </div>
              <select [(ngModel)]="columnMapping[header]" [disabled]="isImporting">
                <option *ngFor="let attr of availableAttributes" [value]="attr.key">
                  {{ attr.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="button-group" style="margin-top:1rem" *ngIf="fileHeaders.length > 0">
          <button
            class="btn-import"
            (click)="startLocalImport()"
            [disabled]="isImporting || !collectionName">
            <span *ngIf="!isImporting">Import "{{ localFileName }}"</span>
            <span *ngIf="isImporting" class="spinner-small"></span>
            <span *ngIf="isImporting">Importing...</span>
          </button>
        </div>
      </ng-container>

      <div class="import-status" *ngIf="statusMessage && !accessToken">
        <div class="status-card" [class.error]="isError" [class.success]="isSuccess">
          {{ statusMessage }}
        </div>
      </div>

      <hr class="section-divider">

      <!-- Google Drive section -->
      <div class="section-header" style="margin-top:1.5rem">
        <h3>📥 Import from Google Drive</h3>
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
              <span class="breadcrumb-item" (click)="jumpToPath(-1)" [class.active]="currentFolder.id === 'root'">My Drive</span>
              <ng-container *ngFor="let item of navigationPath; let i = index">
                <span class="breadcrumb-item" (click)="jumpToPath(i)" *ngIf="item.id !== 'root'">
                  <span class="separator">/</span> {{ item.name }}
                </span>
              </ng-container>
              <ng-container *ngIf="currentFolder.id !== 'root'">
                <span class="separator">/</span>
                <span class="current-folder">{{ currentFolder.name }}</span>
              </ng-container>
            </div>
          </div>

          <!-- Explorer Content -->
          <div class="explorer-content glass-inset">
            <div class="loading-overlay" *ngIf="isLoadingFolders || isLoadingFiles">
              <div class="spinner-large"></div>
            </div>

            <!-- Folders -->
            <div class="explorer-section">
              <div class="section-title-row">
                <label>Folders</label>
                <button class="btn-text" *ngIf="currentFolder.id !== 'root'" (click)="goBack()">
                  ⬅ Back
                </button>
              </div>
              <div class="grid-list" *ngIf="directories.length > 0">
                <div class="grid-item folder" *ngFor="let dir of directories" (click)="navigateTo(dir)">
                  <span class="icon">📁</span>
                  <span class="name">{{ dir.name }}</span>
                </div>
              </div>
              <div class="empty-msg" *ngIf="directories.length === 0 && !isLoadingFolders">
                No folders found.
              </div>
            </div>

            <!-- Files -->
            <div class="explorer-section">
              <label>Files</label>
              <div class="grid-list" *ngIf="files.length > 0">
                <div
                  class="grid-item file"
                  *ngFor="let file of files"
                  (click)="selectFile(file)"
                  [class.selected]="selectedFileId === file.id">
                  <span class="icon">{{ file.mimeType === 'application/vnd.google-apps.spreadsheet' ? '📊' : '📄' }}</span>
                  <div class="grid-info">
                    <span class="grid-name">{{ file.name }}</span>
                    <span class="grid-meta">{{ getMimeTypeLabel(file.mimeType) }}</span>
                  </div>
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

          <!-- Sheet / Tab selector (Google Sheets only) -->
          <div class="form-group sheet-selector" *ngIf="selectedFileId && sheetNames.length > 0">
            <label>Sheet / Tab</label>
            <div class="sheet-loading" *ngIf="isLoadingSheets">
              <span class="spinner-small" style="border-left-color:var(--accent-color)"></span>
              <span>Loading tabs...</span>
            </div>
            <div class="sheet-tabs" *ngIf="!isLoadingSheets">
              <button
                class="sheet-tab-btn"
                [class.active]="selectedSheet === '__all__'"
                (click)="selectSheet('__all__')"
                [disabled]="isImporting">
                All tabs
              </button>
              <button
                *ngFor="let name of sheetNames"
                class="sheet-tab-btn"
                [class.active]="selectedSheet === name"
                (click)="selectSheet(name)"
                [disabled]="isImporting">
                {{ name }}
              </button>
            </div>
          </div>

          <!-- Mapping UI -->
          <div class="mapper-section" *ngIf="selectedFileId && collectionName">
             <button class="btn-secondary" (click)="parseFileHeaders()" *ngIf="fileHeaders.length === 0" [disabled]="isImporting || isLoadingSheets">
               Analyze File &amp; Map Columns
             </button>

             <div class="mapping-grid" *ngIf="fileHeaders.length > 0">
               <p class="mapping-instruction">Map your spreadsheet columns to Repair Attributes:</p>
               <div class="mapping-row header-row">
                 <span>Spreadsheet Column</span>
                 <span>Target Attribute</span>
               </div>
               <div class="mapping-row" *ngFor="let header of fileHeaders; let i = index">
                 <div class="col-info">
                   <span class="badger">{{ header }}</span>
                   <span class="sample-val" *ngIf="sampleRow[i]">{{ sampleRow[i] | slice:0:40 }}{{ sampleRow[i].length > 40 ? '…' : '' }}</span>
                 </div>
                 <select [(ngModel)]="columnMapping[header]" [disabled]="isImporting">
                   <option *ngFor="let attr of availableAttributes" [value]="attr.key">
                     {{ attr.label }}
                   </option>
                 </select>
               </div>
             </div>
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
            <button class="btn-text-danger" (click)="signOut()" [disabled]="isImporting">
              Disconnect
            </button>
          </div>

          <div class="search-section glass-inset" *ngIf="accessToken">
            <div class="search-input-group">
              <input type="text" [(ngModel)]="searchTerm" placeholder="Search for folder name..." (keyup.enter)="searchFolders()">
              <button class="btn-primary" (click)="searchFolders()" [disabled]="!searchTerm || isLoadingFolders">Search</button>
            </div>
            <div class="search-results" *ngIf="searchResults.length > 0">
              <div class="result-item" *ngFor="let result of searchResults" (click)="navigateToFolder(result.id)">
                <span>📁 {{ result.name }}</span>
                <button class="btn-text-small" (click)="$event.stopPropagation(); tracePath(result.id)">Trace Path</button>
              </div>
            </div>
          </div>

          <div class="debug-panel glass-inset" *ngIf="debugInfo">
            <div class="debug-header">
              <span>🔍 Debug Info</span>
              <button class="btn-text" (click)="debugInfo = ''">Hide</button>
            </div>
            <pre class="debug-content">{{ debugInfo }}</pre>
          </div>
        </ng-container>
      </div>

      <div class="import-status" *ngIf="statusMessage && accessToken">
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
    .section-divider {
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin: 2rem 0;
    }
    .drop-zone {
      padding: 2rem;
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      text-align: center;
      transition: all 0.2s;
      cursor: default;
    }
    .drop-zone.drag-over {
      border-color: var(--accent-color);
      background: rgba(0, 242, 255, 0.05);
    }
    .drop-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .drop-icon {
      font-size: 2.5rem;
    }
    .drop-hint {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.35);
      margin: 0;
    }
    .file-chosen {
      font-weight: 600;
      color: var(--accent-color);
      margin: 0;
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
    .breadcrumb-item.active {
      color: white;
      pointer-events: none;
      font-weight: 600;
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
    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.8rem;
    }
    .explorer-section label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.4);
      margin: 0;
    }
    .btn-text {
      background: none;
      border: none;
      color: var(--accent-color);
      font-size: 0.8rem;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .btn-text:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .btn-text-danger {
      background: none;
      border: none;
      color: #ff5959;
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0.5rem;
      transition: opacity 0.2s;
    }
    .btn-text-danger:hover {
      opacity: 0.8;
    }
    
    .debug-panel {
      margin-top: 1rem;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
    }
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.4);
    }
    .debug-content {
      white-space: pre-wrap;
      word-break: break-all;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .search-section {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .search-input-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .search-input-group input {
      flex: 1;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
      color: white;
      font-size: 0.9rem;
    }
    .search-results {
      max-height: 150px;
      overflow-y: auto;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 0.5rem;
    }
    .result-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .result-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-text-small {
      background: none;
      border: none;
      color: #7289da;
      font-size: 0.7rem;
      cursor: pointer;
      padding: 2px 4px;
    }
    .btn-text-small:hover {
      text-decoration: underline;
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
    .grid-name {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.9);
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .grid-meta {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 2px;
    }
    .grid-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
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
    .sheet-selector {
      margin-top: 1rem;
    }
    .sheet-loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: rgba(255,255,255,0.5);
      font-size: 0.85rem;
    }
    .sheet-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }
    .sheet-tab-btn {
      padding: 0.35rem 0.9rem;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.8);
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sheet-tab-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.12);
    }
    .sheet-tab-btn.active {
      background: rgba(0,242,255,0.15);
      border-color: var(--accent-color);
      color: var(--accent-color);
      font-weight: 600;
    }
    .sheet-tab-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .mapper-section {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }
    .mapping-instruction {
      margin: 0 0 1rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9rem;
    }
    .mapping-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 300px;
      overflow-y: auto;
    }
    .mapping-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      align-items: center;
      padding: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .mapping-row.header-row {
      font-weight: bold;
      color: var(--accent-color);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      position: sticky;
      top: 0;
      background: #1a1a1a; 
      z-index: 2;
    }
    .col-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .badger {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
      word-break: break-all;
      align-self: flex-start;
    }
    .sample-val {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.4);
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mapping-row select {
      width: 100%;
      padding: 0.4rem;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.4);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `]
})
export class ImportPanelComponent {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private authService = inject(AuthService);
  private importService = inject(ImportService);
  private repairService = inject(RepairService);

  // Local file state
  localFileName = '';
  localFileData: any[][] = [];
  isDragOver = false;

  accessToken = '';
  directories: { id: string, name: string, mimeType?: string }[] = [];
  files: { id: string, name: string, mimeType: string }[] = [];

  currentFolder: { id: string, name: string } = { id: 'root', name: 'My Drive' };
  navigationPath: { id: string, name: string }[] = [];

  selectedFileId = '';
  selectedFileName = '';
  collectionName = '';

  isLoadingFolders = false;
  isLoadingFiles = false;
  isLoadingSheets = false;
  isImporting = false;
  statusMessage = '';
  isError = false;
  isSuccess = false;
  debugInfo = '';
  searchTerm = '';
  searchResults: { id: string, name: string, mimeType?: string }[] = [];

  // Sheet / tab selection
  sheetNames: string[] = [];
  selectedSheet = '__all__';

  // Mapping
  fileHeaders: string[] = [];
  sampleRow: string[] = [];
  columnMapping: { [key: string]: string } = {};

  availableAttributes = [
    { key: 'ignore', label: '(Ignore Column)' },
    { key: 'id', label: 'ID (Record ID)' },
    { key: 'displayNumber', label: 'Display Number' },
    { key: 'itemDescription', label: 'Description' },
    { key: 'repairItem', label: 'Item Type' },
    { key: 'status', label: 'Status' },
    { key: 'repairer', label: 'Repairer' },
    { key: 'owner', label: 'Owner' },
    { key: 'telephone', label: 'Telephone' },
    { key: 'tags', label: 'Tags' },
    { key: 'additionalRepairers', label: 'Additional Repairers' },
    { key: 'creationDate', label: 'Creation Date' },
    { key: 'creationDate', label: 'Created Date' }, // Alias
    { key: 'rcdate', label: 'RC Event Date' },
    { key: 'RCDay', label: 'RC Day' },
    { key: 'rcDayNumber', label: 'RC Day Sequence' },
    { key: 'itemNumber', label: 'Item Number' },
    { key: 'itemNumber', label: 'Sequence' }, // Alias
    { key: 'photos', label: 'Photos' }
  ];

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.loadLocalFile(file);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.loadLocalFile(file);
  }

  private loadLocalFile(file: File) {
    this.clearLocalFile();
    this.localFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      this.localFileData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    };
    reader.readAsArrayBuffer(file);
  }

  clearLocalFile() {
    this.localFileName = '';
    this.localFileData = [];
    this.fileHeaders = [];
    this.sampleRow = [];
    this.columnMapping = {};
    this.statusMessage = '';
  }

  analyzeLocalFile() {
    if (!this.localFileData || this.localFileData.length === 0) return;
    this.fileHeaders = this.localFileData[0].map((h: any) => h.toString().trim());
    this.sampleRow = this.localFileData.length > 1 ? this.localFileData[1].map((v: any) => v?.toString() ?? '') : [];
    this.columnMapping = {};
    this.fileHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase();
      const match = this.availableAttributes.find(attr => attr.label.toLowerCase() === lowerHeader || attr.key.toLowerCase() === lowerHeader);
      this.columnMapping[header] = match ? match.key : 'ignore';
    });
  }

  async startLocalImport() {
    if (!this.localFileData || this.localFileData.length < 2) return;
    this.isImporting = true;
    this.statusMessage = `Importing ${this.localFileData.length - 1} records to "${this.collectionName}"...`;
    this.isError = false;
    this.isSuccess = false;

    try {
      const mappedValues = Object.values(this.columnMapping);
      if (!mappedValues.includes('itemDescription')) {
        throw new Error('You must map a column to "Description".');
      }

      const importedCount = await this.importService.importToFirestore(this.collectionName, this.localFileData, this.columnMapping);
      await this.repairService.trackCollection(this.collectionName);

      this.statusMessage = `✅ Successfully imported ${importedCount} records to "${this.collectionName}".`;
      this.isSuccess = true;
      this.fileHeaders = [];
      this.sampleRow = [];
    } catch (error: any) {
      this.statusMessage = '❌ Import Failed: ' + (error?.message || 'Unknown error');
      this.isError = true;
    } finally {
      this.isImporting = false;
    }
  }

  goBack() {
    if (this.navigationPath.length > 0) {
      this.jumpToPath(this.navigationPath.length - 1);
    } else {
      this.jumpToPath(-1);
    }
  }

  async connectGoogle() {
    this.statusMessage = 'Connecting to Google Drive...';
    this.isError = false;
    this.isSuccess = false;
    this.debugInfo = '';

    try {
      const { token } = await this.authService.loginWithGoogle();
      console.log('Token received:', token ? `YES (length ${token.length})` : 'NO');

      if (!token) throw new Error('Failed to get access token from Google.');

      this.accessToken = token;
      this.statusMessage = '';
      await this.loadCurrentDirectory();
    } catch (error: any) {
      this.statusMessage = '❌ Connection Failed: ' + (error.message || 'Unknown error');
      this.isError = true;
    }
  }

  async loadCurrentDirectory() {
    this.isLoadingFolders = true;
    this.isLoadingFiles = true;
    try {
      console.log('Fetching directory contents for:', this.currentFolder.id);
      [this.directories, this.files] = await Promise.all([
        this.importService.listFolders(this.accessToken, this.currentFolder.id),
        this.importService.listFilesByFolder(this.accessToken, this.currentFolder.id)
      ]);
      console.log('Directory loaded:', {
        folderCount: this.directories.length,
        fileCount: this.files.length,
        directories: this.directories,
        files: this.files
      });

      if (this.directories.length === 0 && this.currentFolder.id === 'root') {
        // Comprehensive diagnostic check
        try {
          const [raw, globalRaw, about, sharedDrives, spreadsheets, rootMeta, allFolders, tokenInfo] = await Promise.all([
            this.importService.listAllItems(this.accessToken, 'root'),
            this.importService.globalDiagnosticSearch(this.accessToken),
            this.importService.getDriveAbout(this.accessToken),
            this.importService.listSharedDrives(this.accessToken),
            this.importService.findSpreadsheetsGlobally(this.accessToken),
            this.importService.getRootMetadata(this.accessToken),
            this.importService.findAllFoldersGlobally(this.accessToken),
            this.importService.getTokenInfo(this.accessToken)
          ]);

          this.debugInfo = `--- GRANTED SCOPES ---\n` +
            `${tokenInfo.scope}\n\n` +
            `--- ACCOUNT INFO ---\n` +
            `User: ${about.user?.emailAddress} (${about.user?.displayName})\n` +
            `Storage Used: ${(about.storageQuota?.usage / (1024 * 1024)).toFixed(2)} MB / ${(about.storageQuota?.limit / (1024 * 1024 * 1024)).toFixed(0)} GB\n\n` +
            `--- ROOT METADATA ---\n` +
            JSON.stringify(rootMeta, null, 2) + '\n\n' +
            `--- ROOT CHECK (parent='root') ---\n` +
            `Found ${raw.length} items.\n` +
            (raw.length > 0 ? JSON.stringify(raw, null, 2) + '\n\n' : '\n') +
            `--- GLOBAL CHECK (Recent 10) ---\n` +
            `Found ${globalRaw.length} items.\n` +
            (globalRaw.length > 0 ? JSON.stringify(globalRaw, null, 2) + '\n\n' : '\n') +
            `--- ALL FOLDERS (Anywhere) ---\n` +
            `Found ${allFolders.length} folders.\n` +
            (allFolders.length > 0 ? JSON.stringify(allFolders, null, 2) + '\n\n' : '\n') +
            `--- SHARED DRIVES ---\n` +
            `Found ${sharedDrives.length} shared drives.\n` +
            (sharedDrives.length > 0 ? JSON.stringify(sharedDrives, null, 2) + '\n\n' : '\n') +
            `--- RECENT SPREADSHEETS (Anywhere) ---\n` +
            `Found ${spreadsheets.length} spreadsheets.\n` +
            (spreadsheets.length > 0 ? JSON.stringify(spreadsheets, null, 2) : 'No spreadsheets found globally.\n\nTIP: If no spreadsheets are found, check if you have allowed "View and manage Google Drive files" in the sign-in screen.');
        } catch (diagError: any) {
          console.error('Diagnostic failed:', diagError);
          this.debugInfo = `Diagnostic failed: ${diagError.message}\n` +
            `This usually means a permission scope is missing. Please Disconnect and try again, and check ALL boxes on the Google Sign-in screen.`;
        }
      }
    } catch (error: any) {
      console.error('Directory load failed:', error);
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
    this.sheetNames = [];
    this.selectedSheet = '__all__';
    this.fileHeaders = [];
    this.sampleRow = [];
    this.columnMapping = {};
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



  async selectFile(file: { id: string, name: string, mimeType: string }) {
    this.selectedFileId = file.id;
    this.selectedFileName = file.name;
    this.sheetNames = [];
    this.selectedSheet = '__all__';
    this.fileHeaders = [];
    this.sampleRow = [];
    this.columnMapping = {};

    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      this.isLoadingSheets = true;
      try {
        this.sheetNames = await this.importService.getSheetNames(this.accessToken, file.id);
        if (this.sheetNames.length === 1) {
          this.selectedSheet = this.sheetNames[0];
        }
      } catch (e: any) {
        this.statusMessage = '⚠️ Could not load sheet names: ' + e.message;
      } finally {
        this.isLoadingSheets = false;
      }
    }
  }

  selectSheet(name: string) {
    this.selectedSheet = name;
    this.fileHeaders = [];
    this.sampleRow = [];
    this.columnMapping = {};
  }

  async parseFileHeaders() {
    this.statusMessage = 'Analyzing file headers...';
    try {
      const sheetName = this.selectedSheet === '__all__' ? undefined : this.selectedSheet;
      const data = await this.importService.readSheetData(this.accessToken, this.selectedFileId, sheetName);
      if (data && data.length > 0) {
        this.fileHeaders = data[0].map(h => h.toString().trim());
        this.sampleRow = data.length > 1 ? data[1].map(v => v?.toString() ?? '') : [];
        this.columnMapping = {};
        this.fileHeaders.forEach(header => {
          const lowerHeader = header.toLowerCase();
          const match = this.availableAttributes.find(attr => attr.label.toLowerCase() === lowerHeader || attr.key.toLowerCase() === lowerHeader);
          this.columnMapping[header] = match ? match.key : 'ignore';
        });
        this.statusMessage = '';
      }
    } catch (e: any) {
      console.error('Failed to parse headers:', e);
      const detail = e?.error?.error?.message || e?.message || 'Unknown error';
      this.statusMessage = `❌ Failed to read file headers: ${detail}`;
    }
  }

  async startImport() {
    this.isImporting = true;
    this.statusMessage = 'Reading spreadsheet data...';
    this.isError = false;
    this.isSuccess = false;

    try {
      const sheetName = this.selectedSheet === '__all__' ? undefined : this.selectedSheet;
      const data = this.selectedSheet === '__all__' && this.sheetNames.length > 1
        ? await this.importService.readAllSheetsData(this.accessToken, this.selectedFileId)
        : await this.importService.readSheetData(this.accessToken, this.selectedFileId, sheetName);
      if (!data || data.length < 2) throw new Error('Spreadsheet is empty or has no data rows.');

      // Validate mapping: ensure at least itemDescription is mapped
      const mappedValues = Object.values(this.columnMapping);
      if (!mappedValues.includes('itemDescription')) {
        throw new Error('You must map a column to "Description".');
      }

      this.statusMessage = `Importing ${data.length - 1} records to collection "${this.collectionName}"...`;

      // Pass the mapping to import service
      const importedCount = await this.importService.importToFirestore(this.collectionName, data, this.columnMapping);

      // Track the new collection in database explorer
      await this.repairService.trackCollection(this.collectionName);

      this.statusMessage = `✅ Successfully imported ${importedCount} records to "${this.collectionName}".`;
      this.isSuccess = true;
      this.fileHeaders = [];
      this.sampleRow = [];
    } catch (error: any) {
      console.error('Import failed:', error);
      this.statusMessage = '❌ Import Failed: ' + (error?.message || 'Unknown error');
      this.isError = true;
    } finally {
      this.isImporting = false;
    }
  }

  async signOut() {
    await this.authService.logout();
    this.accessToken = '';
    this.directories = [];
    this.files = [];
    this.currentFolder = { id: 'root', name: 'My Drive' };
    this.navigationPath = [];
    this.statusMessage = 'Disconnected from Google Drive.';
    this.isSuccess = false;
    this.searchTerm = '';
    this.searchResults = [];
    this.fileHeaders = [];
    this.sampleRow = [];
    this.columnMapping = {};
    this.sheetNames = [];
    this.selectedSheet = '__all__';
    this.selectedFileId = '';
    this.selectedFileName = '';
  }

  async navigateToFolder(folderId: string) {
    this.isLoadingFolders = true;
    try {
      const { folder, breadcrumbs } = await this.importService.jumpToFolder(this.accessToken, folderId);
      this.currentFolder = folder;
      this.navigationPath = breadcrumbs;
      this.selectedFileId = '';
      this.selectedFileName = '';
      await this.loadCurrentDirectory();
    } catch (e: any) {
      console.error('Failed to jump to folder:', e);
      this.statusMessage = '❌ Failed to navigate to folder.';
      this.isError = true;
    } finally {
      this.isLoadingFolders = false;
    }
  }

  getMimeTypeLabel(mimeType: string): string {
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
    if (mimeType === 'text/csv' || mimeType === 'application/csv') return 'CSV';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'Excel (XLSX)';
    if (mimeType === 'application/vnd.ms-excel') return 'Excel (XLS)';
    return 'File';
  }

  async searchFolders() {
    if (!this.searchTerm) return;
    this.isLoadingFolders = true;
    try {
      this.searchResults = await this.importService.searchByName(this.accessToken, this.searchTerm);
      if (this.searchResults.length === 0) {
        this.statusMessage = 'No folders found matching "' + this.searchTerm + '"';
      }
    } catch (e: any) {
      console.error('Search failed:', e);
    } finally {
      this.isLoadingFolders = false;
    }
  }

  async tracePath(fileId: string) {
    this.debugInfo = 'Tracing path for ' + fileId + '...\n';
    try {
      let currentId = fileId;
      let path = [];
      for (let i = 0; i < 5; i++) { // Trace up to 5 levels
        const meta = await this.importService.getFileMetadata(this.accessToken, currentId);
        path.push(`${meta.name} (${meta.id})`);
        if (!meta.parents || meta.parents.length === 0) {
          path.push('ROOT / END');
          break;
        }
        currentId = meta.parents[0];
      }
      this.debugInfo += path.join(' -> ');
    } catch (e: any) {
      this.debugInfo += 'Tracing failed: ' + e.message;
    }
  }
}
