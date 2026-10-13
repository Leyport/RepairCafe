import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Functions } from '@angular/fire/functions';
import { httpsCallable } from 'firebase/functions';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Subscription } from 'rxjs';
import { RepairService } from '../../services/repair.service';
import { RepairItem, toRepairPhoto } from '../../models/repair-item.model';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FollowUp {
  question: string;
  answer: string;
  html: string;
}

@Component({
  selector: 'app-investigation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inv-container">
      <div class="back-bar">
        <button class="btn-back" (click)="goBack()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Repairs
        </button>
      </div>

      <div class="center-state" *ngIf="loading">
        <div class="spinner"></div>
        <p>Loading item…</p>
      </div>

      <div class="center-state" *ngIf="!loading && !item">
        <p>Item not found.</p>
        <button class="btn-back" (click)="goBack()">Back</button>
      </div>

      <div class="layout" *ngIf="!loading && item">
        <div class="item-panel glass">
          <div class="item-header">
            <span class="item-num">{{ item.displayNumber }}</span>
            <span class="stage-badge">Investigating</span>
          </div>
          <h2 class="item-title">{{ item.itemDescription }}</h2>
          <div class="item-chips">
            <span class="chip" *ngIf="item.owner">{{ item.owner }}</span>
            <span class="chip" *ngIf="item.repairer">{{ item.repairer }}</span>
            <span class="chip accent" *ngIf="item.category">{{ getCategoryEmoji(item.category) }} {{ item.category }}</span>
          </div>
          <div class="detail-row" *ngIf="item.make || item.model">
            <span class="detail-label">Make / Model</span>
            <span class="detail-val">{{ item.make }}{{ item.make && item.model ? ' / ' : '' }}{{ item.model }}</span>
          </div>
          <div class="fault-box">
            <div class="fault-label">Problem reported by owner</div>
            <p class="fault-text">{{ item.fault || 'No fault description provided.' }}</p>
          </div>
          <div class="photo-strip" *ngIf="item.photos && item.photos.length">
            <img class="photo-thumb" alt="Item photo" *ngFor="let photo of item.photos" [src]="getPhotoUrl(photo)">
          </div>
          <div class="photo-add-row">
            <div class="photo-add-group" *ngIf="!addingPhoto">
              <button class="photo-add-btn" title="Take photo with camera" (click)="openWebcam()">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                Camera
              </button>
              <label class="photo-add-btn">
                <input type="file" accept="image/*" style="display:none" (change)="onPhotoSelected($event)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Add Photo
              </label>
            </div>
            <div class="photo-add uploading" *ngIf="addingPhoto">
              <span class="spinner-small"></span> Uploading…
            </div>
            <div class="photo-add-error" *ngIf="photoError">{{ photoError }}</div>
          </div>
        </div>

        <div class="ai-panel">
          <div class="ai-card glass">
            <div class="ai-card-header">
              <div class="ai-title-row">
                <span class="ai-icon">🤖</span>
                <h3>AI Repair Suggestions</h3>
                <div class="provider-toggle">
                  <button class="provider-btn" [class.active]="aiProvider === 'claude'" (click)="setProvider('claude')">Claude</button>
                  <button class="provider-btn" [class.active]="aiProvider === 'gemini'" (click)="setProvider('gemini')">Gemini</button>
                </div>
              </div>
              <div class="ai-btn-group">
                <button class="btn-save-report" *ngIf="aiSuggestions" [disabled]="savingReport" (click)="saveAIReport()">
                  <span *ngIf="!savingReport">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Save AI Response
                  </span>
                  <span class="loading-row" *ngIf="savingReport"><span class="spinner-sm"></span> Saving… </span>
                </button>
                <button class="btn-ask" [disabled]="aiLoading" (click)="askAI()">
                  <span *ngIf="!aiLoading">Ask AI</span>
                  <span class="loading-row" *ngIf="aiLoading"><span class="spinner-sm"></span> Thinking… </span>
                </button>
              </div>
            </div>

            <div class="report-saved-bar" *ngIf="reportUrl">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Report saved —
              <a class="report-link" [href]="reportUrl" target="_blank">Open HTML report</a>
              <button class="btn-wa-report" (click)="openWaReportDialog()">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"></path>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.856L0 24l6.334-1.51A11.933 11.933 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-4.99-1.366l-.358-.213-3.758.896.942-3.65-.233-.374A9.796 9.796 0 0 1 2.182 12C2.182 6.575 6.575 2.182 12 2.182S21.818 6.575 21.818 12 17.425 21.818 12 21.818z"></path>
                </svg>
                Send via WhatsApp
              </button>
            </div>

            <div class="wa-report-dialog glass" *ngIf="showWaReportDialog">
              <div class="wa-report-header">
                <span>Send report to WhatsApp</span>
                <button class="wa-report-close" (click)="showWaReportDialog = false">✕</button>
              </div>
              <input type="tel" class="wa-report-input" placeholder="e.g. 07700 900123"
                     [(ngModel)]="waReportPhone" (keyup.enter)="sendReportViaWhatsApp()">
              <div class="wa-report-actions">
                <button class="wa-report-cancel" (click)="showWaReportDialog = false">Cancel</button>
                <button class="wa-report-send" [disabled]="!waReportPhone.trim()" (click)="sendReportViaWhatsApp()">Send</button>
              </div>
            </div>

            <div class="ai-error" *ngIf="aiError">{{ aiError }}</div>

            <div class="saved-report-bar" *ngIf="item.aiReportUrl && !reportUrl">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              A saved AI report exists for this item —
              <a class="report-link" [href]="item.aiReportUrl" target="_blank">View report</a>
            </div>

            <div class="ai-placeholder" *ngIf="!aiSuggestions && !aiLoading && !aiError">
              Click "Ask AI" to get repair suggestions based on this item's details.
            </div>

            <div class="ai-result" *ngIf="aiSuggestions" [innerHTML]="formattedSuggestions"></div>

            <ng-container *ngIf="followUps.length > 0">
              <div class="followup-thread">
                <div class="followup-pair" *ngFor="let f of followUps">
                  <div class="followup-q">
                    <span class="fq-label">You asked</span>
                    {{ f.question }}
                  </div>
                  <div class="followup-a" [innerHTML]="f.html"></div>
                </div>
                <div class="followup-thinking" *ngIf="followUpLoading">
                  <span class="spinner-sm"></span> Thinking…
                </div>
              </div>
            </ng-container>

            <div class="followup-input-row" *ngIf="aiSuggestions && !aiLoading">
              <textarea class="followup-input" placeholder="Ask a follow-up question…" rows="2"
                        [(ngModel)]="followUpQuestion" [disabled]="followUpLoading"
                        (keydown.control.enter)="sendFollowUp()"></textarea>
              <button class="btn-followup" [disabled]="!followUpQuestion.trim() || followUpLoading" (click)="sendFollowUp()">
                <span *ngIf="!followUpLoading">Send</span>
                <span class="loading-row" *ngIf="followUpLoading"><span class="spinner-sm"></span></span>
              </button>
            </div>
          </div>

          <div class="notes-card glass">
            <h3 class="notes-title">Investigation Notes</h3>
            <p class="notes-hint">Record your findings, measurements, or anything useful for the repair.</p>
            <textarea rows="6" placeholder="What did you find? Any part numbers, measurements, test results…"
                      class="notes-textarea" [(ngModel)]="investigationNotes"></textarea>
            <div class="action-row">
              <button class="btn-save" [disabled]="saving" (click)="saveNotes()">
                <span *ngIf="!saving">Save Notes</span>
                <span *ngIf="saving">Saving…</span>
              </button>
              <button class="btn-start-repair" [disabled]="saving" (click)="completeRepair()"> Complete Repair → </button>
            </div>
          </div>
        </div>
      </div>

      <div class="webcam-overlay" *ngIf="showWebcam" (click)="closeWebcam()">
        <div class="webcam-modal" (click)="$event.stopPropagation()">
          <div class="webcam-header">
            <span>Take Photo</span>
            <button class="webcam-close" (click)="closeWebcam()">✕</button>
          </div>
          <div class="webcam-body">
            <video #videoEl class="webcam-video" autoplay playsinline></video>
            <canvas #canvasEl style="display:none"></canvas>
            <div class="webcam-error" *ngIf="webcamError">{{ webcamError }}</div>
          </div>
          <div class="webcam-footer">
            <button class="btn-cancel" (click)="closeWebcam()">Cancel</button>
            <button class="btn-capture" [disabled]="!!webcamError" (click)="capturePhoto()">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inv-container { max-width: 1100px; margin: 0 auto; padding-top: 1rem; }
    .back-bar { margin-bottom: 1.5rem; }
    .btn-back { display: inline-flex; align-items: center; gap: .35rem; background: transparent; border: none; color: #ffffff73; cursor: pointer; font-size: .88rem; font-weight: 600; padding: 0; transition: color .15s; }
    .btn-back:hover { color: #fff; }
    .center-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 5rem; color: #fff6; }
    .layout { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start; }
    @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
    .item-panel { border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .item-header { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
    .item-num { font-size: .78rem; font-weight: 700; background: #00f2ff1a; border: 1px solid rgba(0,242,255,.3); color: var(--accent-color); padding: .25rem .55rem; border-radius: 5px; }
    .stage-badge { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; background: #9b59b626; border: 1px solid rgba(155,89,182,.4); color: #c39bd3; padding: .2rem .55rem; border-radius: 20px; }
    .item-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; }
    .item-chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .chip { font-size: .75rem; background: #ffffff12; border: 1px solid rgba(255,255,255,.12); color: #fff9; padding: .2rem .5rem; border-radius: 4px; }
    .chip.accent { background: #00f2ff12; border-color: #00f2ff33; color: var(--accent-color); }
    .detail-row { display: flex; flex-direction: column; gap: .2rem; }
    .detail-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #ffffff59; }
    .detail-val { font-size: .88rem; color: #ffffffbf; }
    .fault-box { background: #ffffff0a; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: .9rem 1rem; }
    .fault-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #ffffff59; margin-bottom: .4rem; }
    .fault-text { margin: 0; font-size: .9rem; color: #fffc; line-height: 1.5; }
    .photo-strip { display: flex; gap: .5rem; flex-wrap: wrap; }
    .photo-thumb { width: 70px; height: 70px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,.15); }
    .photo-add-row { display: flex; flex-direction: column; gap: .4rem; }
    .photo-add-group { display: flex; gap: .5rem; flex-wrap: wrap; }
    .photo-add-btn { display: flex; align-items: center; gap: .4rem; background: #ffffff0d; border: 1px solid rgba(255,255,255,.15); color: #ffffff8c; border-radius: 8px; padding: .45rem .75rem; cursor: pointer; font-size: .78rem; font-weight: 600; font-family: inherit; transition: all .15s; white-space: nowrap; }
    .photo-add-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background: #00f2ff0f; }
    .photo-add.uploading { display: flex; align-items: center; gap: .4rem; font-size: .8rem; color: #ffffff73; }
    .photo-add-error { color: #f1948a; font-size: .78rem; }
    .spinner-small { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--accent-color); border-radius: 50%; animation: spin .7s linear infinite; }
    .ai-panel { display: flex; flex-direction: column; gap: 1.2rem; min-width: 0; }
    .ai-card, .notes-card { border-radius: 14px; padding: 1.5rem; }
    .ai-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
    .ai-title-row { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
    .ai-icon { font-size: 1.3rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #fff; }
    .provider-toggle { display: flex; background: #ffffff0f; border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 2px; gap: 2px; }
    .provider-btn { background: none; border: none; color: #fff6; font-size: .72rem; font-weight: 700; font-family: inherit; padding: .2rem .65rem; border-radius: 16px; cursor: pointer; transition: all .15s; }
    .provider-btn.active { background: #9b59b659; color: #c39bd3; }
    .provider-btn:hover:not(.active) { color: #ffffffb3; }
    .ai-btn-group { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .btn-save-report { display: flex; align-items: center; gap: .35rem; background: #3498db1f; border: 1px solid rgba(52,152,219,.35); color: #85c1e9; padding: .5rem .9rem; border-radius: 7px; cursor: pointer; font-size: .82rem; font-weight: 600; font-family: inherit; transition: all .15s; white-space: nowrap; }
    .btn-save-report:hover:not(:disabled) { background: #3498db38; }
    .btn-save-report:disabled { opacity: .5; cursor: not-allowed; }
    .saved-report-bar { display: flex; align-items: center; gap: .4rem; font-size: .82rem; color: #85c1e9; background: #3498db14; border: 1px solid rgba(52,152,219,.2); border-radius: 7px; padding: .45rem .8rem; margin-bottom: .5rem; flex-wrap: wrap; }
    .report-saved-bar { display: flex; align-items: center; gap: .4rem; font-size: .82rem; color: #58d68d; background: #28b46314; border: 1px solid rgba(40,180,99,.2); border-radius: 7px; padding: .45rem .8rem; margin-bottom: .5rem; flex-wrap: wrap; }
    .report-link { color: #58d68d; text-decoration: underline; cursor: pointer; }
    .btn-wa-report { display: inline-flex; align-items: center; gap: .3rem; background: #25d36626; border: 1px solid rgba(37,211,102,.35); color: #58d68d; border-radius: 6px; padding: .2rem .65rem; font-size: .78rem; font-weight: 600; font-family: inherit; cursor: pointer; transition: all .15s; }
    .btn-wa-report:hover { background: #25d36640; }
    .wa-report-dialog { border-radius: 10px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem; }
    .wa-report-header { display: flex; justify-content: space-between; align-items: center; font-size: .88rem; font-weight: 700; color: #fff; }
    .wa-report-close { background: none; border: none; color: #ffffff73; cursor: pointer; font-size: .9rem; padding: .1rem .3rem; }
    .wa-report-close:hover { color: #fff; }
    .wa-report-input { background: #ffffff0f; border: 1px solid rgba(255,255,255,.15); border-radius: 7px; color: #fff; padding: .55rem .8rem; font-size: .88rem; font-family: inherit; outline: none; transition: border-color .15s; box-sizing: border-box; width: 100%; }
    .wa-report-input:focus { border-color: #58d68d; }
    .wa-report-input::placeholder { color: #ffffff40; }
    .wa-report-actions { display: flex; justify-content: flex-end; gap: .5rem; }
    .wa-report-cancel { background: none; border: 1px solid rgba(255,255,255,.15); color: #ffffff80; border-radius: 6px; padding: .4rem .9rem; font-size: .82rem; font-weight: 600; font-family: inherit; cursor: pointer; }
    .wa-report-send { background: #25d3662e; border: 1px solid rgba(37,211,102,.45); color: #58d68d; border-radius: 6px; padding: .4rem 1rem; font-size: .82rem; font-weight: 700; font-family: inherit; cursor: pointer; transition: all .15s; }
    .wa-report-send:hover:not(:disabled) { background: #25d36647; }
    .wa-report-send:disabled { opacity: .35; cursor: not-allowed; }
    .btn-ask { background: #9b59b626; border: 1px solid rgba(155,89,182,.4); color: #c39bd3; padding: .5rem 1.2rem; border-radius: 7px; cursor: pointer; font-size: .85rem; font-weight: 700; transition: all .15s; flex-shrink: 0; }
    .btn-ask:hover:not(:disabled) { background: #9b59b640; }
    .btn-ask:disabled { opacity: .5; cursor: not-allowed; }
    .loading-row { display: flex; align-items: center; gap: .4rem; }
    .ai-error { color: #f1948a; font-size: .88rem; background: #e74c3c1a; border: 1px solid rgba(231,76,60,.25); border-radius: 8px; padding: .7rem 1rem; }
    .ai-placeholder { color: #ffffff4d; font-size: .88rem; padding: 1.5rem 0; text-align: center; }
    .ai-result { font-size: .9rem; color: #ffffffd9; line-height: 1.6; white-space: pre-wrap; }
    .ai-result strong { color: #fff; }
    .notes-title { margin: 0 0 .3rem; font-size: .95rem; font-weight: 700; color: #fff; }
    .notes-hint { margin: 0 0 .9rem; font-size: .8rem; color: #ffffff59; }
    .notes-textarea { width: 100%; background: #ffffff0a; border: 1px solid rgba(255,255,255,.1); color: #ffffffd9; border-radius: 8px; padding: .7rem .9rem; font-size: .9rem; resize: vertical; outline: none; font-family: inherit; transition: border-color .15s; box-sizing: border-box; }
    .notes-textarea:focus { border-color: var(--accent-color); }
    .notes-textarea::placeholder { color: #fff3; }
    .action-row { display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap; }
    .btn-save { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #ffffffa6; padding: .65rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 600; transition: all .15s; }
    .btn-save:hover:not(:disabled) { background: #ffffff0f; color: #fff; }
    .btn-save:disabled { opacity: .4; cursor: not-allowed; }
    .btn-start-repair { background: #3498db26; border: 1px solid rgba(52,152,219,.4); color: #85c1e9; padding: .65rem 1.8rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 700; transition: all .15s; }
    .btn-start-repair:hover:not(:disabled) { background: #3498db40; }
    .btn-start-repair:disabled { opacity: .4; cursor: not-allowed; }
    .followup-thread { display: flex; flex-direction: column; gap: 1rem; border-top: 1px solid rgba(255,255,255,.07); margin-top: 1rem; padding-top: 1rem; }
    .followup-pair { display: flex; flex-direction: column; gap: .5rem; }
    .followup-q { display: flex; flex-direction: column; gap: .2rem; background: #9b59b614; border: 1px solid rgba(155,89,182,.2); border-radius: 8px; padding: .6rem .9rem; font-size: .88rem; color: #ffffffbf; line-height: 1.5; }
    .fq-label { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #c39bd3; }
    .followup-a { font-size: .9rem; color: #ffffffd9; line-height: 1.6; padding: 0 .2rem; }
    .followup-a strong { color: #fff; }
    .followup-thinking { display: flex; align-items: center; gap: .5rem; font-size: .85rem; color: #ffffff59; }
    /*
      followup-input-row: on narrow phones in portrait mode the Send button was being
      pushed off the right edge (textarea has no min-width:0, so a flex item won't
      shrink below its intrinsic content width). min-width:0 lets it shrink, and the
      column layout below is a hard guarantee the button always stays on-screen.
    */
    .followup-input-row { display: flex; gap: .6rem; align-items: flex-end; border-top: 1px solid rgba(255,255,255,.07); margin-top: 1rem; padding-top: 1rem; }
    .followup-input { flex: 1; min-width: 0; background: #ffffff0a; border: 1px solid rgba(255,255,255,.1); color: #ffffffd9; border-radius: 8px; padding: .6rem .8rem; font-size: .88rem; font-family: inherit; resize: none; outline: none; transition: border-color .15s; box-sizing: border-box; }
    .followup-input:focus { border-color: #9b59b699; }
    .followup-input::placeholder { color: #fff3; }
    .followup-input:disabled { opacity: .5; }
    .btn-followup { background: #9b59b626; border: 1px solid rgba(155,89,182,.4); color: #c39bd3; padding: .55rem 1.1rem; border-radius: 7px; cursor: pointer; font-size: .85rem; font-weight: 700; font-family: inherit; transition: all .15s; flex-shrink: 0; }
    .btn-followup:hover:not(:disabled) { background: #9b59b640; }
    .btn-followup:disabled { opacity: .4; cursor: not-allowed; }
    @media (max-width: 480px) {
      .followup-input-row { flex-direction: column; align-items: stretch; }
      .btn-followup { align-self: flex-end; }
    }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,.1); border-top-color: var(--accent-color); border-radius: 50%; animation: spin .8s linear infinite; }
    .spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(155,89,182,.3); border-top-color: #c39bd3; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .webcam-overlay { position: fixed; inset: 0; background: #000000bf; display: flex; align-items: center; justify-content: center; z-index: 1000; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box; }
    .webcam-modal { background: #1a2236; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; overflow: hidden; width: min(560px, 96vw); display: flex; flex-direction: column; box-shadow: 0 24px 64px #0009; }
    .webcam-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); font-size: .95rem; font-weight: 700; color: #fff; }
    .webcam-close { background: none; border: none; color: #ffffff80; font-size: 1rem; cursor: pointer; padding: .2rem .4rem; line-height: 1; border-radius: 4px; transition: color .15s; }
    .webcam-close:hover { color: #fff; }
    .webcam-body { position: relative; background: #000; }
    .webcam-video { width: 100%; display: block; max-height: 60vh; object-fit: contain; }
    .webcam-error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #f1948a; font-size: .9rem; text-align: center; padding: 2rem; background: #0009; }
    .webcam-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,.08); }
    .btn-capture { display: flex; align-items: center; gap: .5rem; background: #00f2ff1f; border: 1px solid rgba(0,242,255,.4); color: var(--accent-color); padding: .6rem 1.4rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 700; font-family: inherit; transition: all .15s; }
    .btn-capture:hover:not(:disabled) { background: #00f2ff38; }
    .btn-capture:disabled { opacity: .35; cursor: not-allowed; }
    .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,.15); color: #fff9; padding: .65rem 1.4rem; border-radius: 8px; cursor: pointer; font-size: .9rem; font-weight: 600; transition: all .15s; }
    .btn-cancel:hover { background: #ffffff0f; color: #fff; }
  `]
})
export class InvestigationComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private repairService = inject(RepairService);
  private functions = inject(Functions);
  private storage = inject(Storage);

  item: RepairItem | null = null;
  loading = true;
  saving = false;

  aiLoading = false;
  aiSuggestions = '';
  aiError = '';
  formattedSuggestions = '';
  investigationNotes = '';
  aiProvider: 'claude' | 'gemini' = 'claude';

  followUps: FollowUp[] = [];
  followUpQuestion = '';
  followUpLoading = false;

  savingReport = false;
  reportUrl = '';
  showWaReportDialog = false;
  waReportPhone = '';

  // New photos added while investigating (not capped — the 3-photo limit only
  // applies to the quick intake step; here the repairer may need more).
  addingPhoto = false;
  photoError = '';
  showWebcam = false;
  webcamError = '';
  private stream: MediaStream | null = null;

  private chatHistory: ChatMessage[] = [];
  private sub: Subscription | null = null;

  private categoryEmojis: { [key: string]: string } = {
    electrical: '⚡', textile: '🧵', ornament: '🪆', mechanical: '⚙️',
    furniture: '🪑', toy: '🧸', clock: '🕐', jewelry: '💍', other: '❓'
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }
    this.sub = this.repairService.getRepairItems().subscribe(items => {
      this.item = items.find(i => i.id === id) ?? null;
      if (this.item) this.investigationNotes = this.item.investigationNotes || '';
      this.loading = false;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.stopStream();
  }

  setProvider(provider: 'claude' | 'gemini') {
    if (this.aiProvider === provider) return;
    this.aiProvider = provider;
    this.aiSuggestions = '';
    this.formattedSuggestions = '';
    this.followUps = [];
    this.chatHistory = [];
    this.aiError = '';
    this.reportUrl = '';
  }

  getCategoryEmoji(category?: string): string {
    return this.categoryEmojis[category?.toLowerCase() || ''] || '❓';
  }

  getPhotoUrl(photo: any): string {
    return toRepairPhoto(photo).url;
  }

  async askAI() {
    if (!this.item || this.aiLoading) return;
    this.aiLoading = true;
    this.aiError = '';
    this.aiSuggestions = '';
    this.formattedSuggestions = '';
    this.followUps = [];
    this.chatHistory = [];
    try {
      const getRepairSuggestions = httpsCallable(this.functions, 'getRepairSuggestions');
      const result: any = await getRepairSuggestions({
        itemDescription: this.item.itemDescription,
        fault: this.item.fault,
        category: this.item.category,
        make: this.item.make,
        model: this.item.model,
        ageOfItem: this.item.ageOfItem,
        provider: this.aiProvider
      });
      this.aiSuggestions = result.data.suggestions;
      this.formattedSuggestions = this.renderMarkdown(this.aiSuggestions);
      this.chatHistory = [
        { role: 'user', content: `Repair item: ${this.item.itemDescription || ''}. Fault: ${this.item.fault || ''}` },
        { role: 'assistant', content: this.aiSuggestions }
      ];
      if (this.item.id) {
        await this.repairService.updateRepairItem(this.item.id, {
          status: 'Investigating',
          investigationNotes: (this.item.investigationNotes || '') +
            (this.item.investigationNotes ? '\n\n---\n\n' : '') +
            `AI suggestions (${new Date().toLocaleDateString()}):\n${this.aiSuggestions}`
        });
      }
    } catch (e: any) {
      console.error('AI call failed:', e);
      this.aiError = e?.message || 'Failed to get AI suggestions. Make sure the ANTHROPIC_API_KEY is set in your Firebase Function config.';
    } finally {
      this.aiLoading = false;
    }
  }

  async sendFollowUp() {
    const question = this.followUpQuestion.trim();
    if (!question || this.followUpLoading || !this.item) return;
    this.followUpQuestion = '';
    this.followUpLoading = true;
    try {
      const getRepairSuggestions = httpsCallable(this.functions, 'getRepairSuggestions');
      const result: any = await getRepairSuggestions({
        conversationHistory: this.chatHistory,
        followUpQuestion: question,
        provider: this.aiProvider,
        // Latest photo URLs (including any added during this investigation) so a
        // vision-capable provider can take them into account on follow-up.
        photos: (this.item.photos || []).map(p => this.getPhotoUrl(p))
      });
      const answer = result.data.suggestions;
      this.chatHistory.push({ role: 'user', content: question });
      this.chatHistory.push({ role: 'assistant', content: answer });
      this.followUps.push({ question, answer, html: this.renderMarkdown(answer) });
      if (this.item.id) {
        await this.repairService.updateRepairItem(this.item.id, {
          investigationNotes: (this.item.investigationNotes || '') +
            (this.item.investigationNotes ? '\n\n' : '') +
            `Q: ${question}\nA: ${answer}`
        });
      }
    } catch (e: any) {
      console.error('Follow-up failed:', e);
      this.aiError = e?.message || 'Failed to get a response.';
    } finally {
      this.followUpLoading = false;
    }
  }

  private renderMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4 style="margin:0.8em 0 0.3em;color:white;font-size:0.9rem">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="margin:0.8em 0 0.3em;color:white">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 style="margin:0.8em 0 0.3em;color:white">$1</h2>')
      .replace(/^\d+\. (.+)$/gm, '<li style="margin:0.3em 0">$1</li>')
      .replace(/^[-*] (.+)$/gm, '<li style="margin:0.3em 0">$1</li>')
      .replace(/\n\n/g, '<br><br>');
  }

  async saveNotes() {
    if (!this.item?.id || this.saving) return;
    this.saving = true;
    try {
      await this.repairService.updateRepairItem(this.item.id, { investigationNotes: this.investigationNotes });
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save notes.');
    } finally {
      this.saving = false;
    }
  }

  async saveAIReport() {
    if (!this.aiSuggestions || this.savingReport || !this.item) return;
    this.savingReport = true;
    this.reportUrl = '';
    try {
      const html = this.buildReportHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const path = `ai-reports/${this.item.id}-${Date.now()}.html`;
      const storageRef = ref(this.storage, path);
      const result = await uploadBytes(storageRef, blob, { contentType: 'text/html' });
      this.reportUrl = await getDownloadURL(result.ref);
      if (this.item.id) {
        await this.repairService.updateRepairItem(this.item.id, { aiReportUrl: this.reportUrl });
        this.item.aiReportUrl = this.reportUrl;
      }
    } catch (e) {
      console.error('Failed to save report:', e);
      alert('Failed to save report. Please try again.');
    } finally {
      this.savingReport = false;
    }
  }

  openWaReportDialog() {
    this.waReportPhone = this.item?.telephone || '';
    this.showWaReportDialog = true;
  }

  sendReportViaWhatsApp() {
    const phone = this.normalisePhone(this.waReportPhone);
    if (!phone || !this.reportUrl) return;
    const owner = this.item?.owner || 'there';
    const description = this.item?.itemDescription || 'your item';
    const message = `Hi ${owner}! 👋\n\nHere is the AI repair suggestions report for your ${description}:\n\n${this.reportUrl}\n\nShrewsbury Repair Café ♻️`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    this.showWaReportDialog = false;
  }

  private normalisePhone(phone: string): string {
    let p = phone.replace(/[\s\-().]/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    else if (p.startsWith('0')) p = '+44' + p.slice(1);
    else if (!p.startsWith('+')) p = '+44' + p;
    return p.replace(/[^\d+]/g, '');
  }

  private buildReportHtml(): string {
    const item = this.item!;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const followUpsHtml = this.followUps.map(f => `
      <div class="followup-pair">
        <div class="followup-q"><span class="q-label">Follow-up question</span>${this.escapeHtml(f.question)}</div>
        <div class="followup-a">${f.html}</div>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Repair Report — ${this.escapeHtml(item.itemDescription)} — ${dateStr}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a2e; line-height: 1.6; }
    h1 { font-size: 1.5rem; color: #0d1b2a; margin-bottom: 0.25rem; }
    .meta { font-size: 0.85rem; color: #666; margin-bottom: 2rem; }
    .item-card { background: #f4f6fb; border-radius: 10px; padding: 1.2rem 1.5rem; margin-bottom: 2rem; }
    .item-card h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    .item-field { display: flex; gap: 0.5rem; font-size: 0.88rem; margin-bottom: 0.25rem; }
    .field-label { font-weight: 600; color: #555; min-width: 80px; }
    .section-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin: 1.5rem 0 0.75rem; }
    .ai-response { background: #fff; border: 1px solid #e0e4f0; border-radius: 10px; padding: 1.2rem 1.5rem; font-size: 0.92rem; }
    .ai-response strong { color: #0d1b2a; }
    .ai-response li { margin: 0.3em 0; }
    .followup-pair { margin-top: 1.5rem; }
    .followup-q { background: #f0ebfa; border-left: 3px solid #9b59b6; padding: 0.7rem 1rem; border-radius: 0 8px 8px 0; margin-bottom: 0.75rem; font-size: 0.9rem; }
    .q-label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #9b59b6; margin-bottom: 0.3rem; }
    .followup-a { background: #fff; border: 1px solid #e0e4f0; border-radius: 8px; padding: 1rem 1.2rem; font-size: 0.92rem; }
    .footer { margin-top: 3rem; font-size: 0.78rem; color: #aaa; border-top: 1px solid #eee; padding-top: 1rem; }
  </style>
</head>
<body>
  <h1>AI Repair Report</h1>
  <div class="meta">Generated ${dateStr} · Shrewsbury Repair Café · AI: ${this.aiProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}</div>

  <div class="item-card">
    <h2>${this.escapeHtml(item.itemDescription)}</h2>
    ${item.owner ? `<div class="item-field"><span class="field-label">Owner</span>${this.escapeHtml(item.owner)}</div>` : ''}
    ${item.make || item.model ? `<div class="item-field"><span class="field-label">Make/Model</span>${this.escapeHtml([item.make, item.model].filter(Boolean).join(' / '))}</div>` : ''}
    ${item.category ? `<div class="item-field"><span class="field-label">Category</span>${this.escapeHtml(item.category)}</div>` : ''}
    ${item.fault ? `<div class="item-field"><span class="field-label">Fault</span>${this.escapeHtml(item.fault)}</div>` : ''}
  </div>

  <div class="section-title">AI Suggestions</div>
  <div class="ai-response">${this.formattedSuggestions}${followUpsHtml}</div>

  <div class="footer">Shrewsbury Repair Café · AI-assisted diagnosis report · ${dateStr}</div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async completeRepair() {
    if (!this.item?.id || this.saving) return;
    this.saving = true;
    try {
      await this.repairService.updateRepairItem(this.item.id, { investigationNotes: this.investigationNotes });
      this.router.navigate(['/complete', this.item.id]);
    } catch (e) {
      console.error('Failed to save notes:', e);
      alert('Failed to save notes.');
      this.saving = false;
    }
  }

  goBack() {
    this.router.navigate(['/repairs']);
  }

  // --- Adding photos during investigation (uncapped) ---

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    await this.uploadNewPhoto(file);
  }

  openWebcam() {
    this.webcamError = '';
    this.showWebcam = true;
    setTimeout(async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        this.videoEl.nativeElement.srcObject = this.stream;
      } catch {
        this.webcamError = 'Camera access denied. Please check your browser permissions and try again.';
      }
    }, 80);
  }

  closeWebcam() {
    this.showWebcam = false;
    this.stopStream();
  }

  capturePhoto() {
    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      this.closeWebcam();
      await this.uploadNewPhoto(file);
    }, 'image/jpeg', 0.9);
  }

  private async uploadNewPhoto(file: File) {
    if (!this.item?.id) return;
    this.addingPhoto = true;
    this.photoError = '';
    try {
      const url = await this.repairService.uploadPhoto(file);
      const photos = [...(this.item.photos || []), { url, type: 'before' as const }];
      await this.repairService.updateRepairItem(this.item.id, { photos });
      this.item.photos = photos;
    } catch (e) {
      console.error('Photo upload failed:', e);
      this.photoError = 'Failed to upload photo. Please try again.';
    } finally {
      this.addingPhoto = false;
    }
  }

  private stopStream() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}
