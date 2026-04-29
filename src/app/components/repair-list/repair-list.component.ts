import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RepairService } from '../../services/repair.service';
import { Observable, combineLatest, startWith, map } from 'rxjs';
import { RepairItem, Owner, toRepairPhoto } from '../../models/repair-item.model';

type SortOption = 'newest' | 'oldest' | 'number';
type CompletionFilter = 'all' | 'active' | 'completed';

const COMPLETED_STATUSES = new Set(['Repaired', 'Advice Given', 'Partially Repaired', 'Not Repaired']);

interface RepairerGroup {
  label: string;
  rcDay: string;
  items: RepairItem[];
}

@Component({
  selector: 'app-repair-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="list-container">
      <div class="header-section">
        <h2>Repair Items</h2>
        <div class="header-controls">
          <div class="completion-toggle">
            <button class="toggle-btn"
                    [class.active]="completionControl.value === 'active'"
                    (click)="completionControl.setValue('active')">Active</button>
            <button class="toggle-btn"
                    [class.active]="completionControl.value === 'all'"
                    (click)="completionControl.setValue('all')">All</button>
            <button class="toggle-btn"
                    [class.active]="completionControl.value === 'completed'"
                    (click)="completionControl.setValue('completed')">Completed</button>
          </div>
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
      
      <div class="compact-list glass" #compactList (mousedown)="onListMouseDown($event, compactList)">
        <div class="list-header">
          <span class="col-photo"></span>
          <span class="col-code pointer" (click)="setSort('number')"># {{ getSortIcon('number') }}</span>
          <span class="col-desc">Description</span>
          <span class="col-owner">Owner</span>
          <span class="col-category">Category</span>
          <span class="col-repairer">Repairer</span>
          <span class="col-session">RC Session</span>
          <span class="col-created pointer" (click)="setSort('newest')">Created {{ getSortIcon('newest') }}</span>
          <span class="col-status">Status</span>
          <span class="col-actions"></span>
        </div>
        <div *ngFor="let item of filteredItems$ | async"
             class="list-row"
             (click)="onRowClick(item)"
             (dblclick)="onRowDblClick(item)">

          <!-- Photo -->
          <div class="col-photo" (click)="item.photos?.length ? openCarousel(item.photos!, $event) : null">
            <div class="thumb" [style.backgroundImage]="item.photos?.length ? 'url(' + getPhotoUrl(item.photos![0]) + ')' : 'none'"
                 [class.has-photos]="item.photos?.length">
              <span *ngIf="!item.photos?.length" class="thumb-placeholder">📷</span>
              <span *ngIf="(item.photos?.length || 0) > 1" class="photo-count">{{ item.photos!.length }}</span>
            </div>
          </div>

          <!-- # -->
          <div class="col-code">
            <span class="seq-badge linkable"
                  [routerLink]="['/edit', item.id]"
                  (click)="$event.stopPropagation()"
                  title="Edit item">
              {{ item.displayNumber }}
            </span>
          </div>

          <!-- Description -->
          <span class="col-desc truncate">{{ item.itemDescription }}</span>

          <!-- Owner -->
          <div class="col-owner" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <div class="lov-container">
              <select class="inline-select owner-select"
                      [ngModel]="item.owner || ''"
                      (ngModelChange)="updateItem(item, 'owner', $event)">
                <option value="">— Visitor —</option>
                <option *ngFor="let o of owners" [value]="o.name">{{ o.name }}</option>
              </select>
              <button *ngIf="item.owner" class="inline-clear"
                      (click)="$event.stopPropagation(); updateItem(item, 'owner', '')">×</button>
            </div>
          </div>

          <!-- Category -->
          <div class="col-category" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <select class="inline-select cat-select"
                    [ngModel]="item.category || ''"
                    (ngModelChange)="updateItem(item, 'category', $event)">
              <option value="">—</option>
              <option *ngFor="let c of categories" [value]="c.value">{{ c.emoji }} {{ c.label }}</option>
            </select>
            <div class="tag-trigger-wrapper" *ngIf="item.tags && item.tags.length > 0">
              <span class="tag-pill small-pill">
                {{ getFirstTagEmoji(item.tags) || '🏷️' }}<span *ngIf="item.tags.length > 1"> +{{ item.tags.length - 1 }}</span>
              </span>
              <div class="tags-popup glass">
                <div class="popup-title">Tags</div>
                <div class="popup-tags">
                  <span class="popup-tag" *ngFor="let tag of item.tags">{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Repairer -->
          <div class="col-repairer" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <div class="lov-container">
              <select class="inline-select"
                      [ngModel]="item.repairer || ''"
                      (ngModelChange)="updateItem(item, 'repairer', $event)">
                <option value="">— Repairer —</option>
                <option *ngFor="let r of primaryRepairers" [value]="r.name">{{ r.name }}</option>
              </select>
              <button *ngIf="item.repairer" class="inline-clear repairer-info-btn"
                      (click)="openRepairerPanel(item.repairer, $event)"
                      title="View {{ item.repairer }}'s items">👤</button>
            </div>
          </div>

          <!-- RC Session -->
          <div class="col-session" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <select class="inline-select rcsession-select"
                    [ngModel]="item.RCDay || ''"
                    (ngModelChange)="updateItem(item, 'RCDay', $event)">
              <option value="" disabled>— Date —</option>
              <option *ngFor="let d of availableRCDates" [value]="d.value">{{ d.label }}</option>
            </select>
          </div>

          <!-- Created -->
          <span class="col-created">{{ item.creationDate?.toDate() | date:'dd MMM yy' }}</span>

          <!-- Status -->
          <div class="col-status" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <select class="inline-select status-select"
                    [ngModel]="item.status || 'New'"
                    (ngModelChange)="updateItem(item, 'status', $event)"
                    [ngClass]="getStatusClass(item.status)">
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

          <!-- Actions -->
          <div class="col-actions" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
            <select class="action-select"
                    (change)="onActionSelect(item, $event)"
                    (click)="$event.stopPropagation()"
                    [value]="''">
              <option value="" disabled>⋯</option>
              <option value="additional">Additional Details</option>
              <option value="complete">Complete</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        </div>
      </div>
      
      <div *ngIf="(filteredItems$ | async)?.length === 0" class="empty-state">
        <p *ngIf="completionControl.value === 'active'">No active repair items.</p>
        <p *ngIf="completionControl.value === 'completed'">No completed repair items.</p>
        <p *ngIf="completionControl.value === 'all'">No repair items found.</p>
      </div>
    </div>

    <!-- Repairer Panel -->
    <div class="repairer-overlay" *ngIf="selectedRepairer" (click)="closeRepairerPanel()">
      <div class="repairer-panel glass" (click)="$event.stopPropagation()">
        <div class="rp-header">
          <div class="rp-title">
            <span class="rp-avatar">{{ selectedRepairer![0] }}</span>
            <div>
              <h3>{{ selectedRepairer }}</h3>
              <p class="rp-sub" *ngIf="repairerGroups">
                {{ repairerTotalItems }} item{{ repairerTotalItems !== 1 ? 's' : '' }} across {{ repairerGroups.length }} event{{ repairerGroups.length !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
          <button class="rp-close" (click)="closeRepairerPanel()">✕</button>
        </div>

        <div class="rp-body">
          <div *ngIf="!repairerGroups || repairerGroups.length === 0" class="rp-empty">
            No items found for this repairer.
          </div>
          <div *ngFor="let group of repairerGroups" class="rp-event-group">
            <div class="rp-event-heading">
              <span class="rp-event-name">{{ group.label }}</span>
              <span class="rp-event-count">{{ group.items.length }} item{{ group.items.length !== 1 ? 's' : '' }}</span>
            </div>
            <div *ngFor="let item of group.items" class="rp-item" [routerLink]="['/item', item.id]" (click)="closeRepairerPanel()">
              <span class="rp-item-num">{{ item.displayNumber }}</span>
              <span class="rp-item-desc">{{ item.itemDescription }}</span>
              <span class="rp-item-role secondary" *ngIf="isSecondaryRepairer(item, selectedRepairer!)">2nd</span>
              <span class="status-badge rp-item-status" [ngClass]="getStatusClass(item.status)">{{ item.status || 'New' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo Carousel Overlay -->
    <div class="carousel-overlay" *ngIf="carouselPhotos" (click)="closeCarousel()"
         (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
      <div class="carousel-content" (click)="$event.stopPropagation()">
        <button class="carousel-close" (click)="closeCarousel()">✕</button>

        <button class="carousel-nav carousel-prev" (click)="prevPhoto()"
                *ngIf="carouselPhotos.length > 1" [disabled]="carouselIndex === 0">&#8249;</button>

        <div class="carousel-image-wrapper">
          <img [src]="carouselPhotos[carouselIndex]" alt="Repair photo" class="carousel-image">
        </div>

        <button class="carousel-nav carousel-next" (click)="nextPhoto()"
                *ngIf="carouselPhotos.length > 1" [disabled]="carouselIndex === carouselPhotos.length - 1">&#8250;</button>

        <div class="carousel-dots" *ngIf="carouselPhotos.length > 1">
          <span *ngFor="let p of carouselPhotos; let i = index"
                class="carousel-dot" [class.active]="i === carouselIndex"
                (click)="carouselIndex = i"></span>
        </div>
        <div class="carousel-counter" *ngIf="carouselPhotos.length > 1">
          {{ carouselIndex + 1 }} / {{ carouselPhotos.length }}
        </div>
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
    
    @media (max-width: 600px) {
      .header-section {
        flex-direction: column;
        align-items: stretch;
      }
    }
    .header-controls {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .completion-toggle {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .toggle-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 0.4rem 0.9rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .toggle-btn:not(:last-child) {
      border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    .toggle-btn:hover:not(.active) {
      background: rgba(255, 255, 255, 0.07);
      color: rgba(255, 255, 255, 0.8);
    }
    .toggle-btn.active {
      background: rgba(99, 102, 241, 0.25);
      color: var(--accent-color);
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
    
    @media (max-width: 600px) {
      .search-container, .sort-container {
        max-width: none;
        width: 100%;
      }
      .header-controls {
        width: 100%;
      }
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
      overflow-x: auto;
      overflow-y: hidden;
      cursor: grab;
    }
    .compact-list.is-dragging {
      cursor: grabbing;
      user-select: none;
    }
    .compact-list select,
    .compact-list a,
    .compact-list button,
    .compact-list input {
      cursor: auto;
    }
    .compact-list.is-dragging select,
    .compact-list.is-dragging a,
    .compact-list.is-dragging button,
    .compact-list.is-dragging input {
      pointer-events: none;
    }

    .list-header,
    .list-row {
      display: grid;
      grid-template-columns: 48px 70px 1fr 110px 120px 120px 130px 95px 90px 60px;
      padding: 0.75rem 1rem;
      align-items: center;
      gap: 0.5rem;
      min-width: 1100px;
    }
    .list-header {
      background: rgba(255, 255, 255, 0.08);
      font-weight: bold;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pointer { cursor: pointer; }
    .pointer:hover { color: var(--accent-color); }
    .list-row {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: background 0.2s;
    }

    @media (max-width: 768px) {
      .list-header { display: none; }
      .list-row {
        min-width: unset;
        grid-template-columns: 48px 70px 1fr auto;
        grid-template-areas:
          "photo code desc actions"
          "photo . status .";
        gap: 0.5rem;
        padding: 0.8rem 1rem;
      }
      .col-photo { grid-area: photo; }
      .col-code { grid-area: code; }
      .col-desc { grid-area: desc; }
      .col-actions { grid-area: actions; }
      .col-status { grid-area: status; }
      .col-owner, .col-category, .col-repairer, .col-session, .col-created { display: none; }
    }

    .list-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .col-code {
      display: flex;
      align-items: center;
    }
    .seq-badge {
      font-size: 0.9rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
      transition: all 0.2s;
    }
    .seq-badge.linkable:hover {
      background: var(--accent-color);
      color: #1a1a2e;
      transform: scale(1.05);
      border-color: white;
    }
    .truncate {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255, 255, 255, 0.9);
      min-width: 0;
    }
    .muted {
      color: rgba(255, 255, 255, 0.3);
    }

    /* Photo thumbnail */
    .col-photo { display: flex; align-items: center; }
    .thumb {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background-size: cover;
      background-position: center;
      background-color: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .thumb-placeholder { font-size: 0.9rem; opacity: 0.3; }

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

    /* Tag pill in category column */
    .tag-pill {
      font-size: 0.78rem;
      background: rgba(0, 242, 255, 0.07);
      border: 1px solid rgba(0, 242, 255, 0.2);
      color: var(--accent-color);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 110px;
      display: inline-block;
      cursor: default;
    }

    .tag-trigger-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .tags-popup {
      position: absolute;
      bottom: 125%;
      right: -20px;
      padding: 1.2rem;
      border-radius: 12px;
      min-width: 200px;
      max-width: 300px;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      background: #111122; /* High contrast solid background */
      border: 2px solid var(--accent-color); /* Bright, sharp border */
      box-shadow: 0 15px 40px rgba(0, 0, 0, 1), 0 0 15px rgba(0, 242, 255, 0.2);
      pointer-events: none;
    }
    .tags-popup::after {
      content: '';
      position: absolute;
      top: 100%;
      right: 30px;
      border: 10px solid transparent;
      border-top-color: var(--accent-color);
    }
    .tag-trigger-wrapper:hover .tags-popup {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    /* Smart Flip for Top Items: Open downwards if in first 3 rows */
    .compact-list .list-row:nth-child(-n+4) .tags-popup {
      bottom: auto;
      top: 130%;
      transform: translateY(-10px);
    }
    .compact-list .list-row:nth-child(-n+4) .tag-trigger-wrapper:hover .tags-popup {
      transform: translateY(0);
    }
    .compact-list .list-row:nth-child(-n+4) .tags-popup::after {
      top: auto;
      bottom: 100%;
      border-top-color: transparent;
      border-bottom-color: var(--accent-color);
    }

    .popup-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--accent-color);
      margin-bottom: 0.8rem;
      letter-spacing: 0.15em;
      font-weight: 800;
      border-bottom: 1px solid rgba(0, 242, 255, 0.2);
      padding-bottom: 0.4rem;
    }
    .popup-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .popup-tag {
      font-size: 0.85rem;
      background: rgba(0, 242, 255, 0.2);
      border: 1px solid var(--accent-color);
      color: #00f2ff;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      white-space: nowrap;
      font-weight: 700;
    }
    .col-created, .col-session, .col-owner, .col-repairer {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }
    .repairer-link {
      cursor: pointer;
      color: var(--accent-color) !important;
      border-bottom: 1px dashed rgba(0, 242, 255, 0.4);
      transition: border-color 0.15s, color 0.15s;
    }
    .repairer-link:hover {
      color: white !important;
      border-bottom-color: white;
    }

    /* Repairer Panel */
    .repairer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 9000;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .repairer-panel {
      width: 420px;
      max-width: 95vw;
      height: 100vh;
      overflow-y: auto;
      border-radius: 0;
      border-left: 1px solid rgba(0, 242, 255, 0.2);
      background: rgba(15, 15, 35, 0.97);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.25s ease-out;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .rp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      position: sticky;
      top: 0;
      background: rgba(15, 15, 35, 0.98);
      z-index: 1;
    }
    .rp-title { display: flex; align-items: center; gap: 1rem; }
    .rp-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0, 242, 255, 0.15);
      border: 2px solid rgba(0, 242, 255, 0.4);
      color: var(--accent-color);
      font-size: 1.3rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .rp-title h3 { margin: 0; color: white; font-size: 1.1rem; }
    .rp-sub { margin: 0.2rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.45); }
    .rp-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      font-size: 1.3rem;
      cursor: pointer;
      padding: 0.2rem 0.4rem;
      transition: color 0.15s;
      line-height: 1;
    }
    .rp-close:hover { color: white; }
    .rp-body { padding: 1rem 1.5rem 2rem; flex: 1; }
    .rp-empty { color: rgba(255,255,255,0.35); text-align: center; padding: 3rem 0; }
    .rp-event-group { margin-bottom: 1.5rem; }
    .rp-event-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid rgba(0, 242, 255, 0.15);
    }
    .rp-event-name { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent-color); }
    .rp-event-count { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
    .rp-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.6rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
      margin-bottom: 2px;
    }
    .rp-item:hover { background: rgba(255,255,255,0.05); }
    .rp-item-num {
      font-size: 0.75rem;
      color: rgba(0, 242, 255, 0.7);
      font-weight: 700;
      min-width: 50px;
      flex-shrink: 0;
    }
    .rp-item-desc {
      flex: 1;
      font-size: 0.88rem;
      color: rgba(255,255,255,0.85);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rp-item-role {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .rp-item-role.secondary {
      background: rgba(241, 196, 15, 0.15);
      color: #f1c40f;
      border: 1px solid rgba(241, 196, 15, 0.3);
    }
    .rp-item-status { flex-shrink: 0; }
    .action-select {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      color: rgba(255,255,255,0.8);
      font-size: 0.8rem;
      padding: 0.3rem 0.4rem;
      cursor: pointer;
      width: 100%;
    }
    .action-select:focus { outline: none; border-color: var(--accent-color); }
    .action-select option { background: #1a2236; color: white; }
    .inline-select {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.9);
      padding: 0.25rem 0.3rem;
      border-radius: 4px;
      font-size: 0.8rem;
      width: 100%;
      cursor: pointer;
    }
    .inline-select:focus { outline: none; border-color: var(--accent-color); background: rgba(0,0,0,0.3); }
    .inline-select option, .inline-select optgroup { background: #1a2236; color: white; }
    .owner-select { padding-right: 22px; }
    .rcsession-select { font-size: 0.75rem; }
    .status-select { font-weight: 600; font-size: 0.75rem; }
    .col-category { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .cat-select { font-size: 0.82rem; width: 100%; }
    .small-pill { font-size: 0.7rem; padding: 0.1rem 0.35rem; max-width: 100%; cursor: default; }
    .lov-container { position: relative; display: flex; align-items: center; width: 100%; }
    .inline-clear {
      position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: rgba(255,255,255,0.4);
      cursor: pointer; font-size: 0.9rem; padding: 0; line-height: 1; z-index: 2;
    }
    .inline-clear:hover { color: white; }
    .repairer-info-btn { font-size: 0.75rem; right: 20px; }
    .status-new      { background: rgba(74,144,226,0.15)!important; color:#7ab1f7!important; border-color:rgba(74,144,226,0.4)!important; }
    .status-assigned { background: rgba(241,196,15,0.15)!important; color:#fce170!important; border-color:rgba(241,196,15,0.4)!important; }
    .status-repaired { background: rgba(40,180,99,0.15)!important;  color:#58d68d!important; border-color:rgba(40,180,99,0.4)!important; }
    .status-advice   { background: rgba(230,126,34,0.15)!important; color:#f0a055!important; border-color:rgba(230,126,34,0.4)!important; }
    .status-partial  { background: rgba(230,126,34,0.15)!important; color:#f0a055!important; border-color:rgba(230,126,34,0.4)!important; }
    .status-not      { background: rgba(231,76,60,0.15)!important;  color:#f1948a!important; border-color:rgba(231,76,60,0.4)!important; }
    .action-menu-wrapper {
      position: relative;
      display: flex;
      justify-content: flex-end;
    }
    .btn-menu {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 6px;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      line-height: 1;
      min-width: 32px;
      height: 28px;
    }
    .btn-menu:hover {
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.3);
      color: white;
    }
    .action-dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      background: #1a2236;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 0.3rem;
      min-width: 175px;
      z-index: 500;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      animation: menuFadeIn 0.1s ease-out;
      overflow: visible;
    }
    @keyframes menuFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.75);
      padding: 0.5rem 0.7rem;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      text-align: left;
      transition: all 0.12s;
    }
    .dropdown-item:hover { background: rgba(255,255,255,0.07); color: white; }
    .item-complete:hover { background: rgba(40,180,99,0.15); color: #58d68d; }
    .item-delete:hover   { background: rgba(231,76,60,0.12);  color: #f1948a; }
    .dropdown-divider {
      height: 1px;
      background: rgba(255,255,255,0.07);
      margin: 0.2rem 0.4rem;
    }
    .empty-state {
      text-align: center;
      padding: 4rem;
      color: rgba(255, 255, 255, 0.4);
    }

    /* Photo thumbnail enhancements */
    .thumb.has-photos {
      cursor: zoom-in;
      transition: transform 0.15s, border-color 0.15s;
      border-color: rgba(0, 242, 255, 0.3);
    }
    .thumb.has-photos:hover {
      transform: scale(1.1);
      border-color: var(--accent-color);
    }
    .photo-count {
      position: absolute;
      bottom: -4px;
      right: -4px;
      background: var(--accent-color);
      color: #1a1a2e;
      font-size: 0.6rem;
      font-weight: 800;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .col-photo { position: relative; }
    .thumb { position: relative; }

    /* Carousel overlay */
    .carousel-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .carousel-content {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 90vw;
      max-height: 90vh;
      gap: 0.5rem;
    }
    .carousel-image-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 80vw;
      max-height: 80vh;
    }
    .carousel-image {
      max-width: 80vw;
      max-height: 80vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.8);
      display: block;
    }
    .carousel-nav {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      font-size: 2.5rem;
      line-height: 1;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
      padding: 0;
    }
    .carousel-nav:hover:not(:disabled) { background: rgba(0,242,255,0.2); border-color: var(--accent-color); }
    .carousel-nav:disabled { opacity: 0.2; cursor: default; }
    .carousel-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.7);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 4px 8px;
      transition: color 0.2s;
    }
    .carousel-close:hover { color: white; }
    .carousel-dots {
      position: absolute;
      bottom: -32px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      cursor: pointer;
      transition: background 0.2s;
    }
    .carousel-dot.active { background: var(--accent-color); }
    .carousel-counter {
      position: absolute;
      bottom: -52px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.8rem;
      color: rgba(255,255,255,0.4);
      white-space: nowrap;
    }
  `]
})
export class RepairListComponent implements OnInit {
  private repairService = inject(RepairService);
  private router = inject(Router);

  searchControl = new FormControl('');
  sortControl = new FormControl<SortOption>('newest');
  completionControl = new FormControl<CompletionFilter>('active');

  owners: Owner[] = [];
  primaryRepairers: any[] = [];
  availableRCDates: { label: string, value: string, date: Date }[] = [];

  readonly categories = [
    { value: 'electrical', emoji: '⚡', label: 'Electrical' },
    { value: 'textile',    emoji: '🧵', label: 'Textile' },
    { value: 'ornament',   emoji: '🪆', label: 'Ornament' },
    { value: 'mechanical', emoji: '⚙️', label: 'Mechanical' },
    { value: 'furniture',  emoji: '🪑', label: 'Furniture' },
    { value: 'toy',        emoji: '🧸', label: 'Toy' },
    { value: 'clock',      emoji: '🕐', label: 'Clock' },
    { value: 'jewelry',    emoji: '💍', label: 'Jewelry' },
    { value: 'other',      emoji: '❓', label: 'Other' },
  ];

  ngOnInit() {
    this.availableRCDates = this.repairService.getAvailableRCDates();
    this.repairService.getOwners().subscribe(o => this.owners = o);
    this.repairService.getPrimaryRepairers().subscribe(r => this.primaryRepairers = r);
  }

  async updateItem(item: RepairItem, field: string, value: any) {
    if (!item.id) return;
    if (field === 'RCDay' && (!value || value.trim() === '')) return;
    const updates: Partial<RepairItem> = {};
    updates[field as keyof RepairItem] = value;
    if (field === 'RCDay') {
      const newSeq = await this.repairService.getSuggestedDisplayNumber(value);
      updates.displayNumber = newSeq;
      (item as any).displayNumber = newSeq;
    }
    if (field === 'repairer') {
      const currentStatus = item.status || 'New';
      if (value && currentStatus === 'New') { updates.status = 'Assigned'; (item as any).status = 'Assigned'; }
      else if (!value && currentStatus === 'Assigned') { updates.status = 'New'; (item as any).status = 'New'; }
    }
    (item as any)[field] = value;
    await this.repairService.updateRepairItem(item.id, updates);
  }

  onActionSelect(item: RepairItem, event: Event) {
    const select = event.target as HTMLSelectElement;
    const action = select.value;
    select.value = '';
    if (!item.id) return;
    if (action === 'additional') this.onAdditionalDetails(item.id, event);
    else if (action === 'complete') this.onComplete(item.id, event);
    else if (action === 'delete') this.onDelete(item.id, event);
  }

  // Drag-to-scroll
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragScrollLeft = 0;
  private dragListEl: HTMLElement | null = null;

  onListMouseDown(event: MouseEvent, listEl: HTMLElement) {
    const target = event.target as HTMLElement;
    if (target.closest('select, input, button, a, label')) return;
    this.isDragging = true;
    this.dragMoved = false;
    this.dragListEl = listEl;
    this.dragStartX = event.clientX;
    this.dragScrollLeft = listEl.scrollLeft;
    listEl.classList.add('is-dragging');
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.dragListEl) return;
    const dx = event.clientX - this.dragStartX;
    if (Math.abs(dx) > 5) this.dragMoved = true;
    this.dragListEl.scrollLeft = this.dragScrollLeft - dx;
  }

  @HostListener('document:mouseup')
  onDocMouseUp() {
    if (this.dragListEl) this.dragListEl.classList.remove('is-dragging');
    this.isDragging = false;
    this.dragListEl = null;
    // dragMoved is intentionally left set here — click fires after mouseup
  }

  onRowClick(item: RepairItem) {
    if (this.dragMoved) {
      this.dragMoved = false;
      return;
    }
    this.router.navigate(['/edit', item.id]);
  }

  onRowDblClick(item: RepairItem) {
    this.router.navigate(['/edit', item.id]);
  }

  // Repairer panel state
  selectedRepairer: string | null = null;
  repairerGroups: RepairerGroup[] | null = null;
  repairerTotalItems = 0;
  private allItems: RepairItem[] = [];

  carouselPhotos: string[] | null = null;
  carouselIndex = 0;
  private touchStartX = 0;

  getPhotoUrl(photo: any): string {
    return toRepairPhoto(photo).url;
  }

  openCarousel(photos: any[], event: Event) {
    event.stopPropagation();
    this.carouselPhotos = photos.map(p => toRepairPhoto(p).url);
    this.carouselIndex = 0;
  }

  closeCarousel() {
    this.carouselPhotos = null;
  }

  prevPhoto() {
    if (this.carouselIndex > 0) this.carouselIndex--;
  }

  nextPhoto() {
    if (this.carouselPhotos && this.carouselIndex < this.carouselPhotos.length - 1) this.carouselIndex++;
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const delta = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      delta > 0 ? this.nextPhoto() : this.prevPhoto();
    }
  }

  private allItems$ = this.repairService.getRepairItems();

  constructor() {
    this.allItems$.subscribe(items => { this.allItems = items; });
  }

  openRepairerPanel(name: string, event: Event) {
    event.stopPropagation();
    this.selectedRepairer = name;
    const matched = this.allItems.filter(item =>
      item.repairer === name ||
      (item.additionalRepairers || []).includes(name)
    );
    // Group by RCDay, most recent first
    const groupMap = new Map<string, RepairItem[]>();
    for (const item of matched) {
      const key = item.RCDay || 'Unknown event';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(item);
    }
    // Sort groups by the earliest item's rcDayNumber desc
    this.repairerGroups = [...groupMap.entries()]
      .map(([rcDay, items]) => ({
        rcDay,
        label: this.formatRCDay(rcDay),
        items: items.sort((a, b) => a.itemNumber - b.itemNumber)
      }))
      .sort((a, b) => {
        const numA = a.items[0]?.rcDayNumber ?? 0;
        const numB = b.items[0]?.rcDayNumber ?? 0;
        return numB - numA;
      });
    this.repairerTotalItems = matched.length;
  }

  closeRepairerPanel() {
    this.selectedRepairer = null;
    this.repairerGroups = null;
  }

  isSecondaryRepairer(item: RepairItem, name: string): boolean {
    return item.repairer !== name && (item.additionalRepairers || []).includes(name);
  }

  filteredItems$: Observable<RepairItem[]> = combineLatest([
    this.repairService.getRepairItems(),
    this.searchControl.valueChanges.pipe(startWith('')),
    this.sortControl.valueChanges.pipe(startWith('newest' as SortOption)),
    this.completionControl.valueChanges.pipe(startWith('active' as CompletionFilter))
  ]).pipe(
    map(([items, searchTerm, sortOrder, completionFilter]) => {
      // Completion filter
      let filtered = items.filter(item => {
        const isDone = COMPLETED_STATUSES.has(item.status || '');
        if (completionFilter === 'active') return !isDone;
        if (completionFilter === 'completed') return isDone;
        return true;
      });

      // Text search filter
      const term = (searchTerm || '').toLowerCase();
      if (term) {
        filtered = filtered.filter(item => {
          const description = (item.itemDescription || '').toLowerCase();
          const number = (item.displayNumber || '').toLowerCase();
          const day = (item.RCDay || '').toLowerCase();
          const tags = item.tags || [];

          return description.includes(term) ||
            number.includes(term) ||
            day.includes(term) ||
            tags.some(tag => tag.toLowerCase().includes(term));
        });
      }

      // Sort
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

  getFirstTagEmoji(tags: string[]): string {
    if (!tags || tags.length === 0) return '';
    for (const tag of tags) {
      const emoji = this.repairService.getEmojiForTag(tag);
      if (emoji) return emoji;
    }
    return '';
  }

  getStatusClass(status: string | undefined): string {
    switch (status) {
      case 'Assigned':          return 'status-assigned';
      case 'Repaired':          return 'status-repaired';
      case 'Advice Given':      return 'status-advice';
      case 'Partially Repaired': return 'status-partial';
      case 'Not Repaired':      return 'status-not';
      default:                  return 'status-new';
    }
  }

  formatRCDay(rcDay: string): string {
    if (!rcDay) return '—';
    // Format is "Saturday, 15, 03, 2025" → "15 Mar 25"
    const parts = rcDay.split(',').map(p => p.trim());
    if (parts.length < 4) return rcDay;
    const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = parts[1];
    const month = months[parseInt(parts[2], 10)] || parts[2];
    const year = parts[3].slice(-2);
    return `${day} ${month} ${year}`;
  }

  onComplete(id: string, event: Event) {
    event.stopPropagation();
    setTimeout(() => this.router.navigate(['/complete', id]), 0);
  }

  onAdditionalDetails(id: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/edit', id], { queryParams: { additional: '1' } });
  }

  async onDelete(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this repair item?')) {
      try {
        await this.repairService.deleteRepairItem(id);
      } catch (error) {
        console.error('Error deleting repair item:', error);
      }
    }
  }
}
