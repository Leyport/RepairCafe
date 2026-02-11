import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepairService } from '../../../services/repair.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
    selector: 'app-database-explorer',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="explorer-container">
      <div class="explorer-header">
        <h3>📂 Database Explorer</h3>
        <p>Select a collection to view its records.</p>
      </div>

      <div class="collection-list">
        <button 
          *ngFor="let col of collections" 
          (click)="selectCollection(col)"
          [class.active]="selectedCollection === col"
          class="btn-col"
        >
          {{ col }}
        </button>
      </div>

      <div class="data-view glass" *ngIf="selectedCollection">
        <div class="data-header">
          <h4>Collection: {{ selectedCollection }}</h4>
          <span class="count" *ngIf="data$ | async as data">{{ data.length }} records</span>
        </div>

        <div class="records-container" *ngIf="data$ | async as data; else loading">
          <div class="record-card" *ngFor="let record of data">
            <div class="record-id">ID: {{ record.id }}</div>
            <pre class="record-data">{{ record | json }}</pre>
          </div>
          <div class="no-data" *ngIf="data.length === 0">
            No records found in this collection.
          </div>
        </div>
        <ng-template #loading>
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading records...</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
    styles: [`
    .explorer-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .explorer-header h3 {
      margin: 0;
      color: var(--accent-color);
    }
    .explorer-header p {
      margin: 0.5rem 0 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }
    .collection-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }
    .btn-col {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }
    .btn-col:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn-col.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
    }
    .data-view {
      padding: 1.5rem;
      border-radius: 12px;
      min-height: 400px;
    }
    .data-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0.8rem;
    }
    .data-header h4 {
      margin: 0;
      color: var(--accent-color);
    }
    .count {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }
    .records-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 600px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }
    .record-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
    }
    .record-id {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--accent-color);
      margin-bottom: 0.5rem;
      opacity: 0.8;
    }
    .record-data {
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-all;
      color: rgba(255, 255, 255, 0.8);
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: rgba(255, 255, 255, 0.4);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 242, 255, 0.1);
      border-left-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .no-data {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.4);
    }
    /* Simple scrollbar */
    .records-container::-webkit-scrollbar {
      width: 6px;
    }
    .records-container::-webkit-scrollbar-track {
      background: transparent;
    }
    .records-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
  `]
})
export class DatabaseExplorerComponent implements OnInit {
    private repairService = inject(RepairService);

    collections = ['repairItems', 'tags', 'repairers'];
    selectedCollection: string | null = null;
    data$: Observable<any[]> | null = null;

    ngOnInit() {
        // Optionally auto-select the first one
        // this.selectCollection(this.collections[0]);
    }

    selectCollection(colName: string) {
        this.selectedCollection = colName;
        this.data$ = this.repairService.getCollectionData(colName).pipe(
            catchError(err => {
                console.error(`Error loading collection ${colName}:`, err);
                return of([]);
            })
        );
    }
}
