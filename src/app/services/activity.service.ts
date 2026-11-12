import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import {
    Firestore, addDoc, collection, collectionData, doc, getDocs, limit, orderBy, query,
    setDoc, Timestamp, where, writeBatch
} from '@angular/fire/firestore';
import { Observable, filter } from 'rxjs';

/** One line in the activity log (Admin → Activity). Only admins can read these. */
export interface ActivityEntry {
    id?: string;
    uid: string;
    name: string | null;
    email: string | null;
    /** 'signin' = opened the app / signed in, 'signout', 'page' = opened a page, 'action' = did something. */
    type: 'signin' | 'signout' | 'page' | 'action';
    /** Plain description, e.g. "Register page" or "Completed a repair". */
    label: string;
    path?: string;
    itemId?: string | null;
    /** Item description at the time, so deleted items still read sensibly. */
    itemText?: string | null;
    device?: string;
    at: Timestamp;
}

/** How long entries are kept before being tidied away (also stated in the privacy policy). */
export const ACTIVITY_KEEP_DAYS = 90;

/** Friendly names for each part of the app, matched against the start of the address. */
const PAGE_NAMES: [RegExp, string][] = [
    [/^\/$/, 'Welcome page'],
    [/^\/repairs/, 'Repair list'],
    [/^\/register/, 'Register page'],
    [/^\/new/, 'New item form'],
    [/^\/edit\//, 'Edit item'],
    [/^\/item\//, 'Item details'],
    [/^\/complete\//, 'Complete repair'],
    [/^\/investigate\//, 'Ask AI'],
    [/^\/admin\/users/, 'Admin · Users'],
    [/^\/admin\/activity/, 'Admin · Activity'],
    [/^\/admin\/repairers/, 'Admin · Repairers'],
    [/^\/admin\/import/, 'Admin · Import'],
    [/^\/admin\/database/, 'Admin · Explorer'],
    [/^\/admin\/backup/, 'Admin · Backup'],
    [/^\/admin\/clear/, 'Admin · Clear data'],
    [/^\/admin\/version/, 'Admin · Version'],
    [/^\/admin/, 'Admin'],
    [/^\/issues/, 'Issues'],
    [/^\/schedule/, 'Schedule'],
    [/^\/rcd-dashboard/, 'Session dashboard'],
    [/^\/repairer-dashboard/, 'Repairer dashboard'],
    [/^\/analytics/, 'Analytics'],
    [/^\/stats/, 'Public stats'],
    [/^\/privacy/, 'Privacy policy'],
    [/^\/data-deletion/, 'Data deletion'],
];

export function pageName(path: string): string {
    const clean = path.split(/[?#]/)[0];
    return PAGE_NAMES.find(([re]) => re.test(clean))?.[1] ?? clean;
}

/** Item id from addresses like /item/abc, /edit/abc, /complete/abc, /investigate/abc. */
function itemIdFromPath(path: string): string | null {
    const m = path.split(/[?#]/)[0].match(/^\/(item|edit|complete|investigate)\/([^/]+)/);
    return m ? m[2] : null;
}

/** Rough "iPhone · Safari" style description of the device, no unique identifiers. */
function describeDevice(): string {
    const ua = navigator.userAgent;
    const device =
        /iPad/.test(ua) ? 'iPad' :
        /iPhone/.test(ua) ? 'iPhone' :
        /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') :
        /Windows/.test(ua) ? 'Windows PC' :
        /Macintosh/.test(ua) ? 'Mac' :
        /CrOS/.test(ua) ? 'Chromebook' :
        /Linux/.test(ua) ? 'Linux PC' : 'Unknown device';
    const browser =
        /Edg\//.test(ua) ? 'Edge' :
        /SamsungBrowser/.test(ua) ? 'Samsung Internet' :
        /Firefox|FxiOS/.test(ua) ? 'Firefox' :
        /Chrome|CriOS/.test(ua) ? 'Chrome' :
        /Safari/.test(ua) ? 'Safari' : '';
    return browser ? `${device} · ${browser}` : device;
}

/**
 * Keeps a simple log of who uses the app and which parts: sign-ins, pages opened and key
 * actions (registering, completing, deleting items, asking the AI). Logging never gets in
 * the way: any failure is ignored.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
    private auth = inject(Auth);
    private firestore = inject(Firestore);
    private router = inject(Router);
    private col = collection(this.firestore, 'activity');
    private device = describeDevice();
    private lastPath = '';
    private started = false;

    /** Called once from the app shell. */
    start() {
        if (this.started) return;
        this.started = true;

        user(this.auth).subscribe(u => {
            if (!u) { this.lastPath = ''; return; }
            // One "opened the app" entry per browser tab session, even if they stayed signed in.
            const key = `activity-session-${u.uid}`;
            let seen = false;
            try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch { }
            if (!seen) this.write('signin', 'Opened the app');
            this.logPage(this.router.url);
        });

        this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe(e => this.logPage(e.urlAfterRedirects));
    }

    /** Record something the person did, e.g. log('Completed a repair', id, 'Kettle'). */
    log(label: string, itemId?: string | null, itemText?: string | null) {
        this.write('action', label, { itemId: itemId ?? null, itemText: itemText ?? null });
    }

    /** Call before signing out (afterwards we no longer know who it was). */
    async logSignOut() {
        await this.write('signout', 'Signed out');
    }

    private logPage(url: string) {
        const path = url.split(/[?#]/)[0];
        if (!this.auth.currentUser || path === this.lastPath) return;
        this.lastPath = path;
        const label = pageName(path);
        this.write('page', label, { path, itemId: itemIdFromPath(path) });
        // Also keep "last seen / last page" on their profile for the Users list.
        const u = this.auth.currentUser;
        setDoc(doc(this.firestore, 'users', u.uid), {
            lastSeen: Timestamp.now(), lastPage: label, lastDevice: this.device
        }, { merge: true }).catch(() => { });
    }

    private async write(type: ActivityEntry['type'], label: string, extra: Partial<ActivityEntry> = {}) {
        const u = this.auth.currentUser;
        if (!u) return;
        try {
            await addDoc(this.col, {
                uid: u.uid,
                name: u.displayName || null,
                email: u.email || null,
                type, label,
                device: this.device,
                at: Timestamp.now(),
                ...extra,
            });
        } catch (e) {
            console.warn('Activity log not saved:', e);
        }
    }

    // ---- For the admin Activity page ----

    recent(count = 500): Observable<ActivityEntry[]> {
        return collectionData(query(this.col, orderBy('at', 'desc'), limit(count)), { idField: 'id' }) as Observable<ActivityEntry[]>;
    }

    /** Deletes entries older than ACTIVITY_KEEP_DAYS (admins only). */
    async tidyOld(): Promise<number> {
        const cutoff = Timestamp.fromMillis(Date.now() - ACTIVITY_KEEP_DAYS * 86400000);
        const snap = await getDocs(query(this.col, where('at', '<', cutoff), limit(400)));
        if (snap.empty) return 0;
        const batch = writeBatch(this.firestore);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return snap.size;
    }
}
