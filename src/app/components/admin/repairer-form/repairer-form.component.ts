import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Repairer } from '../../../models/repairer.model';
import { RepairService } from '../../../services/repair.service';
import { AvatarService } from '../../../services/avatar.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-repairer-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay-backdrop" (click)="close()">
      <div class="overlay-content glass" (click)="$event.stopPropagation()">
        <header>
          <h2>{{ repairer?.id ? 'Edit Repairer' : 'Add Repairer' }}</h2>
          <button class="btn-close" (click)="close()">×</button>
        </header>

        <div class="form-group">
          <!-- Avatar Section -->
          <div class="avatar-section">
            <div class="avatar-preview" [style.backgroundImage]="'url(' + (photoPreview || photoUrl || 'assets/placeholder-avatar.png') + ')'">
              <div class="overlay" (click)="isEmojiMode ? null : fileInput.click()">
                <span>{{ isEmojiMode ? '😊' : '📷' }}</span>
              </div>
            </div>

            <div class="mode-toggles">
                <button class="btn-toggle" [class.active]="!isEmojiMode && !isSearchMode" (click)="toggleMode('photo')">Upload Image</button>
                <button class="btn-toggle" [class.active]="isSearchMode" (click)="toggleMode('search')">Search Internet</button>
                <button class="btn-toggle" [class.active]="isEmojiMode" (click)="toggleMode('emoji')">Choose Emoji</button>
            </div>

            <div class="search-section" *ngIf="isSearchMode">
                <div class="search-bar">
                    <input type="text" [(ngModel)]="searchQuery" (keyup.enter)="onAvatarSearch()" placeholder="Search (e.g. technician)...">
                    <button class="btn-search" (click)="onAvatarSearch()" [disabled]="isSearching">
                        {{ isSearching ? '...' : '🔍' }}
                    </button>
                </div>
                <div class="search-grid custom-scrollbar" *ngIf="searchResults.length > 0">
                    <div 
                        *ngFor="let result of searchResults" 
                        class="search-item" 
                        [style.backgroundImage]="'url(' + result + ')'"
                        (click)="selectInternetAvatar(result)">
                    </div>
                </div>
                <div class="no-results" *ngIf="searchResults.length === 0 && !isSearching && searchQuery">
                    No avatars found.
                </div>
            </div>

            <div class="emoji-grid custom-scrollbar" *ngIf="isEmojiMode">
                <button 
                    *ngFor="let emoji of availableEmojis" 
                    class="emoji-btn" 
                    (click)="selectEmoji(emoji)">
                    {{ emoji }}
                </button>
            </div>

            <input #fileInput type="file" (change)="onFileSelected($event)" accept="image/*" hidden>
            
            <div class="avatar-actions" *ngIf="!isEmojiMode && !isSearchMode">
              <button class="btn-text" (click)="fileInput.click()">Upload New Photo</button>
              <button *ngIf="photoPreview || photoUrl" class="btn-text text-danger" (click)="removePhoto()">Remove Photo</button>
            </div>
          </div>

          <label for="repairerName">Name</label>
          <input
            type="text"
            id="repairerName"
            [(ngModel)]="name"
            placeholder="Enter repairer name"
            autofocus>

          <div class="primary-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                [(ngModel)]="canBePrimary"
                class="toggle-checkbox">
              <span class="toggle-text">Can be Primary Repairer</span>
            </label>
            <small class="toggle-hint">Primary repairers lead repairs and have secondary repairers reporting to them.</small>
          </div>
        </div>

        <footer>
          <button class="btn-delete" *ngIf="repairer?.id" (click)="delete()">Delete</button>
          <div class="actions">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button class="btn-save" (click)="save()" [disabled]="!name.trim() || isUploading">{{ isUploading ? 'Saving...' : 'Save' }}</button>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .overlay-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .overlay-content {
      width: 100%;
      max-width: 400px;
      background: #1a1a2e;
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
      color: white;
    }

    .btn-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 2rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .form-group {
      margin-bottom: 2rem;
      overflow-y: auto;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
    }

    input[type="text"] {
      width: 100%;
      padding: 0.8rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: white;
      font-size: 1rem;
    }

    input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-left: auto;
    }

    button {
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-delete {
      background: rgba(255, 77, 77, 0.1);
      color: #ff4d4d;
    }
    .btn-delete:hover {
      background: rgba(255, 77, 77, 0.2);
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.7);
    }
    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-save {
      background: var(--accent-color);
      color: #000;
      font-weight: 600;
    }
    .btn-save:hover {
      opacity: 0.9;
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .text-danger {
      color: #ff4d4d !important;
    }
    .text-danger:hover {
      background: rgba(255, 77, 77, 0.1) !important;
    }

    /* Avatar Styles */
    .avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .avatar-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      background-color: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      position: relative;
      overflow: hidden;
      cursor: pointer;
    }

    .avatar-preview .overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .avatar-preview:hover .overlay {
      opacity: 1;
    }

    .avatar-actions {
      display: flex;
      gap: 1rem;
    }

    .btn-text {
      background: none;
      border: none;
      color: var(--accent-color);
      font-size: 0.9rem;
      cursor: pointer;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }
    
    .btn-text:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .mode-toggles {
        display: flex;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 4px;
        gap: 4px;
        width: 100%;
    }
    
    .btn-toggle {
        flex: 1;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        padding: 0.5rem;
        font-size: 0.85rem;
        border: none;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
    }
    .btn-toggle.active {
        background: var(--accent-color);
        color: black;
        font-weight: 600;
    }

    .search-section {
        margin: 1rem 0;
    }

    .search-bar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .search-bar input {
        flex: 1;
        padding: 0.6rem;
        background: rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
    }

    .btn-search {
        padding: 0 1rem;
        background: rgba(255,255,255,0.1);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
    }

    .search-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
        max-height: 200px;
        overflow-y: auto;
        padding-right: 5px;
    }

    .search-item {
        aspect-ratio: 1;
        background-size: cover;
        background-position: center;
        border-radius: 4px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.2s;
    }

    .search-item:hover {
        transform: scale(1.05);
        border-color: var(--accent-color);
    }

    .no-results {
        text-align: center;
        color: rgba(255,255,255,0.4);
        font-size: 0.9rem;
        padding: 1rem;
    }
    
    .emoji-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 0.5rem;
        max-height: 150px;
        overflow-y: auto;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        width: 100%;
    }
    
    .emoji-btn {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        padding: 0.5rem;
        cursor: pointer;
        border-radius: 6px;
        transition: transform 0.1s;
    }
    .emoji-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.2);
    }

    .primary-toggle {
        margin-top: 1.5rem;
    }

    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.9);
        font-size: 1rem;
    }

    .toggle-checkbox {
        width: 18px;
        height: 18px;
        accent-color: var(--accent-color);
        cursor: pointer;
    }

    .toggle-text {
        font-weight: 500;
    }

    .toggle-hint {
        display: block;
        margin-top: 0.4rem;
        margin-left: 26px;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
    }
  `]
})
export class RepairerFormComponent {
  private repairService = inject(RepairService);
  private avatarService = inject(AvatarService);

  @Input() repairer: Repairer | null = null;
  @Output() closeEvent = new EventEmitter<void>();
  @Output() saveEvent = new EventEmitter<{ id?: string, name: string, photoUrl?: string, canBePrimary?: boolean }>();
  @Output() deleteEvent = new EventEmitter<string>();

  name = '';
  canBePrimary = false;
  photoUrl: string | null = null;
  photoPreview: string | null = null;
  selectedFile: File | null = null;
  isUploading = false;
  isEmojiMode = false;
  isSearchMode = false;
  isSearching = false;
  searchQuery = '';
  searchResults: string[] = [];

  availableEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😝', '😜',
    '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔',
    '🦊', '🐱', '🦁', '🐶', '🐵', '🐻', '🐨', '🐼', '🐹', '🐰', '🐯', '🐮',
    '🐷', '🐸', '🐙', '🦄', '🐝', '🐞', '🦋', '🦉', '🐢', '🦖', '🐳', '🦈',
    '🔨', '🔧', '🪛', '🔩', '⚙️', '🧶', '🧵', '💡', '🔋', '🔌', '💻', '📷'
  ];

  ngOnChanges() {
    if (this.repairer) {
      this.name = this.repairer.name;
      this.canBePrimary = this.repairer.canBePrimary || false;
      this.photoUrl = this.repairer.photoUrl || null;
      this.photoPreview = null;
    } else {
      this.name = '';
      this.canBePrimary = false;
      this.photoUrl = null;
      this.photoPreview = null;
    }
    this.selectedFile = null;
    this.isEmojiMode = false;
    this.isSearchMode = false;
    this.searchResults = [];
    this.searchQuery = this.name || '';
  }

  close() {
    this.closeEvent.emit();
  }

  toggleMode(mode: 'photo' | 'emoji' | 'search') {
    this.isEmojiMode = mode === 'emoji';
    this.isSearchMode = mode === 'search';
    if (mode === 'photo' && !this.photoPreview) {
      // Clear preview if switching back to upload
    }
  }

  selectEmoji(emoji: string) {
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <style>text { font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; }</style>
        <text y='.9em' font-size='90'>${emoji}</text>
      </svg>`;

    // We encode URI component to handle special characters, then unescape to get bytes, then btoa
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    const dataUri = `data:image/svg+xml;base64,${base64}`;

    this.photoPreview = dataUri;
    this.selectedFile = null; // Clear any file
    // We don't clear photoUrl immediately because we want to fallback to it if preview is cleared,
    // but preview overrides in the template display.
  }

  onAvatarSearch() {
    if (!this.searchQuery.trim()) return;
    this.isSearching = true;
    this.avatarService.searchAvatars(this.searchQuery).subscribe({
      next: (results: string[]) => {
        this.searchResults = results;
        this.isSearching = false;
      },
      error: (err: any) => {
        console.error('Avatar search failed:', err);
        this.isSearching = false;
      }
    });
  }

  async selectInternetAvatar(url: string) {
    this.isUploading = true;
    try {
      const storedUrl = await this.repairService.downloadAndUploadPhoto(url);
      this.photoUrl = storedUrl;
      this.photoPreview = storedUrl;
      this.isSearchMode = false;
    } catch (err) {
      alert('Failed to save selected avatar. It might be blocked by CORS.');
    } finally {
      this.isUploading = false;
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('File is too large. Max 5MB.');
      return;
    }

    this.selectedFile = file;
    this.isEmojiMode = false; // Switch tab

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.photoPreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removePhoto() {
    this.photoUrl = null;
    this.photoPreview = null;
    this.selectedFile = null;
  }

  delete() {
    if (this.repairer?.id) {
      if (confirm('Are you sure you want to delete this repairer?')) {
        this.deleteEvent.emit(this.repairer.id);
      }
    }
  }

  async save() {
    if (!this.name.trim()) return;

    this.isUploading = true;
    try {
      let finalPhotoUrl = this.repairer?.photoUrl; // Default to existing

      if (this.selectedFile) {
        // Upload new file
        finalPhotoUrl = await this.repairService.uploadRepairerPhoto(this.selectedFile);
      } else if (this.photoPreview && this.photoPreview.startsWith('data:image/svg+xml')) {
        // Use SVG Data URI (Emoji)
        finalPhotoUrl = this.photoPreview;
      } else if (!this.photoPreview && !this.photoUrl) {
        // Explicitly removed
        finalPhotoUrl = undefined;
      } else if (this.photoUrl) {
        // kept existing
        finalPhotoUrl = this.photoUrl;
      }

      this.saveEvent.emit({
        id: this.repairer?.id,
        name: this.name,
        photoUrl: finalPhotoUrl,
        canBePrimary: this.canBePrimary
      });
    } catch (error) {
      console.error('Error saving repairer:', error);
      alert('Failed to save repairer.');
    } finally {
      this.isUploading = false;
    }
  }
}
