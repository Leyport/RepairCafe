import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="landing">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-inner">
          <div class="brand">
            <span class="brand-icon">♻️</span>
            <div class="brand-text">
              <h1>Shrewsbury<br>Repair Cafe</h1>
              <p class="tagline">Repair · Reuse · Reduce</p>
            </div>
          </div>

          <p class="hero-desc">
            We're a community of volunteers who repair broken and damaged items for free.
            Bring your broken belongings along and we'll do our best to fix them — saving
            money, reducing waste and sharing skills along the way.
          </p>

          <!-- Sign-in card -->
          <div class="signin-card glass">
            <p class="signin-title">Volunteer sign in</p>

            <div class="social-btns">
              <button class="social-btn google" (click)="login('google')" [disabled]="loading">
                <svg class="social-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <button class="social-btn facebook" (click)="login('facebook')" [disabled]="loading">
                <svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Continue with Facebook</span>
              </button>
            </div>

            <div class="divider"><span>or</span></div>

            <div class="email-form">
              <input class="email-input" type="email" placeholder="Email address" [(ngModel)]="emailValue" [disabled]="loading" />
              <input class="email-input" type="password" placeholder="Password" [(ngModel)]="passwordValue" [disabled]="loading" (keyup.enter)="emailSignIn()" />
              <div class="email-btns">
                <button class="btn-email-signin" (click)="emailSignIn()" [disabled]="loading || !emailValue || !passwordValue">Sign in</button>
                <button class="btn-email-register" (click)="emailRegister()" [disabled]="loading || !emailValue || !passwordValue">Create account</button>
              </div>
            </div>

            <div class="error-msg" *ngIf="error">{{ error }}</div>

            <div class="loading-row" *ngIf="loading">
              <span class="spinner"></span>
              <span>Signing in…</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Info cards -->
      <section class="info-section">
        <div class="info-card glass">
          <div class="info-icon">🔧</div>
          <h3>What we fix</h3>
          <p>Electrical appliances, clothing &amp; textiles, furniture, toys, clocks, jewellery, bikes and much more. If it's broken, bring it along!</p>
        </div>
        <div class="info-card glass">
          <div class="info-icon">🌱</div>
          <h3>Why repair?</h3>
          <p>Every repaired item is one less in landfill. Repairing saves money, reduces waste and cuts the carbon footprint of buying new.</p>
        </div>
        <div class="info-card glass">
          <div class="info-icon">👥</div>
          <h3>Our volunteers</h3>
          <p>Skilled volunteers give their time freely. Sessions are open, friendly and welcoming — visitors are encouraged to watch and learn.</p>
        </div>
        <div class="info-card glass">
          <div class="info-icon">📍</div>
          <h3>Find us</h3>
          <p>We hold regular sessions in Shrewsbury. Check the session schedule for upcoming dates and bring your items along — no booking needed.</p>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .landing {
      padding-bottom: 3rem;
    }

    /* ── Hero ── */
    .hero {
      position: relative;
      padding: 3rem 1rem 3.5rem;
      text-align: center;
      background: radial-gradient(ellipse at 50% 0%, rgba(0,242,255,0.08) 0%, transparent 65%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 2.5rem;
    }

    .hero-inner {
      max-width: 520px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .brand-icon {
      font-size: 3.5rem;
      line-height: 1;
      filter: drop-shadow(0 0 12px rgba(0,242,255,0.4));
    }

    .brand-text {
      text-align: left;
    }

    .brand-text h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.15;
      color: white;
      letter-spacing: -0.02em;
    }

    .tagline {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: var(--accent-color, #00f2ff);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 600;
    }

    .hero-desc {
      margin: 0;
      font-size: 1rem;
      color: rgba(255,255,255,0.65);
      line-height: 1.7;
      max-width: 460px;
    }

    /* ── Sign-in card ── */
    .signin-card {
      width: 100%;
      max-width: 420px;
      padding: 1.75rem;
      border-radius: 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
    }

    .signin-title {
      margin: 0 0 0.3rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: white;
      text-align: center;
    }

    .signin-hint {
      margin: 0 0 1.5rem;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.45);
      text-align: center;
    }

    .social-btns {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .social-btn {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
      padding: 0.8rem 1.25rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      background: rgba(255,255,255,0.06);
      color: white;
      text-align: left;
    }

    .social-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }

    .social-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .social-btn.google {
      background: white;
      color: #3c4043;
      border-color: #dadce0;
    }
    .social-btn.google:hover:not(:disabled) {
      background: #f8f9fa;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }

    .social-btn.facebook {
      background: #1877f2;
      color: white;
      border-color: transparent;
    }
    .social-btn.facebook:hover:not(:disabled) {
      background: #166fe5;
    }

    .social-icon {
      flex-shrink: 0;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1rem 0;
      color: rgba(255,255,255,0.25);
      font-size: 0.8rem;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.1);
    }

    .email-form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .email-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: white;
      font-size: 0.95rem;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .email-input::placeholder { color: rgba(255,255,255,0.3); }
    .email-input:focus { border-color: rgba(0,242,255,0.4); }
    .email-input:disabled { opacity: 0.5; }

    .email-btns {
      display: flex;
      gap: 0.6rem;
      margin-top: 0.2rem;
    }

    .btn-email-signin, .btn-email-register {
      flex: 1;
      padding: 0.75rem;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid;
    }
    .btn-email-signin {
      background: var(--accent-color, #00f2ff);
      color: #0a0a0a;
      border-color: transparent;
    }
    .btn-email-signin:hover:not(:disabled) {
      background: #33f5ff;
      box-shadow: 0 0 14px rgba(0,242,255,0.35);
    }
    .btn-email-register {
      background: transparent;
      color: rgba(255,255,255,0.7);
      border-color: rgba(255,255,255,0.15);
    }
    .btn-email-register:hover:not(:disabled) {
      background: rgba(255,255,255,0.07);
      border-color: rgba(255,255,255,0.3);
      color: white;
    }
    .btn-email-signin:disabled, .btn-email-register:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .error-msg {
      margin-top: 1rem;
      padding: 0.6rem 0.8rem;
      background: rgba(255,60,60,0.12);
      border: 1px solid rgba(255,60,60,0.3);
      border-radius: 8px;
      color: #ff9090;
      font-size: 0.85rem;
      text-align: center;
    }

    .loading-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      margin-top: 1rem;
      color: rgba(255,255,255,0.5);
      font-size: 0.85rem;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.15);
      border-top-color: var(--accent-color, #00f2ff);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Info cards ── */
    .info-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      padding: 0 0.5rem;
    }

    @media (max-width: 900px) {
      .info-section { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 520px) {
      .info-section { grid-template-columns: 1fr; }
      .brand { flex-direction: column; text-align: center; }
      .brand-text { text-align: center; }
      .brand-text h1 { font-size: 1.7rem; }
      .hero { padding: 2rem 1rem 2.5rem; }
    }

    .info-card {
      padding: 1.5rem;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      transition: border-color 0.2s, transform 0.2s;
    }

    .info-card:hover {
      border-color: rgba(0,242,255,0.2);
      transform: translateY(-2px);
    }

    .info-icon {
      font-size: 1.8rem;
      margin-bottom: 0.75rem;
      line-height: 1;
    }

    .info-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      color: white;
    }

    .info-card p {
      margin: 0;
      font-size: 0.87rem;
      color: rgba(255,255,255,0.55);
      line-height: 1.65;
    }
  `]
})
export class LandingComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private sub: Subscription | null = null;

  loading = false;
  error = '';
  emailValue = '';
  passwordValue = '';

  ngOnInit() {
    this.sub = this.authService.user$.subscribe(user => {
      if (user) this.router.navigate(['/repairs']);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  async login(provider: 'google' | 'facebook') {
    this.loading = true;
    this.error = '';
    try {
      if (provider === 'google') await this.authService.loginWithGoogle();
      else await this.authService.loginWithFacebook();
    } catch (e: any) {
      const code = e?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.error = 'Sign in failed. Please try again.';
      }
    } finally {
      this.loading = false;
    }
  }

  async emailSignIn() {
    this.loading = true;
    this.error = '';
    try {
      await this.authService.loginWithEmail(this.emailValue, this.passwordValue);
    } catch (e: any) {
      this.error = e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password'
        ? 'Incorrect email or password.'
        : 'Sign in failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async emailRegister() {
    this.loading = true;
    this.error = '';
    try {
      await this.authService.signUpWithEmail(this.emailValue, this.passwordValue);
    } catch (e: any) {
      this.error = e?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : e?.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters.'
        : 'Registration failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
