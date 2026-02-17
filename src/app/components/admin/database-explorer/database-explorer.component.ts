import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../../services/repair.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { RepairItem } from '../../../models/repair-item.model';
import { Repairer } from '../../../models/repairer.model';
import { RepairerFormComponent } from '../repairer-form/repairer-form.component';

@Component({
  selector: 'app-database-explorer',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RepairerFormComponent],
  template: `
    <div class="explorer-container">
      <app-repairer-form 
        *ngIf="editingRepairer" 
        [repairer]="editingRepairer"
        (closeEvent)="closeEdit()"
        (saveEvent)="saveRepairer($event)"
        (deleteEvent)="deleteRepairer($event)">
      </app-repairer-form>

      <!-- Assignment Modal -->
      <div class="modal-overlay" *ngIf="showRepairerModal" (click)="closeAssignmentModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                    <h2 style="margin: 0;">Assign Repairers</h2>
                    <p class="subtitle" style="margin: 0.5rem 0 0 0;">Select primary and additional repairers.</p>
                </div>
                <button (click)="closeAssignmentModal()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; opacity: 0.7;">&times;</button>
            </div>
            
            <div class="repairer-list" style="flex: 1; overflow-y: auto; margin: 1rem 0; min-height: 0;">
                <div class="repairer-list-item" *ngFor="let repairer of repairers$ | async">
                    <div class="repairer-info">
                        <img [src]="repairer.photoUrl || '/assets/default-avatar.png'" 
                             style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: #333;">
                        <span>{{ repairer.name }}</span>
                    </div>
                    <div class="repairer-role-actions">
                         <!-- Primary Radio -->
                         <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" 
                                   name="primary" 
                                   [checked]="assignmentPrimary === repairer.name"
                                   (change)="setPrimaryRepairer(repairer.name)">
                            <span class="role-badge" [class.primary]="assignmentPrimary === repairer.name">Primary</span>
                         </label>

                         <!-- Additional Checkbox -->
                         <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" 
                                   [checked]="assignmentAdditional.has(repairer.name)"
                                   [disabled]="assignmentPrimary === repairer.name"
                                   (change)="toggleAdditionalRepairer(repairer.name)">
                            <span class="role-badge" [class.helper]="assignmentAdditional.has(repairer.name)">Helper</span>
                         </label>
                    </div>
                </div>
            </div>

            <div class="form-actions" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn-cancel" (click)="closeAssignmentModal()" style="background: transparent; border: 1px solid #ffffff33; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Cancel</button>
                <button class="btn-save" (click)="saveAssignment()" style="background: var(--accent-color); border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer;">Save Assignment</button>
            </div>
        </div>
      </div>

      <div class="header-section">
        <h2>Database Explorer</h2>
        <p class="subtitle">View and manage system collections</p>
        <div class="actions">
          <button class="btn-action" (click)="refresh()">
            🔄 Refresh
          </button>
          <button class="btn-action" (click)="trackCollection()">
            ➕ Track Collection
          </button>
        </div>
      </div>

      <div class="tabs-container glass">
        <div class="tabs-header">
          <button 
            *ngFor="let col of collections$ | async" 
            (click)="selectCollection(col)"
            [class.active]="selectedCollection === col"
            class="tab-btn"
          >
            {{ getCollectionLabel(col) }}
            <span 
              class="delete-tab" 
              (click)="deleteCol(col, $event)"
              title="Delete Collection"
            >×</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="data-header">
            <h3>{{ getCollectionLabel(selectedCollection) }}</h3>
            <div class="header-controls">
                <button 
                    *ngIf="selectedCollection === 'repairItems' && selectedCount > 0"
                    class="btn-delete-selected" 
                    (click)="deleteSelected()">
                    🗑️ Delete Selected ({{ selectedCount }})
                </button>
                <span class="count" *ngIf="data$ | async as data">{{ data.length }} records</span>
                <button class="btn-toggle" (click)="toggleView()" title="Toggle View">
                    {{ viewMode === 'table' ? '📝 Table' : '{} JSON' }}
                </button>
            </div>
          </div>

          <div class="records-container custom-scrollbar" *ngIf="data$ | async as data; else loading">
            <div *ngIf="data.length > 0; else noData">
              
              <ng-container *ngIf="viewMode === 'table'">
                  <!-- Table View -->
                  <ng-container *ngIf="getSchemaType(selectedCollection || '', data) as schema">
                      <table class="data-table" *ngIf="schema !== 'unknown'">
                        <thead>
                        <tr>
                            <th *ngIf="schema === 'repairItems'" class="checkbox-col">
                                <input 
                                    type="checkbox" 
                                    [checked]="data.length > 0 && selectedCount === data.length"
                                    (change)="toggleSelectAll(data)"
                                    title="Select All">
                            </th>
                            <th *ngIf="schema === 'repairItems'" class="photo-col">Photo</th>
                            <th *ngIf="schema === 'repairItems'">Item No.</th>
                            <th *ngIf="schema === 'repairItems'">Description</th>
                            <th *ngIf="schema === 'repairItems'">Telephone</th>
                            <th *ngIf="schema === 'repairItems'">Owner</th>
                            <th *ngIf="schema === 'repairItems'">Type</th>
                            <th *ngIf="schema === 'repairItems'">Repairer</th>
                            <th *ngIf="schema === 'repairItems'">Creation Date</th>
                            <th *ngIf="schema === 'repairItems'">Status</th>
                            
                            <th *ngIf="schema === 'repairers'">Name</th>
                            <th *ngIf="schema === 'repairers'">Joined</th>

                            <th *ngIf="schema === 'owners'">Name</th>
                            <th *ngIf="schema === 'owners'">First Seen</th>

                            <th *ngIf="schema === 'tags'">Tag Name</th>
                            <th *ngIf="schema === 'tags'">Emoji</th>
                            
                            <th>ID</th>
                            <th *ngIf="schema === 'repairItems'">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr *ngFor="let record of data" (dblclick)="onRowDoubleClick(record, schema)" class="clickable-row">
                            <ng-container *ngIf="schema === 'repairItems'">
                            <td class="checkbox-col">
                                <input 
                                    type="checkbox" 
                                    [checked]="isSelected(record.id)"
                                    (change)="toggleItemSelection(record.id, $event)">
                            </td>
                            <td>
                                <div class="thumbnail-container" *ngIf="record.photos && record.photos.length > 0">
                                    <a [href]="record.photos[0]" target="_blank" (click)="$event.stopPropagation()">
                                        <img [src]="record.photos[0]" alt="Item" class="item-thumbnail" loading="lazy">
                                    </a>
                                </div>
                                <span *ngIf="!record.photos || record.photos.length === 0" class="no-photo">-</span>
                            </td>
                            <td>{{ record.displayNumber || record.itemNumber }}</td>
                            <td>{{ record.itemDescription }}</td>
                            <td>{{ record.telephone || '-' }}</td>
                            <td>{{ record.owner || '-' }}</td>
                            <td>{{ record.repairItem || '-' }}</td>
                            <td>
                              <div class="repairer-select-wrapper">
                                <img *ngIf="getRepairerPhoto(record.repairer)" 
                                     [src]="getRepairerPhoto(record.repairer)" 
                                     class="repairer-avatar-display" 
                                     [title]="record.repairer"
                                     alt="Start">
                                
                                <span class="additional-count" *ngIf="record.additionalRepairers?.length" [title]="'Helpers: ' + record.additionalRepairers?.join(', ')">
                                    +{{ record.additionalRepairers?.length }}
                                </span>

                                <select 
                                  [ngModel]="record.repairer || ''" 
                                  (ngModelChange)="updateItem(record, 'repairer', $event)"
                                  class="inline-select"
                                  [class.hidden-text]="getRepairerPhoto(record.repairer)"
                                  (click)="$event.stopPropagation()">
                                  <option value="">-</option>
                                  <option *ngFor="let r of repairers$ | async" [value]="r.name">{{r.name}}</option>
                                </select>
                                
                                <button class="btn-manage-repairers" (click)="openAssignmentModal(record); $event.stopPropagation()" title="Manage Repairers">
                                    👥
                                </button>
                              </div>
                            </td>
                            <td>{{ record.creationDate?.toDate ? (record.creationDate?.toDate() | date:'short') : '-' }}</td>
                            <td>
                              <select 
                                [ngModel]="record.status || 'New'" 
                                (ngModelChange)="updateItem(record, 'status', $event)"
                                class="inline-select status-select"
                                [ngClass]="{'status-new': (record.status || 'New') === 'New', 'status-assigned': record.status === 'Assigned', 'status-completed': record.status === 'Completed'}"
                                (click)="$event.stopPropagation()">
                                <option value="New">New</option>
                                <option value="Assigned">Assigned</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'repairers'">
                            <td>
                              <div class="repairer-cell">
                                <img [src]="record.photoUrl || 'assets/placeholder-avatar.png'" class="repairer-avatar" alt="Avatar">
                                <a (click)="editRepairer(record)" class="link-action" title="Edit Repairer">
                                  {{ record.name }}
                                </a>
                              </div>
                            </td>
                            <td>{{ record.createdAt?.toDate ? (record.createdAt?.toDate() | date:'mediumDate') : (record.createdAt | date:'mediumDate') }}</td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'owners'">
                            <td>{{ record.name }}</td>
                            <td>{{ record.firstSeen?.toDate ? (record.firstSeen?.toDate() | date:'mediumDate') : '-' }}</td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'tags'">
                            <td>{{ record.name }}</td>
                            <td class="emoji-cell">{{ record.emoji }}</td>
                            </ng-container>

                            <td class="id-cell">{{ record.id }}</td>
                            
                            <td *ngIf="schema === 'repairItems'">
                                <a [routerLink]="['/edit', record.id]" class="btn-icon" title="Edit Item">✏️</a>
                            </td>
                        </tr>
                        </tbody>
                    </table>

                    <!-- Fallback to JSON if unknown schema but table view selected -->
                    <div class="json-list" *ngIf="schema === 'unknown'">
                        <div class="alert-info">
                            No table schema found for this data. Showing raw records.
                        </div>
                        <div class="record-card" *ngFor="let record of data">
                            <div class="record-id">ID: {{ record.id }}</div>
                            <pre class="record-data">{{ record | json }}</pre>
                        </div>
                    </div>
                  </ng-container>
              </ng-container>

              <!-- JSON View -->
              <div class="json-list" *ngIf="viewMode === 'json'">
                <div class="record-card" *ngFor="let record of data">
                  <div class="record-id">ID: {{ record.id }}</div>
                  <pre class="record-data">{{ record | json }}</pre>
                </div>
              </div>

            </div>
            
            <ng-template #noData>
              <div class="empty-state">
                <p>No records found in this collection.</p>
              </div>
            </ng-template>
          </div>
          <ng-template #loading>
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading records...</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .explorer-container {
      padding-top: 1rem;
    }
    .header-section {
      margin-bottom: 2rem;
    }
    .header-section h2 {
      margin: 0;
      font-size: 1.8rem;
      background: linear-gradient(45deg, #fff, var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: rgba(255, 255, 255, 0.5);
      margin: 0.5rem 0 0;
    }

    .actions {
      margin-top: 1rem;
      display: flex;
      gap: 0.8rem;
    }

    .btn-action {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-action:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    .btn-icon {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        font-size: 1rem;
    }
    .btn-icon:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.1);
        border-color: var(--accent-color);
    }

    .tabs-container {
      border-radius: 12px;
      overflow: hidden;
      min-height: 600px;
      display: flex;
      flex-direction: column;
    }

    .tabs-header {
      display: flex;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0 1rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 1rem 1.5rem;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      position: relative;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-right: 2.2rem; /* Make room for X */
    }

    .delete-tab {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 1.2rem;
      line-height: 1;
      opacity: 0;
      transition: all 0.2s;
      background: rgba(255, 0, 0, 0.2);
      color: #ff6b6b;
    }

    .tab-btn:hover .delete-tab {
      opacity: 1;
    }

    .delete-tab:hover {
      background: rgba(255, 0, 0, 0.4);
      transform: translateY(-50%) scale(1.1);
    }

    .tab-btn:hover {
      color: white;
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      color: var(--accent-color);
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--accent-color);
      box-shadow: 0 -2px 10px var(--accent-color);
    }

    .tab-content {
      padding: 1.5rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .data-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    
    .header-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .btn-toggle {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: var(--accent-color);
        padding: 0.3rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        font-family: monospace;
    }
    .btn-toggle:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .btn-delete-selected {
        background: rgba(255, 77, 77, 0.2);
        border: 1px solid rgba(255, 77, 77, 0.4);
        color: #ff6b6b;
        padding: 0.4rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .btn-delete-selected:hover {
        background: rgba(255, 77, 77, 0.3);
        transform: translateY(-1px);
    }
    
    .checkbox-col {
        width: 40px;
        text-align: center;
    }
    
    .checkbox-col input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
    }
    
    .alert-info {
        background: rgba(var(--accent-color-rgb), 0.1);
        color: var(--accent-color);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
        text-align: center;
    }

    .data-header h3 {
      margin: 0;
      font-size: 1.2rem;
      color: white;
    }

    .count {
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.8rem;
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    .records-container {
      flex: 1;
      overflow-y: auto;
      max-height: 600px;
    }

    /* Table Styles */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .data-table th {
      text-align: left;
      padding: 1rem;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: sticky;
      top: 0;
      background: #13131f; /* Matches glass dark bg roughly */
      z-index: 10;
    }

    .data-table td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.8);
    }

    .data-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
      cursor: pointer;
    }

    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge.sequence {
      background: rgba(0, 242, 255, 0.1);
      color: var(--accent-color);
      border: 1px solid rgba(0, 242, 255, 0.2);
    }
    
    .inline-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
        padding: 0.3rem;
        border-radius: 4px;
        font-size: 0.9rem;
        width: 100%;
        min-width: 120px;
        cursor: pointer;
    }
    
    .inline-select:focus {
        outline: none;
        border-color: var(--accent-color);
        background: rgba(0, 0, 0, 0.3);
    }
    
    .inline-select option {
        background: #1a1a2e;
        color: white;
    }
    
    .status-select {
        font-weight: 500;
        width: auto;
        min-width: 100px;
    }
    
    .status-new { color: #4a90e2 !important; border-color: rgba(74, 144, 226, 0.3) !important; }
    .status-assigned { color: #f1c40f !important; border-color: rgba(241, 196, 15, 0.3) !important; }
    .status-completed { color: #28b463 !important; border-color: rgba(40, 180, 99, 0.3) !important; }

    .badge.status {
      background: rgba(0, 255, 127, 0.1);
      color: #00ff7f;
    }
    
    .id-cell {
      font-family: monospace;
      color: rgba(255, 255, 255, 0.3);
      font-size: 0.8rem;
    }

    .emoji-cell {
      font-size: 1.5rem;
    }

    .json-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem;
      color: rgba(255, 255, 255, 0.3);
    }

    .thumbnail-container {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .item-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s;
    }
    
    .item-thumbnail:hover {
        transform: scale(1.1);
    }
    
    .no-photo {
        color: rgba(255, 255, 255, 0.2);
        font-size: 0.8rem;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: rgba(255, 255, 255, 0.4);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .link-action {
        color: var(--accent-color);
        cursor: pointer;
        text-decoration: none;
        font-weight: 500;
    }
    .link-action:hover {
        text-decoration: underline;
        color: #fff;
    }
    .repairer-cell {
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }
    .repairer-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        background-color: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .repairer-select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 120px;
        height: 40px;
    }
    
    .repairer-avatar-display {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        position: absolute;
        left: 5px;
        z-index: 1;
        pointer-events: none;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    }
    
    .inline-select.hidden-text {
        opacity: 0;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        cursor: pointer;
    }
    
    .repairer-select-wrapper:hover .repairer-avatar-display {
        box-shadow: 0 0 0 2px var(--accent-color);
    }
    /* Assignment Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex; justify-content: center; align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
    .modal-content {
        background: #1e293b;
        padding: 1.5rem;
        border-radius: 12px;
        width: 500px;
        max-width: 90%;
        max-height: 85vh; 
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .repairer-list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.8rem;
        background: rgba(255, 255, 255, 0.03);
        margin-bottom: 0.5rem;
        border-radius: 8px;
        border: 1px solid transparent;
        transition: all 0.2s;
    }
    .repairer-list-item:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
    }
    .repairer-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .repairer-role-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .role-badge {
        padding: 0.2rem 0.6rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    .role-badge.primary { background: rgba(0, 242, 255, 0.2); color: #00f2ff; }
    .role-badge.helper { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
    
    .btn-manage-repairers {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0 0.5rem;
        transition: color 0.2s;
        z-index: 5;
    }
    .btn-manage-repairers:hover {
        color: white;
    }
    
    .additional-count {
        background: var(--accent-color);
        color: black;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
        position: absolute;
        top: -5px;
        right: -5px;
        z-index: 2;
    }
  `]
})
export class DatabaseExplorerComponent implements OnInit {
  private repairService = inject(RepairService);
  private router = inject(Router);

  collections$: Observable<string[]> = of([]);
  selectedCollection: string | null = null;
  data$: Observable<any[]> | null = null;
  selectedItems = new Set<string>();

  // For inline editing
  repairers$: Observable<any[]> = of([]);
  editingRepairer: any | null = null;
  repairerMap: Map<string, string> = new Map();

  // Repairer Assignment Modal
  showRepairerModal = false;
  selectedItemForAssignment: RepairItem | null = null;
  assignmentPrimary: string = '';
  assignmentAdditional: Set<string> = new Set();

  viewMode: 'table' | 'json' = 'table';

  ngOnInit() {
    this.repairers$ = this.repairService.getRepairers();
    this.collections$ = this.repairService.getTrackedCollections();
    // Auto-select first default
    this.selectCollection('repairItems');

    // Build lookup map for photos
    this.repairers$.subscribe(repairers => {
      this.repairerMap.clear();
      repairers.forEach(r => {
        if (r.photoUrl) {
          this.repairerMap.set(r.name, r.photoUrl);
        }
      });
    });
  }

  getRepairerPhoto(name: string): string | null {
    if (!name) return null;
    return this.repairerMap.get(name) || null;
  }

  openAssignmentModal(item: RepairItem) {
    this.selectedItemForAssignment = item;
    this.assignmentPrimary = item.repairer || '';
    this.assignmentAdditional = new Set(item.additionalRepairers || []);
    // Ensure primary is not in additional
    if (this.assignmentPrimary) {
      this.assignmentAdditional.delete(this.assignmentPrimary);
    }
    this.showRepairerModal = true;
  }

  closeAssignmentModal() {
    this.showRepairerModal = false;
    this.selectedItemForAssignment = null;
  }

  toggleAdditionalRepairer(name: string) {
    if (name === this.assignmentPrimary) return;

    if (this.assignmentAdditional.has(name)) {
      this.assignmentAdditional.delete(name);
    } else {
      this.assignmentAdditional.add(name);
    }
  }

  setPrimaryRepairer(name: string) {
    if (this.assignmentAdditional.has(name)) {
      this.assignmentAdditional.delete(name);
    }
    if (this.assignmentPrimary && this.assignmentPrimary !== name) {
      this.assignmentAdditional.add(this.assignmentPrimary);
    }
    this.assignmentPrimary = name;
  }

  async saveAssignment() {
    if (!this.selectedItemForAssignment) return;

    const updates: any = {
      repairer: this.assignmentPrimary || null,
      additionalRepairers: Array.from(this.assignmentAdditional)
    };

    // Update status logic
    const currentStatus = this.selectedItemForAssignment.status || 'New';
    if (this.assignmentPrimary && currentStatus === 'New') {
      updates.status = 'Assigned';
    } else if (!this.assignmentPrimary && this.assignmentAdditional.size === 0 && currentStatus === 'Assigned') {
      updates.status = 'New';
    }

    Object.assign(this.selectedItemForAssignment, updates);

    try {
      await this.repairService.updateRepairItem(this.selectedItemForAssignment.id!, updates);
      this.closeAssignmentModal();
    } catch (error) {
      console.error('Error saving assignment:', error);
      alert('Failed to save assignment.');
    }
  }

  selectCollection(colName: string) {
    this.selectedCollection = colName;
    this.selectedItems.clear(); // Clear selection when switching collections
    this.data$ = this.repairService.getCollectionData(colName).pipe(
      map(data => {
        // Sort data based on collection type
        if (colName === 'repairItems') {
          return data.sort((a, b) => (b.creationDate?.toMillis() || 0) - (a.creationDate?.toMillis() || 0));
        }
        if (colName === 'repairers') {
          return data.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (colName === 'owners') {
          return data.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (colName === 'tags') {
          return data.sort((a, b) => a.name.localeCompare(b.name));
        }
        return data;
      }),
      catchError(err => {
        console.error(`Error loading collection ${colName}:`, err);
        return of([]);
      })
    );
  }

  getCollectionLabel(col: string | null): string {
    if (!col) return '';
    switch (col) {
      case 'repairItems': return 'Repair Items';
      case 'repairers': return 'Repairers';
      case 'owners': return 'Owners';
      case 'tags': return 'Tags';
      default: return col;
    }
  }

  refresh() {
    if (this.selectedCollection) {
      this.selectCollection(this.selectedCollection);
    }
  }

  trackCollection() {
    const name = prompt('Enter the exact name of the collection to track (case-sensitive):');
    if (name) {
      this.repairService.trackCollection(name).then(() => {
        // Switch to it after a brief delay to allow propagation
        setTimeout(() => this.selectCollection(name), 500);
      });
    }
  }

  deleteCol(colName: string, event: Event) {
    event.stopPropagation(); // Prevent tab selection
    if (!colName) return;

    if (confirm(`Are you sure you want to delete the collection "${colName}"? \n\nThis will permanently delete ALL records in this collection. This action cannot be undone.`)) {
      this.repairService.deleteCollection(colName).then(() => {
        // If we deleted the current collection, switch to default
        if (this.selectedCollection === colName) {
          this.selectCollection('repairItems');
        }
      });
    }
  }

  toggleView() {
    this.viewMode = this.viewMode === 'table' ? 'json' : 'table';
  }

  getSchemaType(collectionName: string, data: any[]): 'repairItems' | 'repairers' | 'tags' | 'owners' | 'unknown' {
    // 1. Explicit overrides for system collections
    if (collectionName === 'repairItems' || collectionName === 'repairers' || collectionName === 'tags' || collectionName === 'owners') {
      return collectionName;
    }

    // 2. Duck typing for imported collections
    if (data && data.length > 0) {
      const sample = data[0];
      // Check for RepairItem signature
      if ('itemDescription' in sample && ('itemNumber' in sample || 'displayNumber' in sample)) {
        return 'repairItems';
      }
      // Check for Owner signature
      if ('firstSeen' in sample && 'name' in sample) {
        return 'owners';
      }
      // Check for Repairer signature
      if ('name' in sample && 'createdAt' in sample && Object.keys(sample).length < 6) {
        return 'repairers';
      }
    }

    return 'unknown';
  }

  async updateItem(item: RepairItem, field: string, value: any) {
    if (!item.id) return;

    const updates: Partial<RepairItem> = {};
    updates[field as keyof RepairItem] = value;

    // Logic: Auto-update status based on repairer assignment
    if (field === 'repairer') {
      const currentStatus = item.status || 'New';
      if (value && currentStatus === 'New') {
        updates.status = 'Assigned';
        (item as any).status = 'Assigned'; // Optimistic update
      } else if (!value && currentStatus === 'Assigned') {
        updates.status = 'New';
        (item as any).status = 'New'; // Optimistic update
      }
    }

    try {
      // Optimistic update
      (item as any)[field] = value;
      await this.repairService.updateRepairItem(item.id, updates);
    } catch (err) {
      console.error('Failed to update item:', err);
      // Revert/Refresh on failure
      this.refresh();
    }
  }

  toggleItemSelection(id: string, event: Event) {
    event.stopPropagation();
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  }

  toggleSelectAll(data: any[]) {
    if (this.selectedItems.size === data.length) {
      this.selectedItems.clear();
    } else {
      this.selectedItems.clear();
      data.forEach(item => this.selectedItems.add(item.id));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedItems.has(id);
  }

  get selectedCount(): number {
    return this.selectedItems.size;
  }

  async deleteSelected() {
    const count = this.selectedItems.size;
    if (count === 0) return;

    const confirmed = confirm(`Are you sure you want to delete ${count} selected item${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      const idsToDelete = Array.from(this.selectedItems);
      await this.repairService.deleteMultipleRepairItems(idsToDelete);
      this.selectedItems.clear();
      // Refresh the view
      this.refresh();
    } catch (error) {
      console.error('Error deleting items:', error);
      alert('Failed to delete items. Please try again.');
    }
  }

  // Repairer Editing
  editRepairer(repairer: any) {
    this.editingRepairer = { ...repairer }; // Clone to avoid direct mutation
  }

  closeEdit() {
    this.editingRepairer = null;
  }

  async saveRepairer(event: { id?: string, name: string, photoUrl?: string }) {
    try {
      if (event.id) {
        await this.repairService.updateRepairer(event.id, {
          name: event.name,
          photoUrl: event.photoUrl
        });
      } else {
        await this.repairService.addRepairer(event.name, event.photoUrl);
      }
      this.closeEdit();
      // Refresh list
      this.refresh();
    } catch (error) {
      console.error('Error saving repairer:', error);
      alert('Failed to save repairer.');
    }
  }

  async deleteRepairer(id: string) {
    try {
      await this.repairService.deleteRepairer(id);
      this.closeEdit();
      this.refresh();
    } catch (error) {
      console.error('Error deleting repairer:', error);
      alert('Failed to delete repairer.');
    }
  }

  onRowDoubleClick(record: any, schema: string) {
    if (schema === 'repairItems' && record.id) {
      this.router.navigate(['/edit', record.id]);
    } else if (schema === 'repairers') {
      this.editRepairer(record);
    }
  }
}
