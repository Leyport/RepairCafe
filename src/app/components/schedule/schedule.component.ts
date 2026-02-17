import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepairService } from '../../services/repair.service';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="schedule-container">
      <header>
        <h1>Repair Cafe Schedule</h1>
        <p class="subtitle">Join us on the 3rd Saturday of every month!</p>
      </header>
      
      <div class="next-session glass" *ngIf="nextSession">
        <h2>Next Session</h2>
        <div class="session-date">{{ nextSession | date:'fullDate' }}</div>
        <div class="countdown" *ngIf="daysUntil >= 0">
            {{ daysUntil === 0 ? 'Today!' : 'In ' + daysUntil + ' days' }}
        </div>
        <!-- Stats -->
        <div class="session-stats" *ngIf="getStats(nextSession) > 0">
            {{ getStats(nextSession) }} items preregistered
        </div>
      </div>

      <div class="year-selector">
        <button 
            *ngFor="let y of years" 
            (click)="selectedYear = y; generateSchedule()"
            [class.active]="selectedYear === y"
            class="btn-year">
            {{ y }}
        </button>
      </div>

      <div class="calendar-grid">
        <div class="month-card glass" *ngFor="let date of schedule" [class.past]="isPast(date)" [class.next]="isNext(date)">
          <div class="month-name">{{ date | date:'MMMM' }}</div>
          <div class="day-number">{{ date | date:'d' }}</div>
          <div class="day-name">{{ date | date:'EEEE' }}</div>
          
          <div class="status-badge" *ngIf="isNext(date)">Next Up</div>
          <div class="status-badge past" *ngIf="isPast(date)">Completed</div>

          <!-- Item Count Badge -->
          <div class="item-count-badge" *ngIf="getStats(date) > 0" title="Items created for this date">
            🛠️ {{ getStats(date) }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .schedule-container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
      text-align: center;
    }

    header {
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(45deg, #fff, var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.6);
      font-size: 1.1rem;
    }

    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2rem;
    }

    .next-session {
      background: rgba(var(--accent-color-rgb), 0.1);
      border-color: var(--accent-color);
      margin-bottom: 3rem;
      animation: pulse 2s infinite ease-in-out;
    }
    
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(var(--accent-color-rgb), 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(var(--accent-color-rgb), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--accent-color-rgb), 0); }
    }

    .next-session h2 {
      color: var(--accent-color);
      margin-top: 0;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 1rem;
    }

    .session-date {
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
      margin: 1rem 0;
    }

    .countdown {
        font-size: 1.2rem;
        color: rgba(255, 255, 255, 0.8);
        font-weight: 500;
    }
    
    .session-stats {
        margin-top: 0.5rem;
        font-size: 1rem;
        color: var(--accent-color);
        font-weight: 600;
    }

    .year-selector {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .btn-year {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 0.5rem 1.5rem;
        border-radius: 20px;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
    }

    .btn-year.active {
        background: var(--accent-color);
        color: black;
        border-color: var(--accent-color);
        font-weight: bold;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1.5rem;
    }

    .month-card {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s;
      position: relative;
      overflow: hidden;
    }

    .month-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.08);
    }

    .month-card.past {
        opacity: 0.5;
        background: rgba(255, 255, 255, 0.02);
    }
    
    .month-card.next {
        border-color: var(--accent-color);
        background: rgba(var(--accent-color-rgb), 0.05);
    }

    .month-name {
      text-transform: uppercase;
      font-size: 0.9rem;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 0.5rem;
    }

    .day-number {
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
      line-height: 1;
    }

    .day-name {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 0.2rem;
    }

    .status-badge {
        margin-top: 1rem;
        font-size: 0.7rem;
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        background: var(--accent-color);
        color: black;
        font-weight: bold;
    }
    
    .status-badge.past {
        background: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
    }
    
    .item-count-badge {
        margin-top: 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }
  `]
})
export class ScheduleComponent implements OnInit {
  private repairService = inject(RepairService);

  years = [2025, 2026];
  selectedYear = new Date().getFullYear();
  schedule: Date[] = [];
  nextSession: Date | null = null;
  daysUntil = 0;

  dateStats: Map<string, number> = new Map();

  ngOnInit() {
    this.generateSchedule();
    this.calculateNextSession();
    this.loadStats();
  }

  generateSchedule() {
    this.schedule = [];
    if (this.selectedYear < 2025) this.selectedYear = 2025;

    for (let month = 0; month < 12; month++) {
      const date = this.getThirdSaturday(this.selectedYear, month);
      this.schedule.push(date);
    }
  }

  calculateNextSession() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let potentialDates: Date[] = [];
    const currentYear = today.getFullYear();

    for (let m = 0; m < 12; m++) potentialDates.push(this.getThirdSaturday(currentYear, m));
    for (let m = 0; m < 12; m++) potentialDates.push(this.getThirdSaturday(currentYear + 1, m));

    this.nextSession = potentialDates.find(d => d >= today) || null;

    if (this.nextSession) {
      const diffTime = Math.abs(this.nextSession.getTime() - today.getTime());
      this.daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  getThirdSaturday(year: number, month: number): Date {
    const date = new Date(year, month, 1);
    let day = date.getDay();
    const daysUntilFirstSat = (6 - day + 7) % 7;
    const firstSatDate = 1 + daysUntilFirstSat;
    const thirdSatDate = firstSatDate + 14;
    return new Date(year, month, thirdSatDate);
  }

  isPast(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isNext(date: Date): boolean {
    return this.nextSession?.getTime() === date.getTime();
  }

  loadStats() {
    this.repairService.getRepairItems().subscribe(items => {
      this.dateStats.clear();
      items.forEach(item => {
        if (item.RCDay) {
          const current = this.dateStats.get(item.RCDay) || 0;
          this.dateStats.set(item.RCDay, current + 1);
        }
      });
    });
  }

  getStats(date: Date | null): number {
    if (!date) return 0;
    const key = this.formatRCDay(date);
    return this.dateStats.get(key) || 0;
  }

  private formatRCDay(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dayOfWeek}, ${dd}, ${mm}, ${yyyy}`;
  }
}
