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
          <span class="col-code pointer" (click)="setSort('number')">No. {{ getSortIcon('number') }}</span>
          <span class="col-desc">Description</span>
          <span class="col-day">RC Day</span>
          <span class="col-actions"></span>
        </div>
        <div *ngFor="let item of filteredItems$ | async" 
             class="list-row" 
             [routerLink]="['/item', item.id]">
          <div class="col-code">
            <span class="seq-badge">{{ item.displayNumber }}</span>
          </div>
          <span class="col-desc truncate">{{ item.itemDescription }}</span>
          <span class="col-day">{{ item.RCDay }}</span>
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
      overflow: hidden;
    }
    .list-header {
      display: grid;
      grid-template-columns: 100px 1fr 200px 80px;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.08);
      font-weight: bold;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pointer { cursor: pointer; }
    .pointer:hover { color: var(--accent-color); }
    .list-row {
      display: grid;
      grid-template-columns: 100px 1fr 200px 80px;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      align-items: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .list-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .col-code {
      display: flex;
      align-items: center;
    }
    .seq-badge {
      background: rgba(0, 242, 255, 0.15);
      color: var(--accent-color);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-weight: 800;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
    }
    .truncate {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255, 255, 255, 0.9);
    }
    .col-day {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
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
        filtered = items.filter(item =>
          item.itemDescription.toLowerCase().includes(term) ||
          item.displayNumber.toLowerCase().includes(term) ||
          item.RCDay.toLowerCase().includes(term) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(term)))
        );
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
