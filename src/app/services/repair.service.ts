import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, Timestamp, doc, deleteDoc, query, where, getDocs, orderBy, updateDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, BehaviorSubject } from 'rxjs';
import { RepairItem } from '../models/repair-item.model';

@Injectable({
    providedIn: 'root'
})
export class RepairService {
    private firestore: Firestore = inject(Firestore);
    private storage: Storage = inject(Storage);
    private repairCollection = collection(this.firestore, 'repairItems');

    private editItemSubject = new BehaviorSubject<RepairItem | null>(null);
    editItem$ = this.editItemSubject.asObservable();

    setEditItem(item: RepairItem | null) {
        this.editItemSubject.next(item);
    }

    getRepairItems(): Observable<RepairItem[]> {
        return collectionData(this.repairCollection, { idField: 'id' }) as Observable<RepairItem[]>;
    }

    async uploadPhoto(file: File): Promise<string> {
        // Sanitize filename and add timestamp for uniqueness
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = `repair-photos/${Date.now()}_${safeName}`;

        try {
            const storageRef = ref(this.storage, filePath);
            const result = await uploadBytes(storageRef, file);
            return await getDownloadURL(result.ref);
        } catch (error) {
            console.error(`Upload failed for ${file.name}:`, error);
            throw error;
        }
    }

    async deletePhoto(photoUrl: string): Promise<void> {
        try {
            const storageRef = ref(this.storage, photoUrl);
            await deleteObject(storageRef);
        } catch (error) {
            console.error('Error deleting photo from storage:', error);
        }
    }

    async addRepairItem(item: Omit<RepairItem, 'id' | 'creationDate' | 'displayNumber' | 'RCDay' | 'itemNumber' | 'rcDayNumber'> & { rcDayNumber?: number }) {
        const now = new Date();
        const rcDay = this.generateRCDay(now);

        // Get RC Day Number (either provided or calculated)
        let rcDayNumber = item.rcDayNumber;
        if (!rcDayNumber) {
            rcDayNumber = await this.getCalculatedRCDayNumber(rcDay);
        }

        // Query for items with the same RCDay and rcDayNumber to find the next sequence number
        const q = query(
            this.repairCollection,
            where('RCDay', '==', rcDay),
            where('rcDayNumber', '==', rcDayNumber)
        );

        const querySnapshot = await getDocs(q);
        const sequence = querySnapshot.size + 1;
        const displayNumber = `${rcDayNumber}.${sequence}`;

        const newItem: RepairItem = {
            ...item,
            itemDescription: this.formatDescription(item.itemDescription),
            itemNumber: sequence,
            rcDayNumber: rcDayNumber,
            creationDate: Timestamp.fromDate(now),
            displayNumber: displayNumber,
            RCDay: rcDay
        };
        return addDoc(this.repairCollection, newItem);
    }

    async getSuggestedDisplayNumber(): Promise<{ sequence: number, dayNumber: number }> {
        const now = new Date();
        const rcDay = this.generateRCDay(now);
        const dayNumber = await this.getCalculatedRCDayNumber(rcDay);

        const q = query(
            this.repairCollection,
            where('RCDay', '==', rcDay),
            where('rcDayNumber', '==', dayNumber)
        );
        const querySnapshot = await getDocs(q);
        return {
            sequence: querySnapshot.size + 1,
            dayNumber: dayNumber
        };
    }

    private async getCalculatedRCDayNumber(rcDay: string): Promise<number> {
        // Find if this RC Day already has a number assigned in the database
        const qExisting = query(this.repairCollection, where('RCDay', '==', rcDay));
        const existingSnapshot = await getDocs(qExisting);

        if (!existingSnapshot.empty) {
            const firstItem = existingSnapshot.docs[0].data() as RepairItem;
            return firstItem.rcDayNumber || 1;
        }

        // Otherwise, find the highest existing day number and increment
        const allItemsSnapshot = await getDocs(this.repairCollection);
        let maxDay = 0;
        allItemsSnapshot.forEach(doc => {
            const data = doc.data() as RepairItem;
            if (data.rcDayNumber && data.rcDayNumber > maxDay) {
                maxDay = data.rcDayNumber;
            }
        });

        return maxDay + 1;
    }

    private formatDescription(text: string): string {
        if (!text) return text;
        const trimmed = text.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    private generateRCDay(date: Date): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[date.getDay()];
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dayOfWeek}, ${dd}, ${mm}, ${yyyy}`;
    }

    private formatDisplayNumber(date: Date, sequence: number): string {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const ddd = days[date.getDay()];
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const xxx = String(sequence).padStart(3, '0');
        return `${ddd}${dd}${mm}${xxx}`;
    }

    updateRepairItem(id: string, item: Partial<RepairItem>) {
        const itemDoc = doc(this.firestore, `repairItems/${id}`);
        const updateData = { ...item };
        if (updateData.itemDescription) {
            updateData.itemDescription = this.formatDescription(updateData.itemDescription);
        }
        return updateDoc(itemDoc, updateData);
    }

    async deleteRepairItem(id: string) {
        // First, get the item to check for photos
        const itemDoc = doc(this.firestore, `repairItems/${id}`);
        const q = query(this.repairCollection, where('__name__', '==', id));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const item = snapshot.docs[0].data() as RepairItem;
            if (item.photos && item.photos.length > 0) {
                // Delete all associated photos from storage
                await Promise.all(item.photos.map(url => this.deletePhoto(url)));
            }
        }

        return deleteDoc(itemDoc);
    }
}
