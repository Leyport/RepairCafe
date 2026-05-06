import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { RepairService } from './repair.service';
import { firstValueFrom } from 'rxjs';
import { RepairItem } from '../models/repair-item.model';

@Injectable({
    providedIn: 'root'
})
export class ExportService {
    private http = inject(HttpClient);
    private repairService = inject(RepairService);

    async exportToSheets(accessToken: string): Promise<string> {
        const items = await firstValueFrom(this.repairService.getRepairItems());
        const timestamp = new Date().toLocaleString();
        return this.exportItemsToSheets(accessToken, items, `Repair Cafe Export - ${timestamp}`);
    }

    async exportItemsToSheets(accessToken: string, items: RepairItem[], title: string, folderId?: string): Promise<string> {
        if (!items || items.length === 0) throw new Error('No items to export.');

        // 1. Create a new Spreadsheet
        const spreadsheet = await this.createSpreadsheet(accessToken, title);
        const spreadsheetId = spreadsheet.spreadsheetId;

        // 2. Prepare data for the sheet
        const values = [
            [
                'Display Number',
                'Description',
                'Item Type',
                'Status',
                'Repairer',
                'Owner',
                'Telephone',
                'Tags',
                'Additional Repairers',
                'Creation Date',
                'RC Day',
                'RC Day Sequence',
                'Item Number'
            ], // Header
            ...items.map(item => [
                item.displayNumber || '',
                item.itemDescription || '',
                item.repairItem || '',
                item.status || 'New',
                item.repairer || '',
                item.owner || '',
                item.telephone || '',
                (item.tags || []).join(', '),
                (item.additionalRepairers || []).join(', '),
                this.formatDate(item.creationDate?.toDate ? item.creationDate.toDate() : item.creationDate),
                item.RCDay || '',
                item.rcDayNumber || '',
                item.itemNumber || ''
            ])
        ];

        // 3. Update the sheet with data
        await this.updateSheetValues(accessToken, spreadsheetId, values);

        // 4. Move to Target folder
        const targetFolderId = folderId || await this.getOrCreateExportsFolder(accessToken);
        await this.moveFileToFolder(accessToken, spreadsheetId, targetFolderId);

        return spreadsheet.spreadsheetUrl;
    }

    private async getOrCreateExportsFolder(token: string): Promise<string> {
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
        const params = new HttpParams().set('q', "name='Exports' and mimeType='application/vnd.google-apps.folder' and trashed=false");
        const searchResult: any = await firstValueFrom(
            this.http.get('https://www.googleapis.com/drive/v3/files', { headers, params })
        );

        if (searchResult.files && searchResult.files.length > 0) {
            return searchResult.files[0].id;
        }

        const createResult: any = await firstValueFrom(
            this.http.post('https://www.googleapis.com/drive/v3/files',
                { name: 'Exports', mimeType: 'application/vnd.google-apps.folder' },
                { headers })
        );
        return createResult.id;
    }

    private async moveFileToFolder(token: string, fileId: string, folderId: string): Promise<void> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // Get current parents to remove them (usually just 'root')
        const getUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`;
        const fileInfo: any = await firstValueFrom(this.http.get(getUrl, { headers }));
        const previousParents = (fileInfo.parents || []).join(',');

        // Move the file
        const updateUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=${previousParents}`;
        await firstValueFrom(this.http.patch(updateUrl, {}, { headers }));
    }

    private async createSpreadsheet(token: string, title: string): Promise<any> {
        const url = 'https://sheets.googleapis.com/v4/spreadsheets';
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        const body = {
            properties: { title }
        };
        return firstValueFrom(this.http.post(url, body, { headers }));
    }

    private async updateSheetValues(token: string, spreadsheetId: string, values: any[][]): Promise<any> {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`;
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        const body = {
            values: values
        };
        return firstValueFrom(this.http.post(url, body, { headers }));
    }

    private formatDate(date: Date | undefined): string {
        if (!date) return '';
        return date.toLocaleDateString();
    }

    private formatTime(date: Date | undefined): string {
        if (!date) return '';
        return date.toLocaleTimeString();
    }
}
