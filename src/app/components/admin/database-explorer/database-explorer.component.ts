import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../../services/repair.service';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { RepairItem } from '../../../models/repair-item.model';
import { Repairer } from '../../../models/repairer.model';
import { RepairerFormComponent } from '../repairer-form/repairer-form.component';

@Component({
  selector: 'app-database-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, RepairerFormComponent],
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
            
            <div class="search-filter" style="margin-bottom: 1rem; position: relative;">
                <input 
                    type="text" 
                    [(ngModel)]="repairerSearchTerm" 
                    placeholder="Search repairers..."
                    class="modal-search-input"
                    style="width: 100%; padding: 0.8rem 2.5rem 0.8rem 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; outline: none;">
                <button 
                  class="clear-btn modal-clear" 
                  *ngIf="repairerSearchTerm" 
                  (click)="repairerSearchTerm = ''"
                  style="right: 10px;">×</button>
            </div>
            
            <div class="repairer-list" style="flex: 1; overflow-y: auto; margin: 1rem 0; min-height: 0;">
                <div class="repairer-list-item" *ngFor="let repairer of filteredRepairers$ | async">
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
            <button class="btn-action" (click)="addRecord()" title="Add New Record">
              ➕
            </button>
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
                    *ngIf="selectedCount > 0"
                    class="btn-delete-selected"
                    (click)="deleteSelected()"
                    title="Delete Selected Records">
                    🗑️ ({{ selectedCount }})
                </button>
                <span class="count" *ngIf="data$ | async as data">{{ data.length }} records</span>
                <div class="gdpr-menu-wrapper">
                    <button class="btn-gdpr" (click)="toggleGdprMenu($event)" title="GDPR Options">
                        🔒 GDPR
                    </button>
                    <div class="gdpr-dropdown glass" *ngIf="showGdprMenu">
                        <div class="gdpr-dropdown-title">GDPR Actions — {{ getCollectionLabel(selectedCollection) }}</div>
                        <button class="gdpr-option" (click)="gdprMask()">
                            <span class="gdpr-option-icon">🎭</span>
                            <div>
                                <div class="gdpr-option-label">Mask</div>
                                <div class="gdpr-option-desc">Replace personal data with J***ohn format</div>
                            </div>
                        </button>
                        <button class="gdpr-option" (click)="gdprAnonymize()">
                            <span class="gdpr-option-icon">🙈</span>
                            <div>
                                <div class="gdpr-option-label">Anonymize</div>
                                <div class="gdpr-option-desc">Replace personal data with [ANONYMIZED]</div>
                            </div>
                        </button>
                        <button class="gdpr-option gdpr-option-danger" (click)="gdprPurge()">
                            <span class="gdpr-option-icon">🗑️</span>
                            <div>
                                <div class="gdpr-option-label">Purge</div>
                                <div class="gdpr-option-desc">Permanently delete all records in this collection</div>
                            </div>
                        </button>
                    </div>
                </div>
                <button class="btn-toggle" (click)="toggleView()" [title]="viewMode === 'table' ? 'Switch to JSON View' : 'Switch to Table View'">
                    {{ viewMode === 'table' ? '📝' : '{}' }}
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
                            <th class="checkbox-col">
                                <input 
                                    type="checkbox" 
                                    [checked]="data.length > 0 && selectedCount === data.length"
                                    (change)="toggleSelectAll(data)"
                                    title="Select All">
                            </th>
                            <th *ngIf="schema === 'repairItems'" class="photo-col">Photo</th>
                            <th *ngIf="schema === 'repairItems'" (click)="onSort('itemNumber')" class="sortable" title="Item Number"># {{ getSortIcon('itemNumber') }}</th>
                            <th *ngIf="schema === 'repairItems'" (click)="onSort('itemDescription')" class="sortable description-col" title="Item Description">Description {{ getSortIcon('itemDescription') }}</th>
                            <th *ngIf="schema === 'repairItems'" (click)="onSort('owner')" class="sortable owner-col" title="Owner">Owner {{ getSortIcon('owner') }}</th>
                            <th *ngIf="schema === 'repairItems'" (click)="onSort('repairItem')" class="sortable" title="Item Type">Category {{ getSortIcon('repairItem') }}</th>
                             <th *ngIf="schema === 'repairItems'" (click)="onSort('repairer')" class="sortable" title="Assigned Primary Repairer">Primary Repairer {{ getSortIcon('repairer') }}</th>
                             <th *ngIf="schema === 'repairItems'" (click)="onSort('RCDay')" class="sortable" title="Repair Session Date">RC Session {{ getSortIcon('RCDay') }}</th>
                             <th *ngIf="schema === 'repairItems'" (click)="onSort('creationDate')" class="sortable" title="Record Creation Date">Created {{ getSortIcon('creationDate') }}</th>
                            <th *ngIf="schema === 'repairItems'" (click)="onSort('status')" class="sortable" title="Status Indicator">Status {{ getSortIcon('status') }}</th>
                            
                            <th *ngIf="schema === 'repairers'" (click)="onSort('name')" class="sortable">Name {{ getSortIcon('name') }}</th>
                            <th *ngIf="schema === 'repairers'" (click)="onSort('isPrimary')" class="sortable">Role {{ getSortIcon('isPrimary') }}</th>
                            <th *ngIf="schema === 'repairers'" (click)="onSort('createdAt')" class="sortable">Joined {{ getSortIcon('createdAt') }}</th>

                            <th *ngIf="schema === 'owners'" (click)="onSort('name')" class="sortable" title="Owner Name">👤 {{ getSortIcon('name') }}</th>
                            <th *ngIf="schema === 'owners'" (click)="onSort('telephone')" class="sortable" title="Telephone">📞 {{ getSortIcon('telephone') }}</th>
                            <th *ngIf="schema === 'owners'" (click)="onSort('email')" class="sortable" title="Email">📧 {{ getSortIcon('email') }}</th>
                            <th *ngIf="schema === 'owners'" (click)="onSort('firstSeen')" class="sortable" title="First Seen Date">📅 {{ getSortIcon('firstSeen') }}</th>

                            <th *ngIf="schema === 'tags'" (click)="onSort('name')" class="sortable" title="Tag Name">🏷️ {{ getSortIcon('name') }}</th>
                            <th *ngIf="schema === 'tags'" (click)="onSort('emoji')" class="sortable" title="Emoji">😀 {{ getSortIcon('emoji') }}</th>
                            
                            <th [title]="schema === 'owners' ? 'Delete Owner' : 'Actions'">{{ schema === 'owners' ? '🗑️' : 'Actions' }}</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr *ngFor="let record of data" (dblclick)="onRowDoubleClick(record, schema)" class="clickable-row">
                            <td class="checkbox-col">
                                <input 
                                    type="checkbox" 
                                    [checked]="isSelected(record.id)"
                                    (change)="toggleItemSelection(record.id, $event)">
                            </td>
                            <ng-container *ngIf="schema === 'repairItems'">
                            <td>
                                <div class="thumbnail-container" *ngIf="record.photos && record.photos.length > 0"
                                     (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                                    <a [href]="record.photos[0]" target="_blank">
                                        <img [src]="record.photos[0]" alt="Item" class="item-thumbnail" loading="lazy">
                                    </a>
                                </div>
                                <label *ngIf="!record.photos || record.photos.length === 0"
                                       class="btn-add-photo"
                                       [class.uploading]="uploadingPhotoId === record.id"
                                       [title]="uploadingPhotoId === record.id ? 'Uploading...' : 'Add photo'"
                                       (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                                    <input type="file" accept="image/*" style="display:none"
                                           (change)="uploadPhotoForRecord(record, $event)"
                                           [disabled]="uploadingPhotoId === record.id">
                                    <span *ngIf="uploadingPhotoId !== record.id">📷</span>
                                    <span *ngIf="uploadingPhotoId === record.id" class="photo-spinner"></span>
                                </label>
                            </td>
                            <td [title]="record.displayNumber || record.itemNumber">{{ record.displayNumber || record.itemNumber }}</td>
                            <td class="description-col">
                                <input 
                                    [ngModel]="record.itemDescription" 
                                    (blur)="updateRecord(record, schema, 'itemDescription', $event)"
                                    class="inline-input"
                                    [title]="record.itemDescription"
                                    placeholder="Description">
                            </td>
                            <td class="owner-col" (dblclick)="selectCollection('owners')" title="Double-click to manage owners">
                                <div class="lov-container">
                                    <select 
                                        [ngModel]="record.owner || ''" 
                                        (ngModelChange)="updateItem(record, 'owner', $event)"
                                        class="inline-select owner-select"
                                        [title]="record.owner || ''"
                                        (click)="$event.stopPropagation()">
                                        <option value="" disabled>Select Owner...</option>
                                        <option *ngFor="let owner of owners" [value]="owner.name">{{ owner.name }}</option>
                                    </select>
                                    <button 
                                        *ngIf="record.owner"
                                        class="clear-btn inline-clear" 
                                        (click)="$event.stopPropagation(); updateItem(record, 'owner', '')"
                                        title="Clear owner">
                                        &times;
                                    </button>
                                </div>
                            </td>
                            <td class="type-col" (dblclick)="selectCollection('tags')" title="Double-click to manage tags">
                                <div class="lov-container">
                                    <select 
                                        [ngModel]="record.repairItem || ''" 
                                        (ngModelChange)="updateItem(record, 'repairItem', $event)"
                                        class="inline-select type-select"
                                        [title]="record.repairItem || ''"
                                        (click)="$event.stopPropagation()">
                                        <option value="" disabled>Select Type...</option>
                                        <option *ngFor="let tag of tags" [value]="tag.name">{{ tag.name }}</option>
                                    </select>
                                    <button 
                                        *ngIf="record.repairItem"
                                        class="clear-btn inline-clear" 
                                        (click)="$event.stopPropagation(); updateItem(record, 'repairItem', '')"
                                        title="Clear type">
                                        &times;
                                    </button>
                                </div>
                            </td>
                            <td (dblclick)="selectCollection('repairers')" title="Double-click to manage repairers">
                              <div class="repairer-select-wrapper">
                                <img *ngIf="getRepairerPhoto(record.repairer)"
                                     [src]="getRepairerPhoto(record.repairer)"
                                     class="repairer-avatar-display"
                                     [title]="record.repairer"
                                     alt="Repairer">

                                <div class="lov-container">
                                    <select
                                        [ngModel]="record.repairer || ''"
                                        (ngModelChange)="updateItem(record, 'repairer', $event)"
                                        class="inline-select repairer-select"
                                        [title]="record.repairer || ''"
                                        (click)="$event.stopPropagation()">
                                        <option value="" disabled>Select Repairer...</option>
                                        <option *ngFor="let r of filteredRepairers" [value]="r.name">{{ r.name }}</option>
                                    </select>
                                    <button
                                        *ngIf="record.repairer"
                                        class="clear-btn inline-clear"
                                        (click)="$event.stopPropagation(); updateItem(record, 'repairer', '')"
                                        title="Clear repairer">
                                        &times;
                                    </button>
                                </div>
                                <span class="additional-count" *ngIf="record.additionalRepairers?.length"
                                  [title]="'Secondary: ' + record.additionalRepairers?.join(', ')">
                                  +{{ record.additionalRepairers?.length }}
                                </span>
                              </div>
                            </td>
                             <td>
                               <div class="lov-container">
                                 <select
                                   [ngModel]="record.RCDay || ''"
                                   (ngModelChange)="updateItem(record, 'RCDay', $event)"
                                   class="inline-select rcsession-select"
                                   [style.color]="!record.RCDay ? '#ff4444' : 'inherit'"
                                   [style.font-weight]="!record.RCDay ? 'bold' : 'normal'"
                                   [title]="record.RCDay || 'MISSING DATE'"
                                   (click)="$event.stopPropagation()">
                                   <option value="" disabled>{{ record.RCDay ? 'Change Date...' : '⚠️ MISSING DATE' }}</option>
                                   <option *ngFor="let d of availableRCDates" [value]="d.value">{{ d.label }}</option>
                                 </select>
                                 <button
                                   *ngIf="record.RCDay"
                                   class="clear-btn inline-clear"
                                   (click)="$event.stopPropagation(); updateItem(record, 'RCDay', '')"
                                   title="Clear date">
                                   &times;
                                 </button>
                               </div>
                             </td>
                             <td [title]="record.creationDate?.toDate ? (record.creationDate?.toDate() | date:'short') : '-'">{{ record.creationDate?.toDate ? (record.creationDate?.toDate() | date:'short') : '-' }}</td>
                            <td>
                              <div class="lov-container">
                                <select
                                  [ngModel]="record.status || 'New'"
                                  (ngModelChange)="updateItem(record, 'status', $event)"
                                  class="inline-select status-select"
                                  [ngClass]="{
                                    'status-new':              (record.status || 'New') === 'New',
                                    'status-assigned':         record.status === 'Assigned',
                                    'status-repaired':         record.status === 'Repaired',
                                    'status-advice':           record.status === 'Advice Given',
                                    'status-partial':          record.status === 'Partially Repaired',
                                    'status-not-repaired':     record.status === 'Not Repaired'
                                  }"
                                  [title]="record.status || 'New'"
                                  (click)="$event.stopPropagation()">
                                  <option value="New">New</option>
                                  <option value="Assigned">Assigned</option>
                                  <optgroup label="Completed">
                                    <option value="Repaired">Repaired</option>
                                    <option value="Advice Given">Advice Given</option>
                                    <option value="Partially Repaired">Partially Repaired</option>
                                    <option value="Not Repaired">Not Repaired</option>
                                  </optgroup>
                                </select>
                              </div>
                            </td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'repairers'">
                            <td>
                              <div class="repairer-cell">
                                <img [src]="record.photoUrl || 'assets/placeholder-avatar.png'" class="repairer-avatar" alt="Avatar">
                                <input 
                                    [ngModel]="record.name" 
                                    (blur)="updateRecord(record, schema, 'name', $event)"
                                    class="inline-input"
                                    [title]="record.name || ''"
                                    placeholder="Name">
                              </div>
                            </td>
                            <td>
                              <span class="role-badge" [class.primary]="record.isPrimary" [class.secondary]="!record.isPrimary">
                                {{ record.isPrimary ? 'Primary' : 'Secondary' }}
                              </span>
                            </td>
                            <td [title]="record.createdAt?.toDate ? (record.createdAt?.toDate() | date:'mediumDate') : (record.createdAt | date:'mediumDate')">{{ record.createdAt?.toDate ? (record.createdAt?.toDate() | date:'mediumDate') : (record.createdAt | date:'mediumDate') }}</td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'owners'">
                            <td>
                                <input 
                                    [ngModel]="record.name" 
                                    (blur)="updateRecord(record, schema, 'name', $event)"
                                    class="inline-input"
                                    [title]="record.name || ''"
                                    placeholder="Name">
                            </td>
                            <td>
                                <input 
                                    [ngModel]="record.telephone" 
                                    (blur)="updateRecord(record, schema, 'telephone', $event)"
                                    class="inline-input"
                                    [title]="record.telephone || ''"
                                    placeholder="Telephone">
                            </td>
                            <td>
                                <input 
                                    [ngModel]="record.email" 
                                    (blur)="updateRecord(record, schema, 'email', $event)"
                                    class="inline-input"
                                    [title]="record.email || ''"
                                    placeholder="Email">
                            </td>
                            <td [title]="record.firstSeen?.toDate ? (record.firstSeen?.toDate() | date:'mediumDate') : '-'">{{ record.firstSeen?.toDate ? (record.firstSeen?.toDate() | date:'mediumDate') : '-' }}</td>
                            </ng-container>

                            <ng-container *ngIf="schema === 'tags'">
                            <td>
                                <input 
                                    [ngModel]="record.name" 
                                    (blur)="updateRecord(record, schema, 'name', $event)"
                                    class="inline-input"
                                    [title]="record.name || ''"
                                    placeholder="Tag Name">
                            </td>
                            <td class="emoji-cell">
                                <input 
                                    [ngModel]="record.emoji" 
                                    (blur)="updateRecord(record, schema, 'emoji', $event)"
                                    class="inline-input emoji-input"
                                    [title]="record.emoji || ''"
                                    placeholder="Emoji">
                            </td>
                            </ng-container>

                            <td>
                                <ng-container *ngIf="schema === 'repairItems'">
                                  <div class="row-action-wrapper">
                                    <button class="btn-row-menu" (click)="toggleRowMenu(record.id, $event)" title="Actions">&#8942;</button>
                                    <div class="row-action-dropdown"
                                         *ngIf="openRowMenuId === record.id"
                                         [style.top.px]="rowMenuPosition.top"
                                         [style.right.px]="rowMenuPosition.right"
                                         style="position:fixed;">
                                      <button class="row-dropdown-item item-complete" (click)="completeRepairItem(record.id, $event)">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        Complete
                                      </button>
                                      <div class="row-dropdown-divider"></div>
                                      <button class="row-dropdown-item item-delete" (click)="deleteRepairItem(record.id, record.displayNumber || record.itemNumber, $event)">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </ng-container>
                                <button *ngIf="schema === 'repairers'" (click)="editRepairer(record)" class="btn-icon" title="Edit Repairer">✏️</button>
                                <button *ngIf="schema === 'repairers'" (click)="openRepairerDashboard(record, $event)" class="btn-icon btn-icon-dashboard" title="View Dashboard">
                                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="3" width="6" height="10" rx="1"></rect>
                                    <rect x="10" y="3" width="12" height="6" rx="1"></rect>
                                    <rect x="10" y="13" width="12" height="8" rx="1"></rect>
                                    <rect x="2" y="17" width="6" height="4" rx="1"></rect>
                                  </svg>
                                </button>
                                <button *ngIf="schema === 'owners'" (click)="deleteOwner(record.id, record.name, $event)" class="btn-icon" title="Delete Owner">🗑️</button>
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
    
    th.sortable {
        cursor: pointer;
        user-select: none;
    }
    th.sortable:hover {
        background: rgba(255,255,255,0.1);
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
    .btn-icon-dashboard { color: rgba(255,255,255,0.4); }
    .btn-icon-dashboard:hover { background: rgba(0,242,255,0.08) !important; border-color: rgba(0,242,255,0.4) !important; color: var(--accent-color); }

    .row-action-wrapper { position: relative; display: flex; justify-content: center; }
    .btn-row-menu {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      color: rgba(255,255,255,0.85);
      cursor: pointer;
      border-radius: 6px;
      width: 32px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      line-height: 1;
      transition: all 0.15s;
    }
    .btn-row-menu:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.35); color: white; }
    .row-action-dropdown {
      background: #1a2236;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 0.3rem;
      min-width: 140px;
      z-index: 2000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      animation: rowMenuFade 0.1s ease-out;
    }
    @keyframes rowMenuFade {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .row-dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.8);
      padding: 0.5rem 0.75rem;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      text-align: left;
      transition: all 0.12s;
    }
    .row-dropdown-item:hover { background: rgba(255,255,255,0.07); color: white; }
    .item-complete:hover { background: rgba(40,180,99,0.15) !important; color: #58d68d !important; }
    .item-delete:hover   { background: rgba(231,76,60,0.12)  !important; color: #f1948a !important; }
    .row-dropdown-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 0.2rem 0.4rem; }

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

    .description-col {
        min-width: 250px;
    }

    .data-table tr:hover td {
      background: rgba(255, 255, 255, 0.04);
      cursor: pointer;
    }

    .data-table tr {
        transition: background 0.2s;
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
      border: 1px solid rgba(0, 242, 255, 0.3);
      box-shadow: 0 0 10px rgba(0, 242, 255, 0.1);
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

    .owner-select {
        width: 100%;
        min-width: 150px !important;
        padding-right: 50px; /* Space for clear button and arrow */
    }

    .owner-col {
        min-width: 220px !important;
        width: 220px !important;
    }

    .type-col {
        min-width: 180px !important;
        width: 180px !important;
    }

    .type-select {
        width: 100%;
        min-width: 120px !important;
        padding-right: 50px; /* Space for clear button and arrow */
    }

    .lov-container {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
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
        width: 100%;
        min-width: 140px;
        padding-right: 10px;
    }

    .rcsession-select {
        width: 100%;
        min-width: 130px;
        padding-right: 50px;
    }

    .status-new {
        background: rgba(74, 144, 226, 0.15) !important;
        color: #7ab1f7 !important;
        border: 1px solid rgba(74, 144, 226, 0.4) !important;
    }
    .status-assigned {
        background: rgba(241, 196, 15, 0.15) !important;
        color: #fce170 !important;
        border: 1px solid rgba(241, 196, 15, 0.4) !important;
    }
    .status-repaired {
        background: rgba(40, 180, 99, 0.15) !important;
        color: #58d68d !important;
        border: 1px solid rgba(40, 180, 99, 0.4) !important;
    }
    .status-advice {
        background: rgba(230, 126, 34, 0.15) !important;
        color: #f0a055 !important;
        border: 1px solid rgba(230, 126, 34, 0.4) !important;
    }
    .status-partial {
        background: rgba(230, 126, 34, 0.15) !important;
        color: #f0a055 !important;
        border: 1px solid rgba(230, 126, 34, 0.4) !important;
    }
    .status-not-repaired {
        background: rgba(231, 76, 60, 0.15) !important;
        color: #f1948a !important;
        border: 1px solid rgba(231, 76, 60, 0.4) !important;
    }

    .inline-input {
        background: transparent;
        border: 1px solid transparent;
        color: rgba(255, 255, 255, 0.8);
        padding: 0.4rem;
        border-radius: 4px;
        width: 100%;
        font-size: 0.9rem;
        transition: all 0.2s;
    }

    .inline-input:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .inline-input:focus {
        background: rgba(0, 0, 0, 0.3);
        border-color: var(--accent-color);
        color: white;
        outline: none;
    }

    .emoji-input {
        font-size: 1.5rem;
        text-align: center;
    }

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

    .btn-add-photo {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 4px;
        border: 1px dashed rgba(255, 255, 255, 0.2);
        cursor: pointer;
        font-size: 1.1rem;
        transition: all 0.2s;
        background: transparent;
    }
    .btn-add-photo:hover {
        border-color: var(--accent-color);
        background: rgba(0, 242, 255, 0.08);
    }
    .btn-add-photo.uploading {
        border-color: var(--accent-color);
        opacity: 0.7;
        cursor: not-allowed;
    }
    .photo-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: var(--accent-color);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

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
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        min-width: 120px;
    }

    .repairer-avatar-display {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    .repairer-select-wrapper .lov-container {
        flex: 1;
        min-width: 0;
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
    .role-badge.secondary { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
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
        background: rgba(0, 242, 255, 0.15);
        color: var(--accent-color);
        border: 1px solid rgba(0, 242, 255, 0.3);
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.1rem 0.4rem;
        border-radius: 10px;
        flex-shrink: 0;
        cursor: default;
        white-space: nowrap;
    }

    .inline-autocomplete {
        width: 100%;
    }
    .inline-suggestions {
        position: fixed;
        width: 250px;
        max-height: 300px;
        z-index: 2000;
        transform: translateY(10px);
    }
    .suggestion-item img {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
    }
    .suggestion-name {
        font-size: 0.9rem;
    }
    .repairer-autocomplete {
        flex: 1;
        margin-left: 35px;
    }

    .clear-btn {
        background: none;
        border: none;
        color: rgba(255,255,255,0.5);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: color 0.2s;
    }

    .clear-btn:hover {
        color: var(--accent-color);
    }

    .inline-clear {
        position: absolute;
        right: 30px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 5;
    }

    .search-box {
        position: relative;
        display: flex;
        align-items: center;
    }

    .modal-clear {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
    }

    /* GDPR Menu */
    .gdpr-menu-wrapper {
        position: relative;
    }
    .btn-gdpr {
        background: rgba(255, 180, 0, 0.12);
        border: 1px solid rgba(255, 180, 0, 0.35);
        color: #ffb400;
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .btn-gdpr:hover {
        background: rgba(255, 180, 0, 0.2);
        border-color: #ffb400;
    }
    .gdpr-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        width: 280px;
        z-index: 500;
        border-radius: 10px;
        padding: 0.6rem;
        border: 1px solid rgba(255, 180, 0, 0.25);
        background: #1a2236;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .gdpr-dropdown-title {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.35);
        padding: 0.3rem 0.6rem 0.5rem;
    }
    .gdpr-option {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        width: 100%;
        background: transparent;
        border: 1px solid transparent;
        color: white;
        padding: 0.6rem 0.7rem;
        border-radius: 7px;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s;
        margin-bottom: 0.25rem;
    }
    .gdpr-option:last-child { margin-bottom: 0; }
    .gdpr-option:hover {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.1);
    }
    .gdpr-option-danger:hover {
        background: rgba(255, 60, 60, 0.12);
        border-color: rgba(255, 60, 60, 0.3);
        color: #ff6b6b;
    }
    .gdpr-option-icon {
        font-size: 1.2rem;
        flex-shrink: 0;
    }
    .gdpr-option-label {
        font-size: 0.9rem;
        font-weight: 600;
    }
    .gdpr-option-desc {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.45);
        margin-top: 0.1rem;
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
  // Repairer Assignment Modal
  showRepairerModal = false;
  selectedItemForAssignment: RepairItem | null = null;
  assignmentPrimary: string = '';
  assignmentAdditional: Set<string> = new Set();

  viewMode: 'table' | 'json' = 'table';
  repairerSearchTerm = '';

  // Inline Autocomplete
  owners: any[] = [];
  tags: any[] = [];
  filteredOwners: any[] = [];
  filteredRepairers: any[] = [];
  activeSuggestionCell: { id: string, field: string } | null = null;

  // Sorting
  sortState$ = new BehaviorSubject<{ column: string, direction: 'asc' | 'desc' }>({ column: '', direction: 'asc' });

  availableRCDates: { label: string, value: string, date: Date }[] = [];

  ngOnInit() {
    this.availableRCDates = this.repairService.getAvailableRCDates();
    this.repairers$ = this.repairService.getRepairers();
    this.collections$ = this.repairService.getTrackedCollections().pipe(
      map(cols => cols.sort((a, b) => {
        const order = ['repairItems', 'owners', 'repairers', 'tags'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      }))
    );
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
      this.filteredRepairers = repairers.filter(r => r.isPrimary === true);
    });

    this.repairService.getOwners().subscribe(owners => {
      this.owners = owners;
    });

    this.repairService.getCollectionData('tags').subscribe(tags => {
      this.tags = tags;
    });
  }

  getRepairerPhoto(name: string): string | null {
    if (!name) return null;
    return this.repairerMap.get(name) || null;
  }

  get filteredRepairers$(): Observable<any[]> {
    return this.repairers$.pipe(
      map(repairers => {
        if (!this.repairerSearchTerm.trim()) return repairers;
        const term = this.repairerSearchTerm.toLowerCase();
        return repairers.filter(r => r.name.toLowerCase().includes(term));
      })
    );
  }

  openAssignmentModal(item: RepairItem) {
    this.selectedItemForAssignment = item;
    this.assignmentPrimary = item.repairer || '';
    this.assignmentAdditional = new Set(item.additionalRepairers || []);
    this.repairerSearchTerm = ''; // Clear search
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

  // Inline Autocomplete Logic

  onInlineRepairerSearch(value: string, recordId: string) {
    this.activeSuggestionCell = { id: recordId, field: 'repairer' };
    const term = (value || '').toLowerCase();
    this.filteredRepairers = this.repairerMap.size > 0 ?
      Array.from(this.repairerMap.keys())
        .filter(name => !term || name.toLowerCase().includes(term))
        .map(name => ({ name, photoUrl: this.repairerMap.get(name) }))
      : [];

    // If map is empty or doesn't have all, use repairers list if available
    if (this.filteredRepairers.length === 0 && this.owners.length > 0) {
      // Fallback logic if needed, but repairerMap is usually good
    }
  }

  selectInlineRepairer(repairer: any, record: any) {
    this.updateItem(record, 'repairer', repairer.name);
    this.hideInlineSuggestions();
  }

  clearInlineRepairer(record: any) {
    this.updateItem(record, 'repairer', '');
    this.hideInlineSuggestions();
  }

  hideInlineSuggestions() {
    setTimeout(() => {
      this.activeSuggestionCell = null;
    }, 200);
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

  // ... (rest of methods)

  selectCollection(colName: string) {
    this.selectedCollection = colName;
    this.selectedItems.clear(); // Clear selection
    // Reset sort when switching, or set default for repairItems
    if (colName === 'repairItems') {
      this.sortState$.next({ column: 'creationDate', direction: 'desc' });
    } else {
      this.sortState$.next({ column: 'name', direction: 'asc' });
    }

    this.data$ = combineLatest([
      this.repairService.getCollectionData(colName),
      this.sortState$
    ]).pipe(
      map(([data, sort]) => {
        if (!sort.column) return data;

        return data.sort((a, b) => {
          let valA = a[sort.column];
          let valB = b[sort.column];

          // Handle undefined/null
          if (valA === undefined || valA === null) valA = '';
          if (valB === undefined || valB === null) valB = '';

          // Handle dates (Firestore Timestamps)
          if (valA && typeof valA.toMillis === 'function') valA = valA.toMillis();
          if (valB && typeof valB.toMillis === 'function') valB = valB.toMillis();

          // Handle dates (JS Date objects if any)
          if (valA instanceof Date) valA = valA.getTime();
          if (valB instanceof Date) valB = valB.getTime();

          // Handle strings (case insensitive)
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();

          // Comparison
          if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }),
      catchError(err => {
        console.error(`Error loading collection ${colName}:`, err);
        return of([]);
      })
    );
  }

  onSort(column: string) {
    const current = this.sortState$.value;
    if (current.column === column) {
      // Toggle direction
      this.sortState$.next({
        column,
        direction: current.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // New column, default asc (except maybe dates? but consistent is better)
      this.sortState$.next({
        column,
        direction: 'asc'
      });
    }
  }

  getSortIcon(column: string): string {
    const current = this.sortState$.value;
    if (current.column !== column) return '';
    return current.direction === 'asc' ? '↑' : '↓';
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





  async addRecord() {
    if (!this.selectedCollection) return;

    try {
      if (this.selectedCollection === 'repairItems') {
        // Create new RepairItem with minimal required fields
        // ID, creationDate, itemNumber, etc. are handled by the service
        const newItem = {
          itemDescription: '',
          owner: '',
          status: 'New',
          photos: [],
          RCDay: this.repairService.getNextRCDay(),
          category: 'Electrical'
        };
        await this.repairService.addRepairItem(newItem);
      } else if (this.selectedCollection === 'repairers') {
        const name = prompt('Enter name for new repairer:');
        if (name) {
          await this.repairService.addRepairer(name);
        }
      } else if (this.selectedCollection === 'owners') {
        const name = prompt('Enter name for new owner:');
        if (name) {
          await this.repairService.ensureOwnerExists(name);
        }
      } else if (this.selectedCollection === 'tags') {
        const name = prompt('Enter name for new tag:');
        if (name) {
          await this.repairService.ensureTagExists(name);
        }
      }

      this.selectCollection(this.selectedCollection); // Refresh
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Failed to add record.');
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

    if (field === 'RCDay' && (!value || value.trim() === '')) {
      return;
      return; // Block blank date updates
    }

    updates[field as keyof RepairItem] = value;

    // RECALCULATE SEQUENCE if RCDay is changed
    if (field === 'RCDay') {
      const newSequence = await this.repairService.getSuggestedDisplayNumber(value);
      updates.displayNumber = newSequence;
      (item as any).displayNumber = newSequence; // Optimistic update
    }

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
      this.selectCollection(this.selectedCollection || 'repairItems');
    }
  }

  async updateRecord(record: any, schema: string, field: string, event: any) {
    const value = event.target.value;
    if (record[field] === value) return; // No change

    if (schema === 'repairItems') {
      await this.updateItem(record, field, value);
      return;
    }

    // Generic update for other schemas
    try {
      const updates: any = {};
      updates[field] = value;

      // Optimistic update
      record[field] = value;

      if (schema === 'repairers') {
        await this.repairService.updateRepairer(record.id, updates);
      } else if (schema === 'owners' || schema === 'tags') {
        // We might need a more generic update method in RepairService
        // but for now we'll use a local implementation or updateDoc directly if shared?
        // Actually RepairService should have it.
        await this.repairService.updateRecord(schema, record.id, updates);
      }
    } catch (err) {
      console.error(`Failed to update ${schema} record ${record.id}:`, err);
      this.selectCollection(this.selectedCollection!); // Refresh
    }
  }

  onRowDoubleClick(record: any, schema: string) {
    if (schema === 'repairItems' && record.id) {
      this.router.navigate(['/edit', record.id]);
    } else if (schema === 'repairers') {
      this.editRepairer(record);
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
    if (count === 0 || !this.selectedCollection) return;

    const confirmed = confirm(`Are you sure you want to delete ${count} selected record${count > 1 ? 's' : ''} from "${this.getCollectionLabel(this.selectedCollection)}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      const idsToDelete = Array.from(this.selectedItems);
      await this.repairService.deleteMultipleRecords(this.selectedCollection, idsToDelete);
      this.selectedItems.clear();
      // Refresh the view
      this.selectCollection(this.selectedCollection);
    } catch (error) {
      console.error('Error deleting records:', error);
      alert('Failed to delete records. Please try again.');
    }
  }

  // Repairer Editing
  editRepairer(repairer: any) {
    this.editingRepairer = { ...repairer }; // Clone to avoid direct mutation
  }

  openRepairerDashboard(repairer: any, event: MouseEvent) {
    event.stopPropagation();
    this.router.navigate(['/repairer-dashboard', encodeURIComponent(repairer.name)]);
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
      this.selectCollection(this.selectedCollection || 'repairItems');
    } catch (error) {
      console.error('Error saving repairer:', error);
      alert('Failed to save repairer.');
    }
  }

  async deleteRepairer(id: string) {
    try {
      await this.repairService.deleteRepairer(id);
      this.closeEdit();
      this.selectCollection(this.selectedCollection || 'repairItems');
    } catch (error) {
      console.error('Error deleting repairer:', error);
      alert('Failed to delete repairer.');
    }
  }

  async deleteOwner(id: string, name: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete owner "${name}"? This will not delete their repair records, but they will be removed from the owners list.`)) {
      try {
        await this.repairService.deleteMultipleRecords('owners', [id]);
        this.selectCollection('owners');
      } catch (error) {
        console.error('Error deleting owner:', error);
        alert('Failed to delete owner.');
      }
    }
  }

  async deleteRepairItem(id: string, label: any, event: Event) {
    event.stopPropagation();
    this.openRowMenuId = null;
    if (confirm(`Delete repair item "${label}"? This cannot be undone.`)) {
      try {
        await this.repairService.deleteMultipleRecords('repairItems', [id]);
        this.selectCollection('repairItems');
      } catch (error) {
        console.error('Error deleting repair item:', error);
        alert('Failed to delete repair item.');
      }
    }
  }

  uploadingPhotoId: string | null = null;

  // Row action menu (repair items)
  openRowMenuId: string | null = null;
  rowMenuPosition = { top: 0, right: 0 };

  private router2 = inject(Router);

  @HostListener('document:click')
  onDocumentClick2() {
    this.openRowMenuId = null;
  }

  toggleRowMenu(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openRowMenuId === id) { this.openRowMenuId = null; return; }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.rowMenuPosition = { top: rect.bottom + 4, right: window.innerWidth - rect.right };
    this.openRowMenuId = id;
  }

  completeRepairItem(id: string, event: Event) {
    event.stopPropagation();
    this.openRowMenuId = null;
    this.router2.navigate(['/complete', id]);
  }

  // GDPR
  showGdprMenu = false;

  private gdprPiiFields: Record<string, string[]> = {
    owners:      ['name', 'telephone', 'email'],
    repairItems: ['owner', 'telephone'],
    repairers:   ['name'],
  };

  @HostListener('document:click')
  onDocumentClick() {
    if (this.showGdprMenu) this.showGdprMenu = false;
  }

  toggleGdprMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showGdprMenu = !this.showGdprMenu;
  }

  closeGdprMenu() {
    this.showGdprMenu = false;
  }

  private maskValue(value: string): string {
    if (!value || typeof value !== 'string') return value;
    const v = value.trim();
    if (v.length <= 1) return v;
    if (v.length <= 4) return v[0] + '*'.repeat(v.length - 1);
    return v[0] + '*'.repeat(v.length - 4) + v.slice(-3);
  }

  async gdprMask() {
    this.showGdprMenu = false;
    const col = this.selectedCollection;
    if (!col) return;
    const piiFields = this.gdprPiiFields[col];
    if (!piiFields?.length) { alert('No personal data fields identified for this collection.'); return; }

    const label = this.getCollectionLabel(col);
    if (!confirm(`Mask all personal data in "${label}"?\n\nFields affected: ${piiFields.join(', ')}\n\nThis will apply first-letter/last-3-chars masking to every record. This cannot be undone.`)) return;

    try {
      const data = await this.repairService.getCollectionDataOnce(col);
      let updated = 0;
      for (const record of data) {
        const updates: any = {};
        let hasChange = false;
        for (const field of piiFields) {
          if (record[field]) { updates[field] = this.maskValue(record[field]); hasChange = true; }
        }
        if (hasChange) { await this.repairService.updateRecord(col, record.id, updates); updated++; }
      }
      this.selectCollection(col);
      alert(`Masked ${updated} record(s) in "${label}".`);
    } catch (err) {
      console.error('GDPR mask failed:', err);
      alert('GDPR mask operation failed.');
    }
  }

  async gdprAnonymize() {
    this.showGdprMenu = false;
    const col = this.selectedCollection;
    if (!col) return;
    const piiFields = this.gdprPiiFields[col];
    if (!piiFields?.length) { alert('No personal data fields identified for this collection.'); return; }

    const label = this.getCollectionLabel(col);
    if (!confirm(`Anonymize all personal data in "${label}"?\n\nFields affected: ${piiFields.join(', ')}\n\nAll values will be replaced with "[ANONYMIZED]". This cannot be undone.`)) return;

    try {
      const data = await this.repairService.getCollectionDataOnce(col);
      let updated = 0;
      for (const record of data) {
        const updates: any = {};
        let hasChange = false;
        for (const field of piiFields) {
          if (record[field]) { updates[field] = '[ANONYMIZED]'; hasChange = true; }
        }
        if (hasChange) { await this.repairService.updateRecord(col, record.id, updates); updated++; }
      }
      this.selectCollection(col);
      alert(`Anonymized ${updated} record(s) in "${label}".`);
    } catch (err) {
      console.error('GDPR anonymize failed:', err);
      alert('GDPR anonymize operation failed.');
    }
  }

  async gdprPurge() {
    this.showGdprMenu = false;
    const col = this.selectedCollection;
    if (!col) return;
    const label = this.getCollectionLabel(col);
    if (!confirm(`PERMANENTLY DELETE all records in "${label}"?\n\nThis will delete every record in this collection. This action CANNOT be undone.`)) return;
    if (!confirm(`Are you absolutely sure? All ${label} data will be gone forever.`)) return;

    try {
      await this.repairService.deleteCollection(col);
      this.selectCollection(col);
      alert(`All records in "${label}" have been purged.`);
    } catch (err) {
      console.error('GDPR purge failed:', err);
      alert('GDPR purge operation failed.');
    }
  }

  async uploadPhotoForRecord(record: any, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.uploadingPhotoId) return;
    this.uploadingPhotoId = record.id;
    try {
      const url = await this.repairService.uploadPhoto(file);
      await this.repairService.updateRepairItem(record.id, {
        ...record,
        photos: [...(record.photos || []), url]
      });
      this.selectCollection(this.selectedCollection || 'repairItems');
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Photo upload failed. Please try again.');
    } finally {
      this.uploadingPhotoId = null;
      input.value = '';
    }
  }


}
