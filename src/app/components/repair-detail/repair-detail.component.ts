import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { RepairItem, toRepairPhoto } from '../../models/repair-item.model';

@Component({
  selector: 'app-repair-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="detail-page" *ngIf="item">
      <div class="detail-container glass">
        <header class="detail-header">
          <div class="header-main">
            <span class="sequence-badge">{{ item.displayNumber }}</span>
            <h1>Repair Details</h1>
          </div>
          <button class="btn-close" [routerLink]="['/']">×</button>
        </header>

        <div class="detail-content">
          <section class="detail-section description-section">
            <label>Description</label>
            <p class="description-text">{{ item.itemDescription }}</p>
          </section>

          <section class="detail-section tags-section" *ngIf="item.tags && item.tags.length > 0">
            <label>Tags</label>
            <div class="tag-chips">
              <span class="tag-chip" *ngFor="let tag of item.tags">{{ tag }}</span>
            </div>
          </section>

          <section class="detail-section info-grid">
            <div class="info-item">
              <label>RC Day</label>
              <span>{{ item.RCDay }}</span>
            </div>
            <div class="info-item">
              <label>Sequence Number</label>
              <span>{{ item.displayNumber }}</span>
            </div>
            <div class="info-item">
              <label>Created</label>
              <span>{{ item.creationDate?.toDate() | date:'short' }}</span>
            </div>
          </section>

          <section class="detail-section photos-section" *ngIf="item.photos && item.photos.length > 0">
            <label>Photos ({{ item.photos.length }})</label>
            <div class="photo-gallery">
              <div class="photo-item glass-light" *ngFor="let photo of item.photos" (click)="openLightbox(getPhotoUrl(photo))">
                <img [src]="getPhotoUrl(photo)" alt="Repair photo">
                <span class="photo-type-badge" [class.before]="getPhotoType(photo) === 'before'" [class.after]="getPhotoType(photo) === 'after'">
                  {{ getPhotoType(photo) }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <footer class="detail-actions">
          <button class="btn-edit" (click)="onEdit()">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Item
          </button>
          <button class="btn-complete" (click)="onComplete()">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Complete
          </button>
          <button class="btn-delete" (click)="onDelete()">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Delete Item
          </button>
        </footer>
      </div>

      <!-- Simple Lightbox -->
      <div class="lightbox" *ngIf="selectedPhoto" (click)="closeLightbox()">
        <img [src]="selectedPhoto" alt="Full view">
        <button class="btn-close-lightbox">×</button>
      </div>
    </div>
  `,
  styles: [`
    .detail-page {
      min-height: calc(100vh - 200px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 2rem;
    }
    .detail-container {
      width: 100%;
      max-width: 800px;
      padding: 3rem;
      border-radius: 24px;
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
    }
    .header-main {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .sequence-badge {
      background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
      color: white;
      padding: 0.5rem 1.2rem;
      border-radius: 12px;
      font-weight: 800;
      font-size: 1.2rem;
      box-shadow: 0 4px 15px rgba(0, 242, 255, 0.3);
    }
    h1 { margin: 0; font-size: 2.2rem; font-weight: 700; color: white; }
    .btn-close {
      background: none;
      border: none;
      color: var(--text-color);
      font-size: 2.5rem;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
      line-height: 1;
    }
    .btn-close:hover { opacity: 1; }
    .detail-section { margin-bottom: 2.5rem; }
    .detail-section label {
      display: block;
      color: var(--accent-color);
      text-transform: uppercase;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      margin-bottom: 0.8rem;
    }
    .description-text {
      font-size: 1.25rem;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-item span {
      display: block;
      font-size: 1.1rem;
      font-weight: 500;
      color: white;
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
      padding: 0.4rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .photo-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1.5rem;
    }
    .photo-item {
      aspect-ratio: 4/3;
      border-radius: 12px;
      overflow: hidden;
      cursor: zoom-in;
      position: relative;
      transition: transform 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .photo-item:hover {
      transform: scale(1.05);
      border-color: var(--accent-color);
    }
    .photo-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo-type-badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .photo-type-badge.before { background: rgba(74,144,226,0.85); color: white; }
    .photo-type-badge.after  { background: rgba(40,180,99,0.85);  color: white; }
    .detail-actions {
      display: flex;
      gap: 1rem;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-edit, .btn-complete, .btn-delete {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      padding: 1rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-edit {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .btn-edit:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
    .btn-complete {
      background: rgba(40, 180, 99, 0.12);
      color: #58d68d;
      border: 1px solid rgba(40, 180, 99, 0.3);
    }
    .btn-complete:hover { background: rgba(40, 180, 99, 0.25); transform: translateY(-2px); }
    .btn-delete {
      background: rgba(255, 68, 68, 0.1);
      color: #ff4444;
      border: 1px solid rgba(255, 68, 68, 0.2);
    }
    .btn-delete:hover { background: #ff4444; color: white; transform: translateY(-2px); }
    
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
      backdrop-filter: blur(5px);
    }
    .lightbox img {
      max-width: 90vw;
      max-height: 90vh;
      border-radius: 8px;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
    }
    .btn-close-lightbox {
      position: absolute;
      top: 2rem;
      right: 2rem;
      background: none;
      border: none;
      color: white;
      font-size: 3rem;
      cursor: pointer;
    }
  `]
})
export class RepairDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private repairService = inject(RepairService);

  item: RepairItem | null = null;
  selectedPhoto: string | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.repairService.getRepairItems().subscribe(items => {
        this.item = items.find(i => i.id === id) || null;
      });
    }
  }

  onEdit() {
    if (this.item) {
      this.repairService.setEditItem(this.item);
      this.router.navigate(['/edit', this.item.id]);
    }
  }

  onComplete() {
    if (this.item?.id) {
      this.router.navigate(['/complete', this.item.id]);
    }
  }

  async onDelete() {
    if (this.item?.id && confirm('Are you sure you want to delete this repair item?')) {
      await this.repairService.deleteRepairItem(this.item.id);
      this.router.navigate(['/']);
    }
  }

  getPhotoUrl(photo: any): string { return toRepairPhoto(photo).url; }
  getPhotoType(photo: any): string { return toRepairPhoto(photo).type; }

  openLightbox(photo: string) {
    this.selectedPhoto = photo;
  }

  closeLightbox() {
    this.selectedPhoto = null;
  }
}
