import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
        // 1. Get all repair items
        const items = await firstValueFrom(this.repairService.getRepairItems());
        if (!items || items.length === 0) throw new Error('No items to export.');

        // 2. Create a new Spreadsheet
        const timestamp = new Date().toLocaleString();
        const spreadsheet = await this.createSpreadsheet(accessToken, `Repair Cafe Export - ${timestamp}`);
        const spreadsheetId = spreadsheet.spreadsheetId;

        // 3. Prepare data for the sheet
        const values = [
            ['Number', 'Description', 'Tags', 'Date', 'Time', 'Day', 'Photos Count'], // Header
            ...items.map(item => [
                item.displayNumber || '',
                item.itemDescription || '',
                (item.tags || []).join(', '),
                this.formatDate(item.creationDate?.toDate()),
                this.formatTime(item.creationDate?.toDate()),
                item.RCDay || '',
                (item.photos || []).length
            ])
        ];

        // 4. Update the sheet with data
        await this.updateSheetValues(accessToken, spreadsheetId, values);

        // 5. Move to "Exports" folder
        try {
            const folderId = await this.getOrCreateExportsFolder(accessToken);
            await this.moveFileToFolder(accessToken, spreadsheetId, folderId);
        } catch (error) {
            console.warn('Failed to move file to Exports folder, it will remain in root:', error);
        }

        return spreadsheet.spreadsheetUrl;
    }

    private async getOrCreateExportsFolder(token: string): Promise<string> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        // Search for existing "Exports" folder
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Exports' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const searchResult: any = await firstValueFrom(this.http.get(searchUrl, { headers }));

        if (searchResult.files && searchResult.files.length > 0) {
            return searchResult.files[0].id;
        }

        // Create new "Exports" folder
        const createUrl = 'https://www.googleapis.com/drive/v3/files';
        const body = {
            name: 'Exports',
            mimeType: 'application/vnd.google-apps.folder'
        };
        const createResult: any = await firstValueFrom(this.http.post(createUrl, body, { headers }));
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
