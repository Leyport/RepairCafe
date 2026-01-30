import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RepairService } from '../../services/repair.service';
import { Observable, combineLatest, startWith, map } from 'rxjs';
import { RepairItem } from '../../models/repair-item.model';

@Component({
  selector: 'app-repair-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="list-container">
      <div class="header-section">
        <h2>Repair Items</h2>
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
      
      <div class="grid">
        <div *ngFor="let item of filteredItems$ | async" class="card glass">
          <div class="card-header">
            <div class="header-left">
              <span class="display-number">{{ item.displayNumber }}</span>
              <span class="rc-day">{{ item.RCDay }}</span>
            </div>
            <div class="header-right">
              <span class="date">{{ item.creationDate?.toDate() | date:'mediumDate' }}</span>
              <div class="actions">
                <button (click)="onEdit(item)" class="btn-action btn-edit" title="Edit record">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
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
          <div class="card-content">
            <p>{{ item.itemDescription }}</p>
            <div class="sequence-info">Sequence: {{ item.itemNumber }}</div>
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
      margin-top: 2rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .search-container {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      flex: 1;
      max-width: 300px;
    }
    .search-icon {
      color: rgba(255, 255, 255, 0.5);
      margin-right: 0.5rem;
    }
    .search-input {
      background: transparent;
      border: none;
      color: white;
      width: 100%;
      outline: none;
      font-size: 1rem;
    }
    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .card {
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s ease;
      position: relative;
    }
    .card:hover {
      transform: translateY(-5px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0.5rem;
      align-items: center;
    }
    .header-left {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .actions {
      display: flex;
      gap: 0.4rem;
    }
    .display-number {
      font-weight: 800;
      color: var(--accent-color);
      letter-spacing: 0.05em;
      font-family: 'Courier New', Courier, monospace;
      font-size: 1.1rem;
    }
    .rc-day {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      font-style: italic;
    }
    .date {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .btn-action {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-edit:hover {
      color: var(--accent-color);
      background: rgba(0, 242, 255, 0.1);
    }
    .btn-delete:hover {
      color: #ff4d4d;
      background: rgba(255, 77, 77, 0.1);
    }
    .card-content p {
      margin: 0;
      line-height: 1.6;
    }
    .sequence-info {
      margin-top: 0.5rem;
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.3);
      text-align: right;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.5);
    }
  `]
})
export class RepairListComponent {
  private repairService = inject(RepairService);
  searchControl = new FormControl('');

  filteredItems$: Observable<RepairItem[]> = combineLatest([
    this.repairService.getRepairItems(),
    this.searchControl.valueChanges.pipe(startWith(''))
  ]).pipe(
    map(([items, searchTerm]) => {
      const term = (searchTerm || '').toLowerCase();
      if (!term) return items;
      return items.filter(item =>
        item.itemDescription.toLowerCase().includes(term) ||
        item.displayNumber.toLowerCase().includes(term) ||
        item.RCDay.toLowerCase().includes(term)
      );
    })
  );

  onEdit(item: RepairItem) {
    this.repairService.setEditItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
