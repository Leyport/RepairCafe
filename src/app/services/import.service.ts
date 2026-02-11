import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Firestore, collection, addDoc, writeBatch, doc, Timestamp } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ImportService {
    private http = inject(HttpClient);
    private firestore = inject(Firestore);

    async listFolders(token: string, parentId: string = 'root'): Promise<{ id: string, name: string }[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&orderBy=name`;

        const result: any = await firstValueFrom(this.http.get(url, { headers }));
        return result.files || [];
    }

    async listFilesByFolder(token: string, folderId: string): Promise<{ id: string, name: string }[]> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // Show all files that are not folders and not trashed
        const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)&orderBy=name`;

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
            // Google Sheets: Use Sheets API
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:ZZ5000`;
            const result: any = await firstValueFrom(this.http.get(url, { headers }));
            return result.values || [];
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel'
        ) {
            // Excel: Use Drive export to CSV
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
            const csvData: any = await firstValueFrom(this.http.get(url, { headers, responseType: 'text' }));
            return this.parseCSV(csvData);
        } else {
            throw new Error(`Unsupported file type for import: ${mimeType}`);
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

    async importToFirestore(collectionName: string, data: any[][]): Promise<number> {
        if (!data || data.length < 2) return 0;

        const headers = data[0].map(h => this.sanitizeHeader(h));
        const rows = data.slice(1);
        const targetCollection = collection(this.firestore, collectionName);

        const BATCH_SIZE = 450;
        let importedCount = 0;

        console.log(`Starting import to ${collectionName}. Rows to process: ${rows.length}`);

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.firestore);
            const chunk = rows.slice(i, i + BATCH_SIZE);

            for (const row of chunk) {
                const docData = this.mapRowToDataObject(headers, row);
                if (Object.keys(docData).length === 0) continue;

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

    private mapRowToDataObject(headers: string[], row: any[]): any {
        const docData: any = {};
        headers.forEach((header, index) => {
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                // Try to parse numbers or dates if needed, otherwise string
                docData[header] = value;
            }
        });
        return docData;
    }
}
