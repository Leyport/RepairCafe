import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SequenceService, SEQUENCE_FIELD } from './sequence.service';
import { Firestore, collection, addDoc, writeBatch, doc, Timestamp, setDoc, query, where, getDocs } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

/** One sheet of an uploaded workbook, with its header row located and blank rows trimmed. */
export interface SheetPreview {
    name: string;
    headerRow: number;          // 0-based row index of the column headings in the sheet
    headers: string[];
    rows: any[][];              // data rows below the header
    sample: string[];           // first non-blank value seen in each column, for the mapping UI
    rowsWithData: number;
    looksLikeRepairData: boolean;
}

/** Targets a spreadsheet column can be mapped to when importing repair items. */
export const REPAIR_COLUMN_TARGETS = [
    { key: 'ignore', label: '(Ignore column)' },
    { key: 'keep', label: 'Keep as extra field' },
    { key: 'rcdate', label: 'Session date' },
    { key: 'itemNumber', label: 'Item number' },
    { key: 'itemDescription', label: 'Item description' },
    { key: 'repairItem', label: 'Item type' },
    { key: 'category', label: 'Category' },
    { key: 'fault', label: 'Fault' },
    { key: 'ageOfItem', label: 'Age of item' },
    { key: 'repairer', label: 'Repairer' },
    { key: 'additionalRepairers', label: 'Additional repairers' },
    { key: 'outcome', label: 'Repair outcome (sets status)' },
    { key: 'satisfaction', label: 'Owner satisfaction' },
    { key: 'owner', label: 'Owner' },
    { key: 'telephone', label: 'Telephone' },
    { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'tags', label: 'Tags' }
];

// Spreadsheet heading (lower-cased, punctuation stripped) -> import target.
const HEADER_TARGETS: { [header: string]: string } = {
    'date': 'rcdate', 'session date': 'rcdate', 'rc date': 'rcdate',
    'item no': 'itemNumber', 'item number': 'itemNumber',
    'item description': 'itemDescription', 'description': 'itemDescription',
    'item type': 'repairItem',
    'item category': 'category', 'category': 'category',
    'fault': 'fault',
    'age of item': 'ageOfItem',
    'primary repairer': 'repairer', 'repairer': 'repairer',
    'additional repairers': 'additionalRepairers',
    'repair outcome': 'outcome', 'outcome': 'outcome',
    'satisfied': 'satisfaction',
    'owner': 'owner', 'telephone': 'telephone', 'phone': 'telephone',
    'make': 'make', 'model': 'model', 'tags': 'tags'
};

// Spreadsheet categories -> the app's category values (see intake categories).
const CATEGORY_RULES: [RegExp, string][] = [
    [/electric/i, 'electrical'],
    [/cloth|textile|material|fabric/i, 'textile'],
    [/ornament|ceramic/i, 'ornament'],
    [/mechanical/i, 'mechanical'],
    [/furniture/i, 'furniture'],
    [/toy/i, 'toy'],
    [/clock|watch/i, 'clock'],
    [/jewel/i, 'jewelry']
];

// Spreadsheet repair outcomes -> the app's status values (see repair-complete outcomes).
const OUTCOME_RULES: [RegExp, string][] = [
    [/partial/i, 'Partially Repaired'],
    [/advice/i, 'Advice Given'],
    [/not repaired yet|ongoing|bring back|coming back|pending|out of time|going home/i, 'Assigned'],
    [/unable|unrepairable|not (repaired|reaired|able)|invalid|wasn't broke|needs part/i, 'Not Repaired'],
    [/repair|complete/i, 'Repaired']
];

@Injectable({
    providedIn: 'root'
})
export class ImportService {
    private http = inject(HttpClient);
    private firestore = inject(Firestore);
    private sequence = inject(SequenceService);

    async listFolders(token: string, parentId: string = 'root'): Promise<{ id: string, name: string, mimeType: string }[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // Simplified query for broader compatibility
        const query = `'${parentId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, shortcutDetails)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        console.log(`Listing items for parent: ${parentId}`, { query, url });
        try {
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            console.log('API Result:', result);

            if (!result.files) return [];

            // Filter for folders or shortcuts to folders
            return result.files.filter((file: any) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                const isFolderShortcut = file.mimeType === 'application/vnd.google-apps.shortcut' &&
                    file.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder';
                return isFolder || isFolderShortcut;
            }).map((file: any) => ({
                id: file.mimeType === 'application/vnd.google-apps.shortcut' ? file.shortcutDetails.targetId : file.id,
                name: file.name
            }));
        } catch (error) {
            console.error('Error listing folders:', error);
            throw error;
        }
    }

    async listAllItems(token: string, parentId: string = 'root'): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = `'${parentId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=50`;
        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async globalDiagnosticSearch(token: string): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        // Diagnostic: list the most recent 10 items globally (no parent filter)
        const url = `https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id, name, mimeType, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async getDriveAbout(token: string): Promise<any> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const url = `https://www.googleapis.com/drive/v3/about?fields=user,storageQuota`;
        return firstValueFrom(this.http.get(url, { headers }));
    }

    async listSharedDrives(token: string): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const url = `https://www.googleapis.com/drive/v3/drives?pageSize=10`;
        try {
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return result.drives || [];
        } catch (e) {
            console.warn('Could not list shared drives:', e);
            return [];
        }
    }

    async findSpreadsheetsGlobally(token: string): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=5&fields=files(id, name, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        try {
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return result.files || [];
        } catch (e) {
            return [];
        }
    }

    async getRootMetadata(token: string): Promise<any> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const url = `https://www.googleapis.com/drive/v3/files/root?fields=id,name,kind`;
        return firstValueFrom(this.http.get(url, { headers }));
    }

    async findAllFoldersGlobally(token: string): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=20&fields=files(id, name, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async getTokenInfo(token: string): Promise<any> {
        // This endpoint verifies the token and returns the scopes associated with it
        const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
        return firstValueFrom(this.http.get(url));
    }

    async searchByName(token: string, name: string): Promise<any[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = `name contains '${name}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=10&fields=files(id, name, mimeType, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async getFileMetadata(token: string, fileId: string): Promise<any> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents&supportsAllDrives=true`;
        return firstValueFrom(this.http.get(url, { headers }));
    }

    async jumpToFolder(token: string, folderId: string): Promise<{ folder: any, breadcrumbs: any[] }> {
        // Trace path to build breadcrumbs and get final folder
        let currentId = folderId;
        const breadcrumbs = [];
        for (let i = 0; i < 10; i++) {
            const meta = await this.getFileMetadata(token, currentId);
            breadcrumbs.unshift({ id: meta.id, name: meta.name });
            if (!meta.parents || meta.parents.length === 0 || meta.id === 'root') break;
            currentId = meta.parents[0];
        }
        return { folder: breadcrumbs[breadcrumbs.length - 1], breadcrumbs: breadcrumbs.slice(0, -1) };
    }

    async listFilesByFolder(token: string, folderId: string): Promise<{ id: string, name: string, mimeType: string }[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // Show all files that are not folders and not trashed
        const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async findFolder(token: string, folderName: string): Promise<string | null> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files && result.files.length > 0 ? result.files[0].id : null;
    }

    async findFileInFolder(token: string, folderId: string, fileName: string): Promise<string | null> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files && result.files.length > 0 ? result.files[0].id : null;
    }

    async readSheetData(token: string, fileId: string): Promise<any[][]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // 1. Get file metadata to check mimeType
        const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`;
        const metadata: any = await firstValueFrom(this.http.get(metadataUrl, { headers }));
        const mimeType = metadata.mimeType;

        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            // Google Sheets: Use Sheets API or Export
            // Sheets API is more robust for data reading
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:ZZ5000`;
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return result.values || [];
        } else if (mimeType === 'text/csv' || mimeType === 'application/csv') {
            // CSV: Use standard Drive download with alt=media
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const csvData: any = await firstValueFrom(this.http.get(url, { headers, responseType: 'text' }));
            return this.parseCSV(csvData);
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel'
        ) {
            // Excel: Google Drive cannot directly export binary Excel files to CSV via the /export endpoint.
            // Users should convert to Google Sheets or we'd need an XLSX parsing library.
            throw new Error(`XLSX files must be converted to Google Sheets first, or use a CSV file. (MimeType: ${mimeType})`);
        } else {
            throw new Error(`Unsupported file type for import: ${mimeType}. Please use a Google Sheet or CSV.`);
        }
    }

    private parseCSV(csvText: string): any[][] {
        const lines = csvText.split(/\r?\n/);
        return lines
            .filter(line => line.trim())
            .map(line => {
                // Simple CSV parser (doesn't handle quoted commas, but good for basic sheets)
                return line.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
            });
    }

    // ── Local workbook import (multi-sheet, repair item rows) ──────────────────

    async readWorkbook(file: File): Promise<SheetPreview[]> {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        return wb.SheetNames.map(name => this.previewSheet(name, wb.Sheets[name])).filter((s): s is SheetPreview => s !== null);
    }

    private previewSheet(name: string, ws: XLSX.WorkSheet): SheetPreview | null {
        // Some sheets declare a used range of a million rows; shrink it to the cells that actually exist.
        let maxRow = -1, maxCol = -1;
        for (const key of Object.keys(ws)) {
            if (key.startsWith('!')) continue;
            const c = XLSX.utils.decode_cell(key);
            if (c.r > maxRow) maxRow = c.r;
            if (c.c > maxCol) maxCol = c.c;
        }
        if (maxRow < 0) return null;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });

        const all = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true, blankrows: true });

        // The heading row is the one (within the first 10) with the most text cells, e.g. row 2 under a title row.
        let headerRow = 0, best = -1;
        all.slice(0, 10).forEach((row, i) => {
            const textCells = row.filter(c => typeof c === 'string' && c.trim() !== '').length;
            if (textCells > best) { best = textCells; headerRow = i; }
        });

        const headers = (all[headerRow] || []).map(h => String(h ?? '').trim());
        const rows = all.slice(headerRow + 1);
        const sample = headers.map((_, i) => {
            const hit = rows.find(r => r[i] !== '' && r[i] !== null && r[i] !== undefined);
            return hit ? this.displayCell(hit[i]) : '';
        });

        const targets = this.autoMapColumns(headers);
        const preview: SheetPreview = {
            name, headerRow, headers, rows, sample,
            rowsWithData: 0,
            looksLikeRepairData: targets.includes('itemDescription')
        };
        preview.rowsWithData = rows.filter(r => this.isItemRow(r, targets)).length;
        return preview;
    }

    /** Suggests a target for each column by its heading; repeated headings (e.g. a second "Date") are ignored. */
    autoMapColumns(headers: string[]): string[] {
        const used = new Set<string>();
        return headers.map(h => {
            const norm = h.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
            const target = HEADER_TARGETS[norm];
            if (target) {
                if (used.has(target)) return 'ignore';
                used.add(target);
                return target;
            }
            return 'keep';
        });
    }

    /** A row is a repair item if it has a description, category or repairer; date/number-only rows are skipped. */
    isItemRow(row: any[], targets: string[]): boolean {
        return targets.some((t, i) =>
            (t === 'itemDescription' || t === 'category' || t === 'repairer') && String(row[i] ?? '').trim() !== '');
    }

    /** Converts mapped sheet rows into repair item documents keyed by session date + item number. */
    buildRepairDocs(sheet: SheetPreview, targets: string[], usedIds: Set<string>): { docs: { id: string; data: any }[]; skipped: number } {
        const docs: { id: string; data: any }[] = [];
        let skipped = 0;
        const extraNames = sheet.headers.map((h, i) => this.extraFieldName(h, i));

        sheet.rows.forEach((row, r) => {
            if (!this.isItemRow(row, targets)) {
                if (row.some(c => String(c ?? '').trim() !== '')) skipped++;
                return;
            }

            const data: any = { importSource: `${sheet.name} row ${sheet.headerRow + r + 2}` };
            targets.forEach((target, i) => {
                const raw = row[i];
                const text = String(raw ?? '').trim();
                if (target === 'ignore' || text === '') return;

                switch (target) {
                    case 'rcdate': {
                        const date = this.parseSheetDate(raw);
                        if (date) data.rcdate = date;
                        else data.originalDate = text;
                        break;
                    }
                    case 'itemNumber': {
                        data.displayNumber = text;
                        const n = parseInt(text, 10);
                        if (!isNaN(n)) data.itemNumber = n;
                        break;
                    }
                    case 'category':
                        data.originalCategory = text;
                        data.category = CATEGORY_RULES.find(([re]) => re.test(text))?.[1] ?? 'other';
                        break;
                    case 'outcome':
                        data.repairOutcome = text;
                        data.status = OUTCOME_RULES.find(([re]) => re.test(text))?.[1];
                        break;
                    case 'satisfaction':
                        data.satisfaction = text;
                        data.ownerSatisfied = !/dissatisfied/i.test(text);
                        break;
                    case 'tags':
                    case 'additionalRepairers':
                        data[target] = text.split(',').map(t => t.trim()).filter(t => t);
                        break;
                    case 'keep':
                        data[extraNames[i]] = typeof raw === 'number' ? raw : text;
                        break;
                    default:
                        data[target] = text;
                }
            });

            if (!data.itemDescription) data.itemDescription = '(No description)';
            if (!data.status) data.status = data.repairer ? 'Assigned' : 'New';

            const date: Date | undefined = data.rcdate;
            if (date) {
                data.RCDay = this.formatRCDay(date);
                data.rcdate = Timestamp.fromDate(date);
                data.creationDate = data.rcdate;
            } else {
                data.creationDate = Timestamp.now();
            }

            // Stable IDs mean re-importing the same sheet overwrites items instead of duplicating them.
            const base = date
                ? `${date.toISOString().slice(0, 10)}_${(data.displayNumber || `row${sheet.headerRow + r + 2}`).replace(/[^A-Za-z0-9]/g, '')}`
                : `${sheet.name.replace(/[^A-Za-z0-9]/g, '')}_row${sheet.headerRow + r + 2}`;
            let id = base;
            for (let n = 2; usedIds.has(id); n++) id = `${base}_${n}`;
            usedIds.add(id);

            docs.push({ id, data });
        });

        return { docs, skipped };
    }

    async importRepairDocs(collectionName: string, docs: { id: string; data: any }[], onProgress?: (msg: string) => void): Promise<number> {
        const importedAt = Timestamp.now();
        if (collectionName === 'repairItems') {
            // Re-importing the same rows keeps their reference numbers; new rows get new ones.
            onProgress?.('Assigning reference numbers...');
            const existing = await this.sequence.existingNumbers(collectionName);
            const needNew = docs.filter(d => !existing.has(d.id));
            let next = await this.sequence.reserve(needNew.length);
            docs = docs.map(d => ({
                id: d.id,
                data: { ...d.data, [SEQUENCE_FIELD]: existing.get(d.id) ?? next++ }
            }));
        }
        for (let i = 0; i < docs.length; i += 450) {
            onProgress?.(`Saving items ${i + 1}–${Math.min(i + 450, docs.length)} of ${docs.length}...`);
            const batch = writeBatch(this.firestore);
            docs.slice(i, i + 450).forEach(d => batch.set(doc(this.firestore, collectionName, d.id), { ...d.data, importedAt }));
            await batch.commit();
        }

        if (docs.length > 0 && collectionName !== 'repairItems') {
            await setDoc(doc(this.firestore, 'sys_collections', collectionName), {
                name: collectionName,
                lastImportAt: Timestamp.now()
            }, { merge: true });
        }
        return docs.length;
    }

    /** Excel serial dates and UK-style text dates (e.g. "19/9/26") are returned as UTC midnight. */
    private parseSheetDate(value: any): Date | null {
        if (typeof value === 'number' && value > 20000 && value < 80000) {
            return new Date(Math.round((value - 25569) * 86400) * 1000);
        }
        const m = String(value).trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
        if (m) {
            const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
            const date = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
            return isNaN(date.getTime()) ? null : date;
        }
        return null;
    }

    // Same "Saturday, 17, 05, 2025" format as RepairService.generateRCDay, so imported items group by session.
    private formatRCDay(date: Date): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        return `${days[date.getUTCDay()]}, ${dd}, ${mm}, ${date.getUTCFullYear()}`;
    }

    // "PAT Test" -> "patTest"; a column with no heading becomes e.g. "columnL".
    private extraFieldName(header: string, index: number): string {
        const words = header.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(w => w);
        if (words.length === 0) return `column${XLSX.utils.encode_col(index)}`;
        return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    }

    private displayCell(value: any): string {
        const date = typeof value === 'number' ? this.parseSheetDate(value) : null;
        // Show plausible Excel dates as dates so the user recognises the column.
        if (date && value > 40000) return date.toISOString().slice(0, 10) + ` (${value})`;
        return String(value);
    }

    async importToFirestore(collectionName: string, data: any[][], mapping?: { [key: string]: string }): Promise<number> {
        if (!data || data.length < 2) return 0;

        // Use original headers if mapping is provided, otherwise sanitize
        const headers = mapping ? data[0].map(h => h.toString()) : data[0].map(h => this.sanitizeHeader(h));
        const rows = data.slice(1);
        const targetCollection = collection(this.firestore, collectionName);

        const BATCH_SIZE = 450;
        let importedCount = 0;

        console.log(`Starting import to ${collectionName}. Rows to process: ${rows.length}`);

        // Track sequence numbers per date for this import batch
        const dateSequences = new Map<string, number>();

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.firestore);
            const chunk = rows.slice(i, i + BATCH_SIZE);

            for (const row of chunk) {
                const docData = this.mapRowToDataObject(headers, row, mapping);
                if (Object.keys(docData).length === 0) continue;

                // Auto-generate creationDate if missing
                if (!docData.creationDate) {
                    docData.creationDate = Timestamp.now();
                }

                // Calculate displayNumber if not already set
                if (!docData.displayNumber) {
                    let creationDate: Date;
                    if (docData.creationDate instanceof Timestamp) {
                        creationDate = docData.creationDate.toDate();
                    } else if (docData.creationDate instanceof Date) {
                        creationDate = docData.creationDate;
                    } else {
                        creationDate = new Date(docData.creationDate);
                    }

                    // Final fallback to now if still invalid
                    if (isNaN(creationDate.getTime())) creationDate = new Date();

                    const dateKey = this.formatDateYYMMDD(creationDate);

                    // Query existing items for this date
                    const startOfDay = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate());
                    const endOfDay = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate(), 23, 59, 59, 999);

                    const q = query(
                        targetCollection,
                        where('creationDate', '>=', Timestamp.fromDate(startOfDay)),
                        where('creationDate', '<=', Timestamp.fromDate(endOfDay))
                    );

                    const existingSnapshot = await getDocs(q);

                    // Get next sequence: existing count + items already processed in this batch for this date
                    const batchSequence = dateSequences.get(dateKey) || 0;
                    const sequence = existingSnapshot.size + batchSequence + 1;

                    docData.displayNumber = `${dateKey}.${sequence}`;
                    dateSequences.set(dateKey, batchSequence + 1);
                }

                const newDocRef = doc(targetCollection);
                batch.set(newDocRef, {
                    ...docData,
                    importedAt: Timestamp.now()
                });
                importedCount++;
            }

            await batch.commit();
            console.log(`Batch committed. Total imported: ${importedCount}`);
        }

        if (importedCount > 0) {
            // Register this collection in sys_collections for dynamic tabs
            const sysColRef = doc(this.firestore, 'sys_collections', collectionName);
            await setDoc(sysColRef, {
                name: collectionName,
                lastImportAt: Timestamp.now()
            }, { merge: true });
        }

        return importedCount;
    }

    private sanitizeHeader(header: any): string {
        if (!header) return 'unnamed_column';
        return header.toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    private mapRowToDataObject(headers: string[], row: any[], mapping?: { [key: string]: string }): any {
        const docData: any = {};

        headers.forEach((header, index) => {
            const value = row[index];
            if (value === undefined || value === null || value === '') return;

            let targetField = '';

            if (mapping) {
                // If mapping is provided, header is the raw string from file
                targetField = mapping[header];
            } else {
                // Legacy: header is already sanitized
                targetField = header;
            }

            if (!targetField || targetField === 'ignore') return;

            // Transformation Logic
            if (targetField === 'tags' && typeof value === 'string') {
                // Split comma-separated tags
                docData.tags = value.split(',').map(t => t.trim()).filter(t => t);
            } else if (targetField === 'additionalRepairers' && typeof value === 'string') {
                // Split comma-separated repairers
                docData.additionalRepairers = value.split(',').map(t => t.trim()).filter(t => t);
            } else if (targetField === 'itemNumber' || targetField === 'rcDayNumber') {
                // Ensure numbers
                const num = parseInt(value, 10);
                if (!isNaN(num)) docData[targetField] = num;
            } else if (targetField === 'creationDate' || targetField === 'rcdate') {
                // Safe date/timestamp parsing
                const parsed = this.parseSafeDate(value);
                if (parsed) {
                    docData[targetField] = Timestamp.fromDate(parsed);
                }
            } else {
                // Default handling
                docData[targetField] = value;
            }
        });

        return docData;
    }

    private formatDateYYMMDD(date: Date): string {
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}${mm}${dd}`;
    }

    private parseSafeDate(value: any): Date | null {
        if (!value) return null;

        // Already a Date object
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        // Handle numeric values (common in Excel/Google Sheets exports as serial numbers)
        if (typeof value === 'number' || (!isNaN(value) && !isNaN(parseFloat(value)))) {
            const num = parseFloat(value);
            // Very small numbers are likely just sequence numbers incorrectly mapped, 
            // but we'll try to detect the Excel epoch (usually > 30000 for recent dates)
            if (num > 20000 && num < 60000) {
                const date = new Date((num - 25569) * 86400 * 1000);
                return isNaN(date.getTime()) ? null : date;
            }
        }

        // String parsing
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }
}
