import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { RepairItem, Owner } from '../../models/repair-item.model';
import { Tag } from '../../models/tag.model';

interface PhotoFile {
  file: File;
  preview: string;
  status: 'ready' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

@Component({
  selector: 'app-repair-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="form-page">
      <div class="form-container glass">
        <div class="form-header">
          <h2>{{ isEdit ? 'Edit Repair Item' : 'Register New Repair' }} <small class="version">v1.1</small></h2>
          <button class="btn-close" [routerLink]="['/']" [disabled]="isUploading">×</button>
        </div>
        
        <form [formGroup]="repairForm" (ngSubmit)="onSubmit()">
          <!-- Repair Cafe Date -->
          <div class="form-group">
            <label for="rcday">Repair Cafe Date <span class="required">*</span></label>
            <div class="select-wrapper glass">
                <select id="rcday" formControlName="RCDay">
                    <option value="" disabled>Select Date</option>
                    <option *ngFor="let d of availableDates" [value]="d.value">{{ d.label }}</option>
                </select>
                <div class="select-arrow">▼</div>
            </div>
            <div *ngIf="repairForm.get('RCDay')?.touched && repairForm.get('RCDay')?.invalid" class="error">
              Please select a date.
            </div>
          </div>

          <!-- Sequence Number -->
          <div class="form-group">
            <label for="itemNumber">Sequence Number (Suggested)</label>
            <input id="itemNumber" type="text" formControlName="displayNumber" placeholder="e.g., 1">
            <small class="hint">Leave as is or override. The system will auto-assign if left blank.</small>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="itemDescription">Description <span class="required">*</span></label>
            <textarea id="itemDescription" formControlName="itemDescription" placeholder="What needs fixing? (e.g. Lamp with frayed cord)"></textarea>
            <div *ngIf="repairForm.get('itemDescription')?.touched && repairForm.get('itemDescription')?.invalid" class="error">
              Please enter a description of the item.
            </div>
          </div>

          <!-- Telephone Number -->
          <div class="form-group">
            <label for="telephone">Telephone Number</label>
            <input id="telephone" type="tel" formControlName="telephone" placeholder="e.g. 07700 900000">
          </div>

          <!-- Owner Name -->
          <div class="form-group">
            <label for="owner">Owner Name</label>
            <div class="autocomplete-container">
                <input 
                    id="owner" 
                    type="text" 
                    formControlName="owner" 
                    placeholder="Who brought this item?" 
                    (input)="onOwnerSearch($any($event.target).value)"
                    (blur)="hideOwnerSuggestions()"
                    autocomplete="off">
                
                <div class="suggestions-list glass" *ngIf="filteredOwners.length > 0 && showOwnerSuggestions">
                  <div 
                    class="suggestion-item" 
                    *ngFor="let owner of filteredOwners"
                    (mousedown)="selectOwner(owner)">
                    <span class="suggestion-name">{{ owner.name }}</span>
                    <span class="version" style="margin-left: auto">{{ owner.firstSeen?.toDate() | date:'shortDate' }}</span>
                  </div>
                </div>
            </div>
          </div>

          <!-- Assigned Repairer -->
          <div class="form-group">
            <label for="repairer">Assigned Repairer</label>
            <div class="select-wrapper glass">
                <select id="repairer" formControlName="repairer">
                    <option value="">-- Unassigned --</option>
                    <option *ngFor="let r of repairers$ | async" [value]="r.name">
                        {{ r.name }}
                    </option>
                </select>
                <div class="select-arrow">▼</div>
            </div>
          </div>

          <!-- Status -->
          <div class="form-group">
            <label for="status">Status</label>
            <div class="select-wrapper glass">
                <select id="status" formControlName="status">
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Completed">Completed</option>
                </select>
                <div class="select-arrow">▼</div>
            </div>
          </div>

          <div class="form-group">
            <label>Tags (Optional)</label>
            <div class="tag-input-wrapper">
              <div class="autocomplete-container">
                <input 
                  type="text" 
                  #tagInput 
                  (input)="onTagSearch(tagInput.value)"
                  (keyup.enter)="addTag(tagInput)" 
                  (blur)="hideSuggestions()"
                  placeholder="Enter a tag (e.g. Electrical) and press Enter">
                
                <div class="suggestions-list glass" *ngIf="filteredSuggestions.length > 0 && showSuggestions">
                  <div 
                    class="suggestion-item" 
                    *ngFor="let tag of filteredSuggestions"
                    (mousedown)="selectSuggestion(tag, tagInput)">
                    <span class="suggestion-emoji">{{ tag.emoji }}</span>
                    <span class="suggestion-name">{{ tag.name }}</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn-add-tag" (click)="addTag(tagInput)">Add</button>
            </div>
            <div class="tag-chips" *ngIf="tags.length > 0">
              <span class="tag-chip" *ngFor="let tag of tags; let i = index">
                {{ tag }}
                <button type="button" class="btn-remove-tag" (click)="removeTag(i)">×</button>
              </span>
            </div>
          </div>
          <div class="form-group">
            <label>Item Photos</label>
            <div class="photo-upload-zone">
              <input type="file" #fileInput (change)="onFileSelected($event)" multiple accept="image/*" style="display: none">
              <input type="file" #cameraInput (change)="onFileSelected($event)" accept="image/*" capture="environment" style="display: none">
              
              <div class="upload-actions">
                <button type="button" class="btn-upload primary" (click)="cameraInput.click()" [disabled]="isUploading">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Take Photo
                </button>
                <button type="button" class="btn-upload" (click)="fileInput.click()" [disabled]="isUploading">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Add Files
                </button>
              </div>
            </div>

            <!-- Preview Grid -->
            <div class="photo-preview-grid" *ngIf="existingPhotos.length > 0 || selectedFiles.length > 0">
              <!-- Existing Photos -->
              <div class="photo-card" *ngFor="let photo of existingPhotos; let i = index">
                <img [src]="photo" alt="Repair photo">
                <button type="button" class="btn-remove" (click)="removeExistingPhoto(i)" title="Remove photo" [disabled]="isUploading">×</button>
              </div>
              
              <!-- Newly Selected Photos -->
              <div class="photo-card" [class.pending]="file.status === 'ready'" [class.uploading]="file.status === 'uploading'" *ngFor="let file of selectedFiles; let i = index">
                <img [src]="file.preview" alt="Preview">
                <div class="status-overlay" [ngClass]="file.status">
                  <span *ngIf="file.status === 'ready'">Ready</span>
                  <span *ngIf="file.status === 'uploading'">Uploading...</span>
                  <span *ngIf="file.status === 'error'">Error!</span>
                </div>
                <button type="button" class="btn-remove" (click)="removeSelectedFile(i)" title="Remove photo" *ngIf="file.status !== 'uploading'">×</button>
              </div>
            </div>
            
            <div *ngIf="uploadError" class="error-banner">
              {{ uploadError }}
            </div>
          </div>

          <div class="form-actions-wrapper">
            <div class="validation-hint" *ngIf="repairForm.get('itemDescription')?.invalid && (repairForm.get('itemDescription')?.touched || selectedFiles.length > 0)">
              ⚠️ Please enter a description to enable saving.
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="onCancel()" [disabled]="isUploading">Cancel</button>
              <button type="submit" [disabled]="repairForm.invalid || isUploading" class="btn-submit">
                <span class="spinner" *ngIf="isUploading"></span>
                {{ isUploading ? 'Saving Repair...' : (isEdit ? 'Save Changes' : 'Register Repair') }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-page {
      min-height: calc(100vh - 200px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 2rem;
    }
    .form-container {
      width: 100%;
      max-width: 600px;
      padding: 2.5rem;
      border-radius: 20px;
      animation: slideUp 0.5s ease-out;
    }
    
    @media (max-width: 600px) {
      .form-page {
        padding: 0.5rem;
      }
      .form-container {
        padding: 1.5rem;
        border-radius: 12px;
      }
      h2 {
        font-size: 1.4rem;
      }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    
    @media (max-width: 600px) {
      .form-actions {
        flex-direction: column-reverse;
      }
      .btn-cancel, .btn-submit {
        width: 100%;
        padding: 1rem;
        justify-content: center;
      }
    }
    h2 { margin: 0; font-size: 1.8rem; color: var(--accent-color); display: flex; align-items: baseline; gap: 0.8rem; }
    .version { font-size: 0.6rem; opacity: 0.3; font-weight: 300; }
    .btn-close {
      background: none;
      border: none;
      color: var(--text-color);
      font-size: 2rem;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .btn-close:hover:not(:disabled) { opacity: 1; }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
    .required { color: #ff4444; margin-left: 2px; }
    .hint { display: block; font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); margin-top: 0.3rem; }
    
    input, textarea {
      width: 100%;
      padding: 0.8rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: white;
      font-size: 1rem;
      transition: all 0.2s;
    }
    textarea { height: 120px; resize: vertical; }
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
    }

    .select-wrapper {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
    }
    select {
        width: 100%;
        padding: 0.8rem 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: white;
        font-size: 1rem;
        appearance: none;
        cursor: pointer;
        transition: all 0.2s;
    }
    select:focus {
        outline: none;
        border-color: var(--primary-color);
        background: rgba(255, 255, 255, 0.08);
    }
    select option {
        background: #1a1a2e;
        color: white;
        padding: 1rem;
    }
    .select-arrow {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.8rem;
    }

    .tag-input-wrapper {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.8rem;
    }
    .autocomplete-container {
      position: relative;
      flex: 1;
    }
    .suggestions-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 1000;
      margin-top: 0.5rem;
      max-height: 200px;
      overflow-y: auto;
      border-radius: 12px;
      background: rgba(20, 20, 35, 0.95);
      backdrop-filter: blur(20px);
      border: 2px solid rgba(0, 242, 255, 0.3);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 242, 255, 0.1);
    }
    .suggestions-list::-webkit-scrollbar {
      width: 6px;
    }
    .suggestions-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0 12px 12px 0;
    }
    .suggestions-list::-webkit-scrollbar-thumb {
      background: var(--primary-color);
      border-radius: 10px;
    }
    .suggestion-item {
      padding: 1rem 1.2rem;
      cursor: pointer;
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.9);
      transition: all 0.2s;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .suggestion-emoji {
      font-size: 1.2rem;
    }
    .suggestion-item:last-child {
      border-bottom: none;
    }
    .suggestion-item:hover {
      background: rgba(0, 242, 255, 0.15);
      color: var(--accent-color);
      padding-left: 1.5rem;
    }
    .btn-add-tag {
      padding: 0 1.5rem;
      background: var(--primary-color);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-add-tag:hover {
      background: var(--accent-color);
      transform: translateY(-1px);
    }
    .tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }
    .tag-chip {
      background: rgba(0, 242, 255, 0.1);
      border: 1px solid var(--accent-color);
      color: var(--accent-color);
      padding: 0.4rem 0.8rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-remove-tag {
      background: none;
      border: none;
      color: var(--accent-color);
      font-size: 1.2rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      opacity: 0.6;
    }
    .btn-remove-tag:hover { opacity: 1; }

    .photo-upload-zone {
      margin-bottom: 1rem;
    }
    .upload-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .btn-upload {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: var(--text-color);
      cursor: pointer;
      transition: all 0.2s;
      justify-content: center;
      font-weight: 500;
    }
    .btn-upload.primary {
      background: rgba(0, 242, 255, 0.1);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
    .btn-upload:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }
    .btn-upload.primary:hover:not(:disabled) {
      background: rgba(0, 242, 255, 0.2);
    }
    .btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }

    .photo-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .photo-card {
      position: relative;
      aspect-ratio: 1;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .status-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: white;
      font-weight: 600;
      backdrop-filter: blur(2px);
    }
    .status-overlay.ready { background: rgba(0, 0, 0, 0.3); }
    .status-overlay.uploading { background: rgba(0, 242, 255, 0.4); }
    .status-overlay.error { background: rgba(255, 68, 68, 0.6); }
    
    .btn-remove {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255, 68, 68, 0.8);
      border: none;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      transition: transform 0.2s;
      z-index: 10;
    }
    .btn-remove:hover:not(:disabled) { transform: scale(1.1); background: #ff4444; }
    .btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .form-actions-wrapper { margin-top: 2.5rem; }
    .validation-hint {
      text-align: center;
      margin-bottom: 1rem;
      color: #ffaa00;
      font-size: 0.9rem;
      font-weight: 600;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    
    .form-actions { display: flex; gap: 1rem; }
    .btn-submit, .btn-cancel {
      flex: 1;
      padding: 1rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
    }
    .btn-submit {
      background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
      color: white;
    }
    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 242, 255, 0.3);
    }
    .btn-submit:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }
    .btn-cancel {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-color);
    }
    .btn-cancel:hover:not(:disabled) { background: rgba(255, 255, 255, 0.15); }
    
    .error { color: #ff4444; font-size: 0.85rem; margin-top: 0.4rem; }
    .error-banner {
      margin-top: 1rem;
      padding: 0.8rem;
      background: rgba(255, 68, 68, 0.1);
      border: 1px solid rgba(255, 68, 68, 0.2);
      border-radius: 8px;
      color: #ff4444;
      font-size: 0.9rem;
    }
    
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class RepairFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private repairService = inject(RepairService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  repairForm: FormGroup;
  isEdit = false;
  editItemId: string | null = null;
  isUploading = false;
  uploadError: string | null = null;

  selectedFiles: PhotoFile[] = [];
  existingPhotos: string[] = [];
  tags: string[] = [];
  allAvailableTags: Tag[] = [];
  filteredSuggestions: Tag[] = [];
  showSuggestions = false;

  availableDates: { label: string, value: string, date: Date }[] = [];

  owners: Owner[] = [];
  filteredOwners: Owner[] = [];
  showOwnerSuggestions = false;

  repairers$ = this.repairService.getRepairers();

  constructor() {
    this.generateAvailableDates();

    this.repairForm = this.fb.group({
      displayNumber: [''],
      itemDescription: ['', Validators.required],
      telephone: [''],
      owner: [''],
      repairer: [''],
      status: ['New'],
      RCDay: ['', Validators.required]
    });

    // Set default RCDay to next upcoming date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = this.availableDates.find(d => d.date >= today);
    if (nextDate) {
      this.repairForm.patchValue({ RCDay: nextDate.value });
    } else if (this.availableDates.length > 0) {
      this.repairForm.patchValue({ RCDay: this.availableDates[this.availableDates.length - 1].value });
    }

    // Auto-update status when repairer changes
    this.repairForm.get('repairer')?.valueChanges.subscribe(repairer => {
      const currentStatus = this.repairForm.get('status')?.value;
      if (repairer && currentStatus === 'New') {
        this.repairForm.patchValue({ status: 'Assigned' }, { emitEvent: false });
      } else if (!repairer && currentStatus === 'Assigned') {
        this.repairForm.patchValue({ status: 'New' }, { emitEvent: false });
      }
    });
  }

  generateAvailableDates() {
    const dates = [];
    // Generate dates for 2025 and 2026
    const years = [2025, 2026];

    for (const year of years) {
      for (let month = 0; month < 12; month++) {
        const date = this.getThirdSaturday(year, month);
        const value = this.repairService.generateRCDay(date);
        const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        dates.push({ label, value, date });
      }
    }
    this.availableDates = dates;
  }

  getThirdSaturday(year: number, month: number): Date {
    const date = new Date(year, month, 1);
    const day = date.getDay();
    const daysUntilFirstSat = (6 - day + 7) % 7;
    const firstSatDate = 1 + daysUntilFirstSat;
    const thirdSatDate = firstSatDate + 14;
    return new Date(year, month, thirdSatDate);
  }

  async ngOnInit() {
    // Load all available tags for autocomplete
    this.repairService.getAllTags().then(tags => {
      this.allAvailableTags = tags;
    });

    this.repairService.getOwners().subscribe(owners => {
      this.owners = owners;
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.editItemId = id;

      this.repairService.getRepairItems().subscribe(items => {
        const item = items.find(i => i.id === id);
        if (item) {
          this.repairForm.patchValue({
            displayNumber: item.displayNumber,
            itemDescription: item.itemDescription,
            telephone: item.telephone || '',
            owner: item.owner || '',
            repairer: item.repairer || '',
            status: item.status || 'New',
            RCDay: item.RCDay || ''
          });
          this.existingPhotos = item.photos || [];
          this.tags = item.tags || [];
        }
      });
    } else {
      try {
        const suggestion = await this.repairService.getSuggestedDisplayNumber();
        this.repairForm.patchValue({ displayNumber: suggestion });
      } catch (err) {
        console.error('Failed to get suggested number:', err);
      }
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files as FileList;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedFiles.push({
            file: file,
            preview: e.target.result,
            status: 'ready'
          });
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeSelectedFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  removeExistingPhoto(index: number) {
    this.existingPhotos.splice(index, 1);
  }

  addTag(input: HTMLInputElement) {
    const value = input.value.trim();
    if (value && !this.tags.includes(value)) {
      this.tags.push(value);
      // Update local cache so it appears in suggestions immediately if typed again
      if (!this.allAvailableTags.find(t => t.name === value)) {
        const emoji = this.repairService.getEmojiForTag(value);
        this.allAvailableTags.push({ name: value, emoji: emoji });
        this.allAvailableTags.sort((a, b) => a.name.localeCompare(b.name));
      }
      input.value = '';
    }
  }

  removeTag(index: number) {
    this.tags.splice(index, 1);
  }

  onTagSearch(value: string) {
    if (!value.trim()) {
      this.filteredSuggestions = [];
      this.showSuggestions = false;
      return;
    }
    const term = value.toLowerCase();
    this.filteredSuggestions = this.allAvailableTags.filter(tag =>
      tag.name.toLowerCase().includes(term) && !this.tags.includes(tag.name)
    );
    this.showSuggestions = this.filteredSuggestions.length > 0;
  }

  selectSuggestion(tag: Tag, input: HTMLInputElement) {
    if (!this.tags.includes(tag.name)) {
      this.tags.push(tag.name);
    }
    input.value = '';
    this.filteredSuggestions = [];
    this.showSuggestions = false;
  }

  hideSuggestions() {
    // Use timeout to allow mousedown on suggestion to trigger first
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  onOwnerSearch(value: string) {
    if (!value.trim()) {
      this.filteredOwners = [];
      this.showOwnerSuggestions = false;
      return;
    }
    const term = value.toLowerCase();
    this.filteredOwners = this.owners.filter(o => o.name.toLowerCase().includes(term));
    this.showOwnerSuggestions = this.filteredOwners.length > 0;
  }

  selectOwner(owner: Owner) {
    this.repairForm.patchValue({ owner: owner.name });
    this.filteredOwners = [];
    this.showOwnerSuggestions = false;
  }

  hideOwnerSuggestions() {
    setTimeout(() => {
      this.showOwnerSuggestions = false;
    }, 200);
  }

  async onSubmit() {
    if (this.repairForm.valid && !this.isUploading) {
      this.isUploading = true;
      this.uploadError = null;

      try {
        const uploadPromises = this.selectedFiles.map(async (photoFile) => {
          if (photoFile.status === 'success') return photoFile.preview; // Should not happen but for safety

          try {
            photoFile.status = 'uploading';
            const url = await this.repairService.uploadPhoto(photoFile.file);
            photoFile.status = 'success';
            return url;
          } catch (err) {
            photoFile.status = 'error';
            photoFile.errorMessage = (err as any).message || 'Upload failed';
            throw err;
          }
        });

        const newPhotoUrls = await Promise.all(uploadPromises);
        const allPhotos = [...this.existingPhotos, ...newPhotoUrls];

        const itemData = {
          ...this.repairForm.value,
          photos: allPhotos,
          tags: this.tags
        };

        if (this.isEdit && this.editItemId) {
          await this.repairService.updateRepairItem(this.editItemId, itemData);
        } else {
          await this.repairService.addRepairItem(itemData);
        }

        this.repairService.setEditItem(null);
        this.router.navigate(['/']);
      } catch (error) {
        console.error('Error during submission:', error);
        this.uploadError = 'Some photos failed to upload. Please try again or remove the failing files.';
      } finally {
        this.isUploading = false;
      }
    }
  }

  onCancel() {
    if (!this.isUploading) {
      this.repairService.setEditItem(null);
      this.router.navigate(['/']);
    }
  }
}
