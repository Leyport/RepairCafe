import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Firestore, collection, addDoc, writeBatch, doc, Timestamp, setDoc, query, where, getDocs } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

@Injectable({
    providedIn: 'root'
})
export class ImportService {
    private http = inject(HttpClient);
    private firestore = inject(Firestore);

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

    private async getMimeType(token: string, fileId: string): Promise<string> {
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`;
        const metadata: any = await firstValueFrom(this.http.get(url, { headers }));
        return metadata.mimeType;
    }

    private async downloadXlsxWorkbook(token: string, fileId: string): Promise<XLSX.WorkBook> {
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const buffer: any = await firstValueFrom(this.http.get(url, { headers, responseType: 'arraybuffer' }));
        return XLSX.read(new Uint8Array(buffer), { type: 'array' });
    }

    async getSheetNames(token: string, fileId: string): Promise<string[]> {
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
        const mimeType = await this.getMimeType(token, fileId);

        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties.title`;
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return (result.sheets || []).map((s: any) => s.properties.title as string);
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel'
        ) {
            const workbook = await this.downloadXlsxWorkbook(token, fileId);
            return workbook.SheetNames;
        }
        return [];
    }

    async readSheetData(token: string, fileId: string, sheetName?: string): Promise<any[][]> {
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
        const mimeType = await this.getMimeType(token, fileId);

        if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            // Wrap sheet name in single quotes (required for names with spaces/special chars),
            // then percent-encode the entire range as a URL path segment.
            const range = sheetName ? `'${sheetName}'!A1:ZZ5000` : 'A1:ZZ5000';
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}`;
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return result.values || [];
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel'
        ) {
            const workbook = await this.downloadXlsxWorkbook(token, fileId);
            const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
            if (!sheet) throw new Error(`Sheet "${sheetName}" not found in workbook.`);
            return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
        } else if (mimeType === 'text/csv' || mimeType === 'application/csv') {
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const csvData: any = await firstValueFrom(this.http.get(url, { headers, responseType: 'text' }));
            return this.parseCSV(csvData);
        } else {
            throw new Error(`Unsupported file type: ${mimeType}. Please use a Google Sheet, XLSX, or CSV.`);
        }
    }

    // Read all sheets and merge: header from first sheet, data rows from all sheets combined.
    async readAllSheetsData(token: string, fileId: string): Promise<any[][]> {
        const sheetNames = await this.getSheetNames(token, fileId);
        const combined: any[][] = [];
        for (let i = 0; i < sheetNames.length; i++) {
            const sheetData = await this.readSheetData(token, fileId, sheetNames[i]);
            if (!sheetData || sheetData.length === 0) continue;
            if (i === 0) {
                combined.push(...sheetData); // include header from first sheet
            } else {
                combined.push(...sheetData.slice(1)); // skip header row from subsequent sheets
            }
        }
        return combined;
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
