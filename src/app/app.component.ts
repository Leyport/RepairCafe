import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { APP_VERSION } from './constants/version';
import { RepairService } from './services/repair.service';
import { map } from 'rxjs/operators';

import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/auth/login/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'RepairCafe';
  version = APP_VERSION.version;
  changeDescription = APP_VERSION.description;
  showLogin = false;

  private repairService = inject(RepairService);
  private authService = inject(AuthService);

  issueCount$ = this.repairService.getIssues().pipe(
    map(issues => issues.length)
  );

  user$ = this.authService.user$;

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
