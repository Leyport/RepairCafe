import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { PublicStatsService, PublicSessionStats } from '../../services/public-stats.service';
import { AuthService } from '../../services/auth.service';
import { ORGANISATION_NAME } from '../../constants/venue';

interface SessionView extends PublicSessionStats {
  label: string;
  fixed: number;
  finished: number;
  fixRate: number | null;
  topCategories: { name: string; count: number }[];
  bar: { key: string; label: string; count: number; pct: number }[];
}

interface PageView {
  sessions: SessionView[];
  totals: { sessions: number; items: number; fixed: number; visitors: number; fixRate: number | null };
  updated: string | null;
  published: boolean;
}

const OUTCOMES: { key: keyof PublicSessionStats; label: string }[] = [
  { key: 'repaired', label: 'Repaired' },
  { key: 'partlyRepaired', label: 'Partly repaired' },
  { key: 'advice', label: 'Advice given' },
  { key: 'notRepaired', label: 'Not repairable' },
  { key: 'inProgress', label: 'Still in progress' },
];

/**
 * Public, embeddable per-session statistics. Reads only the anonymous summary in
 * public_stats/sessions, never the repair items themselves.
 *
 * Query parameters (all optional), for use in an <iframe> on other websites:
 *   embed=1         hide this app's header and footer
 *   theme=light     light background, to suit most websites
 *   year=2026       only sessions in that year
 *   session=2026-09-19   just that one session
 *   limit=6         at most this many sessions (newest first)
 */
@Component({
  selector: 'app-public-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="stats" [class.light]="light" [class.embedded]="embed">
      <header class="stats-head">
        <h1>{{ title }}</h1>
        <p class="sub">What we've fixed together, session by session.</p>
      </header>

      <ng-container *ngIf="view$ | async as v; else loading">
        <p class="empty" *ngIf="!v.published">Statistics haven't been published yet.</p>
        <p class="empty" *ngIf="v.published && !v.sessions.length">No sessions match.</p>

        <div class="totals" *ngIf="v.sessions.length > 1">
          <div class="tile"><span class="num">{{ v.totals.sessions }}</span><span class="lbl">sessions</span></div>
          <div class="tile"><span class="num">{{ v.totals.items }}</span><span class="lbl">items brought in</span></div>
          <div class="tile"><span class="num">{{ v.totals.fixed }}</span><span class="lbl">repaired or part repaired</span></div>
          <div class="tile" *ngIf="v.totals.fixRate !== null"><span class="num">{{ v.totals.fixRate }}%</span><span class="lbl">fix rate</span></div>
        </div>

        <div class="cards">
          <article class="card" *ngFor="let s of v.sessions">
            <h2>{{ s.label }}</h2>
            <div class="figures">
              <div><span class="num">{{ s.items }}</span><span class="lbl">items</span></div>
              <div *ngIf="s.visitors"><span class="num">{{ s.visitors }}</span><span class="lbl">visitors</span></div>
              <div><span class="num">{{ s.fixed }}</span><span class="lbl">fixed</span></div>
              <div *ngIf="s.fixRate !== null"><span class="num">{{ s.fixRate }}%</span><span class="lbl">fix rate</span></div>
            </div>

            <div class="bar" role="img" [attr.aria-label]="barLabel(s)">
              <span *ngFor="let b of s.bar" class="seg" [ngClass]="b.key" [style.width.%]="b.pct"
                    [title]="b.label + ': ' + b.count"></span>
            </div>
            <ul class="legend">
              <li *ngFor="let b of s.bar"><span class="dot" [ngClass]="b.key"></span>{{ b.label }} {{ b.count }}</li>
            </ul>

            <p class="cats" *ngIf="s.topCategories.length">
              <span *ngFor="let c of s.topCategories; let last = last">{{ c.name }} {{ c.count }}<ng-container *ngIf="!last"> · </ng-container></span>
            </p>
          </article>
        </div>

        <p class="foot">
          <ng-container *ngIf="v.updated">Updated {{ v.updated }} · </ng-container>
          <a href="https://repaircafe-6792c.web.app/" target="_blank" rel="noopener">{{ org }}</a>
        </p>

        <details class="embed-help" *ngIf="!embed && (signedIn$ | async)">
          <summary>Show this on another website</summary>
          <p>Paste this where you want the statistics to appear:</p>
          <pre>{{ embedCode }}</pre>
          <p>
            Options you can add to the address: <code>&amp;year=2026</code> for one year,
            <code>&amp;session=2026-09-19</code> for one session, <code>&amp;limit=3</code> for the latest few,
            and remove <code>&amp;theme=light</code> for the dark look.
          </p>
        </details>
      </ng-container>
      <ng-template #loading><p class="empty">Loading…</p></ng-template>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .stats {
      --ink: #f8fafc; --muted: rgba(255,255,255,0.55); --card: rgba(255,255,255,0.05);
      --line: rgba(255,255,255,0.1); --link: var(--accent-color, #00f2ff);
      color: var(--ink); max-width: 960px; margin: 0 auto 2rem;
    }
    .stats.light {
      --ink: #1e293b; --muted: #64748b; --card: #f8fafc; --line: #e2e8f0; --link: #4f46e5;
    }
    .stats.embedded { margin-bottom: 0; }
    .stats-head h1 { margin: 0; font-size: 1.6rem; color: var(--ink); }
    .stats.embedded .stats-head h1 { font-size: 1.3rem; }
    .sub { margin: 0.25rem 0 1.25rem; color: var(--muted); }
    .empty { color: var(--muted); }
    .num { display: block; font-size: 1.5rem; font-weight: 800; line-height: 1.1; color: var(--ink); }
    .lbl { font-size: 0.78rem; color: var(--muted); }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .tile, .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem 1rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.9rem; }
    .card h2 { margin: 0 0 0.6rem; font-size: 1.05rem; color: var(--ink); }
    .figures { display: flex; flex-wrap: wrap; gap: 1.2rem; margin-bottom: 0.8rem; }
    .figures .num { font-size: 1.3rem; }
    .bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--line); }
    .seg { height: 100%; }
    .legend { list-style: none; padding: 0; margin: 0.55rem 0 0; display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; font-size: 0.78rem; color: var(--muted); }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 0.3rem; vertical-align: -1px; }
    .repaired { background: #22c55e; }
    .partlyRepaired { background: #a3e635; }
    .advice { background: #3b82f6; }
    .notRepaired { background: #f97316; }
    .inProgress { background: #94a3b8; }
    .cats { margin: 0.6rem 0 0; font-size: 0.8rem; color: var(--muted); }
    .foot { margin: 1rem 0 0; font-size: 0.78rem; color: var(--muted); }
    .foot a, .embed-help a { color: var(--link); }
    .embed-help { margin-top: 1.5rem; padding: 0.9rem 1rem; border: 1px dashed var(--line); border-radius: 12px; color: var(--muted); font-size: 0.88rem; }
    .embed-help summary { cursor: pointer; color: var(--ink); font-weight: 600; }
    .embed-help pre { white-space: pre-wrap; word-break: break-all; background: rgba(0,0,0,0.3); color: #e2e8f0; padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; }
    code { font-size: 0.82rem; }
  `]
})
export class PublicStatsComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private statsService = inject(PublicStatsService);
  private authService = inject(AuthService);

  readonly org = ORGANISATION_NAME;
  readonly title = `${ORGANISATION_NAME} in numbers`;
  readonly embed = this.route.snapshot.queryParamMap.get('embed') === '1';
  readonly light = this.route.snapshot.queryParamMap.get('theme') === 'light';
  readonly signedIn$ = this.authService.user$.pipe(map(u => !!u));
  readonly embedCode =
    `<iframe src="https://repaircafe-6792c.web.app/stats?embed=1&theme=light&limit=6"\n` +
    `        title="${ORGANISATION_NAME} statistics" width="100%" height="900"\n` +
    `        style="border:0" loading="lazy"></iframe>`;

  constructor() {
    if (this.embed) document.body.classList.add('embed');
    if (this.light) document.body.classList.add('embed-light');
  }

  ngOnDestroy() {
    document.body.classList.remove('embed', 'embed-light');
  }

  view$ = combineLatest([this.statsService.getStats(), this.route.queryParamMap]).pipe(
    map(([stats, params]): PageView => {
      const year = params.get('year');
      const session = params.get('session');
      const limit = parseInt(params.get('limit') || '', 10);
      let list = stats?.sessions ?? [];
      if (year) list = list.filter(s => s.date.startsWith(year));
      if (session) list = list.filter(s => s.date === session);
      if (limit > 0) list = list.slice(0, limit);

      const sessions = list.map(s => this.toView(s));
      const items = sessions.reduce((n, s) => n + s.items, 0);
      const fixed = sessions.reduce((n, s) => n + s.fixed, 0);
      const finished = sessions.reduce((n, s) => n + s.finished, 0);
      return {
        sessions,
        totals: {
          sessions: sessions.length,
          items,
          fixed,
          visitors: sessions.reduce((n, s) => n + s.visitors, 0),
          fixRate: finished ? Math.round((fixed / finished) * 100) : null,
        },
        updated: stats?.updated
          ? new Date(stats.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : null,
        published: !!stats,
      };
    })
  );

  barLabel(s: SessionView): string {
    return s.bar.map(b => `${b.label} ${b.count}`).join(', ');
  }

  private toView(s: PublicSessionStats): SessionView {
    const [y, m, d] = s.date.split('-');
    const fixed = s.repaired + s.partlyRepaired;
    const finished = s.items - s.inProgress;
    const bar = OUTCOMES
      .map(o => ({ key: o.key as string, label: o.label, count: s[o.key] as number }))
      .filter(b => b.count > 0)
      .map(b => ({ ...b, pct: s.items ? (b.count / s.items) * 100 : 0 }));
    const topCategories = Object.entries(s.categories || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 4);
    return {
      ...s,
      label: new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      }),
      fixed,
      finished,
      fixRate: finished > 0 ? Math.round((fixed / finished) * 100) : null,
      topCategories,
      bar,
    };
  }
}
