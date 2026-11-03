import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, writeBatch, addDoc, query, orderBy, collectionData, Timestamp, GeoPoint } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import * as XLSX from 'xlsx';
import { APP_VERSION } from '../constants/version';

// Collections the app always uses. Imported collections are discovered via sys_collections.
const CORE_COLLECTIONS = [
    'repairItems', 'repairers', 'tags', 'owners', 'issues',
    'users', 'admins', 'sys_collections', 'sys_settings', 'sys_counters', 'imported_sessions'
];

// The backup log itself is never backed up or restored, so restoring can't wipe the history.
export const BACKUP_LOG_COLLECTION = 'sys_backups';

const INFO_SHEET = 'Backup Info';
const ID_COLUMN = '_id';

// Cell encoding: plain strings/numbers/booleans are stored as-is so the sheet stays readable.
// Anything else is tagged so it can be restored with its exact Firestore type.
const TS_PREFIX = '__ts:';
const JSON_PREFIX = '__json:';
const NULL_TOKEN = '__null';
const EMPTY_TOKEN = '__empty';

// Excel's hard limit is 32767 characters per cell; longer values spill into "field~2", "field~3"...
const MAX_CELL = 32000;
const PART_SEP = '~';

export interface BackupCollection {
    name: string;
    docs: { id: string; data: any }[];
}

export interface ParsedBackup {
    backupName: string;
    downloadedAt: Date | null;
    downloadedBy: string;
    appVersion: string;
    collections: BackupCollection[];
}

export interface BackupLogEntry {
    id?: string;
    type: 'download' | 'upload' | 'clear';
    name: string;
    fileName: string;
    downloadedAt: any;
    uploadedAt?: any;
    performedBy: string;
    mode?: 'replace' | 'merge';
    loggedAt?: any;
    collections: { [name: string]: number };
}

@Injectable({
    providedIn: 'root'
})
export class BackupService {
    private firestore: Firestore = inject(Firestore);
    private auth: Auth = inject(Auth);

    getBackupLog(): Observable<BackupLogEntry[]> {
        const q = query(collection(this.firestore, BACKUP_LOG_COLLECTION), orderBy('loggedAt', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<BackupLogEntry[]>;
    }

    async listCollections(): Promise<string[]> {
        const snapshot = await getDocs(collection(this.firestore, 'sys_collections'));
        const dynamic = snapshot.docs.map(d => (d.data() as any).name || d.id);
        return Array.from(new Set([...CORE_COLLECTIONS, ...dynamic])).filter(n => n && n !== BACKUP_LOG_COLLECTION);
    }

    /** Reads every collection, builds the workbook, triggers the browser download and logs it. */
    async downloadBackup(backupName: string, onProgress?: (msg: string) => void): Promise<BackupLogEntry> {
        const now = new Date();
        const performedBy = this.currentUserLabel();
        const names = await this.listCollections();

        const collections: BackupCollection[] = [];
        for (const name of names) {
            onProgress?.(`Reading ${name}...`);
            const snapshot = await getDocs(collection(this.firestore, name));
            collections.push({ name, docs: snapshot.docs.map(d => ({ id: d.id, data: d.data() })) });
        }

        onProgress?.('Building spreadsheet...');
        const wb = XLSX.utils.book_new();
        const sheetNames = this.assignSheetNames(collections.map(c => c.name));

        const infoRows: any[][] = [
            ['Backup Name', backupName],
            ['Downloaded At', now.toISOString()],
            ['Downloaded By', performedBy],
            ['App Version', APP_VERSION.version],
            [],
            ['Collection', 'Sheet', 'Documents']
        ];
        collections.forEach(c => infoRows.push([c.name, sheetNames[c.name], c.docs.length]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), INFO_SHEET);

        for (const c of collections) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(this.collectionToRows(c)), sheetNames[c.name]);
        }

        const fileName = `${this.safeFileName(backupName)}_${this.fileStamp(now)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        const entry: BackupLogEntry = {
            type: 'download',
            name: backupName,
            fileName,
            downloadedAt: Timestamp.fromDate(now),
            performedBy,
            collections: Object.fromEntries(collections.map(c => [c.name, c.docs.length]))
        };
        await addDoc(collection(this.firestore, BACKUP_LOG_COLLECTION), { ...entry, loggedAt: Timestamp.now() });
        return entry;
    }

    async parseBackupFile(file: File): Promise<ParsedBackup> {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const info = wb.Sheets[INFO_SHEET];
        if (!info) {
            throw new Error(`This file is not an app backup (no "${INFO_SHEET}" sheet found).`);
        }

        const infoRows = XLSX.utils.sheet_to_json<any[]>(info, { header: 1, defval: '' });
        const meta: { [key: string]: any } = {};
        let tableStart = -1;
        infoRows.forEach((row, i) => {
            if (row[0] === 'Collection' && row[1] === 'Sheet') tableStart = i + 1;
            else if (tableStart < 0 && row[0]) meta[row[0]] = row[1];
        });
        if (tableStart < 0) throw new Error('The backup info sheet is missing its collection list.');

        const collections: BackupCollection[] = [];
        for (const row of infoRows.slice(tableStart)) {
            const [name, sheetName] = row;
            if (!name || !sheetName) continue;
            const sheet = wb.Sheets[sheetName];
            if (!sheet) throw new Error(`Sheet "${sheetName}" for collection "${name}" is missing from the file.`);
            if (name === BACKUP_LOG_COLLECTION) continue;
            collections.push({ name: String(name), docs: this.rowsToDocs(XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: true })) });
        }

        const downloadedAt = meta['Downloaded At'] ? new Date(meta['Downloaded At']) : null;
        return {
            backupName: String(meta['Backup Name'] || ''),
            downloadedAt: downloadedAt && !isNaN(downloadedAt.getTime()) ? downloadedAt : null,
            downloadedBy: String(meta['Downloaded By'] || ''),
            appVersion: String(meta['App Version'] || ''),
            collections
        };
    }

    /**
     * Writes the selected collections back to Firestore.
     * 'replace' deletes documents that are not in the backup, so the collection matches the backup exactly.
     * 'merge' overwrites documents with matching IDs and leaves any others untouched.
     */
    async restoreBackup(
        backup: ParsedBackup,
        uploadName: string,
        fileName: string,
        collectionNames: string[],
        mode: 'replace' | 'merge',
        onProgress?: (msg: string) => void
    ): Promise<BackupLogEntry> {
        const selected = backup.collections.filter(c => collectionNames.includes(c.name));

        for (const c of selected) {
            const colRef = collection(this.firestore, c.name);
            const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];

            if (mode === 'replace') {
                onProgress?.(`Clearing documents not in backup from ${c.name}...`);
                const keep = new Set(c.docs.map(d => d.id));
                const existing = await getDocs(colRef);
                existing.docs.filter(d => !keep.has(d.id)).forEach(d => ops.push(b => b.delete(d.ref)));
            }
            c.docs.forEach(d => ops.push(b => b.set(doc(this.firestore, c.name, d.id), d.data)));

            for (let i = 0; i < ops.length; i += 450) {
                onProgress?.(`Restoring ${c.name} (${Math.min(i + 450, ops.length)}/${ops.length})...`);
                const batch = writeBatch(this.firestore);
                ops.slice(i, i + 450).forEach(op => op(batch));
                await batch.commit();
            }
        }

        const entry: BackupLogEntry = {
            type: 'upload',
            name: uploadName,
            fileName,
            downloadedAt: backup.downloadedAt ? Timestamp.fromDate(backup.downloadedAt) : null,
            uploadedAt: Timestamp.now(),
            performedBy: this.currentUserLabel(),
            mode,
            collections: Object.fromEntries(selected.map(c => [c.name, c.docs.length]))
        };
        await addDoc(collection(this.firestore, BACKUP_LOG_COLLECTION), { ...entry, loggedAt: Timestamp.now() });
        return entry;
    }

    /** Deletes every document in the given collections and logs it. Callers must take a backup first. */
    async clearCollections(
        clearName: string,
        backupFileName: string,
        collectionNames: string[],
        onProgress?: (msg: string) => void
    ): Promise<BackupLogEntry> {
        const counts: { [name: string]: number } = {};
        for (const name of collectionNames.filter(n => n !== BACKUP_LOG_COLLECTION)) {
            const snapshot = await getDocs(collection(this.firestore, name));
            counts[name] = snapshot.size;
            for (let i = 0; i < snapshot.docs.length; i += 450) {
                onProgress?.(`Deleting ${name} (${Math.min(i + 450, snapshot.size)}/${snapshot.size})...`);
                const batch = writeBatch(this.firestore);
                snapshot.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }

        const entry: BackupLogEntry = {
            type: 'clear',
            name: clearName,
            fileName: backupFileName,
            downloadedAt: null,
            performedBy: this.currentUserLabel(),
            collections: counts
        };
        await addDoc(collection(this.firestore, BACKUP_LOG_COLLECTION), { ...entry, loggedAt: Timestamp.now() });
        return entry;
    }

    async countCollection(name: string): Promise<number> {
        return (await getDocs(collection(this.firestore, name))).size;
    }

    // --- Spreadsheet <-> Firestore conversion ---

    private collectionToRows(c: BackupCollection): any[][] {
        const encodedDocs = c.docs.map(d => {
            const cells: { [col: string]: any } = { [ID_COLUMN]: d.id };
            for (const [field, value] of Object.entries(d.data)) {
                const encoded = this.encodeValue(value);
                if (typeof encoded === 'string' && encoded.length > MAX_CELL) {
                    for (let i = 0, part = 1; i < encoded.length; i += MAX_CELL, part++) {
                        cells[part === 1 ? field : `${field}${PART_SEP}${part}`] = encoded.slice(i, i + MAX_CELL);
                    }
                } else {
                    cells[field] = encoded;
                }
            }
            return cells;
        });

        const columns = [ID_COLUMN];
        const seen = new Set(columns);
        encodedDocs.forEach(cells => Object.keys(cells).forEach(k => {
            if (!seen.has(k)) { seen.add(k); columns.push(k); }
        }));

        return [columns, ...encodedDocs.map(cells => columns.map(col => cells[col] ?? null))];
    }

    private rowsToDocs(rows: any[][]): { id: string; data: any }[] {
        if (rows.length === 0) return [];
        const header: string[] = rows[0].map(h => String(h ?? ''));
        const idIdx = header.indexOf(ID_COLUMN);
        if (idIdx < 0) throw new Error(`A collection sheet is missing its "${ID_COLUMN}" column.`);

        const partPattern = new RegExp(`^(.*)${PART_SEP}(\\d+)$`);
        const baseFields = new Set(header.filter(h => h && h !== ID_COLUMN && !partPattern.test(h)));

        return rows.slice(1)
            .filter(row => row[idIdx] !== null && row[idIdx] !== '')
            .map(row => {
                const raw: { [field: string]: any } = {};
                const parts: { [field: string]: { n: number; text: string }[] } = {};
                header.forEach((col, i) => {
                    const cell = row[i];
                    if (!col || col === ID_COLUMN || cell === null || cell === undefined) return;
                    const m = col.match(partPattern);
                    if (m && baseFields.has(m[1])) {
                        (parts[m[1]] ||= []).push({ n: Number(m[2]), text: String(cell) });
                    } else {
                        raw[col] = cell;
                    }
                });
                for (const [field, pieces] of Object.entries(parts)) {
                    raw[field] = String(raw[field] ?? '') + pieces.sort((a, b) => a.n - b.n).map(p => p.text).join('');
                }

                const data: { [field: string]: any } = {};
                for (const [field, cell] of Object.entries(raw)) data[field] = this.decodeCell(cell);
                return { id: String(row[idIdx]), data };
            });
    }

    private encodeValue(value: any): any {
        if (value === null) return NULL_TOKEN;
        if (value === '') return EMPTY_TOKEN;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
        if (value instanceof Timestamp) return TS_PREFIX + value.toDate().toISOString();
        return JSON_PREFIX + JSON.stringify(this.toJsonSafe(value));
    }

    private decodeCell(cell: any): any {
        if (typeof cell !== 'string') return cell;
        if (cell === NULL_TOKEN) return null;
        if (cell === EMPTY_TOKEN) return '';
        if (cell.startsWith(TS_PREFIX)) return Timestamp.fromDate(new Date(cell.slice(TS_PREFIX.length)));
        if (cell.startsWith(JSON_PREFIX)) return this.fromJsonSafe(JSON.parse(cell.slice(JSON_PREFIX.length)));
        return cell;
    }

    // Nested Timestamps/GeoPoints inside maps and arrays are tagged so they survive JSON.
    private toJsonSafe(value: any): any {
        if (value instanceof Timestamp) return { __ts: value.toDate().toISOString() };
        if (value instanceof GeoPoint) return { __geo: [value.latitude, value.longitude] };
        if (Array.isArray(value)) return value.map(v => this.toJsonSafe(v));
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.toJsonSafe(v)]));
        }
        return value;
    }

    private fromJsonSafe(value: any): any {
        if (Array.isArray(value)) return value.map(v => this.fromJsonSafe(v));
        if (value && typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 1 && keys[0] === '__ts') return Timestamp.fromDate(new Date(value.__ts));
            if (keys.length === 1 && keys[0] === '__geo') return new GeoPoint(value.__geo[0], value.__geo[1]);
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.fromJsonSafe(v)]));
        }
        return value;
    }

    // --- Helpers ---

    // Sheet names are limited to 31 chars and must be unique; the info sheet maps them back.
    private assignSheetNames(names: string[]): { [collection: string]: string } {
        const used = new Set([INFO_SHEET.toLowerCase()]);
        const result: { [collection: string]: string } = {};
        for (const name of names) {
            const base = name.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 28) || 'Sheet';
            let candidate = base;
            for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}_${n}`;
            used.add(candidate.toLowerCase());
            result[name] = candidate;
        }
        return result;
    }

    private currentUserLabel(): string {
        const u = this.auth.currentUser;
        return u?.displayName || u?.email || 'Unknown';
    }

    private safeFileName(name: string): string {
        return name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'Backup';
    }

    private fileStamp(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    }
}
