import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RepairService } from '../../services/repair.service';
import { RepairItem } from '../../models/repair-item.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-repair-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-container glass">
      <h2>{{ isEditMode ? 'Edit' : 'Add New' }} Repair Item</h2>
      <form [formGroup]="repairForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="itemNumber">Display Code (Suggested)</label>
          <input id="itemNumber" type="text" formControlName="displayNumber" placeholder="e.g., RC-001">
          <div *ngIf="repairForm.get('displayNumber')?.touched && repairForm.get('displayNumber')?.invalid" class="error">
            Display code is required.
          </div>
        </div>

        <div class="form-group">
          <label for="itemDescription">Description</label>
          <textarea id="itemDescription" formControlName="itemDescription" placeholder="Describe the repair needed..."></textarea>
          <div *ngIf="repairForm.get('itemDescription')?.touched && repairForm.get('itemDescription')?.invalid" class="error">
            Description is required.
          </div>
        </div>

        <div class="button-group">
          <button type="submit" [disabled]="repairForm.invalid" class="btn-primary">
            {{ isEditMode ? 'Update' : 'Add' }} Item
          </button>
          <button *ngIf="isEditMode" type="button" (click)="onCancel()" class="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-container {
      padding: 2rem;
      border-radius: 15px;
      margin-bottom: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: var(--text-color);
    }
    input, textarea {
      width: 100%;
      padding: 0.8rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
      color: white;
      font-size: 1rem;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px rgba(0, 242, 255, 0.2);
    }
    .button-group {
      display: flex;
      gap: 1rem;
    }
    .btn-primary {
      flex: 1;
      padding: 1rem;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-color), var(--primary-color));
      color: white;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      opacity: 0.9;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      padding: 1rem 2rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: transparent;
      color: white;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .error {
      color: #ff4d4d;
      font-size: 0.8rem;
      margin-top: 0.3rem;
    }
  `]
})
export class RepairFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private repairService = inject(RepairService);
  private subscription: Subscription = new Subscription();

  repairForm: FormGroup = this.fb.group({
    displayNumber: ['', Validators.required],
    itemDescription: ['', Validators.required]
  });

  isEditMode = false;
  editingItemId: string | null = null;

  async ngOnInit() {
    this.subscription.add(
      this.repairService.editItem$.subscribe(item => {
        if (item) {
          this.isEditMode = true;
          this.editingItemId = item.id!;
          this.repairForm.patchValue({
            displayNumber: item.displayNumber,
            itemDescription: item.itemDescription
          });
        } else {
          this.resetForm();
        }
      })
    );

    // Set initial suggested display number
    if (!this.isEditMode) {
      const suggested = await this.repairService.getSuggestedDisplayNumber();
      this.repairForm.patchValue({ displayNumber: suggested });
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async onSubmit() {
    if (this.repairForm.valid) {
      try {
        if (this.isEditMode && this.editingItemId) {
          await this.repairService.updateRepairItem(this.editingItemId, {
            displayNumber: this.repairForm.value.displayNumber,
            itemDescription: this.repairForm.value.itemDescription
          });
          this.repairService.setEditItem(null);
        } else {
          // Addition: service handles sequence generation
          await this.repairService.addRepairItem({
            itemDescription: this.repairForm.value.itemDescription
            // Service will use the generation logic even if form has a suggested number
            // but we could also pass the form's displayNumber if we wanted it to be editable and override
          });
        }
        await this.resetForm();
      } catch (error) {
        console.error('Error saving repair item:', error);
      }
    }
  }

  onCancel() {
    this.repairService.setEditItem(null);
  }

  private async resetForm() {
    this.repairForm.reset();
    this.isEditMode = false;
    this.editingItemId = null;

    // Get new suggestion after reset
    const suggested = await this.repairService.getSuggestedDisplayNumber();
    this.repairForm.patchValue({ displayNumber: suggested });
  }
}
