import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
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
  showLogin = false;
  isCreatingRepair = false;

  private repairService = inject(RepairService);
  private authService = inject(AuthService);
  private router = inject(Router);

  appVersion$ = this.repairService.getAppVersion();

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

  async createNewRepair() {
    if (this.isCreatingRepair) return;
    this.isCreatingRepair = true;
    try {
      const rcDay = this.repairService.getNextRCDay();
      const docRef = await this.repairService.addRepairItem({
        itemDescription: '',
        RCDay: rcDay,
        status: 'New'
      });
      this.router.navigate(['/edit', docRef.id]);
    } catch (error) {
      console.error('Failed to create repair item:', error);
    } finally {
      this.isCreatingRepair = false;
    }
  }
}
