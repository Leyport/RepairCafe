import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { APP_VERSION } from '../../constants/version';
import { RepairService } from '../../services/repair.service';
import { Observable, firstValueFrom } from 'rxjs';
import { RepairItem, RepairPhoto, toRepairPhoto, Owner } from '../../models/repair-item.model';
import { Tag } from '../../models/tag.model';
import { environment } from '../../../environments/environment';

interface PhotoFile {
  file: File;
  preview: string;
  status: 'ready' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  type: 'before' | 'after';
}

interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  selected: boolean;
}

@Component({
  selector: 'app-repair-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="form-page">
      <div class="form-container glass">
        <div class="form-header">
          <h2>{{ isEdit ? 'Edit Repair Item' : 'Register New Repair' }} <small class="version">{{ appVersion.version }}</small></h2>
          <button class="btn-close" [routerLink]="['/']" [disabled]="isUploading">×</button>
        </div>
        
        <form [formGroup]="repairForm" (ngSubmit)="onSubmit()">
          <!-- Repair Cafe Date -->
          <div class="form-group">
            <label for="rcday">Repair Cafe Date <span class="required">*</span></label>
            <div class="select-wrapper glass">
                <select id="rcday_select_v158" name="rcday_select_v158" formControlName="RCDay">
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
                    (focus)="onOwnerSearch($any($event.target).value)"
                    (blur)="hideOwnerSuggestions()"
                    autocomplete="off">
                <button 
                  type="button" 
                  class="clear-btn" 
                  *ngIf="repairForm.get('owner')?.value" 
                  (click)="clearOwner()"
                  title="Clear owner">×</button>
                
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

          <div class="form-group">
            <label for="repairer">Primary Repairer</label>
            <div class="autocomplete-container">
                <input
                    id="repairer"
                    type="text"
                    formControlName="repairer"
                    placeholder="Who is the lead repairer?"
                    (input)="onRepairerSearch($any($event.target).value)"
                    (focus)="onRepairerSearch($any($event.target).value)"
                    (blur)="hideRepairerSuggestions()"
                    autocomplete="off">
                <button
                  type="button"
                  class="clear-btn"
                  *ngIf="repairForm.get('repairer')?.value"
                  (click)="clearRepairer()"
                  title="Clear repairer">×</button>

                <div class="suggestions-list glass" *ngIf="filteredRepairers.length > 0 && showRepairerSuggestions">
                  <div
                    class="suggestion-item"
                    *ngFor="let repairer of filteredRepairers"
                    (mousedown)="selectRepairer(repairer)">
                    <img [src]="repairer.photoUrl || '/assets/default-avatar.png'"
                         style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                    <span class="suggestion-name">{{ repairer.name }}</span>
                  </div>
                </div>
            </div>
            <small class="hint" *ngIf="allPrimaryRepairers.length === 0">No primary repairers available. An admin must mark repairers as primary.</small>
          </div>

          <div class="form-group">
            <label>Secondary Repairers</label>
            <div class="autocomplete-container">
                <input
                    type="text"
                    #secondaryInput
                    (input)="onSecondaryRepairerSearch(secondaryInput.value)"
                    (focus)="onSecondaryRepairerSearch(secondaryInput.value)"
                    (blur)="hideSecondaryRepairerSuggestions()"
                    placeholder="Add supporting repairers..."
                    autocomplete="off">

                <div class="suggestions-list glass" *ngIf="filteredSecondaryRepairers.length > 0 && showSecondaryRepairerSuggestions">
                  <div
                    class="suggestion-item"
                    *ngFor="let repairer of filteredSecondaryRepairers"
                    (mousedown)="addSecondaryRepairer(repairer, secondaryInput)">
                    <img [src]="repairer.photoUrl || '/assets/default-avatar.png'"
                         style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                    <span class="suggestion-name">{{ repairer.name }}</span>
                  </div>
                </div>
            </div>
            <div class="tag-chips" *ngIf="secondaryRepairers.length > 0">
              <span class="tag-chip" *ngFor="let name of secondaryRepairers; let i = index">
                {{ name }}
                <button type="button" class="btn-remove-tag" (click)="removeSecondaryRepairer(i)">×</button>
              </span>
            </div>
          </div>

          <!-- Status -->
          <div class="form-group">
            <label for="status">Status</label>
            <div class="select-wrapper glass">
                <select id="status" formControlName="status">
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <optgroup label="Completed">
                        <option value="Repaired">Repaired</option>
                        <option value="Advice Given">Advice Given</option>
                        <option value="Partially Repaired">Partially Repaired</option>
                        <option value="Not Repaired">Not Repaired</option>
                    </optgroup>
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
              <!-- Hidden mobile camera input (capture="environment" works on mobile) -->
              <input type="file" #cameraInput (change)="onFileSelected($event)" accept="image/*" capture="environment" style="display:none">

              <!-- Take photo button — opens camera on mobile, webcam modal on desktop -->
              <button type="button" class="drop-zone" [class.disabled]="isUploading" [disabled]="isUploading" (click)="onTakePhotoClick()">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span class="drop-zone-label">Take a photo</span>
                <span class="drop-zone-hint">Opens your camera</span>
              </button>

              <!-- Library button — file picker for selecting existing images -->
              <input type="file" #libraryInput (change)="onFileSelected($event)" accept="image/*" multiple style="display: none">
              <button type="button" class="btn-camera" (click)="libraryInput.click()" [disabled]="isUploading">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Choose from library
              </button>

              <!-- Webcam modal (desktop only) -->
              <div class="webcam-modal" *ngIf="showWebcamModal">
                <div class="webcam-overlay" (click)="closeWebcam()"></div>
                <div class="webcam-container">
                  <p class="webcam-title">Take a photo</p>
                  <video #webcamVideo autoplay playsinline class="webcam-video"></video>
                  <canvas #webcamCanvas style="display:none"></canvas>
                  <div class="webcam-controls">
                    <button type="button" class="btn-capture" (click)="capturePhoto()">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      Capture
                    </button>
                    <button type="button" class="btn-cancel-webcam" (click)="closeWebcam()">Cancel</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Preview Grid -->
            <div class="photo-preview-grid" *ngIf="existingPhotos.length > 0 || selectedFiles.length > 0">
              <!-- Existing Photos -->
              <div class="photo-card" *ngFor="let photo of existingPhotos; let i = index">
                <img [src]="photo.url" alt="Repair photo">
                <div class="photo-type-toggle">
                  <button type="button" [class.active-before]="photo.type === 'before'" (click)="photo.type = 'before'">Before</button>
                  <button type="button" [class.active-after]="photo.type === 'after'" (click)="photo.type = 'after'">After</button>
                </div>
                <button type="button" class="btn-remove" (click)="removeExistingPhoto(i)" title="Remove photo" [disabled]="isUploading">×</button>
              </div>

              <!-- Newly Selected Photos -->
              <div class="photo-card" [class.pending]="file.status === 'ready'" [class.uploading]="file.status === 'uploading'" *ngFor="let file of selectedFiles; let i = index">
                <img [src]="file.preview" alt="Preview">
                <div class="photo-type-toggle">
                  <button type="button" [class.active-before]="file.type === 'before'" (click)="file.type = 'before'">Before</button>
                  <button type="button" [class.active-after]="file.type === 'after'" (click)="file.type = 'after'">After</button>
                </div>
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

          <!-- Additional Details button -->
          <div class="form-group">
            <button type="button" class="btn-additional-details" (click)="showAdditionalDetails = true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Additional Details
              <span class="details-badge" *ngIf="hasAdditionalDetails()">&#10003;</span>
            </button>
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

          <!-- Additional Details modal -->
          <div class="additional-details-modal" *ngIf="showAdditionalDetails">
            <div class="additional-details-overlay" (click)="closeAdditionalDetails()"></div>
            <div class="additional-details-panel">
              <div class="additional-details-header">
                <h3>Additional Details</h3>
                <button type="button" class="btn-close-panel" (click)="closeAdditionalDetails()">×</button>
              </div>
              <div class="additional-details-body">
                <div class="form-group">
                  <label>Make / Brand</label>
                  <input type="text" [(ngModel)]="additionalDetails.make" [ngModelOptions]="{standalone: true}" placeholder="e.g. Bosch, Samsung, Dyson">
                </div>
                <div class="form-group">
                  <label>Model</label>
                  <input type="text" [(ngModel)]="additionalDetails.model" [ngModelOptions]="{standalone: true}" placeholder="e.g. WAS28468GB">
                </div>
                <div class="form-group">
                  <label>Colour</label>
                  <input type="text" [(ngModel)]="additionalDetails.colour" [ngModelOptions]="{standalone: true}" placeholder="e.g. Black, White, Silver">
                </div>
                <div class="form-group">
                  <label>Serial Number</label>
                  <input type="text" [(ngModel)]="additionalDetails.serialNumber" [ngModelOptions]="{standalone: true}" placeholder="e.g. SN123456789">
                </div>
                <div class="form-group">
                  <label>Year of Manufacture</label>
                  <input type="text" [(ngModel)]="additionalDetails.yearOfManufacture" [ngModelOptions]="{standalone: true}" placeholder="e.g. 2018">
                </div>

                <!-- Saved repair videos -->
                <div class="form-group" *ngIf="additionalDetails.repairVideos && additionalDetails.repairVideos.length > 0">
                  <label>Saved Repair Videos</label>
                  <div class="saved-videos-list">
                    <div class="saved-video-row" *ngFor="let v of additionalDetails.repairVideos; let i = index">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="#ff0000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>
                      <a [href]="v.url" target="_blank" class="saved-video-title">{{ v.title }}</a>
                      <button type="button" class="btn-remove-video" (click)="removeRepairVideo(i)" title="Remove">×</button>
                    </div>
                  </div>
                </div>

                <!-- Find repair videos button -->
                <div class="form-group">
                  <button type="button" class="btn-find-videos" (click)="searchRepairVideos()">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#ff0000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>
                    Find Repair Videos on YouTube
                  </button>
                </div>
              </div>

              <!-- Video search results overlay -->
              <div class="video-search-overlay" *ngIf="showVideoSearch">
                <div class="video-search-header">
                  <div>
                    <p class="video-search-title">Repair Videos</p>
                    <p class="video-search-query">{{ videoSearchQuery }}</p>
                  </div>
                  <button type="button" class="btn-close-panel" (click)="showVideoSearch = false">×</button>
                </div>

                <div class="video-search-loading" *ngIf="videoSearchLoading">
                  <span class="spinner"></span> Searching YouTube...
                </div>

                <div class="video-search-error" *ngIf="videoSearchError">
                  {{ videoSearchError }}
                </div>

                <div class="video-results-grid" *ngIf="!videoSearchLoading && !videoSearchError">
                  <label class="video-card" *ngFor="let video of videoSearchResults">
                    <input type="checkbox" [(ngModel)]="video.selected" [ngModelOptions]="{standalone: true}" class="video-checkbox">
                    <div class="video-thumb-wrap">
                      <img [src]="video.thumbnail" alt="">
                      <div class="video-selected-overlay" *ngIf="video.selected">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    </div>
                    <div class="video-info">
                      <p class="video-title">{{ video.title }}</p>
                      <p class="video-channel">{{ video.channel }}</p>
                    </div>
                  </label>
                </div>

                <div class="video-search-footer" *ngIf="!videoSearchLoading && !videoSearchError">
                  <span class="selected-count" *ngIf="selectedVideoCount > 0">{{ selectedVideoCount }} selected</span>
                  <button type="button" class="btn-cancel" (click)="showVideoSearch = false">Cancel</button>
                  <button type="button" class="btn-submit" (click)="addSelectedVideos()" [disabled]="selectedVideoCount === 0">
                    Add Selected
                  </button>
                </div>
              </div>

              <div class="additional-details-footer">
                <button type="button" class="btn-cancel" (click)="closeAdditionalDetails()">Cancel</button>
                <button type="button" class="btn-submit" (click)="saveAdditionalDetails()" [disabled]="isSavingDetails">
                  <span class="spinner" *ngIf="isSavingDetails"></span>
                  {{ isSavingDetails ? 'Saving...' : (isEdit ? 'Save Details' : 'Apply') }}
                </button>
              </div>
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
      max-height: 300px;
      overflow-y: auto;
      border-radius: 12px;
      background: rgba(20, 20, 35, 0.95);
      backdrop-filter: blur(20px);
      border: 2px solid rgba(0, 242, 255, 0.3);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 242, 255, 0.1);
    }

    .clear-btn {
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: color 0.2s;
      z-index: 5;
    }

    .clear-btn:hover {
      color: var(--accent-color);
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
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.5rem 1rem;
      background: rgba(0, 242, 255, 0.05);
      border: 2px dashed rgba(0, 242, 255, 0.3);
      border-radius: 12px;
      color: var(--accent-color);
      cursor: pointer;
      transition: all 0.2s;
    }
    .drop-zone:hover:not(.disabled) {
      background: rgba(0, 242, 255, 0.1);
      border-color: var(--accent-color);
    }
    .drop-zone.disabled { opacity: 0.5; cursor: not-allowed; }
    .drop-zone-label {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .drop-zone-hint {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.4);
    }
    .btn-camera {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      justify-content: center;
      padding: 0.6rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .btn-camera:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .btn-camera:disabled { opacity: 0.5; cursor: not-allowed; }

    .webcam-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .webcam-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
    }
    .webcam-container {
      position: relative;
      background: #1a1a2e;
      border: 1px solid rgba(0, 242, 255, 0.3);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      max-width: 90vw;
    }
    .webcam-title {
      margin: 0;
      font-weight: 600;
      color: var(--accent-color);
    }
    .webcam-video {
      width: min(480px, 80vw);
      border-radius: 10px;
      background: #000;
    }
    .webcam-controls {
      display: flex;
      gap: 1rem;
    }
    .btn-capture {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.4rem;
      background: var(--accent-color);
      color: #000;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
    }
    .btn-capture:hover { filter: brightness(1.1); }
    .btn-cancel-webcam {
      padding: 0.7rem 1.2rem;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
    }
    .btn-cancel-webcam:hover { background: rgba(255,255,255,0.12); color: white; }

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
    .photo-type-toggle {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      z-index: 2;
    }
    .photo-type-toggle button {
      flex: 1;
      border: none;
      padding: 4px 0;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      background: rgba(0,0,0,0.55);
      color: rgba(255,255,255,0.45);
      transition: all 0.15s;
    }
    .photo-type-toggle button:hover { background: rgba(0,0,0,0.75); color: white; }
    .photo-type-toggle button.active-before {
      background: rgba(74,144,226,0.75);
      color: white;
    }
    .photo-type-toggle button.active-after {
      background: rgba(40,180,99,0.75);
      color: white;
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
    .btn-additional-details {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(0, 242, 255, 0.06);
      border: 1px dashed rgba(0, 242, 255, 0.35);
      border-radius: 10px;
      color: var(--accent-color);
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-additional-details:hover { background: rgba(0, 242, 255, 0.12); border-color: var(--accent-color); }
    .details-badge {
      background: var(--accent-color);
      color: #000;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .additional-details-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    @media (min-width: 600px) {
      .additional-details-modal { align-items: center; }
    }
    .additional-details-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
    }
    .additional-details-panel {
      position: relative;
      background: #12122a;
      border: 1px solid rgba(0, 242, 255, 0.25);
      border-radius: 20px 20px 0 0;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    @media (min-width: 600px) {
      .additional-details-panel { border-radius: 16px; }
    }
    .additional-details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.2rem 1.5rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .additional-details-header h3 { margin: 0; font-size: 1.1rem; color: var(--accent-color); }
    .btn-close-panel {
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0 0.2rem;
    }
    .btn-close-panel:hover { color: white; }
    .additional-details-body {
      padding: 1.2rem 1.5rem;
      overflow-y: auto;
      flex: 1;
    }
    .additional-details-footer {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .additional-details-footer .btn-cancel,
    .additional-details-footer .btn-submit { flex: 1; }

    /* Find repair videos */
    .btn-find-videos {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem 1rem;
      background: rgba(255, 0, 0, 0.08);
      border: 1px dashed rgba(255, 0, 0, 0.35);
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-find-videos:hover { background: rgba(255, 0, 0, 0.15); border-color: rgba(255, 0, 0, 0.6); }

    /* Saved videos list */
    .saved-videos-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .saved-video-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
    }
    .saved-video-title {
      flex: 1;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.75);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .saved-video-title:hover { color: var(--accent-color); }
    .btn-remove-video {
      background: none; border: none; color: rgba(255,255,255,0.35);
      cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0.2rem;
    }
    .btn-remove-video:hover { color: #ff4444; }

    /* Video search overlay — full panel replacement */
    .video-search-overlay {
      position: absolute;
      inset: 0;
      background: #12122a;
      border-radius: inherit;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .video-search-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1.2rem 1.5rem 0.8rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    .video-search-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--accent-color); }
    .video-search-query { margin: 0.2rem 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.4); }
    .video-search-loading {
      display: flex; align-items: center; justify-content: center;
      gap: 0.8rem; padding: 3rem; color: rgba(255,255,255,0.5);
    }
    .video-search-error {
      padding: 1.5rem; text-align: center; color: #ff4444; font-size: 0.9rem;
    }
    .video-results-grid {
      flex: 1;
      overflow-y: auto;
      padding: 0.8rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .video-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
      border: 1px solid transparent;
    }
    .video-card:hover { background: rgba(255,255,255,0.04); }
    .video-checkbox { display: none; }
    .video-card:has(.video-checkbox:checked) {
      background: rgba(0, 242, 255, 0.07);
      border-color: rgba(0, 242, 255, 0.3);
    }
    .video-thumb-wrap {
      position: relative;
      flex-shrink: 0;
      width: 120px;
      border-radius: 6px;
      overflow: hidden;
    }
    .video-thumb-wrap img { width: 100%; display: block; }
    .video-selected-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 242, 255, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .video-info { flex: 1; min-width: 0; }
    .video-title {
      margin: 0 0 0.3rem;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.85);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .video-channel { margin: 0; font-size: 0.75rem; color: rgba(255,255,255,0.4); }
    .video-search-footer {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 1.5rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    .video-search-footer .btn-cancel,
    .video-search-footer .btn-submit { flex: 1; }
    .selected-count { font-size: 0.8rem; color: var(--accent-color); white-space: nowrap; }
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
export class RepairFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private repairService = inject(RepairService);
  private http = inject(HttpClient);

  @ViewChild('cameraInput') cameraInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('webcamVideo') webcamVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('webcamCanvas') webcamCanvasRef!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected appVersion = APP_VERSION;

  private normalizeRCDay(storedValue: string): string {
    if (!storedValue) return storedValue;

    // Check if it already matches a value in our list exactly
    if (this.availableDates.some(d => d.value === storedValue)) {
      return storedValue;
    }

    // Try to normalize by components (Day, Month, Year)
    // Format is "DayName, DD, MM, YYYY"
    const parts = storedValue.split(',').map(p => p.trim());
    if (parts.length < 4) return storedValue;

    const storedDay = parseInt(parts[1], 10);
    const storedMonth = parseInt(parts[2], 10);
    const storedYear = parseInt(parts[3], 10);

    // Look for a Saturday in the same month/year that is within 1 day of the stored date
    const match = this.availableDates.find(d => {
      return d.date.getUTCMonth() + 1 === storedMonth &&
        d.date.getUTCFullYear() === storedYear &&
        Math.abs(d.date.getUTCDate() - storedDay) <= 1;
    });

    if (match) {
      return match.value;
    }

    return storedValue;
  }

  repairForm: FormGroup;
  isEdit = false;
  editItemId: string | null = null;
  isUploading = false;
  uploadError: string | null = null;

  selectedFiles: PhotoFile[] = [];
  existingPhotos: RepairPhoto[] = [];
  showWebcamModal = false;
  private videoStream: MediaStream | null = null;

  showAdditionalDetails = false;
  isSavingDetails = false;
  additionalDetails: {
    make: string;
    model: string;
    colour: string;
    serialNumber: string;
    yearOfManufacture: string;
    repairVideos: { url: string; title: string }[];
  } = {
    make: '',
    model: '',
    colour: '',
    serialNumber: '',
    yearOfManufacture: '',
    repairVideos: []
  };

  showVideoSearch = false;
  videoSearchLoading = false;
  videoSearchError = '';
  videoSearchQuery = '';
  videoSearchResults: VideoResult[] = [];
  tags: string[] = [];
  allAvailableTags: Tag[] = [];
  filteredSuggestions: Tag[] = [];
  showSuggestions = false;

  availableDates: { label: string, value: string, date: Date }[] = [];

  owners: Owner[] = [];
  filteredOwners: Owner[] = [];
  showOwnerSuggestions = false;

  allRepairers: any[] = [];
  allPrimaryRepairers: any[] = [];
  filteredRepairers: any[] = [];
  showRepairerSuggestions = false;

  secondaryRepairers: string[] = [];
  filteredSecondaryRepairers: any[] = [];
  showSecondaryRepairerSuggestions = false;

  constructor() {
    this.generateAvailableDates();

    // Calculate default RCDay (next upcoming date)
    const today = new Date();
    // Normalize today to start of day in UTC for comparison against availableDates
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const nextDate = this.availableDates.find(d => d.date >= todayUTC);
    const defaultValue = nextDate ? nextDate.value : (this.availableDates.length > 0 ? this.availableDates[this.availableDates.length - 1].value : '');

    this.repairForm = this.fb.group({
      displayNumber: [''],
      itemDescription: ['', Validators.required],
      telephone: [''],
      owner: [''],
      repairer: [''],
      status: ['New'],
      RCDay: [defaultValue, Validators.required]
    });



    // Track every change to RCDay
    this.repairForm.get('RCDay')?.valueChanges.subscribe(val => {
      if (val === '' || val === null || val === undefined) {
        if (!this.isUploading) {
          this.repairForm.patchValue({ RCDay: defaultValue }, { emitEvent: false });
        }
        return;
      }

      // FUTURE ENFORCEMENT for NEW repairs
      if (!this.isEdit && !this.isUploading) {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const selectedDateObj = this.availableDates.find(d => d.value === val);

        if (selectedDateObj && selectedDateObj.date < todayUTC) {
          this.repairForm.patchValue({ RCDay: defaultValue }, { emitEvent: false });
        } else {
          // Refresh suggested number for this date
          this.repairService.getSuggestedDisplayNumber(val).then(num => {
            this.repairForm.patchValue({ displayNumber: num }, { emitEvent: false });
          });
        }
      }
    });

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
    this.availableDates = this.repairService.getAvailableRCDates();
  }

  async ngOnInit() {
    // Load all available tags for autocomplete
    this.repairService.getAllTags().then(tags => {
      this.allAvailableTags = tags;
    });

    this.repairService.getOwners().subscribe(owners => {
      this.owners = owners;
    });

    this.repairService.getRepairers().subscribe((repairers: any[]) => {
      this.allRepairers = repairers;
    });

    this.repairService.getPrimaryRepairers().subscribe((repairers: any[]) => {
      this.allPrimaryRepairers = repairers;
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.editItemId = id;

      this.repairService.getRepairItems().subscribe(items => {
        const item = items.find(i => i.id === id);
        if (item) {
          const updates: any = {
            displayNumber: item.displayNumber,
            itemDescription: item.itemDescription,
            telephone: item.telephone || '',
            owner: item.owner || '',
            repairer: item.repairer || '',
            status: item.status || 'New'
          };

          if (item.RCDay && item.RCDay.trim() !== '') {
            const normalized = this.normalizeRCDay(item.RCDay);

            // FUTURE PREFERENCE: If we are editing an old item with a PAST session date,
            // DO NOT patch the date field. Let it keep the defaultValue (the next upcoming session).
            const today = new Date();
            const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            const normalizedObj = this.availableDates.find(d => d.value === normalized);

            if (normalizedObj && normalizedObj.date < todayUTC) {
              // We don't add to 'updates' so it retains existing defaultValue from constructor
            } else {
              updates.RCDay = normalized;
            }
          } else {
            // No RCDay provided by database.
          }

          this.repairForm.patchValue(updates);
          this.existingPhotos = (item.photos || []).map(toRepairPhoto);
          this.tags = item.tags || [];
          this.secondaryRepairers = item.additionalRepairers || [];
          this.additionalDetails = {
            make: item.make || '',
            model: item.model || '',
            colour: item.colour || '',
            serialNumber: item.serialNumber || '',
            yearOfManufacture: item.yearOfManufacture || '',
            repairVideos: item.repairVideos || []
          };
        }
      });
    } else {
      try {
        const currentRCDay = this.repairForm.get('RCDay')?.value;
        const suggestion = await this.repairService.getSuggestedDisplayNumber(currentRCDay);
        this.repairForm.patchValue({ displayNumber: suggestion });

        // SECOND-PASS SAFETY: Repatch defaultValue after a short delay 
        // to ensure no browser autocomplete or late sync clobbered it.
        setTimeout(() => {
          const currentVal = this.repairForm.get('RCDay')?.value;
          const today = new Date();
          const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
          const currentSelectedObj = this.availableDates.find(d => d.value === currentVal);

          if (!currentVal || currentVal === '' || (currentSelectedObj && currentSelectedObj.date < todayUTC)) {
            const nextDate = this.availableDates.find(d => d.date >= todayUTC);
            const fallback = nextDate ? nextDate.value : (this.availableDates.length > 0 ? this.availableDates[this.availableDates.length - 1].value : '');
            this.repairForm.patchValue({ RCDay: fallback });
          }
        }, 500);
      } catch (err) {
        console.error('Failed to get suggested number:', err);
      }
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files as FileList;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      // Reset input so the same file(s) can be re-selected later
      event.target.value = '';

      const readPromises = newFiles.map(file => new Promise<PhotoFile>(resolve => {
        const reader = new FileReader();
        reader.onload = (e: any) => resolve({ file, preview: e.target.result, status: 'ready', type: 'before' });
        reader.readAsDataURL(file);
      }));

      Promise.all(readPromises).then(loaded => {
        this.selectedFiles = [...this.selectedFiles, ...loaded];
      });
    }
  }

  removeSelectedFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  removeExistingPhoto(index: number) {
    this.existingPhotos.splice(index, 1);
  }

  onTakePhotoClick() {
    if (this.isUploading) return;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      this.cameraInputRef.nativeElement.click();
    } else {
      this.openWebcam();
    }
  }

  async openWebcam() {
    this.showWebcamModal = true;
    // Wait one tick for Angular to render the video element
    setTimeout(async () => {
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.webcamVideoRef.nativeElement.srcObject = this.videoStream;
      } catch {
        this.showWebcamModal = false;
        // Fall back to file picker if camera access is denied
        this.cameraInputRef.nativeElement.click();
      }
    }, 50);
  }

  capturePhoto() {
    const video = this.webcamVideoRef.nativeElement;
    const canvas = this.webcamCanvasRef.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedFiles = [...this.selectedFiles, { file, preview: e.target.result, status: 'ready', type: 'before' }];
        };
        reader.readAsDataURL(file);
      }
      this.closeWebcam();
    }, 'image/jpeg', 0.92);
  }

  closeWebcam() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    this.showWebcamModal = false;
  }

  ngOnDestroy() {
    this.closeWebcam();
  }

  hasAdditionalDetails(): boolean {
    return !!(this.additionalDetails.make || this.additionalDetails.model ||
              this.additionalDetails.colour || this.additionalDetails.serialNumber ||
              this.additionalDetails.yearOfManufacture ||
              this.additionalDetails.repairVideos?.length);
  }

  get selectedVideoCount(): number {
    return this.videoSearchResults.filter(v => v.selected).length;
  }

  async searchRepairVideos() {
    const description = this.repairForm.get('itemDescription')?.value || '';
    const parts = [
      description,
      this.additionalDetails.make,
      this.additionalDetails.model,
      this.additionalDetails.colour,
      this.additionalDetails.yearOfManufacture
    ].filter(p => p?.trim()).join(' ');

    this.videoSearchQuery = `${parts} repair`;
    this.showVideoSearch = true;
    this.videoSearchLoading = true;
    this.videoSearchError = '';
    this.videoSearchResults = [];

    try {
      const response = await firstValueFrom(
        this.http.get<any>('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: this.videoSearchQuery,
            type: 'video',
            maxResults: '12',
            key: environment.youtubeApiKey
          }
        })
      );
      this.videoSearchResults = (response.items || []).map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        selected: false
      }));
    } catch (err: any) {
      const apiMsg = err?.error?.error?.message;
      const status = err?.status;
      if (status === 403) {
        this.videoSearchError = `YouTube API access denied (403)${apiMsg ? ': ' + apiMsg : ''}. Make sure the YouTube Data API v3 is enabled in Google Cloud Console and the API key has no referrer restrictions blocking this site.`;
      } else if (status === 400) {
        this.videoSearchError = `Bad request (400)${apiMsg ? ': ' + apiMsg : ''}. Check the API key is correct.`;
      } else if (apiMsg) {
        this.videoSearchError = `YouTube API error: ${apiMsg}`;
      } else {
        this.videoSearchError = `Search failed (${status || 'network error'}). Open browser DevTools → Network tab for details.`;
      }
      console.error('YouTube search error:', err);
    } finally {
      this.videoSearchLoading = false;
    }
  }

  addSelectedVideos() {
    const newVideos = this.videoSearchResults
      .filter(v => v.selected)
      .map(v => ({ url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title }));

    const existing = this.additionalDetails.repairVideos || [];
    const existingUrls = new Set(existing.map(v => v.url));
    const toAdd = newVideos.filter(v => !existingUrls.has(v.url));
    this.additionalDetails.repairVideos = [...existing, ...toAdd];
    this.showVideoSearch = false;
  }

  removeRepairVideo(index: number) {
    this.additionalDetails.repairVideos.splice(index, 1);
  }

  closeAdditionalDetails() {
    this.showAdditionalDetails = false;
  }

  async saveAdditionalDetails() {
    if (this.isEdit && this.editItemId) {
      this.isSavingDetails = true;
      try {
        await this.repairService.updateRepairItem(this.editItemId, { ...this.additionalDetails });
      } finally {
        this.isSavingDetails = false;
      }
    }
    this.showAdditionalDetails = false;
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
    const term = (value || '').toLowerCase();
    this.filteredOwners = this.owners.filter(o =>
      !term || o.name.toLowerCase().includes(term)
    );
    this.showOwnerSuggestions = true;
  }

  selectOwner(owner: Owner) {
    this.repairForm.patchValue({ owner: owner.name });
    this.filteredOwners = [];
    this.showOwnerSuggestions = false;
  }

  clearOwner() {
    this.repairForm.patchValue({ owner: '' });
    this.filteredOwners = [];
    this.showOwnerSuggestions = false;
  }

  hideOwnerSuggestions() {
    setTimeout(() => {
      this.showOwnerSuggestions = false;
    }, 200);
  }

  onRepairerSearch(value: string) {
    const term = (value || '').toLowerCase();
    this.filteredRepairers = this.allPrimaryRepairers.filter(r =>
      !term || r.name.toLowerCase().includes(term)
    );
    this.showRepairerSuggestions = true;
  }

  selectRepairer(repairer: any) {
    this.repairForm.patchValue({ repairer: repairer.name });
    this.filteredRepairers = [];
    this.showRepairerSuggestions = false;
  }

  clearRepairer() {
    this.repairForm.patchValue({ repairer: '' });
    this.filteredRepairers = [];
    this.showRepairerSuggestions = false;
  }

  hideRepairerSuggestions() {
    setTimeout(() => {
      this.showRepairerSuggestions = false;
    }, 200);
  }

  onSecondaryRepairerSearch(value: string) {
    const term = (value || '').toLowerCase();
    const primaryRepairer = this.repairForm.get('repairer')?.value || '';
    this.filteredSecondaryRepairers = this.allRepairers.filter(r =>
      (!term || r.name.toLowerCase().includes(term)) &&
      !this.secondaryRepairers.includes(r.name) &&
      r.name !== primaryRepairer
    );
    this.showSecondaryRepairerSuggestions = true;
  }

  addSecondaryRepairer(repairer: any, input: HTMLInputElement) {
    if (!this.secondaryRepairers.includes(repairer.name)) {
      this.secondaryRepairers.push(repairer.name);
    }
    input.value = '';
    this.filteredSecondaryRepairers = [];
    this.showSecondaryRepairerSuggestions = false;
  }

  removeSecondaryRepairer(index: number) {
    this.secondaryRepairers.splice(index, 1);
  }

  hideSecondaryRepairerSuggestions() {
    setTimeout(() => {
      this.showSecondaryRepairerSuggestions = false;
    }, 200);
  }

  async onSubmit() {
    if (this.repairForm.valid && !this.isUploading) {
      this.isUploading = true;
      this.uploadError = null;

      try {
        const uploadPromises = this.selectedFiles.map(async (photoFile): Promise<RepairPhoto> => {
          try {
            photoFile.status = 'uploading';
            const url = await this.repairService.uploadPhoto(photoFile.file);
            photoFile.status = 'success';
            return { url, type: photoFile.type };
          } catch (err) {
            photoFile.status = 'error';
            photoFile.errorMessage = (err as any).message || 'Upload failed';
            throw err;
          }
        });

        const newPhotos = await Promise.all(uploadPromises);
        const allPhotos: RepairPhoto[] = [...this.existingPhotos, ...newPhotos];

        const itemData = {
          ...this.repairForm.value,
          photos: allPhotos,
          tags: this.tags,
          additionalRepairers: this.secondaryRepairers,
          ...this.additionalDetails
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
