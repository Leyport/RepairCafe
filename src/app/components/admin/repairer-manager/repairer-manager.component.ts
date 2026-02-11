import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../../services/repair.service';
import { Repairer } from '../../../models/repairer.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-repairer-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>👥 Volunteer Repairers</h3>
        <button class="btn-primary" (click)="showAddForm = !showAddForm">
          {{ showAddForm ? 'Cancel' : 'Add New Repairer' }}
        </button>
      </div>

      <div class="add-form glass" *ngIf="showAddForm">
        <input 
          type="text" 
          [(ngModel)]="newRepairerName" 
          placeholder="Enter repairer's full name"
          (keyup.enter)="addRepairer()"
          #nameInput>
        <button class="btn-save" (click)="addRepairer()" [disabled]="!newRepairerName.trim()">
          Save Repairer
        </button>
      </div>

      <div class="repairer-list">
        <div *ngIf="(repairers$ | async)?.length === 0" class="empty-state">
          No repairers added yet.
        </div>
        
        <div class="repairer-row" *ngFor="let repairer of repairers$ | async">
          <div class="repairer-info">
            <span class="repairer-name">{{ repairer.name }}</span>
          </div>
          <button class="btn-delete" (click)="deleteRepairer(repairer)" title="Remove repairer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .manager-section {
      max-width: 600px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 600px) {
      .section-header {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }
      .section-header h3 {
        font-size: 1.2rem;
      }
    }
    .section-header h3 {
      margin: 0;
      color: white;
    }
    .add-form {
      display: flex;
      gap: 1rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
    }
    @media (max-width: 480px) {
      .add-form {
        flex-direction: column;
        padding: 1rem;
      }
      .btn-save {
        width: 100%;
      }
    }
    .add-form input {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.8rem 1rem;
      border-radius: 8px;
      color: white;
      outline: none;
    }
    .add-form input:focus {
      border-color: var(--accent-color);
    }
    .btn-save {
      background: var(--accent-color);
      color: #000;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .repairer-list {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .repairer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      transition: all 0.2s ease;
    }
    .repairer-row:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateX(5px);
    }
    .repairer-name {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.9);
    }
    .btn-delete {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .btn-delete:hover {
      background: rgba(255, 89, 89, 0.1);
      color: #ff5959;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.1);
    }
  `]
})
export class RepairerManagerComponent {
  private repairService = inject(RepairService);
  repairers$ = this.repairService.getRepairers();

  showAddForm = false;
  newRepairerName = '';

  async addRepairer() {
    if (!this.newRepairerName.trim()) return;

    try {
      await this.repairService.addRepairer(this.newRepairerName.trim());
      this.newRepairerName = '';
      this.showAddForm = false;
    } catch (error) {
      console.error('Error adding repairer:', error);
    }
  }

  async deleteRepairer(repairer: Repairer) {
    if (confirm(`Are you sure you want to remove ${repairer.name}?`)) {
      try {
        await this.repairService.deleteRepairer(repairer.id!);
      } catch (error) {
        console.error('Error deleting repairer:', error);
      }
    }
  }
}
