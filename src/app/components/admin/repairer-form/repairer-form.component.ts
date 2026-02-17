import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Repairer } from '../../../models/repairer.model';
import { RepairService } from '../../../services/repair.service';
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
            <div class="avatar-preview" [style.backgroundImage]="'url(' + (photoUrl || 'assets/placeholder-avatar.png') + ')'">
              <div class="overlay" (click)="fileInput.click()">
                <span>📷</span>
              </div>
            </div>
            <input #fileInput type="file" (change)="onFileSelected($event)" accept="image/*" hidden>
            <div class="avatar-actions">
              <button class="btn-text" (click)="fileInput.click()">Upload Photo</button>
              <button *ngIf="photoUrl" class="btn-text text-danger" (click)="removePhoto()">Remove</button>
            </div>
          </div>

          <label for="repairerName">Name</label>
          <input 
            type="text" 
            id="repairerName" 
            [(ngModel)]="name" 
            placeholder="Enter repairer name"
            autofocus>
        </div>

        <!-- Future fields can go here -->

        <footer>
          <button class="btn-delete" *ngIf="repairer?.id" (click)="delete()">Delete</button>
          <div class="actions">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button class="btn-save" (click)="save()" [disabled]="!name.trim()">Save</button>
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
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
    }

    input {
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
  `]
})
export class RepairerFormComponent {
  private repairService = inject(RepairService);

  @Input() repairer: Repairer | null = null;
  @Output() closeEvent = new EventEmitter<void>();
  @Output() saveEvent = new EventEmitter<{ id?: string, name: string, photoUrl?: string }>();
  @Output() deleteEvent = new EventEmitter<string>();

  name = '';
  photoUrl: string | null = null;
  isUploading = false;

  ngOnChanges() {
    if (this.repairer) {
      this.name = this.repairer.name;
      this.photoUrl = this.repairer.photoUrl || null;
    } else {
      this.name = '';
      this.photoUrl = null;
    }
  }

  close() {
    this.closeEvent.emit();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('File is too large. Max 5MB.');
      return;
    }

    try {
      this.isUploading = true;
      this.photoUrl = await this.repairService.uploadRepairerPhoto(file);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photo.');
    } finally {
      this.isUploading = false;
    }
  }

  removePhoto() {
    this.photoUrl = null;
  }

  save() {
    if (this.name.trim()) {
      this.saveEvent.emit({
        id: this.repairer?.id,
        name: this.name.trim(),
        photoUrl: this.photoUrl || undefined
      });
    }
  }

  delete() {
    if (this.repairer?.id) {
      if (confirm(`Are you sure you want to delete ${this.repairer.name}?`)) {
        this.deleteEvent.emit(this.repairer.id);
      }
    }
  }
}
