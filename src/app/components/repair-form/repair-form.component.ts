import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, HostListener } from '@angular/core';
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

interface ImageResult {
  url: string;
  thumbnail: string;
  title: string;
  width: number;
  height: number;
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

          <!-- ── SESSION ── -->
          <div class="form-section">
            <button type="button" class="section-hdr" (click)="toggleSection('session')">
              <span class="section-hdr-left"><span class="section-ico">📅</span><span class="section-lbl">Session</span></span>
              <span class="section-chevron" [class.open]="sectionsOpen.session">▼</span>
            </button>
            <div class="section-body" *ngIf="sectionsOpen.session">

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

              <div class="form-group">
                <label for="itemNumber">Sequence Number (Suggested)</label>
                <input id="itemNumber" type="text" formControlName="displayNumber" placeholder="e.g., 1">
                <small class="hint">Leave as is or override. The system will auto-assign if left blank.</small>
              </div>

            </div>
          </div>

          <!-- ── ITEM ── -->
          <div class="form-section">
            <button type="button" class="section-hdr" (click)="toggleSection('item')">
              <span class="section-hdr-left"><span class="section-ico">🔧</span><span class="section-lbl">Item</span></span>
              <span class="section-chevron" [class.open]="sectionsOpen.item">▼</span>
            </button>
            <div class="section-body" *ngIf="sectionsOpen.item">

              <div class="form-group">
                <label>Category</label>
                <div class="category-picker">
                  <button *ngFor="let cat of categories" type="button"
                    class="cat-btn"
                    [class.selected]="repairForm.get('category')?.value === cat.value"
                    (click)="selectCategory(cat.value)"
                    [title]="cat.label">
                    <span class="cat-emoji">{{ cat.emoji }}</span>
                    <span class="cat-label">{{ cat.label }}</span>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="itemDescription">Description <span class="required">*</span></label>
                <textarea id="itemDescription" formControlName="itemDescription" placeholder="What needs fixing? (e.g. Lamp with frayed cord)"></textarea>
                <div *ngIf="repairForm.get('itemDescription')?.touched && repairForm.get('itemDescription')?.invalid" class="error">
                  Please enter a description of the item.
                </div>
              </div>

              <div class="form-group">
                <label for="fault">Fault</label>
                <textarea id="fault" formControlName="fault" placeholder="Describe the fault (e.g. Does not power on)"></textarea>
              </div>

              <div class="form-group">
                <label for="ageOfItem">Age of Item</label>
                <select id="ageOfItem" formControlName="ageOfItem">
                  <option value="">-- Select age --</option>
                  <option value="<1">&lt;1 year</option>
                  <option value="1-2">1–2 years</option>
                  <option value="3-5">3–5 years</option>
                  <option value="6-10">6–10 years</option>
                  <option value="11+">11+ years</option>
                </select>
              </div>

              <!-- Item Details Grid -->
              <div class="item-details-grid">
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
                  <label>Year of Manufacture</label>
                  <input type="text" [(ngModel)]="additionalDetails.yearOfManufacture" [ngModelOptions]="{standalone: true}" placeholder="e.g. 2018">
                </div>
                <div class="form-group item-details-full">
                  <label>Serial Number</label>
                  <input type="text" [(ngModel)]="additionalDetails.serialNumber" [ngModelOptions]="{standalone: true}" placeholder="e.g. SN123456789">
                </div>
              </div>

              <!-- Photos -->
              <div class="form-group">
                <label>Photos</label>
                <div class="photo-upload-zone">
                  <input type="file" #cameraInput (change)="onFileSelected($event)" accept="image/*" capture="environment" style="display:none">
                  <button type="button" class="drop-zone" [class.disabled]="isUploading" [disabled]="isUploading" (click)="onTakePhotoClick()">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <span class="drop-zone-label">Take a photo</span>
                    <span class="drop-zone-hint">Opens your camera</span>
                  </button>
                  <input type="file" #libraryInput (change)="onFileSelected($event)" accept="image/*" multiple style="display: none">
                  <button type="button" class="btn-camera" (click)="libraryInput.click()" [disabled]="isUploading">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    Choose from library
                  </button>
                  <button type="button" class="btn-camera btn-web-search" (click)="showImageSearch = !showImageSearch" [disabled]="isUploading">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    Search internet for photos
                  </button>

                  <div class="img-search-panel" *ngIf="showImageSearch">
                    <div class="yt-search-row">
                      <input type="text" [(ngModel)]="imageSearchQuery" [ngModelOptions]="{standalone: true}"
                             placeholder="e.g. broken lamp cord" class="yt-query-input"
                             (ngModelChange)="onImageQueryEdit()" (keyup.enter)="searchImages()">
                      <button type="button" class="btn-yt-search" (click)="searchImages()"
                              [disabled]="!imageSearchQuery.trim() || imageSearchLoading">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        {{ imageSearchLoading ? 'Searching...' : 'Search' }}
                      </button>
                    </div>
                    <div class="yt-loading" *ngIf="imageSearchLoading"><span class="yt-spinner"></span> Searching for images...</div>
                    <div class="yt-error" *ngIf="imageSearchError && !imageSearchLoading">{{ imageSearchError }}</div>
                    <div class="img-results-grid" *ngIf="!imageSearchLoading && imageSearchResults.length > 0">
                      <div class="img-card" *ngFor="let img of imageSearchResults" (click)="addSingleImage(img)" title="Click to add">
                        <div class="img-thumb">
                          <img [src]="img.thumbnail" [alt]="img.title" (error)="img.thumbnail = img.url">
                          <div class="yt-add-hint">+ Add</div>
                        </div>
                        <p class="yt-card-title">{{ img.title }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Webcam modal -->
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

                <div class="photo-preview-grid" *ngIf="existingPhotos.length > 0 || selectedFiles.length > 0">
                  <div class="photo-card" *ngFor="let photo of existingPhotos; let i = index" (dblclick)="openLightbox(photo.url)">
                    <img [src]="photo.url" alt="Repair photo">
                    <button type="button" class="btn-remove" (click)="removeExistingPhoto(i)" title="Remove photo" [disabled]="isUploading">×</button>
                  </div>
                  <div class="photo-card" [class.pending]="file.status === 'ready'" [class.uploading]="file.status === 'uploading'"
                       *ngFor="let file of selectedFiles; let i = index" (dblclick)="openLightbox(file.preview)">
                    <img [src]="file.preview" alt="Preview">
                    <div class="status-overlay" [ngClass]="file.status">
                      <span *ngIf="file.status === 'ready'">Ready</span>
                      <span *ngIf="file.status === 'uploading'">Uploading...</span>
                      <span *ngIf="file.status === 'error'">Error!</span>
                    </div>
                    <button type="button" class="btn-remove" (click)="removeSelectedFile(i)" title="Remove photo" *ngIf="file.status !== 'uploading'">×</button>
                  </div>
                </div>
                <div *ngIf="uploadError" class="error-banner">{{ uploadError }}</div>
              </div>

              <!-- Repair Videos -->
              <div class="form-group yt-section">
                <label>Find Repair Videos</label>
                <div class="yt-search-row">
                  <input type="text" [(ngModel)]="youtubeSearchQuery" [ngModelOptions]="{standalone: true}"
                         placeholder="e.g. lamp wiring repair" class="yt-query-input" (ngModelChange)="onYoutubeQueryEdit()">
                  <button type="button" class="btn-yt-search" (click)="searchRepairVideos()"
                          [disabled]="!youtubeSearchQuery.trim() || videoSearchLoading">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="#ff0000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>
                    {{ videoSearchLoading ? 'Searching...' : 'Search YouTube' }}
                  </button>
                </div>
                <div class="yt-loading" *ngIf="videoSearchLoading"><span class="yt-spinner"></span> Searching YouTube...</div>
                <div class="yt-error" *ngIf="videoSearchError && !videoSearchLoading">{{ videoSearchError }}</div>
                <div class="yt-results-grid" *ngIf="!videoSearchLoading && videoSearchResults.length > 0">
                  <div class="yt-card" *ngFor="let video of videoSearchResults" (click)="addSingleVideo(video)" title="Click to add">
                    <div class="yt-thumb"><img [src]="video.thumbnail" alt=""><div class="yt-add-hint">+ Add</div></div>
                    <p class="yt-card-title">{{ video.title }}</p>
                  </div>
                </div>
                <div class="yt-saved-list" *ngIf="additionalDetails.repairVideos && additionalDetails.repairVideos.length > 0">
                  <p class="yt-saved-label">Saved videos</p>
                  <div class="saved-video-row" *ngFor="let v of additionalDetails.repairVideos; let i = index">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="#ff0000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/></svg>
                    <a [href]="v.url" target="_blank" class="saved-video-title">{{ v.title }}</a>
                    <button type="button" class="btn-remove-video" (click)="removeRepairVideo(i)" title="Remove">×</button>
                  </div>
                </div>
              </div>

              <!-- Tags -->
              <div class="form-group">
                <label>Tags (Optional)</label>
                <div class="tag-input-wrapper">
                  <div class="autocomplete-container">
                    <input type="text" #tagInput (input)="onTagSearch(tagInput.value)"
                           (keyup.enter)="addTag(tagInput)" (blur)="hideSuggestions()"
                           placeholder="Enter a tag (e.g. Electrical) and press Enter">
                    <div class="suggestions-list glass" *ngIf="filteredSuggestions.length > 0 && showSuggestions">
                      <div class="suggestion-item" *ngFor="let tag of filteredSuggestions"
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

            </div>
          </div>

          <!-- ── VISITOR ── -->
          <div class="form-section">
            <button type="button" class="section-hdr" (click)="toggleSection('visitor')">
              <span class="section-hdr-left"><span class="section-ico">👤</span><span class="section-lbl">Visitor</span></span>
              <span class="section-chevron" [class.open]="sectionsOpen.visitor">▼</span>
            </button>
            <div class="section-body" *ngIf="sectionsOpen.visitor">

              <div class="form-group">
                <label for="owner">Visitor Name</label>
                <div class="autocomplete-container">
                  <input id="owner" type="text" formControlName="owner"
                         placeholder="Who brought this item?"
                         (input)="onOwnerSearch($any($event.target).value)"
                         (focus)="onOwnerSearch($any($event.target).value)"
                         (blur)="hideOwnerSuggestions()" autocomplete="off">
                  <button type="button" class="clear-btn" *ngIf="repairForm.get('owner')?.value"
                          (click)="clearOwner()" title="Clear visitor">×</button>
                  <div class="suggestions-list glass" *ngIf="filteredOwners.length > 0 && showOwnerSuggestions">
                    <div class="suggestion-item" *ngFor="let owner of filteredOwners" (mousedown)="selectOwner(owner)">
                      <span class="suggestion-name">{{ owner.name }}</span>
                      <span class="version" style="margin-left: auto">{{ owner.firstSeen?.toDate() | date:'shortDate' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label for="telephone">Telephone Number</label>
                <input id="telephone" type="tel" formControlName="telephone" placeholder="e.g. 07700 900000">
              </div>

            </div>
          </div>

          <!-- ── REPAIRER ── -->
          <div class="form-section">
            <button type="button" class="section-hdr" (click)="toggleSection('repairer')">
              <span class="section-hdr-left"><span class="section-ico">🛠️</span><span class="section-lbl">Repairer</span></span>
              <span class="section-chevron" [class.open]="sectionsOpen.repairer">▼</span>
            </button>
            <div class="section-body" *ngIf="sectionsOpen.repairer">

              <div class="form-group">
                <label for="repairer">Primary Repairer</label>
                <div class="autocomplete-container">
                  <input id="repairer" type="text" formControlName="repairer"
                         placeholder="Who is the lead repairer?"
                         (input)="onRepairerSearch($any($event.target).value)"
                         (focus)="onRepairerSearch($any($event.target).value)"
                         (blur)="hideRepairerSuggestions()" autocomplete="off">
                  <button type="button" class="clear-btn" *ngIf="repairForm.get('repairer')?.value"
                          (click)="clearRepairer()" title="Clear repairer">×</button>
                  <div class="suggestions-list glass" *ngIf="filteredRepairers.length > 0 && showRepairerSuggestions">
                    <div class="suggestion-item" *ngFor="let repairer of filteredRepairers"
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
                <label>Supporting Repairers</label>
                <div class="autocomplete-container">
                  <input type="text" #secondaryInput
                         (input)="onSecondaryRepairerSearch(secondaryInput.value)"
                         (focus)="onSecondaryRepairerSearch(secondaryInput.value)"
                         (blur)="hideSecondaryRepairerSuggestions()"
                         placeholder="Add supporting repairers..." autocomplete="off">
                  <div class="suggestions-list glass" *ngIf="filteredSecondaryRepairers.length > 0 && showSecondaryRepairerSuggestions">
                    <div class="suggestion-item" *ngFor="let repairer of filteredSecondaryRepairers"
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

            </div>
          </div>

          <!-- ── OUTCOME ── -->
          <div class="form-section">
            <button type="button" class="section-hdr" (click)="toggleSection('outcome')">
              <span class="section-hdr-left"><span class="section-ico">✅</span><span class="section-lbl">Outcome</span></span>
              <span class="section-chevron" [class.open]="sectionsOpen.outcome">▼</span>
            </button>
            <div class="section-body" *ngIf="sectionsOpen.outcome">

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

              <p class="outcome-hint" *ngIf="isEdit && editItemId">
                Use the <strong>Complete</strong> button below to record satisfaction and donation details.
              </p>

            </div>
          </div>

          <!-- Actions -->
          <div class="form-actions-wrapper">
            <div class="validation-hint" *ngIf="repairForm.get('itemDescription')?.invalid && (repairForm.get('itemDescription')?.touched || selectedFiles.length > 0)">
              ⚠️ Please enter a description to enable saving.
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="onCancel()" [disabled]="isUploading">Cancel</button>
              <button *ngIf="isEdit && editItemId" type="button" class="btn-complete-item" (click)="goToComplete()" [disabled]="isUploading">
                ✓ Complete
              </button>
              <button type="submit" *ngIf="!isEdit || hasChanges" [disabled]="repairForm.invalid || isUploading" class="btn-submit">
                <span class="spinner" *ngIf="isUploading"></span>
                {{ isUploading ? 'Saving Repair...' : (isEdit ? 'Save Changes' : 'Register Repair') }}
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Photo lightbox -->
      <div class="lightbox-overlay" *ngIf="lightboxPhotos.length" (click)="closeLightbox()">
        <button class="lightbox-close" (click)="closeLightbox()">✕</button>
        <button class="lightbox-nav lightbox-prev" *ngIf="lightboxPhotos.length > 1"
                [disabled]="lightboxIndex === 0"
                (click)="$event.stopPropagation(); lightboxPrev()">&#8249;</button>
        <img [src]="lightboxUrl" class="lightbox-img" (click)="$event.stopPropagation()">
        <button class="lightbox-nav lightbox-next" *ngIf="lightboxPhotos.length > 1"
                [disabled]="lightboxIndex === lightboxPhotos.length - 1"
                (click)="$event.stopPropagation(); lightboxNext()">&#8250;</button>
        <div class="lightbox-counter" *ngIf="lightboxPhotos.length > 1">
          {{ lightboxIndex + 1 }} / {{ lightboxPhotos.length }}
        </div>
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
      .form-page { padding: 0.5rem; }
      .form-container { padding: 1.5rem; border-radius: 12px; }
      h2 { font-size: 1.4rem; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    h2 { margin: 0; font-size: 1.8rem; color: var(--accent-color); display: flex; align-items: baseline; gap: 0.8rem; }
    .version { font-size: 0.6rem; opacity: 0.3; font-weight: 300; }
    .btn-close {
      background: none; border: none; color: var(--text-color);
      font-size: 2rem; cursor: pointer; opacity: 0.5; transition: opacity 0.2s;
    }
    .btn-close:hover:not(:disabled) { opacity: 1; }

    /* ── Section accordion ── */
    .form-section {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      margin-bottom: 0.75rem;
      overflow: visible;
    }
    .section-hdr {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      padding: 0.85rem 1.2rem;
      background: rgba(255,255,255,0.04);
      border: none; cursor: pointer; color: white; text-align: left;
      transition: background 0.2s; border-radius: 12px;
    }
    .section-hdr:hover { background: rgba(255,255,255,0.08); }
    .section-hdr-left { display: flex; align-items: center; gap: 0.65rem; }
    .section-ico { font-size: 1.1rem; line-height: 1; }
    .section-lbl { font-weight: 600; font-size: 1rem; color: rgba(255,255,255,0.9); letter-spacing: 0.01em; }
    .section-chevron {
      font-size: 0.65rem; color: rgba(255,255,255,0.35);
      transition: transform 0.25s ease; display: inline-block;
      transform: rotate(-90deg);
    }
    .section-chevron.open { transform: rotate(0deg); }
    .section-body {
      padding: 1.25rem 1.25rem 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .section-body .form-group:last-child { margin-bottom: 0; }

    .form-group { margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
    .required { color: #ff4444; margin-left: 2px; }
    .hint { display: block; font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); margin-top: 0.3rem; }
    .outcome-hint {
      font-size: 0.82rem; color: rgba(255,255,255,0.4);
      margin: 0; padding: 0.6rem 0.8rem;
      background: rgba(255,255,255,0.03); border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.07);
    }
    .outcome-hint strong { color: rgba(255,255,255,0.65); }

    .category-picker { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .cat-btn {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; padding: 0.5rem 0.6rem; cursor: pointer;
      transition: all 0.15s; color: white; min-width: 58px;
    }
    .cat-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); transform: translateY(-1px); }
    .cat-btn.selected { background: rgba(0,242,255,0.15); border-color: var(--accent-color); box-shadow: 0 0 8px rgba(0,242,255,0.2); }
    .cat-emoji { font-size: 1.5rem; line-height: 1; }
    .cat-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.75; white-space: nowrap; }

    input, textarea {
      width: 100%; padding: 0.8rem 1rem;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; color: white; font-size: 1rem; transition: all 0.2s;
    }
    textarea { height: 100px; resize: vertical; }
    input:focus, textarea:focus {
      outline: none; border-color: var(--primary-color);
      background: rgba(255,255,255,0.08); box-shadow: 0 0 15px rgba(99,102,241,0.2);
    }

    .select-wrapper { position: relative; border-radius: 10px; overflow: hidden; }
    select {
      width: 100%; padding: 0.8rem 1rem;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; color: white; font-size: 1rem;
      appearance: none; cursor: pointer; transition: all 0.2s;
    }
    select:focus { outline: none; border-color: var(--primary-color); background: rgba(255,255,255,0.08); }
    select option { background: #1a1a2e; color: white; padding: 1rem; }
    .select-arrow {
      position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: rgba(255,255,255,0.5); font-size: 0.8rem;
    }

    .autocomplete-container { position: relative; flex: 1; }
    .suggestions-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
      margin-top: 0.5rem; max-height: 300px; overflow-y: auto;
      border-radius: 12px; background: rgba(20,20,35,0.95);
      backdrop-filter: blur(20px); border: 2px solid rgba(0,242,255,0.3);
      box-shadow: 0 15px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,242,255,0.1);
    }
    .clear-btn {
      position: absolute; right: 15px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: rgba(255,255,255,0.5);
      font-size: 1.2rem; cursor: pointer; padding: 5px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1; transition: color 0.2s; z-index: 5;
    }
    .clear-btn:hover { color: var(--accent-color); }
    .suggestion-item {
      padding: 1rem 1.2rem; cursor: pointer; font-size: 0.95rem;
      color: rgba(255,255,255,0.9); transition: all 0.2s;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex; align-items: center; gap: 0.8rem;
    }
    .suggestion-emoji { font-size: 1.2rem; }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:hover { background: rgba(0,242,255,0.15); color: var(--accent-color); padding-left: 1.5rem; }

    .tag-input-wrapper { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; }
    .btn-add-tag {
      padding: 0 1.5rem; background: var(--primary-color);
      border: none; border-radius: 10px; color: white;
      font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-add-tag:hover { background: var(--accent-color); transform: translateY(-1px); }
    .tag-chips { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 0.5rem; }
    .tag-chip {
      background: rgba(0,242,255,0.1); border: 1px solid var(--accent-color);
      color: var(--accent-color); padding: 0.4rem 0.8rem;
      border-radius: 20px; font-size: 0.85rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .btn-remove-tag { background: none; border: none; color: var(--accent-color); font-size: 1.2rem; line-height: 1; cursor: pointer; padding: 0; opacity: 0.6; }
    .btn-remove-tag:hover { opacity: 1; }

    .photo-upload-zone { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .drop-zone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 1.5rem 1rem;
      background: rgba(0,242,255,0.05); border: 2px dashed rgba(0,242,255,0.3);
      border-radius: 12px; color: var(--accent-color); cursor: pointer; transition: all 0.2s;
    }
    .drop-zone:hover:not(.disabled) { background: rgba(0,242,255,0.1); border-color: var(--accent-color); }
    .drop-zone.disabled { opacity: 0.5; cursor: not-allowed; }
    .drop-zone-label { font-weight: 600; font-size: 0.95rem; }
    .drop-zone-hint { font-size: 0.78rem; color: rgba(255,255,255,0.4); }
    .btn-camera {
      display: flex; align-items: center; gap: 0.6rem; justify-content: center;
      padding: 0.6rem 1rem; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      color: rgba(255,255,255,0.6); cursor: pointer; font-size: 0.85rem; transition: all 0.2s;
    }
    .btn-camera:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: white; }
    .btn-camera:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-web-search { border-color: rgba(0,242,255,0.2); color: rgba(0,242,255,0.7); }
    .btn-web-search:hover:not(:disabled) { background: rgba(0,242,255,0.08); border-color: rgba(0,242,255,0.4); color: var(--accent-color); }

    .webcam-modal { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .webcam-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.75); }
    .webcam-container {
      position: relative; background: #1a1a2e; border: 1px solid rgba(0,242,255,0.3);
      border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column;
      align-items: center; gap: 1rem; max-width: 90vw;
    }
    .webcam-title { margin: 0; font-weight: 600; color: var(--accent-color); }
    .webcam-video { width: min(480px, 80vw); border-radius: 10px; background: #000; }
    .webcam-controls { display: flex; gap: 1rem; }
    .btn-capture {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.4rem;
      background: var(--accent-color); color: #000; border: none;
      border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.95rem;
    }
    .btn-capture:hover { filter: brightness(1.1); }
    .btn-cancel-webcam {
      padding: 0.7rem 1.2rem; background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; cursor: pointer; font-size: 0.95rem;
    }
    .btn-cancel-webcam:hover { background: rgba(255,255,255,0.12); color: white; }

    .photo-preview-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 1rem; margin-top: 1rem;
    }
    .photo-card { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); cursor: zoom-in; }
    .photo-card img { width: 100%; height: 100%; object-fit: cover; }
    .status-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; color: white; font-weight: 600; backdrop-filter: blur(2px);
    }
    .status-overlay.ready { background: rgba(0,0,0,0.3); }
    .status-overlay.uploading { background: rgba(0,242,255,0.4); }
    .status-overlay.error { background: rgba(255,68,68,0.6); }
    .btn-remove {
      position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
      border-radius: 50%; background: rgba(255,68,68,0.8); border: none;
      color: white; display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; transition: transform 0.2s; z-index: 10;
    }
    .btn-remove:hover:not(:disabled) { transform: scale(1.1); background: #ff4444; }
    .btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-banner {
      margin-top: 1rem; padding: 0.8rem;
      background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.2);
      border-radius: 8px; color: #ff4444; font-size: 0.9rem;
    }

    /* YouTube */
    .yt-section label { display: block; margin-bottom: 0.5rem; }
    .yt-search-row { display: flex; gap: 0.5rem; align-items: stretch; }
    .yt-query-input {
      flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; color: white; padding: 0.6rem 0.8rem; font-size: 0.9rem; outline: none;
    }
    .yt-query-input:focus { border-color: rgba(255,60,60,0.5); }
    .btn-yt-search {
      display: flex; align-items: center; gap: 0.4rem;
      background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.35);
      border-radius: 8px; color: white; padding: 0.6rem 1rem;
      font-size: 0.85rem; cursor: pointer; white-space: nowrap; transition: all 0.2s;
    }
    .btn-yt-search:hover:not(:disabled) { background: rgba(255,0,0,0.25); border-color: rgba(255,0,0,0.6); }
    .btn-yt-search:disabled { opacity: 0.4; cursor: not-allowed; }
    .yt-loading { display: flex; align-items: center; gap: 0.5rem; color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.75rem; }
    .yt-spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #ff3333;
      border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; flex-shrink: 0;
    }
    .yt-error {
      margin-top: 0.75rem; padding: 0.6rem 0.8rem;
      background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.3);
      border-radius: 8px; color: #ff9090; font-size: 0.8rem; line-height: 1.4;
    }
    .yt-results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.75rem; }
    @media (max-width: 520px) { .yt-results-grid { grid-template-columns: repeat(2, 1fr); } }
    .yt-card {
      cursor: pointer; border-radius: 8px; overflow: hidden;
      background: rgba(255,255,255,0.04); border: 2px solid transparent;
      transition: border-color 0.15s, transform 0.15s; display: block;
    }
    .yt-card:hover { border-color: rgba(255,60,60,0.5); transform: translateY(-2px); }
    .yt-thumb { position: relative; aspect-ratio: 16/9; overflow: hidden; }
    .yt-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .yt-add-hint {
      position: absolute; inset: 0; background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 700; color: white; letter-spacing: 0.05em;
      opacity: 0; transition: opacity 0.15s;
    }
    .yt-card:hover .yt-add-hint { opacity: 1; }
    .yt-card-title {
      margin: 0; padding: 0.35rem 0.4rem; font-size: 0.72rem; line-height: 1.3;
      color: rgba(255,255,255,0.8);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .yt-saved-list { margin-top: 0.75rem; }
    .yt-saved-label { margin: 0 0 0.4rem; font-size: 0.75rem; color: rgba(255,255,255,0.4); }
    .saved-video-row {
      display: flex; align-items: center; gap: 0.5rem;
      background: rgba(255,255,255,0.04); border-radius: 6px; padding: 0.4rem 0.6rem; margin-bottom: 0.25rem;
    }
    .saved-video-title { flex: 1; font-size: 0.82rem; color: rgba(255,255,255,0.75); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .saved-video-title:hover { color: var(--accent-color); }
    .btn-remove-video { background: none; border: none; color: rgba(255,255,255,0.35); cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0.2rem; }
    .btn-remove-video:hover { color: #ff4444; }

    /* Image search */
    .img-search-panel { margin-top: 0.5rem; padding: 0.75rem; background: rgba(0,242,255,0.03); border: 1px solid rgba(0,242,255,0.12); border-radius: 10px; }
    .img-results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.75rem; }
    @media (max-width: 520px) { .img-results-grid { grid-template-columns: repeat(2, 1fr); } }
    .img-card { cursor: pointer; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.04); border: 2px solid transparent; transition: border-color 0.15s, transform 0.15s; display: block; }
    .img-card:hover { border-color: rgba(0,242,255,0.5); transform: translateY(-2px); }
    .img-card:hover .yt-add-hint { opacity: 1; }
    .img-thumb { position: relative; aspect-ratio: 4/3; overflow: hidden; background: rgba(255,255,255,0.05); }
    .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* Item details grid */
    .item-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
    .item-details-full { grid-column: 1 / -1; }
    @media (max-width: 480px) { .item-details-grid { grid-template-columns: 1fr; } .item-details-full { grid-column: 1; } }

    /* Actions */
    .form-actions-wrapper { margin-top: 1.5rem; }
    .validation-hint { text-align: center; margin-bottom: 1rem; color: #ffaa00; font-size: 0.9rem; font-weight: 600; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .form-actions { display: flex; gap: 1rem; }
    @media (max-width: 600px) { .form-actions { flex-direction: column-reverse; } .btn-cancel, .btn-submit { width: 100%; padding: 1rem; justify-content: center; } }
    .btn-submit, .btn-cancel {
      flex: 1; padding: 1rem; border-radius: 12px; font-weight: 600; cursor: pointer;
      transition: all 0.2s; border: none; display: flex; align-items: center; justify-content: center; gap: 0.8rem;
    }
    .btn-submit { background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: white; }
    .btn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,242,255,0.3); }
    .btn-submit:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }
    .btn-complete-item {
      flex: 1; padding: 1rem; border-radius: 12px; font-weight: 600; cursor: pointer;
      transition: all 0.2s; border: 1px solid rgba(40,180,99,0.5); background: rgba(40,180,99,0.12); color: #58d68d;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .btn-complete-item:hover:not(:disabled) { background: rgba(40,180,99,0.25); border-color: #58d68d; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(40,180,99,0.25); }
    .btn-complete-item:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-cancel { background: rgba(255,255,255,0.1); color: var(--text-color); }
    .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
    .error { color: #ff4444; font-size: 0.85rem; margin-top: 0.4rem; }
    .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Lightbox */
    .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
    .lightbox-img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,0.8); cursor: default; }
    .lightbox-close { position: fixed; top: 1.5rem; right: 1.5rem; background: transparent; border: none; color: rgba(255,255,255,0.7); font-size: 1.5rem; cursor: pointer; padding: 4px 8px; transition: color 0.2s; z-index: 10000; }
    .lightbox-close:hover { color: white; }
    .lightbox-nav { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 2.5rem; line-height: 1; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0; transition: background 0.2s; z-index: 10000; }
    .lightbox-nav:hover:not(:disabled) { background: rgba(0,242,255,0.2); border-color: var(--accent-color); }
    .lightbox-nav:disabled { opacity: 0.2; cursor: default; }
    .lightbox-counter { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); font-size: 0.85rem; color: rgba(255,255,255,0.5); }
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

  sectionsOpen = { session: true, item: true, visitor: true, repairer: true, outcome: true };

  toggleSection(section: string) {
    (this.sectionsOpen as any)[section] = !(this.sectionsOpen as any)[section];
  }

  private normalizeRCDay(storedValue: string): string {
    if (!storedValue) return storedValue;
    if (this.availableDates.some(d => d.value === storedValue)) return storedValue;
    const parts = storedValue.split(',').map(p => p.trim());
    if (parts.length < 4) return storedValue;
    const storedDay = parseInt(parts[1], 10);
    const storedMonth = parseInt(parts[2], 10);
    const storedYear = parseInt(parts[3], 10);
    const match = this.availableDates.find(d =>
      d.date.getUTCMonth() + 1 === storedMonth &&
      d.date.getUTCFullYear() === storedYear &&
      Math.abs(d.date.getUTCDate() - storedDay) <= 1
    );
    return match ? match.value : storedValue;
  }

  repairForm: FormGroup;
  isEdit = false;
  editItemId: string | null = null;
  isUploading = false;
  uploadError: string | null = null;

  selectedFiles: PhotoFile[] = [];
  existingPhotos: RepairPhoto[] = [];
  showWebcamModal = false;
  lightboxPhotos: string[] = [];
  lightboxIndex = 0;
  get lightboxUrl(): string | null { return this.lightboxPhotos[this.lightboxIndex] ?? null; }

  openLightbox(startUrl: string) {
    this.lightboxPhotos = [...this.existingPhotos.map(p => p.url), ...this.selectedFiles.map(f => f.preview)];
    const idx = this.lightboxPhotos.indexOf(startUrl);
    this.lightboxIndex = idx >= 0 ? idx : 0;
  }
  closeLightbox() { this.lightboxPhotos = []; }
  lightboxPrev() { if (this.lightboxIndex > 0) this.lightboxIndex--; }
  lightboxNext() { if (this.lightboxIndex < this.lightboxPhotos.length - 1) this.lightboxIndex++; }

  @HostListener('document:keydown', ['$event'])
  onLightboxKey(e: KeyboardEvent) {
    if (!this.lightboxPhotos.length) return;
    if (e.key === 'ArrowLeft')  { this.lightboxPrev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.lightboxNext(); e.preventDefault(); }
    if (e.key === 'Escape')     { this.closeLightbox(); }
  }

  private videoStream: MediaStream | null = null;
  private originalSnapshot = '';

  get hasChanges(): boolean {
    if (!this.isEdit) return true;
    return this.getSnapshot() !== this.originalSnapshot;
  }

  private getSnapshot(): string {
    return JSON.stringify({
      form: this.repairForm.value,
      make: this.additionalDetails.make,
      model: this.additionalDetails.model,
      colour: this.additionalDetails.colour,
      serialNumber: this.additionalDetails.serialNumber,
      yearOfManufacture: this.additionalDetails.yearOfManufacture,
      repairVideos: this.additionalDetails.repairVideos,
      tags: this.tags,
      secondaryRepairers: this.secondaryRepairers,
      newPhotos: this.selectedFiles.length,
      existingPhotoTypes: this.existingPhotos.map(p => p.type)
    });
  }

  showAdditionalDetails = false;
  isSavingDetails = false;
  additionalDetails: {
    make: string; model: string; colour: string;
    serialNumber: string; yearOfManufacture: string;
    repairVideos: { url: string; title: string }[];
  } = { make: '', model: '', colour: '', serialNumber: '', yearOfManufacture: '', repairVideos: [] };

  showVideoSearch = false;
  videoSearchLoading = false;
  videoSearchError = '';
  videoSearchQuery = '';
  videoSearchResults: VideoResult[] = [];
  youtubeSearchQuery = '';
  private lastAutoQuery = '';

  showImageSearch = false;
  imageSearchLoading = false;
  imageSearchError = '';
  imageSearchQuery = '';
  imageSearchResults: ImageResult[] = [];
  private lastAutoImageQuery = '';

  tags: string[] = [];
  allAvailableTags: Tag[] = [];
  filteredSuggestions: Tag[] = [];
  showSuggestions = false;

  availableDates: { label: string, value: string, date: Date }[] = [];

  categories = [
    { value: 'electrical',  emoji: '⚡', label: 'Electrical' },
    { value: 'textile',     emoji: '🧵', label: 'Textile' },
    { value: 'ornament',    emoji: '🪆', label: 'Ornament' },
    { value: 'mechanical',  emoji: '⚙️', label: 'Mechanical' },
    { value: 'furniture',   emoji: '🪑', label: 'Furniture' },
    { value: 'toy',         emoji: '🧸', label: 'Toy' },
    { value: 'clock',       emoji: '🕐', label: 'Clock' },
    { value: 'jewelry',     emoji: '💍', label: 'Jewelry' },
    { value: 'other',       emoji: '❓', label: 'Other' },
  ];

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

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const nextDate = this.availableDates.find(d => d.date >= todayUTC);
    const defaultValue = nextDate ? nextDate.value : (this.availableDates.length > 0 ? this.availableDates[this.availableDates.length - 1].value : '');

    this.repairForm = this.fb.group({
      displayNumber: [''],
      category: [''],
      itemDescription: ['', Validators.required],
      fault: [''],
      ageOfItem: [''],
      telephone: [''],
      owner: [''],
      repairer: [''],
      status: ['New'],
      RCDay: [defaultValue, Validators.required]
    });

    this.repairForm.get('RCDay')?.valueChanges.subscribe(val => {
      if (val === '' || val === null || val === undefined) {
        if (!this.isUploading) {
          this.repairForm.patchValue({ RCDay: defaultValue }, { emitEvent: false });
        }
        return;
      }
      if (!this.isUploading) {
        this.repairService.getSuggestedDisplayNumber(val).then(num => {
          this.repairForm.patchValue({ displayNumber: num }, { emitEvent: false });
        });
      }
    });

    this.repairForm.get('repairer')?.valueChanges.subscribe(repairer => {
      const currentStatus = this.repairForm.get('status')?.value;
      if (repairer && currentStatus === 'New') {
        this.repairForm.patchValue({ status: 'Assigned' }, { emitEvent: false });
      } else if (!repairer && currentStatus === 'Assigned') {
        this.repairForm.patchValue({ status: 'New' }, { emitEvent: false });
      }
    });

    const buildYoutubeQuery = () => {
      const desc = this.repairForm.get('itemDescription')?.value?.trim() || '';
      const fault = this.repairForm.get('fault')?.value?.trim() || '';
      return [desc, fault].filter(Boolean).join(' ');
    };

    this.repairForm.get('itemDescription')?.valueChanges.subscribe(desc => {
      const autoQuery = buildYoutubeQuery();
      if (this.youtubeSearchQuery === '' || this.youtubeSearchQuery === this.lastAutoQuery) {
        this.youtubeSearchQuery = autoQuery;
        this.lastAutoQuery = autoQuery;
      }
      if (this.imageSearchQuery === '' || this.imageSearchQuery === this.lastAutoImageQuery) {
        this.imageSearchQuery = desc?.trim() || '';
        this.lastAutoImageQuery = desc?.trim() || '';
      }
    });

    this.repairForm.get('fault')?.valueChanges.subscribe(() => {
      const autoQuery = buildYoutubeQuery();
      if (this.youtubeSearchQuery === '' || this.youtubeSearchQuery === this.lastAutoQuery) {
        this.youtubeSearchQuery = autoQuery;
        this.lastAutoQuery = autoQuery;
      }
    });
  }

  generateAvailableDates() {
    this.availableDates = this.repairService.getAvailableRCDates();
  }

  async ngOnInit() {
    this.repairService.getAllTags().then(tags => { this.allAvailableTags = tags; });
    this.repairService.getOwners().subscribe(owners => { this.owners = owners; });
    this.repairService.getRepairers().subscribe((repairers: any[]) => { this.allRepairers = repairers; });
    this.repairService.getPrimaryRepairers().subscribe((repairers: any[]) => { this.allPrimaryRepairers = repairers; });

    if (this.route.snapshot.queryParamMap.get('additional') === '1') {
      this.showAdditionalDetails = true;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.editItemId = id;

      this.repairService.getRepairItems().subscribe(items => {
        const item = items.find(i => i.id === id);
        if (item) {
          const updates: any = {
            displayNumber: item.displayNumber,
            category: item.category || '',
            itemDescription: item.itemDescription,
            fault: item.fault || '',
            ageOfItem: item.ageOfItem || '',
            telephone: item.telephone || '',
            owner: item.owner || '',
            repairer: item.repairer || '',
            status: item.status || 'New'
          };
          if (item.RCDay && item.RCDay.trim() !== '') {
            updates.RCDay = this.normalizeRCDay(item.RCDay);
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
          setTimeout(() => { this.originalSnapshot = this.getSnapshot(); }, 0);
        }
      });
    } else {
      try {
        const currentRCDay = this.repairForm.get('RCDay')?.value;
        const suggestion = await this.repairService.getSuggestedDisplayNumber(currentRCDay);
        this.repairForm.patchValue({ displayNumber: suggestion });
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
      event.target.value = '';
      const readPromises = newFiles.map(file => new Promise<PhotoFile>(resolve => {
        const reader = new FileReader();
        reader.onload = (e: any) => resolve({ file, preview: e.target.result, status: 'ready', type: 'before' });
        reader.readAsDataURL(file);
      }));
      Promise.all(readPromises).then(loaded => { this.selectedFiles = [...this.selectedFiles, ...loaded]; });
    }
  }

  removeSelectedFile(index: number) { this.selectedFiles.splice(index, 1); }
  removeExistingPhoto(index: number) { this.existingPhotos.splice(index, 1); }

  onTakePhotoClick() {
    if (this.isUploading) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) { this.cameraInputRef.nativeElement.click(); } else { this.openWebcam(); }
  }

  async openWebcam() {
    this.showWebcamModal = true;
    setTimeout(async () => {
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        this.webcamVideoRef.nativeElement.srcObject = this.videoStream;
      } catch {
        this.showWebcamModal = false;
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
        reader.onload = (e: any) => { this.selectedFiles = [...this.selectedFiles, { file, preview: e.target.result, status: 'ready', type: 'before' }]; };
        reader.readAsDataURL(file);
      }
      this.closeWebcam();
    }, 'image/jpeg', 0.92);
  }

  closeWebcam() {
    if (this.videoStream) { this.videoStream.getTracks().forEach(t => t.stop()); this.videoStream = null; }
    this.showWebcamModal = false;
  }

  ngOnDestroy() { this.closeWebcam(); }

  hasAdditionalDetails(): boolean {
    return !!(this.additionalDetails.make || this.additionalDetails.model ||
              this.additionalDetails.colour || this.additionalDetails.serialNumber ||
              this.additionalDetails.yearOfManufacture || this.additionalDetails.repairVideos?.length);
  }

  async searchRepairVideos() {
    if (!this.youtubeSearchQuery.trim()) return;
    this.videoSearchLoading = true;
    this.videoSearchError = '';
    this.videoSearchResults = [];
    try {
      const response = await firstValueFrom(
        this.http.get<any>('https://www.googleapis.com/youtube/v3/search', {
          params: { part: 'snippet', q: this.youtubeSearchQuery, type: 'video', maxResults: '12', key: environment.youtubeApiKey }
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
        this.videoSearchError = `YouTube API access denied (403)${apiMsg ? ': ' + apiMsg : ''}.`;
      } else if (status === 400) {
        this.videoSearchError = `Bad request (400)${apiMsg ? ': ' + apiMsg : ''}.`;
      } else if (apiMsg) {
        this.videoSearchError = `YouTube API error: ${apiMsg}`;
      } else {
        this.videoSearchError = `Search failed (${status || 'network error'}).`;
      }
    } finally {
      this.videoSearchLoading = false;
    }
  }

  addSingleVideo(video: VideoResult) {
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    const existing = this.additionalDetails.repairVideos || [];
    if (!existing.some(v => v.url === url)) {
      this.additionalDetails.repairVideos = [...existing, { url, title: video.title }];
    }
    this.videoSearchResults = this.videoSearchResults.filter(v => v.id !== video.id);
  }

  onYoutubeQueryEdit() { this.lastAutoQuery = ''; }
  removeRepairVideo(index: number) { this.additionalDetails.repairVideos.splice(index, 1); }
  onImageQueryEdit() { this.lastAutoImageQuery = ''; }

  async searchImages() {
    if (!this.imageSearchQuery.trim()) return;
    this.imageSearchLoading = true;
    this.imageSearchError = '';
    this.imageSearchResults = [];
    if (!environment.pixabayApiKey) {
      this.imageSearchError = 'Image search is not configured.';
      this.imageSearchLoading = false;
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<any>('https://pixabay.com/api/', {
          params: { key: environment.pixabayApiKey, q: this.imageSearchQuery, image_type: 'photo', safesearch: 'true', per_page: '18', min_width: '200' }
        })
      );
      this.imageSearchResults = (response.hits || []).map((hit: any) => ({
        url: hit.largeImageURL || hit.webformatURL,
        thumbnail: hit.previewURL || hit.webformatURL,
        title: hit.tags, width: hit.imageWidth || 0, height: hit.imageHeight || 0, selected: false
      }));
      if (this.imageSearchResults.length === 0) {
        this.imageSearchError = 'No images found. Try a different search term.';
      }
    } catch (err: any) {
      const status = err?.status;
      this.imageSearchError = status === 400 ? 'Invalid API key or request.' : `Search failed (${status || 'network error'}).`;
    } finally {
      this.imageSearchLoading = false;
    }
  }

  addSingleImage(img: ImageResult) {
    if (!this.existingPhotos.some(p => p.url === img.url)) {
      this.existingPhotos = [...this.existingPhotos, { url: img.url, type: 'before' }];
    }
    this.imageSearchResults = this.imageSearchResults.filter(i => i.url !== img.url);
  }

  closeAdditionalDetails() { this.showAdditionalDetails = false; }

  async saveAdditionalDetails() {
    if (this.isEdit && this.editItemId) {
      this.isSavingDetails = true;
      try { await this.repairService.updateRepairItem(this.editItemId, { ...this.additionalDetails }); }
      finally { this.isSavingDetails = false; }
    }
    this.showAdditionalDetails = false;
  }

  addTag(input: HTMLInputElement) {
    const value = input.value.trim();
    if (value && !this.tags.includes(value)) {
      this.tags.push(value);
      if (!this.allAvailableTags.find(t => t.name === value)) {
        const emoji = this.repairService.getEmojiForTag(value);
        this.allAvailableTags.push({ name: value, emoji });
        this.allAvailableTags.sort((a, b) => a.name.localeCompare(b.name));
      }
      input.value = '';
    }
  }

  removeTag(index: number) { this.tags.splice(index, 1); }

  onTagSearch(value: string) {
    if (!value.trim()) { this.filteredSuggestions = []; this.showSuggestions = false; return; }
    const term = value.toLowerCase();
    this.filteredSuggestions = this.allAvailableTags.filter(tag => tag.name.toLowerCase().includes(term) && !this.tags.includes(tag.name));
    this.showSuggestions = this.filteredSuggestions.length > 0;
  }

  selectSuggestion(tag: Tag, input: HTMLInputElement) {
    if (!this.tags.includes(tag.name)) this.tags.push(tag.name);
    input.value = '';
    this.filteredSuggestions = [];
    this.showSuggestions = false;
  }

  hideSuggestions() { setTimeout(() => { this.showSuggestions = false; }, 200); }

  onOwnerSearch(value: string) {
    const term = (value || '').toLowerCase();
    this.filteredOwners = this.owners.filter(o => !term || o.name.toLowerCase().includes(term));
    this.showOwnerSuggestions = true;
  }

  selectOwner(owner: Owner) {
    this.repairForm.patchValue({ owner: owner.name });
    this.filteredOwners = [];
    this.showOwnerSuggestions = false;
  }

  clearOwner() { this.repairForm.patchValue({ owner: '' }); this.filteredOwners = []; this.showOwnerSuggestions = false; }
  hideOwnerSuggestions() { setTimeout(() => { this.showOwnerSuggestions = false; }, 200); }

  onRepairerSearch(value: string) {
    const term = (value || '').toLowerCase();
    this.filteredRepairers = this.allPrimaryRepairers.filter(r => !term || r.name.toLowerCase().includes(term));
    this.showRepairerSuggestions = true;
  }

  selectRepairer(repairer: any) {
    this.repairForm.patchValue({ repairer: repairer.name });
    this.filteredRepairers = [];
    this.showRepairerSuggestions = false;
  }

  clearRepairer() { this.repairForm.patchValue({ repairer: '' }); this.filteredRepairers = []; this.showRepairerSuggestions = false; }
  hideRepairerSuggestions() { setTimeout(() => { this.showRepairerSuggestions = false; }, 200); }

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
    if (!this.secondaryRepairers.includes(repairer.name)) this.secondaryRepairers.push(repairer.name);
    input.value = '';
    this.filteredSecondaryRepairers = [];
    this.showSecondaryRepairerSuggestions = false;
  }

  removeSecondaryRepairer(index: number) { this.secondaryRepairers.splice(index, 1); }
  hideSecondaryRepairerSuggestions() { setTimeout(() => { this.showSecondaryRepairerSuggestions = false; }, 200); }

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
          this.selectedFiles = this.selectedFiles.filter(f => f.status !== 'success');
          this.originalSnapshot = this.getSnapshot();
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

  selectCategory(value: string) {
    const current = this.repairForm.get('category')?.value;
    this.repairForm.patchValue({ category: current === value ? '' : value });
  }

  onCancel() {
    if (!this.isUploading) { this.repairService.setEditItem(null); this.router.navigate(['/']); }
  }

  goToComplete() {
    if (this.editItemId) { this.router.navigate(['/complete', this.editItemId]); }
  }
}
