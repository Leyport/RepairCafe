import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../services/repair.service';
import { RepairItem } from '../../models/repair-item.model';

@Component({
  selector: 'app-repair-complete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="complete-container">
      <div class="back-bar">
        <button class="btn-back" (click)="goBack()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Repair Items
        </button>
      </div>

      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading item...</p>
      </div>

      <div *ngIf="!loading && item" class="content-card glass">
        <div class="card-header">
          <div class="item-summary">
            <span class="item-number">{{ item.displayNumber }}</span>
            <div class="item-meta">
              <h2>{{ item.itemDescription || 'Untitled item' }}</h2>
              <div class="meta-row">
                <span *ngIf="item.owner" class="meta-chip">{{ item.owner }}</span>
                <span *ngIf="item.repairer" class="meta-chip repairer">{{ item.repairer }}</span>
                <span class="status-badge" [ngClass]="getStatusClass(item.status)">{{ item.status || 'New' }}</span>
              </div>
            </div>
          </div>
          <div class="complete-icon">✓</div>
        </div>

        <div class="divider"></div>

        <div class="form-section">
          <h3 class="section-title">Completion Details</h3>

          <!-- Outcome selector -->
          <div class="field-group">
            <label class="field-label">Repair Outcome</label>
            <div class="outcome-grid">
              <button
                *ngFor="let opt of outcomeOptions"
                class="outcome-btn"
                [class.selected]="completionStatus === opt.value"
                (click)="completionStatus = opt.value">
                <span class="outcome-icon">{{ opt.icon }}</span>
                <span class="outcome-label">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- Owner satisfaction -->
          <div class="field-group">
            <label class="field-label">Owner Satisfaction</label>
            <div class="satisfaction-options">
              <button
                class="sat-btn happy"
                [class.selected]="ownerSatisfied === true"
                (click)="ownerSatisfied = true">
                <span class="sat-icon">😊</span>
                <span>Happy</span>
              </button>
              <button
                class="sat-btn neutral"
                [class.selected]="ownerSatisfied === null"
                (click)="ownerSatisfied = null">
                <span class="sat-icon">😐</span>
                <span>Neutral</span>
              </button>
              <button
                class="sat-btn unhappy"
                [class.selected]="ownerSatisfied === false"
                (click)="ownerSatisfied = false">
                <span class="sat-icon">😞</span>
                <span>Unhappy</span>
              </button>
            </div>
          </div>

          <!-- Donation amount -->
          <div class="field-group">
            <label class="field-label" for="donation">Donation Amount</label>
            <div class="donation-input-wrapper">
              <span class="currency-symbol">£</span>
              <input
                id="donation"
                type="number"
                [(ngModel)]="donationAmount"
                min="0"
                step="0.50"
                placeholder="0.00"
                class="donation-input">
            </div>
            <p class="field-hint">Leave blank or zero if no donation was made.</p>
          </div>

          <!-- Notes -->
          <div class="field-group">
            <label class="field-label" for="notes">Completion Notes <span class="optional">(optional)</span></label>
            <textarea
              id="notes"
              [(ngModel)]="completionNotes"
              rows="3"
              placeholder="Any notes about the repair outcome..."
              class="notes-input"></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-cancel" (click)="goBack()">Cancel</button>
          <button
            class="btn-complete"
            [disabled]="saving || !completionStatus"
            (click)="saveCompletion()">
            <span *ngIf="!saving">Mark as Complete</span>
            <span *ngIf="saving">Saving...</span>
          </button>
        </div>
      </div>

      <div *ngIf="!loading && !item" class="empty-state">
        <p>Item not found.</p>
        <button class="btn-back" (click)="goBack()">Back to Repair Items</button>
      </div>
    </div>
  `,
  styles: [`
    .complete-container {
      max-width: 680px;
      margin: 0 auto;
      padding-top: 1rem;
    }
    .back-bar {
      margin-bottom: 1.5rem;
    }
    .btn-back {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.9rem;
      padding: 0;
      transition: color 0.15s;
    }
    .btn-back:hover { color: white; }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: rgba(255,255,255,0.4);
      gap: 1rem;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .content-card {
      border-radius: 14px;
      overflow: hidden;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .item-summary {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;
    }
    .item-number {
      font-size: 0.8rem;
      font-weight: 700;
      background: rgba(0,242,255,0.1);
      border: 1px solid rgba(0,242,255,0.3);
      color: var(--accent-color);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;
      margin-top: 0.3rem;
    }
    .item-meta h2 {
      margin: 0 0 0.5rem;
      font-size: 1.2rem;
      color: white;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .meta-chip {
      font-size: 0.78rem;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.65);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .meta-chip.repairer {
      background: rgba(0,242,255,0.07);
      border-color: rgba(0,242,255,0.2);
      color: var(--accent-color);
    }
    .complete-icon {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(40,180,99,0.15);
      border: 2px solid rgba(40,180,99,0.4);
      color: #58d68d;
      font-size: 1.3rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .divider {
      height: 1px;
      background: rgba(255,255,255,0.07);
      margin: 0 -2rem;
    }
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .section-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: rgba(255,255,255,0.8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.8rem;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .field-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .optional {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: rgba(255,255,255,0.35);
    }

    /* Outcome grid */
    .outcome-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.6rem;
    }
    .outcome-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 0.8rem 0.5rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03);
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      transition: all 0.15s;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .outcome-btn:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.2);
      color: white;
    }
    .outcome-btn.selected {
      background: rgba(40,180,99,0.15);
      border-color: rgba(40,180,99,0.5);
      color: #58d68d;
    }
    .outcome-icon { font-size: 1.4rem; }
    .outcome-label { text-align: center; line-height: 1.2; }

    /* Satisfaction */
    .satisfaction-options {
      display: flex;
      gap: 0.75rem;
    }
    .sat-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 0.9rem 0.5rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03);
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      transition: all 0.15s;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .sat-btn:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.2);
      color: white;
    }
    .sat-icon { font-size: 1.6rem; }
    .sat-btn.happy.selected {
      background: rgba(40,180,99,0.15);
      border-color: rgba(40,180,99,0.5);
      color: #58d68d;
    }
    .sat-btn.neutral.selected {
      background: rgba(241,196,15,0.12);
      border-color: rgba(241,196,15,0.4);
      color: #fce170;
    }
    .sat-btn.unhappy.selected {
      background: rgba(231,76,60,0.12);
      border-color: rgba(231,76,60,0.4);
      color: #f1948a;
    }

    /* Donation input */
    .donation-input-wrapper {
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      overflow: hidden;
      max-width: 200px;
      transition: border-color 0.15s;
    }
    .donation-input-wrapper:focus-within {
      border-color: var(--accent-color);
    }
    .currency-symbol {
      padding: 0.6rem 0.8rem;
      color: rgba(255,255,255,0.4);
      font-size: 1rem;
      font-weight: 600;
      border-right: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03);
    }
    .donation-input {
      background: transparent;
      border: none;
      color: white;
      padding: 0.6rem 0.8rem;
      font-size: 1rem;
      outline: none;
      width: 120px;
    }
    .donation-input::-webkit-outer-spin-button,
    .donation-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .field-hint {
      margin: 0;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.3);
    }

    /* Notes */
    .notes-input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: rgba(255,255,255,0.85);
      padding: 0.7rem 0.9rem;
      font-size: 0.9rem;
      resize: vertical;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .notes-input:focus { border-color: var(--accent-color); }
    .notes-input::placeholder { color: rgba(255,255,255,0.25); }

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

    /* Form actions */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .btn-cancel {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.6);
      padding: 0.65rem 1.4rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.15s;
    }
    .btn-cancel:hover { background: rgba(255,255,255,0.06); color: white; }
    .btn-complete {
      background: rgba(40,180,99,0.2);
      border: 1px solid rgba(40,180,99,0.5);
      color: #58d68d;
      padding: 0.65rem 1.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 700;
      transition: all 0.15s;
    }
    .btn-complete:hover:not(:disabled) {
      background: rgba(40,180,99,0.3);
      border-color: #58d68d;
    }
    .btn-complete:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `]
})
export class RepairCompleteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private repairService = inject(RepairService);

  item: RepairItem | null = null;
  loading = true;
  saving = false;

  completionStatus: string = '';
  ownerSatisfied: boolean | null = null;
  donationAmount: number | null = null;
  completionNotes: string = '';

  readonly outcomeOptions = [
    { value: 'Repaired',            label: 'Repaired',            icon: '✅' },
    { value: 'Partially Repaired',  label: 'Partially Repaired',  icon: '🔧' },
    { value: 'Advice Given',        label: 'Advice Given',        icon: '💬' },
    { value: 'Not Repaired',        label: 'Not Repaired',        icon: '❌' },
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }

    this.repairService.getRepairItems().subscribe(items => {
      this.item = items.find(i => i.id === id) ?? null;
      if (this.item) {
        // Pre-fill if already has completion data
        if (this.item.status && this.item.status !== 'New' && this.item.status !== 'Assigned') {
          this.completionStatus = this.item.status;
        }
        if (this.item.ownerSatisfied !== undefined) {
          this.ownerSatisfied = this.item.ownerSatisfied;
        }
        if (this.item.donationAmount !== undefined) {
          this.donationAmount = this.item.donationAmount;
        }
      }
      this.loading = false;
    });
  }

  getStatusClass(status: string | undefined): string {
    switch (status) {
      case 'Assigned':           return 'status-assigned';
      case 'Repaired':           return 'status-repaired';
      case 'Advice Given':       return 'status-advice';
      case 'Partially Repaired': return 'status-partial';
      case 'Not Repaired':       return 'status-not';
      default:                   return 'status-new';
    }
  }

  goBack() {
    this.router.navigate(['/repairs']);
  }

  async saveCompletion() {
    if (!this.item?.id || !this.completionStatus || this.saving) return;
    this.saving = true;

    const updates: Partial<RepairItem> = {
      status: this.completionStatus,
      ownerSatisfied: this.ownerSatisfied === null ? undefined : this.ownerSatisfied,
      donationAmount: this.donationAmount && this.donationAmount > 0 ? this.donationAmount : undefined,
    };

    try {
      await this.repairService.updateRepairItem(this.item.id, updates);
      this.router.navigate(['/repairs']);
    } catch (err) {
      console.error('Error saving completion:', err);
      alert('Failed to save. Please try again.');
      this.saving = false;
    }
  }
}
