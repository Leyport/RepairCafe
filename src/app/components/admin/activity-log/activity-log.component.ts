import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable, startWith } from 'rxjs';
import { ActivityEntry, ActivityService, ACTIVITY_KEEP_DAYS } from '../../../services/activity.service';
import { RepairService } from '../../../services/repair.service';

interface PersonSummary {
  uid: string;
  name: string;
  lastAt: Date;
  device: string;
  lastLabel: string;
  daysActive: number;
  topPart: string;
}

interface DayGroup {
  label: string;
  rows: (ActivityEntry & { when: Date; itemName: string | null })[];
}

type Kind = 'all' | 'signin' | 'page' | 'action';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="activity">
      <h3>🕒 Activity</h3>
      <p class="intro">
        Who has been using the app, when, on what device and which parts they used.
        Only admins can see this. Entries are kept for {{ keepDays }} days.
      </p>

      <ng-container *ngIf="view$ | async as v; else loadingTpl">

        <!-- People -->
        <h4>People</h4>
        <div class="empty" *ngIf="v.people.length === 0">No activity recorded yet. It starts from today's update.</div>
        <div class="people">
          <button class="person" *ngFor="let p of v.people"
                  [class.selected]="person === p.uid" (click)="togglePerson(p.uid)">
            <div class="avatar">{{ p.name.charAt(0).toUpperCase() }}</div>
            <div class="pinfo">
              <div class="pname">{{ p.name }}</div>
              <div class="pline">Last active {{ ago(p.lastAt) }} · {{ p.lastLabel }}</div>
              <div class="pline dim">{{ p.device }} · active on {{ p.daysActive }} {{ p.daysActive === 1 ? 'day' : 'days' }} · mostly {{ p.topPart }}</div>
            </div>
          </button>
        </div>

        <!-- Filters -->
        <div class="filters">
          <div class="chips">
            <button *ngFor="let k of kinds" [class.on]="kind === k.value" (click)="setKind(k.value)">{{ k.label }}</button>
          </div>
          <span class="showing" *ngIf="person">
            Showing {{ nameOf(v.people, person) }} only ·
            <a (click)="togglePerson(person)">show everyone</a>
          </span>
        </div>

        <!-- Timeline -->
        <div class="empty" *ngIf="v.days.length === 0 && v.people.length > 0">Nothing matches these filters.</div>
        <section class="day" *ngFor="let d of v.days">
          <h5>{{ d.label }}</h5>
          <div class="row" *ngFor="let r of d.rows" [class]="'row t-' + r.type">
            <span class="time">{{ r.when | date:'HH:mm' }}</span>
            <span class="icon">{{ icon(r) }}</span>
            <span class="text">
              <strong *ngIf="!person">{{ r.name || r.email || 'Someone' }}</strong>
              {{ describe(r) }}
              <a *ngIf="r.itemId && r.itemName && r.label !== 'Deleted an item'" [routerLink]="['/item', r.itemId]" class="item">{{ r.itemName }}</a>
              <span *ngIf="r.itemName && (!r.itemId || r.label === 'Deleted an item')" class="item">{{ r.itemName }}</span>
              <span class="device">{{ r.type === 'signin' ? r.device : '' }}</span>
            </span>
          </div>
        </section>
      </ng-container>
      <ng-template #loadingTpl><div class="empty">Loading activity…</div></ng-template>
    </div>
  `,
  styles: [`
    .activity { max-width: 820px; }
    h3 { margin: 0 0 0.5rem; color: white; }
    h4 { margin: 1.25rem 0 0.6rem; color: rgba(255,255,255,0.8); font-size: 0.95rem; }
    h5 { margin: 1.25rem 0 0.4rem; color: var(--accent-color, #00f2ff); font-size: 0.85rem; font-weight: 600; }
    .intro { margin: 0 0 0.5rem; font-size: 0.88rem; color: rgba(255,255,255,0.55); line-height: 1.5; }
    .empty { padding: 1.5rem; text-align: center; color: rgba(255,255,255,0.45); border: 1px dashed rgba(255,255,255,0.12); border-radius: 10px; }
    .people { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.6rem; }
    .person { display: flex; gap: 0.75rem; align-items: flex-start; text-align: left; padding: 0.75rem 0.9rem;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
      color: inherit; cursor: pointer; font: inherit; }
    .person:hover { background: rgba(255,255,255,0.06); }
    .person.selected { border-color: var(--accent-color, #00f2ff); background: rgba(0,242,255,0.07); }
    .avatar { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); font-weight: 600; }
    .pinfo { min-width: 0; }
    .pname { color: white; font-weight: 600; font-size: 0.95rem; }
    .pline { font-size: 0.8rem; color: rgba(255,255,255,0.65); line-height: 1.4; }
    .pline.dim { color: rgba(255,255,255,0.4); }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-top: 1.25rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chips button { padding: 0.35rem 0.8rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15);
      background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 0.82rem; }
    .chips button.on { background: rgba(0,242,255,0.12); border-color: var(--accent-color, #00f2ff); color: var(--accent-color, #00f2ff); }
    .showing { font-size: 0.82rem; color: rgba(255,255,255,0.6); }
    .showing a { color: var(--accent-color, #00f2ff); cursor: pointer; text-decoration: underline; }
    .row { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.88rem; }
    .row:nth-child(odd) { background: rgba(255,255,255,0.025); }
    .time { color: rgba(255,255,255,0.45); font-variant-numeric: tabular-nums; flex-shrink: 0; width: 3rem; }
    .icon { flex-shrink: 0; width: 1.3rem; text-align: center; }
    .text { color: rgba(255,255,255,0.8); min-width: 0; overflow-wrap: anywhere; }
    .text strong { color: white; font-weight: 600; }
    .t-signin .text, .t-signout .text { color: #81c784; }
    .t-action .text { color: #ffcc80; }
    .item { margin-left: 0.25rem; color: var(--accent-color, #00f2ff); }
    span.item { color: rgba(255,255,255,0.6); font-style: italic; }
    .device { margin-left: 0.4rem; font-size: 0.78rem; color: rgba(255,255,255,0.4); }
  `]
})
export class ActivityLogComponent implements OnInit {
  private activity = inject(ActivityService);
  private repairService = inject(RepairService);

  keepDays = ACTIVITY_KEEP_DAYS;
  kinds: { value: Kind; label: string }[] = [
    { value: 'all', label: 'Everything' },
    { value: 'signin', label: 'Sign-ins' },
    { value: 'action', label: 'Changes made' },
    { value: 'page', label: 'Pages opened' },
  ];
  kind: Kind = 'all';
  person: string | null = null;

  private refresh$ = new BehaviorSubject<void>(undefined);

  view$!: Observable<{ people: PersonSummary[]; days: DayGroup[] }>;

  ngOnInit() {
    // Quietly remove entries older than the keep period.
    this.activity.tidyOld().catch(() => { });

    const itemNames$ = this.repairService.getRepairItems().pipe(
      map(items => new Map(items.map(i => [i.id as string, i.itemDescription || '']))),
      startWith(new Map<string, string>())
    );

    this.view$ = combineLatest([this.activity.recent(1000), itemNames$, this.refresh$]).pipe(
      map(([entries, names]) => ({
        people: this.summarise(entries),
        days: this.group(entries, names),
      }))
    );
  }

  setKind(k: Kind) { this.kind = k; this.refresh$.next(); }
  togglePerson(uid: string) { this.person = this.person === uid ? null : uid; this.refresh$.next(); }

  nameOf(people: PersonSummary[], uid: string) { return people.find(p => p.uid === uid)?.name || 'this person'; }

  private summarise(entries: ActivityEntry[]): PersonSummary[] {
    const byUid = new Map<string, ActivityEntry[]>();
    for (const e of entries) {
      if (!byUid.has(e.uid)) byUid.set(e.uid, []);
      byUid.get(e.uid)!.push(e);
    }
    return [...byUid.entries()].map(([uid, list]) => {
      const latest = list[0]; // entries arrive newest first
      const days = new Set(list.map(e => e.at.toDate().toDateString()));
      const parts = new Map<string, number>();
      list.filter(e => e.type === 'page').forEach(e => parts.set(e.label, (parts.get(e.label) || 0) + 1));
      const top = [...parts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      return {
        uid,
        name: latest.name || latest.email || 'Unknown',
        lastAt: latest.at.toDate(),
        device: latest.device || 'Unknown device',
        lastLabel: latest.type === 'page' ? `on ${latest.label}` : latest.label.toLowerCase(),
        daysActive: days.size,
        topPart: top,
      };
    }).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  }

  private group(entries: ActivityEntry[], names: Map<string, string>): DayGroup[] {
    const groups: DayGroup[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    for (const e of entries) {
      if (this.person && e.uid !== this.person) continue;
      if (this.kind === 'signin' ? !(e.type === 'signin' || e.type === 'signout') : this.kind !== 'all' && e.type !== this.kind) continue;
      const when = e.at.toDate();
      const ds = when.toDateString();
      const label = ds === today ? 'Today' : ds === yesterday ? 'Yesterday'
        : when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      let g = groups[groups.length - 1];
      if (!g || g.label !== label) groups.push(g = { label, rows: [] });
      const itemName = (e.itemId && names.get(e.itemId)) || e.itemText || (e.itemId ? 'an item' : null);
      g.rows.push({ ...e, when, itemName });
    }
    return groups;
  }

  icon(e: ActivityEntry): string {
    if (e.type === 'signin') return '🔓';
    if (e.type === 'signout') return '🔒';
    if (e.type === 'page') return '📄';
    if (/Deleted/.test(e.label)) return '🗑️';
    if (/AI/.test(e.label)) return '🤖';
    if (/Registered/.test(e.label)) return '➕';
    if (/Marked as/.test(e.label)) return '✅';
    return '✏️';
  }

  describe(e: ActivityEntry): string {
    if (e.type === 'page') return `opened ${e.label}`;
    const l = e.label;
    return l.charAt(0).toLowerCase() + l.slice(1);
  }

  ago(d: Date): string {
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.round(hrs / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
}
