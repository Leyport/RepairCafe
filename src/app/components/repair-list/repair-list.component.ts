import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepairService } from '../../services/repair.service';
import { Observable } from 'rxjs';
import { RepairItem } from '../../models/repair-item.model';

@Component({
  selector: 'app-repair-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-container">
      <h2>Repair Items</h2>
      <div class="grid">
        <div *ngFor="let item of repairItems$ | async" class="card glass">
          <div class="card-header">
            <div class="header-left">
              <span class="display-number">{{ item.displayNumber }}</span>
              <span class="item-number">#{{ item.itemNumber }}</span>
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
          </div>
        </div>
      </div>
      <div *ngIf="(repairItems$ | async)?.length === 0" class="empty-state">
        <p>No repair items yet. Add one above!</p>
      </div>
    </div>
  `,
  styles: [`
    .list-container {
      margin-top: 2rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
      gap: 0.2rem;
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
    }
    .item-number {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
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
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.5);
    }
  `]
})
export class RepairListComponent {
  private repairService = inject(RepairService);
  repairItems$: Observable<RepairItem[]> = this.repairService.getRepairItems();

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
