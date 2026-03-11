import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { Observable, combineLatest, startWith, map, BehaviorSubject } from 'rxjs';
import { RepairItem } from '../../models/repair-item.model';

type SortOption = 'newest' | 'oldest' | 'number';

@Component({
  selector: 'app-repair-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="list-container">
      <div class="header-section">
        <h2>Repair Items</h2>
        <div class="header-controls">
          <div class="sort-container glass">
             <select [formControl]="sortControl" class="sort-select">
               <option value="newest">Newest First</option>
               <option value="oldest">Oldest First</option>
               <option value="number">By Item No.</option>
             </select>
          </div>
          <div class="search-container glass">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              [formControl]="searchControl" 
              placeholder="Filter items..."
              class="search-input"
            >
          </div>
        </div>
      </div>
      
      <div class="compact-list glass">
        <div class="list-header">
          <span class="col-photo"></span>
          <span class="col-code pointer" (click)="setSort('number')"># {{ getSortIcon('number') }}</span>
          <span class="col-desc">Description</span>
          <span class="col-owner">Owner</span>
          <span class="col-category">Category</span>
          <span class="col-repairer">Repairer</span>
          <span class="col-session">RC Session</span>
          <span class="col-created pointer" (click)="setSort('newest')">Created {{ getSortIcon('newest') }}</span>
          <span class="col-status">Status</span>
          <span class="col-actions"></span>
        </div>
        <div *ngFor="let item of filteredItems$ | async"
             class="list-row"
             [routerLink]="['/item', item.id]">

          <!-- Photo -->
          <div class="col-photo">
            <div class="thumb" [style.backgroundImage]="item.photos?.length ? 'url(' + item.photos![0] + ')' : 'none'">
              <span *ngIf="!item.photos?.length" class="thumb-placeholder">📷</span>
            </div>
          </div>

          <!-- # -->
          <div class="col-code">
            <span class="seq-badge linkable"
                  [routerLink]="['/edit', item.id]"
                  (click)="$event.stopPropagation()"
                  title="Edit item">
              {{ item.displayNumber }}
            </span>
          </div>

          <!-- Description -->
          <span class="col-desc truncate">{{ item.itemDescription }}</span>

          <!-- Owner -->
          <span class="col-owner truncate">{{ item.owner || '—' }}</span>

          <!-- Category -->
          <div class="col-category">
            <div class="tag-trigger-wrapper" *ngIf="item.tags && item.tags.length > 0">
              <span class="tag-pill">
                <span *ngIf="getFirstTagEmoji(item.tags)">{{ getFirstTagEmoji(item.tags) }}</span>
                {{ item.tags[0] }}<span *ngIf="item.tags.length > 1"> +{{ item.tags.length - 1 }}</span>
              </span>
              <div class="tags-popup glass">
                <div class="popup-title">Tags</div>
                <div class="popup-tags">
                  <span class="popup-tag" *ngFor="let tag of item.tags">{{ tag }}</span>
                </div>
              </div>
            </div>
            <span *ngIf="!item.tags || item.tags.length === 0" class="muted">—</span>
          </div>

          <!-- Repairer -->
          <span class="col-repairer truncate">{{ item.repairer || '—' }}</span>

          <!-- RC Session -->
          <span class="col-session truncate">{{ formatRCDay(item.RCDay) }}</span>

          <!-- Created -->
          <span class="col-created">{{ item.creationDate?.toDate() | date:'dd MMM yy' }}</span>

          <!-- Status -->
          <div class="col-status">
            <span class="status-badge" [ngClass]="getStatusClass(item.status)">
              {{ item.status || 'New' }}
            </span>
          </div>

          <!-- Actions -->
          <div class="col-actions actions" (click)="$event.stopPropagation()">
            <button (click)="onDelete(item.id!)" class="btn-action btn-delete" title="Delete record">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div *ngIf="(filteredItems$ | async)?.length === 0" class="empty-state">
        <p>No matching repair items found.</p>
      </div>
    </div>
  `,
  styles: [`
    .list-container {
      margin-top: 1rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    @media (max-width: 600px) {
      .header-section {
        flex-direction: column;
        align-items: stretch;
      }
    }
    .header-controls {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-container, .sort-container {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .search-container {
      max-width: 300px;
      flex: 1;
    }
    
    @media (max-width: 600px) {
      .search-container, .sort-container {
        max-width: none;
        width: 100%;
      }
      .header-controls {
        width: 100%;
      }
    }
    .sort-select {
      background: transparent;
      border: none;
      color: white;
      outline: none;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .sort-select option {
      background: #1a1a2e;
      color: white;
    }
    .search-icon {
      color: rgba(255, 255, 255, 0.4);
      margin-right: 0.5rem;
    }
    .search-input {
      background: transparent;
      border: none;
      color: white;
      width: 100%;
      outline: none;
    }
    .compact-list {
      border-radius: 12px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .list-header,
    .list-row {
      display: grid;
      grid-template-columns: 48px 70px 1fr 110px 120px 120px 130px 95px 90px 40px;
      padding: 0.75rem 1rem;
      align-items: center;
      gap: 0.5rem;
      min-width: 900px;
    }
    .list-header {
      background: rgba(255, 255, 255, 0.08);
      font-weight: bold;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pointer { cursor: pointer; }
    .pointer:hover { color: var(--accent-color); }
    .list-row {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: background 0.2s;
    }

    @media (max-width: 768px) {
      .list-header { display: none; }
      .list-row {
        min-width: unset;
        grid-template-columns: 48px 70px 1fr auto;
        grid-template-areas:
          "photo code desc actions"
          "photo . status .";
        gap: 0.5rem;
        padding: 0.8rem 1rem;
      }
      .col-photo { grid-area: photo; }
      .col-code { grid-area: code; }
      .col-desc { grid-area: desc; }
      .col-actions { grid-area: actions; }
      .col-status { grid-area: status; }
      .col-owner, .col-category, .col-repairer, .col-session, .col-created { display: none; }
    }

    .list-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .col-code {
      display: flex;
      align-items: center;
    }
    .seq-badge {
      font-size: 0.9rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
      transition: all 0.2s;
    }
    .seq-badge.linkable:hover {
      background: var(--accent-color);
      color: #1a1a2e;
      transform: scale(1.05);
      border-color: white;
    }
    .truncate {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255, 255, 255, 0.9);
    }
    .muted {
      color: rgba(255, 255, 255, 0.3);
    }

    /* Photo thumbnail */
    .col-photo { display: flex; align-items: center; }
    .thumb {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background-size: cover;
      background-position: center;
      background-color: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .thumb-placeholder { font-size: 0.9rem; opacity: 0.3; }

    /* Status badge */
    .status-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .status-new       { background: rgba(74,144,226,0.12);  color: #7ab1f7; border: 1px solid rgba(74,144,226,0.3); }
    .status-assigned  { background: rgba(241,196,15,0.12);  color: #fce170; border: 1px solid rgba(241,196,15,0.3); }
    .status-repaired  { background: rgba(40,180,99,0.12);   color: #58d68d; border: 1px solid rgba(40,180,99,0.3); }
    .status-advice    { background: rgba(230,126,34,0.12);  color: #f0a055; border: 1px solid rgba(230,126,34,0.3); }
    .status-partial   { background: rgba(230,126,34,0.12);  color: #f0a055; border: 1px solid rgba(230,126,34,0.3); }
    .status-not       { background: rgba(231,76,60,0.12);   color: #f1948a; border: 1px solid rgba(231,76,60,0.3); }

    /* Tag pill in category column */
    .tag-pill {
      font-size: 0.78rem;
      background: rgba(0, 242, 255, 0.07);
      border: 1px solid rgba(0, 242, 255, 0.2);
      color: var(--accent-color);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 110px;
      display: inline-block;
      cursor: default;
    }

    .tag-trigger-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .tags-popup {
      position: absolute;
      bottom: 125%;
      right: -20px;
      padding: 1.2rem;
      border-radius: 12px;
      min-width: 200px;
      max-width: 300px;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      background: #111122; /* High contrast solid background */
      border: 2px solid var(--accent-color); /* Bright, sharp border */
      box-shadow: 0 15px 40px rgba(0, 0, 0, 1), 0 0 15px rgba(0, 242, 255, 0.2);
      pointer-events: none;
    }
    .tags-popup::after {
      content: '';
      position: absolute;
      top: 100%;
      right: 30px;
      border: 10px solid transparent;
      border-top-color: var(--accent-color);
    }
    .tag-trigger-wrapper:hover .tags-popup {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    /* Smart Flip for Top Items: Open downwards if in first 3 rows */
    .compact-list .list-row:nth-child(-n+4) .tags-popup {
      bottom: auto;
      top: 130%;
      transform: translateY(-10px);
    }
    .compact-list .list-row:nth-child(-n+4) .tag-trigger-wrapper:hover .tags-popup {
      transform: translateY(0);
    }
    .compact-list .list-row:nth-child(-n+4) .tags-popup::after {
      top: auto;
      bottom: 100%;
      border-top-color: transparent;
      border-bottom-color: var(--accent-color);
    }

    .popup-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--accent-color);
      margin-bottom: 0.8rem;
      letter-spacing: 0.15em;
      font-weight: 800;
      border-bottom: 1px solid rgba(0, 242, 255, 0.2);
      padding-bottom: 0.4rem;
    }
    .popup-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .popup-tag {
      font-size: 0.85rem;
      background: rgba(0, 242, 255, 0.2);
      border: 1px solid var(--accent-color);
      color: #00f2ff;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      white-space: nowrap;
      font-weight: 700;
    }
    .col-created, .col-session, .col-owner, .col-repairer {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .btn-action {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .btn-delete:hover {
      color: #ff4d4d;
      background: rgba(255, 77, 77, 0.1);
    }
    .empty-state {
      text-align: center;
      padding: 4rem;
      color: rgba(255, 255, 255, 0.4);
    }
  `]
})
export class RepairListComponent {
  private repairService = inject(RepairService);
  private router = inject(Router);

  searchControl = new FormControl('');
  sortControl = new FormControl<SortOption>('newest');

  filteredItems$: Observable<RepairItem[]> = combineLatest([
    this.repairService.getRepairItems(),
    this.searchControl.valueChanges.pipe(startWith('')),
    this.sortControl.valueChanges.pipe(startWith('newest' as SortOption))
  ]).pipe(
    map(([items, searchTerm, sortOrder]) => {
      // First filter
      const term = (searchTerm || '').toLowerCase();
      let filtered = items;
      if (term) {
        filtered = items.filter(item => {
          const description = (item.itemDescription || '').toLowerCase();
          const number = (item.displayNumber || '').toLowerCase();
          const day = (item.RCDay || '').toLowerCase();
          const tags = item.tags || [];

          return description.includes(term) ||
            number.includes(term) ||
            day.includes(term) ||
            tags.some(tag => tag.toLowerCase().includes(term));
        });
      }

      // Then sort
      return [...filtered].sort((a, b) => {
        switch (sortOrder) {
          case 'newest':
            return (b.creationDate?.toMillis() || 0) - (a.creationDate?.toMillis() || 0);
          case 'oldest':
            return (a.creationDate?.toMillis() || 0) - (b.creationDate?.toMillis() || 0);
          case 'number':
            if (a.rcDayNumber !== b.rcDayNumber) {
              return a.rcDayNumber - b.rcDayNumber;
            }
            return a.itemNumber - b.itemNumber;
          default:
            return 0;
        }
      });
    })
  );

  setSort(option: SortOption) {
    this.sortControl.setValue(option);
  }

  getSortIcon(option: SortOption): string {
    if (this.sortControl.value === option) {
      return '↓';
    }
    return '';
  }

  getFirstTagEmoji(tags: string[]): string {
    if (!tags || tags.length === 0) return '';
    for (const tag of tags) {
      const emoji = this.repairService.getEmojiForTag(tag);
      if (emoji) return emoji;
    }
    return '';
  }

  getStatusClass(status: string | undefined): string {
    switch (status) {
      case 'Assigned':          return 'status-assigned';
      case 'Repaired':          return 'status-repaired';
      case 'Advice Given':      return 'status-advice';
      case 'Partially Repaired': return 'status-partial';
      case 'Not Repaired':      return 'status-not';
      default:                  return 'status-new';
    }
  }

  formatRCDay(rcDay: string): string {
    if (!rcDay) return '—';
    // Format is "Saturday, 15, 03, 2025" → "15 Mar 25"
    const parts = rcDay.split(',').map(p => p.trim());
    if (parts.length < 4) return rcDay;
    const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = parts[1];
    const month = months[parseInt(parts[2], 10)] || parts[2];
    const year = parts[3].slice(-2);
    return `${day} ${month} ${year}`;
  }

  async onDelete(id: string) {
    if (confirm('Are you sure you want to delete this repair item?')) {
      try {
        await this.repairService.deleteRepairItem(id);
      } catch (error) {
        console.error('Error deleting repair item:', error);
      }
    }
  }
}
