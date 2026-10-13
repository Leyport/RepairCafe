import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepairService } from '../../../services/repair.service';

@Component({
  selector: 'app-version-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="manager-section">
      <div class="section-header">
        <h3>🏷️ App Version</h3>
      </div>

      <p class="hint">
        The version number is stamped automatically at build time from the git commit and
        build timestamp, so it always matches exactly what's deployed — there's nothing to
        edit here any more.
      </p>

      <div class="current-version glass" *ngIf="currentVersion">
        <span class="label">Currently deployed:</span>
        <span class="ver">{{ currentVersion.version }}</span>
        <span class="desc" *ngIf="currentVersion.description">— {{ currentVersion.description }}</span>
      </div>
    </div>
  `,
  styles: [`
    .manager-section { max-width: 600px; }
    .section-header { display: flex; align-items: center; margin-bottom: 1rem; }
    .section-header h3 { margin: 0; color: white; }
    .hint { color: rgba(255,255,255,.6); font-size: .88rem; line-height: 1.5; margin: 0 0 1.2rem; }
    .current-version {
      margin-top: 0; font-size: .9rem; color: rgba(255,255,255,.7);
      display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
      padding: 1rem 1.2rem; border-radius: 10px;
    }
    .ver { color: var(--accent-color, #00f2ff); font-weight: 600; font-family: 'Courier New', monospace; }
  `]
})
export class VersionManagerComponent implements OnInit {
  private repairService = inject(RepairService);

  currentVersion: { version: string, description: string } | null = null;

  ngOnInit() {
    this.repairService.getAppVersion().subscribe(v => this.currentVersion = v);
  }
}
