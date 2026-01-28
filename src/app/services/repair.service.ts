import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, Timestamp, doc, deleteDoc, query, where, getDocs, orderBy, updateDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';
import { RepairItem } from '../models/repair-item.model';

@Injectable({
    providedIn: 'root'
})
export class RepairService {
    private firestore: Firestore = inject(Firestore);
    private repairCollection = collection(this.firestore, 'repairItems');

    private editItemSubject = new BehaviorSubject<RepairItem | null>(null);
    editItem$ = this.editItemSubject.asObservable();

    setEditItem(item: RepairItem | null) {
        this.editItemSubject.next(item);
    }

    getRepairItems(): Observable<RepairItem[]> {
        return collectionData(this.repairCollection, { idField: 'id' }) as Observable<RepairItem[]>;
    }

    async addRepairItem(item: Omit<RepairItem, 'id' | 'creationDate' | 'displayNumber' | 'RCDay' | 'itemNumber'>) {
        const now = new Date();
        const rcDay = this.generateRCDay(now);

        // Query for items with the same RCDay to find the next sequence number
        const q = query(
            this.repairCollection,
            where('RCDay', '==', rcDay)
        );

        const querySnapshot = await getDocs(q);
        const sequence = querySnapshot.size + 1;
        const displayNumber = this.formatDisplayNumber(now, sequence);

        const newItem: RepairItem = {
            ...item,
            itemNumber: sequence,
            creationDate: Timestamp.fromDate(now),
            displayNumber: displayNumber,
            RCDay: rcDay
        };
        return addDoc(this.repairCollection, newItem);
    }

    async getSuggestedDisplayNumber(): Promise<string> {
        const now = new Date();
        const rcDay = this.generateRCDay(now);
        const q = query(this.repairCollection, where('RCDay', '==', rcDay));
        const querySnapshot = await getDocs(q);
        const sequence = querySnapshot.size + 1;
        return this.formatDisplayNumber(now, sequence);
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
        return updateDoc(itemDoc, item);
    }

    deleteRepairItem(id: string) {
        const itemDoc = doc(this.firestore, `repairItems/${id}`);
        return deleteDoc(itemDoc);
    }
}
