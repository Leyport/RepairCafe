import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-overlay" (click)="onClose()">
      <div class="login-card" (click)="$event.stopPropagation()">
        <header>
          <h2>{{ isSignUp ? 'Create Account' : 'Welcome Back' }}</h2>
          <button class="close-btn" (click)="onClose()">&times;</button>
        </header>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" [(ngModel)]="email" name="email" required placeholder="your@email.com">
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-container">
              <input [type]="showPassword ? 'text' : 'password'" id="password" [(ngModel)]="password" name="password" required placeholder="••••••••">
              <button type="button" class="toggle-password" (click)="showPassword = !showPassword" [title]="showPassword ? 'Hide password' : 'Show password'">
                <svg *ngIf="!showPassword" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg *ngIf="showPassword" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="error-msg" *ngIf="error">{{ error }}</div>

          <button type="submit" class="btn-primary" [disabled]="loading">
             {{ loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login') }}
          </button>
        </form>

        <div class="switch-mode">
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button (click)="toggleMode()">{{ isSignUp ? 'Login' : 'Sign Up' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .login-card {
      background: rgba(30, 30, 40, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
      background: linear-gradient(45deg, #fff, var(--accent-color, #4a9eff));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .close-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 2rem;
      cursor: pointer;
      line-height: 1;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.9rem;
    }

    input {
      width: 100%;
      padding: 0.8rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.3s;
    }

    input:focus {
      border-color: var(--accent-color, #4a9eff);
    }

    .password-container {
      position: relative;
    }

    .password-container input {
      padding-right: 3rem;
    }

    .toggle-password {
      position: absolute;
      right: 0.8rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.4rem;
      border-radius: 4px;
      transition: color 0.2s, background 0.2s;
    }

    .toggle-password:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-primary {
      width: 100%;
      padding: 1rem;
      background: var(--accent-color, #4a9eff);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, background 0.3s;
    }

    .btn-primary:active {
      transform: scale(0.98);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-msg {
      color: #ff4a4a;
      background: rgba(255, 74, 74, 0.1);
      padding: 0.8rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    .switch-mode {
      margin-top: 1.5rem;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
    }

    .switch-mode button {
      background: none;
      border: none;
      color: var(--accent-color, #4a9eff);
      font-weight: 600;
      cursor: pointer;
      padding: 0 0.5rem;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);

  @Output() close = new EventEmitter<void>();

  email = '';
  password = '';
  showPassword = false;
  isSignUp = false;
  loading = false;
  error = '';

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.error = '';
  }

  onClose() {
    this.close.emit();
  }

  async onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Please fill in all fields.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      if (this.isSignUp) {
        await this.authService.signUpWithEmail(this.email, this.password);
      } else {
        await this.authService.loginWithEmail(this.email, this.password);
      }
      this.onClose();
    } catch (err: any) {
      this.error = this.getErrorMessage(err.code);
    } finally {
      this.loading = false;
    }
  }

  private getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use': return 'Email already in use.';
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/weak-password': return 'Password is too weak.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Invalid email or password.';
      case 'auth/operation-not-allowed': return 'Email/Password sign-in is not enabled in Firebase Console.';
      default: return 'An error occurred. Please try again.';
    }
  }
}
