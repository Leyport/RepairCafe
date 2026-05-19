import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { RepairService } from '../../../services/repair.service';
import { firstValueFrom } from 'rxjs';

const SYSTEM_COLLECTIONS = ['repairItems', 'repairers', 'tags', 'owners'];

interface AttributeOption {
  key: string;
  label: string;
}

const ATTRIBUTE_OPTIONS: AttributeOption[] = [
  { key: 'ignore',              label: '(Ignore)' },
  { key: 'itemDescription',     label: 'Description *' },
  { key: 'repairItem',          label: 'Item Type' },
  { key: 'fault',               label: 'Fault' },
  { key: 'owner',               label: 'Owner' },
  { key: 'telephone',           label: 'Telephone' },
  { key: 'repairer',            label: 'Repairer' },
  { key: 'additionalRepairers', label: 'Additional Repairers' },
  { key: 'status',              label: 'Status' },
  { key: 'category',            label: 'Category' },
  { key: 'tags',                label: 'Tags (comma-separated)' },
  { key: 'RCDay',               label: 'RC Day' },
  { key: 'make',                label: 'Make' },
  { key: 'model',               label: 'Model' },
  { key: 'colour',              label: 'Colour' },
  { key: 'serialNumber',        label: 'Serial Number' },
  { key: 'yearOfManufacture',   label: 'Year of Manufacture' },
  { key: 'ageOfItem',           label: 'Age of Item' },
  { key: 'displayNumber',       label: 'Display Number' },
];

interface FieldMapping {
  sourceField: string;
  sampleValue: any;
  targetKey: string;
}

@Component({
  selector: 'app-collection-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mapper-container">
      <div class="section-header">
        <h2>🔀 Collection Mapper</h2>
        <p>Map records from an imported collection to RepairItems and transfer them.</p>
      </div>

      <!-- Step 1: Choose source collection -->
      <div class="card step-card">
        <div class="step-label">Step 1 — Choose Source Collection</div>
        <div class="step-row">
          <select [(ngModel)]="selectedCollection" class="select-input" [disabled]="loadingRecords">
            <option value="">-- Select a collection --</option>
            <option *ngFor="let col of availableCollections" [value]="col">{{ col }}</option>
          </select>
          <button class="btn-primary" (click)="loadRecords()"
                  [disabled]="!selectedCollection || loadingRecords">
            <span *ngIf="!loadingRecords">Load Records</span>
            <span *ngIf="loadingRecords" class="spinner-row">
              <span class="spinner-small"></span> Loading…
            </span>
          </button>
        </div>
        <p *ngIf="loadError" class="error-msg">{{ loadError }}</p>
      </div>

      <!-- Step 2: Map fields -->
      <div class="card step-card" *ngIf="records.length > 0">
        <div class="step-label">Step 2 — Map Fields</div>
        <p class="record-count">
          <span class="badger">{{ records.length }}</span> record{{ records.length === 1 ? '' : 's' }} found
          in <strong>{{ selectedCollection }}</strong>
        </p>

        <div *ngIf="!descriptionMapped" class="warning-badge">
          ⚠️ <strong>itemDescription</strong> (Description *) is required — please map it before transferring.
        </div>

        <div class="mapping-table-wrap">
          <table class="mapping-table">
            <thead>
              <tr>
                <th>Source Field</th>
                <th>Sample Value</th>
                <th>Map To</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of fieldMappings" [class.required-row]="row.targetKey === 'itemDescription'">
                <td><code class="field-name">{{ row.sourceField }}</code></td>
                <td class="sample-value">{{ formatSample(row.sampleValue) }}</td>
                <td>
                  <select [(ngModel)]="row.targetKey" class="select-input select-small"
                          (ngModelChange)="onMappingChanged()">
                    <option *ngFor="let attr of attributeOptions" [value]="attr.key">{{ attr.label }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Step 3: Preview & Transfer -->
      <div class="card step-card" *ngIf="records.length > 0">
        <div class="step-label">Step 3 — Preview &amp; Transfer</div>

        <div class="preview-scroll-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th class="col-check sticky-col">
                  <input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll($event)" />
                </th>
                <th *ngFor="let col of previewColumns">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of previewRows; let i = index"
                  (click)="toggleRow(i)" [class.selected-row]="selectedRows[i]">
                <td class="col-check sticky-col" (click)="$event.stopPropagation(); toggleRow(i)">
                  <input type="checkbox" [checked]="selectedRows[i]" (change)="toggleRow(i); $event.stopPropagation()" />
                </td>
                <td *ngFor="let col of previewColumns">{{ row[col.sourceField] }}</td>
              </tr>
              <tr *ngIf="previewRows.length === 0">
                <td [attr.colspan]="previewColumns.length + 1" class="empty-msg">No records to preview.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="transfer-bar">
          <button class="btn-import"
                  [disabled]="selectedCount === 0 || !descriptionMapped || transferring"
                  (click)="transfer()">
            <span *ngIf="!transferring">
              Transfer {{ selectedCount }} Selected → repairItems
            </span>
            <span *ngIf="transferring" class="spinner-row">
              <span class="spinner-small"></span>
              Transferring ({{ transferProgress }}/{{ selectedCount }})…
            </span>
          </button>
          <span *ngIf="transferResult" class="transfer-result"
                [class.success]="transferSuccess" [class.partial]="!transferSuccess">
            {{ transferResult }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mapper-container {
      padding: 0;
    }
    .section-header {
      margin-bottom: 1.5rem;
    }
    .section-header h2 {
      margin: 0;
      color: var(--accent-color);
    }
    .section-header p {
      margin: 0.4rem 0 0;
      color: rgba(255,255,255,0.6);
      font-size: 0.9rem;
    }

    /* Cards */
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .step-card {
      position: relative;
    }
    .step-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-color);
      margin-bottom: 1rem;
    }

    /* Step 1 row */
    .step-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Inputs */
    .select-input {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff;
      padding: 0.5rem 0.75rem;
      font-size: 0.95rem;
      min-width: 220px;
    }
    .select-input:disabled {
      opacity: 0.5;
    }
    .select-small {
      min-width: 180px;
      font-size: 0.85rem;
      padding: 0.3rem 0.5rem;
    }

    /* Buttons */
    .btn-primary {
      background: var(--accent-color);
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 0.55rem 1.2rem;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
      transition: opacity 0.2s;
    }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-import {
      background: rgba(0,242,255,0.15);
      border: 1px solid var(--accent-color);
      color: var(--accent-color);
      border-radius: 8px;
      padding: 0.6rem 1.4rem;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
      transition: background 0.2s;
    }
    .btn-import:hover:not(:disabled) {
      background: rgba(0,242,255,0.25);
    }
    .btn-import:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Spinner */
    .spinner-row {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.3);
      border-left-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .btn-import .spinner-small {
      border-color: rgba(0,242,255,0.3);
      border-left-color: var(--accent-color);
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Record count */
    .record-count {
      margin: 0 0 1rem;
      color: rgba(255,255,255,0.7);
      font-size: 0.9rem;
    }

    /* Badger chip */
    .badger {
      display: inline-block;
      background: rgba(0,242,255,0.15);
      border: 1px solid var(--accent-color);
      color: var(--accent-color);
      border-radius: 4px;
      padding: 0.1rem 0.5rem;
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      margin-right: 0.3rem;
    }

    /* Warning badge */
    .warning-badge {
      background: rgba(255,200,0,0.12);
      border: 1px solid rgba(255,200,0,0.4);
      color: #ffd700;
      border-radius: 8px;
      padding: 0.5rem 0.9rem;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    /* Mapping table */
    .mapping-table-wrap {
      overflow-x: auto;
    }
    .mapping-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .mapping-table th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.5);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .mapping-table td {
      padding: 0.45rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      vertical-align: middle;
    }
    .mapping-table tr:last-child td {
      border-bottom: none;
    }
    .required-row td {
      background: rgba(0,242,255,0.04);
    }
    .field-name {
      background: rgba(255,255,255,0.07);
      border-radius: 4px;
      padding: 0.1rem 0.4rem;
      font-size: 0.82rem;
      color: var(--accent-color);
    }
    .sample-value {
      color: rgba(255,255,255,0.55);
      font-size: 0.85rem;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Preview table */
    .preview-scroll-wrap {
      overflow-x: auto;
      max-height: 360px;
      overflow-y: auto;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      margin-bottom: 1.2rem;
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      min-width: 500px;
    }
    .preview-table thead {
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(20,20,30,0.95);
    }
    .preview-table th {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.5);
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .preview-table td {
      padding: 0.4rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.75);
      white-space: nowrap;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .preview-table tr:hover td {
      background: rgba(0,242,255,0.05);
      cursor: pointer;
    }
    .selected-row td {
      background: rgba(0,242,255,0.08) !important;
    }
    .col-check {
      width: 38px;
      text-align: center;
    }
    .sticky-col {
      position: sticky;
      left: 0;
      background: rgba(18,18,28,0.97);
      z-index: 1;
    }
    .preview-table thead .sticky-col {
      z-index: 3;
    }
    .empty-msg {
      text-align: center;
      color: rgba(255,255,255,0.35);
      padding: 1.5rem;
    }

    /* Transfer bar */
    .transfer-bar {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      flex-wrap: wrap;
    }
    .transfer-result {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .transfer-result.success {
      color: #4cff91;
    }
    .transfer-result.partial {
      color: #ffd700;
    }

    /* Error */
    .error-msg {
      color: #ff6b6b;
      font-size: 0.85rem;
      margin: 0.75rem 0 0;
    }
  `]
})
export class CollectionMapperComponent implements OnInit {
  private firestore = inject(Firestore);
  private repairService = inject(RepairService);
  private cdr = inject(ChangeDetectorRef);

  attributeOptions = ATTRIBUTE_OPTIONS;

  // Step 1
  availableCollections: string[] = [];
  selectedCollection = '';
  loadingRecords = false;
  loadError = '';

  // Step 2
  records: any[] = [];
  fieldMappings: FieldMapping[] = [];

  // Step 3
  previewColumns: { sourceField: string; label: string }[] = [];
  previewRows: any[] = [];
  selectedRows: boolean[] = [];
  allSelected = false;

  // Transfer
  transferring = false;
  transferProgress = 0;
  transferResult = '';
  transferSuccess = false;

  get descriptionMapped(): boolean {
    return this.fieldMappings.some(m => m.targetKey === 'itemDescription');
  }

  get selectedCount(): number {
    return this.selectedRows.filter(Boolean).length;
  }

  async ngOnInit() {
    try {
      const cols = await firstValueFrom(this.repairService.getTrackedCollections());
      this.availableCollections = (cols || []).filter(c => !SYSTEM_COLLECTIONS.includes(c));
    } catch (e) {
      console.error('Failed to load collections', e);
    }
  }

  async loadRecords() {
    if (!this.selectedCollection) return;
    this.loadingRecords = true;
    this.loadError = '';
    this.records = [];
    this.fieldMappings = [];
    this.previewColumns = [];
    this.previewRows = [];
    this.selectedRows = [];
    this.transferResult = '';

    try {
      const colRef = collection(this.firestore, this.selectedCollection);
      const snapshot = await getDocs(colRef);
      this.records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (this.records.length === 0) {
        this.loadError = 'No records found in this collection.';
        this.loadingRecords = false;
        return;
      }

      this.buildFieldMappings();
      this.buildPreview();
    } catch (e: any) {
      this.loadError = 'Error loading records: ' + (e.message || String(e));
    } finally {
      this.loadingRecords = false;
      this.cdr.markForCheck();
    }
  }

  private buildFieldMappings() {
    // Collect all field keys from the first record (excluding 'id')
    const firstRecord = this.records[0];
    const keys = Object.keys(firstRecord).filter(k => k !== 'id');

    this.fieldMappings = keys.map(key => {
      const sampleValue = firstRecord[key];
      // Auto-map where source field name matches an attribute key (case-insensitive)
      const match = ATTRIBUTE_OPTIONS.find(
        a => a.key !== 'ignore' && a.key.toLowerCase() === key.toLowerCase()
      );
      return {
        sourceField: key,
        sampleValue,
        targetKey: match ? match.key : 'ignore'
      };
    });
  }

  onMappingChanged() {
    this.buildPreview();
    this.transferResult = '';
  }

  private buildPreview() {
    // Only include non-ignored mapped fields
    this.previewColumns = this.fieldMappings
      .filter(m => m.targetKey !== 'ignore')
      .map(m => {
        const attr = ATTRIBUTE_OPTIONS.find(a => a.key === m.targetKey);
        return { sourceField: m.sourceField, label: attr ? attr.label : m.targetKey };
      });

    this.previewRows = this.records;
    this.selectedRows = this.records.map(() => false);
    this.allSelected = false;
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRows = this.selectedRows.map(() => checked);
    this.allSelected = checked;
  }

  toggleRow(index: number) {
    this.selectedRows[index] = !this.selectedRows[index];
    this.allSelected = this.selectedRows.every(Boolean);
  }

  formatSample(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      try { return JSON.stringify(value).slice(0, 60); } catch { return '[Object]'; }
    }
    return String(value).slice(0, 80);
  }

  async transfer() {
    if (this.selectedCount === 0 || !this.descriptionMapped || this.transferring) return;

    this.transferring = true;
    this.transferProgress = 0;
    this.transferResult = '';

    const selectedRecords = this.records.filter((_, i) => this.selectedRows[i]);
    let successCount = 0;
    let failCount = 0;

    for (const record of selectedRecords) {
      try {
        const item = this.buildItemFromRecord(record);
        await this.repairService.addRepairItem(item as any);
        successCount++;
      } catch (e: any) {
        console.error('Transfer failed for record', record, e);
        failCount++;
      }
      this.transferProgress++;
      this.cdr.markForCheck();
    }

    this.transferring = false;
    if (failCount === 0) {
      this.transferSuccess = true;
      this.transferResult = `✅ ${successCount} record${successCount !== 1 ? 's' : ''} transferred successfully.`;
    } else {
      this.transferSuccess = false;
      this.transferResult = `⚠️ ${successCount} transferred, ${failCount} failed. Check console for details.`;
    }
    this.cdr.markForCheck();
  }

  private buildItemFromRecord(record: any): Record<string, any> {
    const item: Record<string, any> = {};

    for (const mapping of this.fieldMappings) {
      if (mapping.targetKey === 'ignore') continue;

      const rawValue = record[mapping.sourceField];
      if (rawValue === undefined || rawValue === null || rawValue === '') continue;

      // Special transforms for array fields
      if (mapping.targetKey === 'tags' || mapping.targetKey === 'additionalRepairers') {
        if (typeof rawValue === 'string') {
          item[mapping.targetKey] = rawValue.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
          item[mapping.targetKey] = rawValue;
        }
      } else {
        item[mapping.targetKey] = rawValue;
      }
    }

    return item;
  }
}
