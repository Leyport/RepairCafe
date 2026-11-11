import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { RepairService } from './services/repair.service';
import { filter, map, startWith, switchMap } from 'rxjs/operators';
import { combineLatest, firstValueFrom, of, Subscription } from 'rxjs';

import { AuthService } from './services/auth.service';
import { PublicStatsService } from './services/public-stats.service';
import { LoginComponent } from './components/auth/login/login.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { APP_VERSION } from './constants/version';

import { DialogService } from './services/dialog.service';
// Pages anyone can see without signing in or being approved.
const PUBLIC_PATHS = new Set(['', 'stats', 'privacy', 'data-deletion']);

// Pages whose content (e.g. a wide data table) benefits from more than the
// usual reading-width .container, on screens big enough to make use of it.
const WIDE_PATHS = new Set(['repairs']);

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, LoginComponent, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  title = 'RepairCafe';
  showLogin = false;
  updateAvailable = false;

  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private publicStats = inject(PublicStatsService);
  private statsSub: Subscription | null = null;

  /** Embedded in another website (e.g. /stats?embed=1): show just the page, no header or footer. */
  readonly embedded = new URLSearchParams(window.location.search).get('embed') === '1';

  private readonly bootVersion = APP_VERSION.version;
  private updateCheckTimer: ReturnType<typeof setInterval> | null = null;
  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.checkForUpdate();
  };

  appVersion$ = this.repairService.getAppVersion();

  user$ = this.authService.user$;
  access$ = this.authService.access$;

  // Only approved volunteers can read the issues log.
  issueCount$ = this.access$.pipe(
    switchMap(a => (a === 'approved' ? this.repairService.getIssues() : of([]))),
    map(issues => issues.length)
  );

  private isPublicPage$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => e.urlAfterRedirects),
    startWith(window.location.pathname),
    map(url => PUBLIC_PATHS.has(url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').split('/')[0]))
  );

  isWidePage$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => e.urlAfterRedirects),
    startWith(window.location.pathname),
    map(url => WIDE_PATHS.has(url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').split('/')[0]))
  );

  /** What the main area shows: the page itself, or a sign-in / waiting-for-approval message. */
  gate$ = combineLatest([this.access$.pipe(startWith('loading' as const)), this.isPublicPage$]).pipe(
    map(([access, isPublic]) => {
      if (isPublic || access === 'approved') return 'page';
      return access; // 'loading' | 'signed-out' | 'pending'
    })
  );

  ngOnInit() {
    // Actively tells you when a newer build has been deployed, rather than
    // relying on you noticing the version badge changed or guessing whether
    // you're looking at stale cached code.
    this.updateCheckTimer = setInterval(() => this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    // Keep the anonymous public statistics (/stats) up to date while a volunteer is signed in.
    if (!this.embedded) this.statsSub = this.publicStats.startAutoPublish();
  }

  ngOnDestroy() {
    if (this.updateCheckTimer) clearInterval(this.updateCheckTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.statsSub?.unsubscribe();
  }

  private async checkForUpdate() {
    if (this.updateAvailable) return;
    try {
      const data = await firstValueFrom(
        this.http.get<{ version: string }>(`/assets/version.json?t=${Date.now()}`)
      );
      if (data?.version && data.version !== this.bootVersion) {
        this.updateAvailable = true;
        if (this.updateCheckTimer) clearInterval(this.updateCheckTimer);
      }
    } catch {
      // No network, or the file briefly 404s during a deploy — just try again next tick.
    }
  }

  reloadApp() {
    window.location.reload();
  }

  async loginGoogle() {
    try {
      await this.authService.loginWithGoogle();
    } catch (e) {
      this.dialog.error("Couldn't sign you in. Please try again.", 'Sign-in failed');
    }
  }


  async logout() {
    await this.authService.logout();
    // Load the welcome page (with the sign-in options) fresh. A full page load always shows it,
    // even if sign-out finished outside Angular's change detection, and clears anything the
    // previous user had open, which matters on shared laptops at sessions.
    window.location.assign('/');
  }

}
