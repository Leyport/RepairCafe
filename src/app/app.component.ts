import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { RepairService } from './services/repair.service';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/auth/login/login.component';
import { APP_VERSION } from './constants/version';

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'RepairCafe';
  showLogin = false;
  updateAvailable = false;

  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private readonly bootVersion = APP_VERSION.version;
  private updateCheckTimer: ReturnType<typeof setInterval> | null = null;
  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.checkForUpdate();
  };

  appVersion$ = this.repairService.getAppVersion();

  issueCount$ = this.repairService.getIssues().pipe(
    map(issues => issues.length)
  );

  user$ = this.authService.user$;

  ngOnInit() {
    // Actively tells you when a newer build has been deployed, rather than
    // relying on you noticing the version badge changed or guessing whether
    // you're looking at stale cached code.
    this.updateCheckTimer = setInterval(() => this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy() {
    if (this.updateCheckTimer) clearInterval(this.updateCheckTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
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
      alert('Login failed');
    }
  }

  async loginApple() {
    try {
      await this.authService.loginWithApple();
    } catch (e) {
      alert('Login failed');
    }
  }

  async logout() {
    await this.authService.logout();
  }

}
