import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../services/document.service';
import { AuthService } from '../../services/auth.service';
import { RCDocument } from '../../models/document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="documents-page">
      <div class="page-header">
        <h2>Documents</h2>
        <p class="page-subtitle">Organize, search, and manage all your files in one place.</p>
      </div>

      <!-- Toolbar -->
      <div class="toolbar glass">
        <div class="search-box">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search documents..."
            (input)="filterDocuments()"
          />
        </div>

        <div class="toolbar-actions">
          <button class="btn-view" [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'" title="Grid view">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
          </button>
          <button class="btn-view" [class.active]="viewMode === 'list'" (click)="viewMode = 'list'" title="List view">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
          <button class="btn-upload" (click)="showUpload = !showUpload">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload
          </button>
        </div>
      </div>

      <!-- Upload Panel -->
      <div class="upload-panel glass" *ngIf="showUpload">
        <h3>Upload Document</h3>
        <div class="upload-form">
          <div
            class="drop-zone"
            [class.drag-over]="isDragging"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging = false"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p *ngIf="!selectedFile">Drop files here or click to browse</p>
            <p *ngIf="selectedFile" class="selected-file">{{ selectedFile.name }} ({{ documentService.formatFileSize(selectedFile.size) }})</p>
            <input #fileInput type="file" (change)="onFileSelected($event)" hidden />
          </div>

          <div class="upload-fields">
            <div class="field-row">
              <label>Folder</label>
              <div class="folder-input">
                <input
                  type="text"
                  [(ngModel)]="uploadFolder"
                  placeholder="Choose or type folder name..."
                  list="folderList"
                />
                <datalist id="folderList">
                  <option *ngFor="let f of folders" [value]="f"></option>
                </datalist>
              </div>
            </div>
            <div class="field-row">
              <label>Description</label>
              <input type="text" [(ngModel)]="uploadDescription" placeholder="Brief description (optional)" />
            </div>
            <div class="field-row">
              <label>Tags</label>
              <input type="text" [(ngModel)]="uploadTags" placeholder="Comma-separated tags (optional)" />
            </div>
          </div>

          <div class="upload-actions">
            <button class="btn-cancel" (click)="showUpload = false; resetUpload()">Cancel</button>
            <button class="btn-submit" [disabled]="!selectedFile || uploading" (click)="uploadDocument()">
              <span *ngIf="!uploading">Upload</span>
              <span *ngIf="uploading">Uploading...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="content-area">
        <!-- Folder Sidebar -->
        <aside class="folder-sidebar glass">
          <h3>Folders</h3>
          <ul>
            <li
              [class.active]="selectedFolder === null"
              (click)="selectFolder(null)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3h18v18H3z"></path>
              </svg>
              All Documents
              <span class="count">{{ allDocuments.length }}</span>
            </li>
            <li
              *ngFor="let folder of folders"
              [class.active]="selectedFolder === folder"
              (click)="selectFolder(folder)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              {{ folder }}
              <span class="count">{{ getFolderCount(folder) }}</span>
            </li>
          </ul>
        </aside>

        <!-- Document Grid/List -->
        <div class="document-list">
          <div *ngIf="filteredDocuments.length === 0" class="empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p>No documents found.</p>
            <p class="hint" *ngIf="!showUpload">Click <strong>Upload</strong> to add your first document.</p>
          </div>

          <!-- Grid View -->
          <div class="doc-grid" *ngIf="viewMode === 'grid' && filteredDocuments.length > 0">
            <div class="doc-card glass" *ngFor="let doc of filteredDocuments">
              <div class="doc-icon">{{ documentService.getFileIcon(doc.fileType) }}</div>
              <div class="doc-info">
                <span class="doc-name" [title]="doc.name">{{ doc.name }}</span>
                <span class="doc-folder">{{ doc.folder }}</span>
                <span class="doc-size">{{ documentService.formatFileSize(doc.fileSize) }}</span>
              </div>
              <div class="doc-tags" *ngIf="doc.tags && doc.tags.length">
                <span class="tag" *ngFor="let tag of doc.tags">{{ tag }}</span>
              </div>
              <div class="doc-actions">
                <a [href]="doc.fileUrl" target="_blank" class="btn-icon" title="Open / Download">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
                <button class="btn-icon btn-danger" (click)="confirmDelete(doc)" title="Delete">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- List View -->
          <table class="doc-table" *ngIf="viewMode === 'list' && filteredDocuments.length > 0">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Folder</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of filteredDocuments">
                <td class="col-icon">{{ documentService.getFileIcon(doc.fileType) }}</td>
                <td class="col-name">
                  <span [title]="doc.name">{{ doc.name }}</span>
                  <span class="doc-desc" *ngIf="doc.description">{{ doc.description }}</span>
                </td>
                <td class="col-folder">{{ doc.folder }}</td>
                <td class="col-size">{{ documentService.formatFileSize(doc.fileSize) }}</td>
                <td class="col-date">{{ doc.uploadedAt.toDate() | date:'mediumDate' }}</td>
                <td class="col-actions">
                  <a [href]="doc.fileUrl" target="_blank" class="btn-icon" title="Open">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                  <button class="btn-icon btn-danger" (click)="confirmDelete(doc)" title="Delete">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .documents-page {
      max-width: 100%;
    }

    .page-header {
      margin-bottom: 1.5rem;
    }

    .page-header h2 {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      background: linear-gradient(to right, #6366f1, #00f2ff);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 0.3rem 0;
    }

    .page-subtitle {
      color: rgba(255,255,255,0.5);
      margin: 0;
      font-size: 0.95rem;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.8rem 1rem;
      border-radius: 12px;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.5rem 0.8rem;
      flex: 1;
      min-width: 200px;
    }

    .search-box svg {
      opacity: 0.5;
      flex-shrink: 0;
    }

    .search-box input {
      background: none;
      border: none;
      color: #f8fafc;
      font-size: 0.9rem;
      outline: none;
      width: 100%;
    }

    .toolbar-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .btn-view {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5);
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: all 0.2s;
    }

    .btn-view.active, .btn-view:hover {
      color: #00f2ff;
      border-color: rgba(0,242,255,0.3);
      background: rgba(0,242,255,0.08);
    }

    .btn-upload {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #00f2ff, #6366f1);
      color: white;
      border: none;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 10px rgba(0,242,255,0.3);
    }

    .btn-upload:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(0,242,255,0.4);
    }

    /* Upload Panel */
    .upload-panel {
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .upload-panel h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: #00f2ff;
    }

    .drop-zone {
      border: 2px dashed rgba(0,242,255,0.3);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      color: rgba(255,255,255,0.5);
      margin-bottom: 1rem;
    }

    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #00f2ff;
      background: rgba(0,242,255,0.05);
    }

    .drop-zone svg {
      opacity: 0.4;
      margin-bottom: 0.5rem;
    }

    .drop-zone p {
      margin: 0.5rem 0 0 0;
      font-size: 0.9rem;
    }

    .selected-file {
      color: #00f2ff !important;
      font-weight: 600;
    }

    .upload-fields {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin-bottom: 1rem;
    }

    .field-row {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }

    .field-row label {
      min-width: 80px;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.6);
      font-weight: 600;
    }

    .field-row input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.5rem 0.8rem;
      color: #f8fafc;
      font-size: 0.9rem;
      outline: none;
    }

    .field-row input:focus {
      border-color: rgba(0,242,255,0.4);
    }

    .folder-input {
      flex: 1;
    }

    .folder-input input {
      width: 100%;
    }

    .upload-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .btn-cancel {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: rgba(255,255,255,0.1);
    }

    .btn-submit {
      padding: 0.5rem 1.5rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #00f2ff, #6366f1);
      border: none;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn-submit:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Content Area */
    .content-area {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 1rem;
      align-items: start;
    }

    /* Folder Sidebar */
    .folder-sidebar {
      border-radius: 12px;
      padding: 1rem;
      position: sticky;
      top: 1rem;
    }

    .folder-sidebar h3 {
      margin: 0 0 0.8rem 0;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.4);
    }

    .folder-sidebar ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .folder-sidebar li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.7rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      color: rgba(255,255,255,0.7);
      transition: all 0.15s;
    }

    .folder-sidebar li:hover {
      background: rgba(255,255,255,0.05);
      color: white;
    }

    .folder-sidebar li.active {
      background: rgba(0,242,255,0.1);
      color: #00f2ff;
      border: 1px solid rgba(0,242,255,0.2);
    }

    .folder-sidebar li .count {
      margin-left: auto;
      font-size: 0.75rem;
      background: rgba(255,255,255,0.08);
      padding: 0.1rem 0.45rem;
      border-radius: 6px;
      color: rgba(255,255,255,0.4);
    }

    .folder-sidebar li.active .count {
      background: rgba(0,242,255,0.15);
      color: rgba(0,242,255,0.7);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: rgba(255,255,255,0.4);
    }

    .empty-state svg {
      opacity: 0.3;
      margin-bottom: 1rem;
    }

    .empty-state p {
      margin: 0.3rem 0;
    }

    .empty-state .hint {
      font-size: 0.85rem;
    }

    /* Grid View */
    .doc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.8rem;
    }

    .doc-card {
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: all 0.2s;
      cursor: default;
    }

    .doc-card:hover {
      border-color: rgba(0,242,255,0.3);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }

    .doc-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .doc-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .doc-name {
      font-weight: 600;
      font-size: 0.88rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-folder {
      font-size: 0.78rem;
      color: rgba(0,242,255,0.6);
    }

    .doc-size {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.35);
    }

    .doc-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }

    .tag {
      font-size: 0.7rem;
      background: rgba(99,102,241,0.15);
      color: rgba(99,102,241,0.9);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      border: 1px solid rgba(99,102,241,0.2);
    }

    .doc-actions {
      display: flex;
      gap: 0.4rem;
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }

    .btn-icon:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }

    .btn-danger:hover {
      background: rgba(255,69,0,0.15);
      border-color: rgba(255,69,0,0.3);
      color: #ff4500;
    }

    /* List/Table View */
    .doc-table {
      width: 100%;
      border-collapse: collapse;
    }

    .doc-table th {
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(255,255,255,0.35);
      padding: 0.6rem 0.8rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .doc-table td {
      padding: 0.7rem 0.8rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 0.88rem;
      vertical-align: middle;
    }

    .doc-table tr:hover td {
      background: rgba(255,255,255,0.02);
    }

    .col-icon {
      width: 40px;
      font-size: 1.3rem;
    }

    .col-name span {
      display: block;
    }

    .col-name .doc-desc {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.4);
      margin-top: 0.15rem;
    }

    .col-folder {
      color: rgba(0,242,255,0.6);
      font-size: 0.82rem;
    }

    .col-size {
      color: rgba(255,255,255,0.4);
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .col-date {
      color: rgba(255,255,255,0.4);
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .col-actions {
      display: flex;
      gap: 0.3rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .content-area {
        grid-template-columns: 1fr;
      }

      .folder-sidebar {
        position: static;
      }

      .folder-sidebar ul {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
      }

      .folder-sidebar li {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }

      .doc-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      }

      .field-row {
        flex-direction: column;
        align-items: stretch;
      }

      .field-row label {
        min-width: auto;
      }

      .col-date, .col-folder {
        display: none;
      }
    }
  `]
})
export class DocumentsComponent implements OnInit {
  documentService = inject(DocumentService);
  private authService = inject(AuthService);

  allDocuments: RCDocument[] = [];
  filteredDocuments: RCDocument[] = [];
  folders: string[] = [];

  searchQuery = '';
  selectedFolder: string | null = null;
  viewMode: 'grid' | 'list' = 'grid';

  showUpload = false;
  selectedFile: File | null = null;
  uploadFolder = '';
  uploadDescription = '';
  uploadTags = '';
  uploading = false;
  isDragging = false;

  ngOnInit() {
    this.documentService.getDocuments().subscribe(docs => {
      this.allDocuments = docs;
      this.folders = Array.from(new Set(docs.map(d => d.folder))).sort();
      this.filterDocuments();
    });
  }

  selectFolder(folder: string | null) {
    this.selectedFolder = folder;
    this.filterDocuments();
  }

  filterDocuments() {
    let docs = this.allDocuments;

    if (this.selectedFolder) {
      docs = docs.filter(d => d.folder === this.selectedFolder);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.folder.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    this.filteredDocuments = docs;
  }

  getFolderCount(folder: string): number {
    return this.allDocuments.filter(d => d.folder === folder).length;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.selectedFile = event.dataTransfer.files[0];
    }
  }

  async uploadDocument() {
    if (!this.selectedFile) return;
    this.uploading = true;

    try {
      const tags = this.uploadTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const user = this.authService.getCurrentUser();
      const uploadedBy = user?.displayName || user?.email || 'Unknown';

      await this.documentService.uploadDocument(
        this.selectedFile,
        this.uploadFolder || 'Uncategorized',
        this.uploadDescription,
        tags,
        uploadedBy
      );

      this.showUpload = false;
      this.resetUpload();
    } catch (e) {
      console.error('Upload failed:', e);
      alert('Upload failed. Please try again.');
    } finally {
      this.uploading = false;
    }
  }

  resetUpload() {
    this.selectedFile = null;
    this.uploadFolder = '';
    this.uploadDescription = '';
    this.uploadTags = '';
  }

  async confirmDelete(doc: RCDocument) {
    if (confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
      await this.documentService.deleteDocument(doc);
    }
  }
}
