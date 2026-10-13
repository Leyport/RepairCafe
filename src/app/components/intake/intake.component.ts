import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { Owner } from '../../models/repair-item.model';

interface PendingPhoto {
  preview: string;
  file: File;
}

@Component({
  selector: 'app-intake',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="intake-container">
      <div class="intake-header">
        <button class="btn-back" (click)="router.navigate(['/repairs'])">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>
        <div>
          <h1 class="page-title">Register Item</h1>
          <p class="page-sub">Quick intake — capture the basics to get the item registered</p>
        </div>
      </div>

      <div class="intake-card glass">
        <div class="section">
          <h2 class="section-heading">Owner</h2>
          <div class="fields-row">
            <div class="field">
              <label>Name <span class="req">*</span></label>
              <input type="text" class="text-input" placeholder="Owner's full name" list="owner-list"
                     [(ngModel)]="ownerName" (input)="onOwnerInput()">
              <datalist id="owner-list">
                <option *ngFor="let o of owners" [value]="o.name"></option>
              </datalist>
            </div>
            <div class="field">
              <label>Phone</label>
              <input type="tel" class="text-input" placeholder="07xxx xxxxxx" [(ngModel)]="ownerPhone">
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <h2 class="section-heading">Item</h2>
          <div class="fields-row">
            <div class="field field-grow">
              <label>What is it? <span class="req">*</span></label>
              <input type="text" class="text-input" placeholder="e.g. Toaster, Lamp, Jacket…" [(ngModel)]="itemDescription">
            </div>
            <div class="field field-narrow">
              <label>Category</label>
              <select class="select-input" [(ngModel)]="category">
                <option value="">— Select —</option>
                <option *ngFor="let c of categories" [value]="c.value">{{ c.emoji }} {{ c.label }}</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>What's wrong with it? <span class="req">*</span></label>
            <textarea rows="3" class="textarea-input" placeholder="Describe the problem the owner has reported…"
                      [(ngModel)]="fault"></textarea>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <h2 class="section-heading">Photos <span class="optional-label">(up to 3)</span></h2>
          <div class="photo-row">
            <div class="photo-thumb" *ngFor="let p of photos; let i = index">
              <img [src]="p.preview" alt="Item photo">
              <button class="photo-remove" (click)="removePhoto(i)">✕</button>
            </div>
            <ng-container *ngIf="photos.length < 3">
              <div class="photo-add-group" *ngIf="!uploadingPhoto">
                <button class="photo-add-btn" title="Take photo with camera" (click)="openWebcam()">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Camera
                </button>
                <label class="photo-add-btn">
                  <input type="file" accept="image/*" style="display:none" (change)="onPhotoSelected($event)">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  File
                </label>
              </div>
              <div class="photo-add uploading" *ngIf="uploadingPhoto">
                <span class="spinner-small"></span>
              </div>
            </ng-container>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-cancel" (click)="router.navigate(['/repairs'])">Cancel</button>
          <button class="btn-register" [disabled]="!canSubmit() || saving" (click)="register()">
            <span *ngIf="!saving">Register Item</span>
            <span class="btn-saving" *ngIf="saving"><span class="spinner-small white"></span> Saving… </span>
          </button>
        </div>
      </div>

      <div class="webcam-overlay" *ngIf="showWebcam" (click)="closeWebcam()">
        <div class="webcam-modal" (click)="$event.stopPropagation()">
          <div class="webcam-header">
            <span>Take Photo</span>
            <button class="webcam-close" (click)="closeWebcam()">✕</button>
          </div>
          <div class="webcam-body">
            <video #videoEl class="webcam-video" autoplay playsinline></video>
            <canvas #canvasEl style="display:none"></canvas>
            <div class="webcam-error" *ngIf="webcamError">{{ webcamError }}</div>
          </div>
          <div class="webcam-footer">
            <button class="btn-cancel" (click)="closeWebcam()">Cancel</button>
            <button class="btn-capture" [disabled]="!!webcamError" (click)="capturePhoto()">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .intake-container { max-width: 720px; margin: 0 auto; padding-top: 1rem; }
    .intake-header { display: flex; align-items: flex-start; gap: 1.2rem; margin-bottom: 1.8rem; }
    .btn-back { display: flex; align-items: center; gap: .3rem; background: transparent; border: 1px solid rgba(255,255,255,.15); color: #ffffff8c; border-radius: 7px; padding: .4rem .75rem; cursor: pointer; font-size: .85rem; font-weight: 600; transition: all .15s; flex-shrink: 0; }
    .btn-back:hover { color: #fff; border-color: #ffffff4d; }
    .page-title { margin: 0 0 .2rem; font-size: 1.6rem; font-weight: 800; color: #fff; }
    .page-sub { margin: 0; font-size: .88rem; color: #ffffff73; }
    .intake-card { border-radius: 14px; padding: 2rem; display: flex; flex-direction: column; gap: 0; }
    .section { display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem 0; }
    .section:first-of-type { padding-top: 0; }
    .section-heading { margin: 0; font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color: #ffffff73; }
    .divider { height: 1px; background: #ffffff12; margin: 0 -2rem; }
    .fields-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .field { display: flex; flex-direction: column; gap: .4rem; flex: 1; min-width: 0; }
    .field-grow { flex: 2; }
    .field-narrow { flex: 1; min-width: 140px; }
    label { font-size: .82rem; font-weight: 600; color: #ffffff8c; }
    .req { color: #f1948a; }
    .optional-label { font-size: .75rem; font-weight: 400; color: #ffffff4d; text-transform: none; letter-spacing: 0; }
    .text-input, .select-input, .textarea-input { background: #ffffff0d; border: 1px solid rgba(255,255,255,.12); color: #ffffffe6; border-radius: 8px; padding: .6rem .8rem; font-size: .92rem; outline: none; font-family: inherit; transition: border-color .15s; box-sizing: border-box; width: 100%; }
    .text-input:focus, .select-input:focus, .textarea-input:focus { border-color: var(--accent-color); }
    .text-input::placeholder, .textarea-input::placeholder { color: #ffffff40; }
    .select-input option, .select-input optgroup { background: #1a2236; color: #fff; }
    .textarea-input { resize: vertical; }
    .photo-row { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
    .photo-thumb { position: relative; width: 90px; height: 90px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,.15); }
    .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .photo-remove { position: absolute; top: 4px; right: 4px; background: #000000a6; border: none; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: .7rem; line-height: 1; }
    .photo-add-group { display: flex; flex-direction: column; gap: .4rem; }
    .photo-add-btn { display: flex; align-items: center; gap: .45rem; background: #ffffff0d; border: 1px solid rgba(255,255,255,.15); color: #ffffff8c; border-radius: 8px; padding: .5rem .85rem; cursor: pointer; font-size: .8rem; font-weight: 600; font-family: inherit; transition: all .15s; white-space: nowrap; }
    .photo-add-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background: #00f2ff0f; }
    .photo-add { display: flex; align-items: center; justify-content: center; width: 90px; height: 90px; }
    .photo-add.uploading { pointer-events: none; opacity: .7; }
    .spinner-small { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--accent-color); border-radius: 50%; animation: spin .7s linear infinite; }
    .spinner-small.white { border-top-color: #fff; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .form-actions { display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,.07); margin-top: 1rem; flex-wrap: wrap; }
    .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,.15); color: #fff9; padding: .65rem 1.4rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 600; transition: all .15s; }
    .btn-cancel:hover { background: #ffffff0f; color: #fff; }
    .btn-register { background: #00f2ff1f; border: 1px solid rgba(0,242,255,.4); color: var(--accent-color); padding: .65rem 2rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 700; transition: all .15s; display: flex; align-items: center; gap: .5rem; }
    .btn-register:hover:not(:disabled) { background: #00f2ff33; }
    .btn-register:disabled { opacity: .4; cursor: not-allowed; }
    .btn-saving { display: flex; align-items: center; gap: .5rem; }
    .webcam-overlay { position: fixed; inset: 0; background: #000000bf; display: flex; align-items: center; justify-content: center; z-index: 1000; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box; }
    .webcam-modal { background: #1a2236; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; overflow: hidden; width: min(560px, 96vw); display: flex; flex-direction: column; box-shadow: 0 24px 64px #0009; }
    .webcam-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); font-size: .95rem; font-weight: 700; color: #fff; }
    .webcam-close { background: none; border: none; color: #ffffff80; font-size: 1rem; cursor: pointer; padding: .2rem .4rem; line-height: 1; border-radius: 4px; transition: color .15s; }
    .webcam-close:hover { color: #fff; }
    .webcam-body { position: relative; background: #000; }
    .webcam-video { width: 100%; display: block; max-height: 60vh; object-fit: contain; }
    .webcam-error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #f1948a; font-size: .9rem; text-align: center; padding: 2rem; background: #0009; }
    .webcam-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,.08); }
    .btn-capture { display: flex; align-items: center; gap: .5rem; background: #00f2ff1f; border: 1px solid rgba(0,242,255,.4); color: var(--accent-color); padding: .6rem 1.4rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 700; font-family: inherit; transition: all .15s; }
    .btn-capture:hover:not(:disabled) { background: #00f2ff38; }
    .btn-capture:disabled { opacity: .35; cursor: not-allowed; }
    @media (max-width: 600px) {
      .fields-row { flex-direction: column; }
      .intake-header { flex-direction: column; gap: .75rem; }
    }
  `]
})
export class IntakeComponent {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  router = inject(Router);
  private repairService = inject(RepairService);

  ownerName = '';
  ownerPhone = '';
  itemDescription = '';
  fault = '';
  category = '';
  saving = false;
  uploadingPhoto = false;
  showWebcam = false;
  webcamError = '';
  private stream: MediaStream | null = null;
  photos: PendingPhoto[] = [];
  owners: Owner[] = [];

  categories = [
    { value: 'electrical', emoji: '⚡', label: 'Electrical' },
    { value: 'textile', emoji: '🧵', label: 'Textile' },
    { value: 'ornament', emoji: '🪆', label: 'Ornament' },
    { value: 'mechanical', emoji: '⚙️', label: 'Mechanical' },
    { value: 'furniture', emoji: '🪑', label: 'Furniture' },
    { value: 'toy', emoji: '🧸', label: 'Toy' },
    { value: 'clock', emoji: '🕐', label: 'Clock' },
    { value: 'jewelry', emoji: '💍', label: 'Jewelry' },
    { value: 'other', emoji: '❓', label: 'Other' },
  ];

  ngOnInit() {
    this.repairService.getOwners().subscribe(o => this.owners = o);
  }

  ngOnDestroy() {
    this.stopStream();
  }

  onOwnerInput() {
    const match = this.owners.find(o => o.name.toLowerCase() === this.ownerName.toLowerCase());
    if (match?.telephone && !this.ownerPhone) this.ownerPhone = match.telephone;
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const preview = await this.readAsDataUrl(file);
    this.photos.push({ preview, file });
  }

  openWebcam() {
    this.webcamError = '';
    this.showWebcam = true;
    setTimeout(async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        this.videoEl.nativeElement.srcObject = this.stream;
      } catch {
        this.webcamError = 'Camera access denied. Please check your browser permissions and try again.';
      }
    }, 80);
  }

  closeWebcam() {
    this.showWebcam = false;
    this.stopStream();
  }

  capturePhoto() {
    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = await this.readAsDataUrl(file);
      this.photos.push({ preview, file });
      this.closeWebcam();
    }, 'image/jpeg', 0.9);
  }

  private stopStream() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  removePhoto(index: number) {
    this.photos.splice(index, 1);
  }

  canSubmit(): boolean {
    return !!(this.ownerName.trim() && this.itemDescription.trim() && this.fault.trim());
  }

  async register() {
    if (!this.canSubmit() || this.saving) return;
    this.saving = true;
    try {
      const uploaded: { url: string; type: 'before' }[] = [];
      for (const p of this.photos) {
        const url = await this.repairService.uploadPhoto(p.file);
        uploaded.push({ url, type: 'before' });
      }
      const rcDay = this.repairService.getNextRCDay();
      const item: any = {
        owner: this.ownerName.trim(),
        itemDescription: this.itemDescription.trim(),
        fault: this.fault.trim(),
        RCDay: rcDay,
        status: 'Registered'
      };
      if (this.ownerPhone.trim()) item.telephone = this.ownerPhone.trim();
      if (this.category) item.category = this.category;
      if (uploaded.length) item.photos = uploaded;
      await this.repairService.addRepairItem(item);
      this.router.navigate(['/repairs']);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Failed to register item. Please try again.');
      this.saving = false;
    }
  }
}
