import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, collectionData, addDoc, Timestamp, doc, deleteDoc, query, where, getDocs, orderBy, updateDoc, setDoc, writeBatch, getDoc, docData } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { APP_VERSION } from '../constants/version';
import { RepairItem, Owner } from '../models/repair-item.model';
import { Tag } from '../models/tag.model';
import { Repairer } from '../models/repairer.model';
import { Issue } from '../models/issue.model';

const TAG_EMOJI_MAP: { [key: string]: string } = {
    'electrical': '⚡',
    'mechanical': '⚙️',
    'fabric': '🧵',
    'toy': '🧸',
    'electronics': '💻',
    'battery': '🔋',
    'clock': '🕒',
    'lamp': '💡',
    'appliance': '🔌',
    'jewelry': '💍',
    'bicycle': '🚲',
    'audio': '🔊',
    'video': '📹',
    'kitchen': '🍳',
    'garden': '🌱',
    'textile': '🧵',
    'textiles': '🧵',
    'clothing': '👕',
    'furniture': '🪑'
};

@Injectable({
    providedIn: 'root'
})
export class RepairService {
    private firestore: Firestore = inject(Firestore);
    private storage: Storage = inject(Storage);
    private http: HttpClient = inject(HttpClient);
    private repairCollection = collection(this.firestore, 'repairItems');
    private tagsCollection = collection(this.firestore, 'tags');
    private repairersCollection = collection(this.firestore, 'repairers');
    private ownersCollection = collection(this.firestore, 'owners');

    private editItemSubject = new BehaviorSubject<RepairItem | null>(null);
    editItem$ = this.editItemSubject.asObservable();

    setEditItem(item: RepairItem | null) {
        this.editItemSubject.next(item);
    }

    getRepairItems(): Observable<RepairItem[]> {
        return collectionData(this.repairCollection, { idField: 'id' }) as Observable<RepairItem[]>;
    }

    async getAllTags(): Promise<Tag[]> {
        let querySnapshot = await getDocs(this.tagsCollection);

        // If empty, try to sync from existing items first
        if (querySnapshot.empty) {
            await this.syncTagsFromRepairItems();
            querySnapshot = await getDocs(this.tagsCollection);
        }

        const tags: Tag[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data() as Tag;
            tags.push({
                ...data,
                id: doc.id
            });
        });
        return tags.sort((a, b) => a.name.localeCompare(b.name));
    }

    async syncTagsFromRepairItems(): Promise<void> {
        const itemsSnapshot = await getDocs(this.repairCollection);
        const tagsSet = new Set<string>();

        itemsSnapshot.forEach(doc => {
            const data = doc.data() as RepairItem;
            if (data.tags) {
                data.tags.forEach(tag => tagsSet.add(tag));
            }
        });

        if (tagsSet.size > 0) {
            const syncPromises = Array.from(tagsSet).map(tag => this.ensureTagExists(tag));
            await Promise.all(syncPromises);
        }
    }

    async ensureTagExists(tagName: string): Promise<void> {
        if (!tagName) return;

        const q = query(this.tagsCollection, where('name', '==', tagName));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            const emoji = TAG_EMOJI_MAP[tagName.toLowerCase()];
            await addDoc(this.tagsCollection, {
                name: tagName,
                emoji: emoji || null
            });
        } else {
            // Update emoji if missing or changed in map
            const docSnap = snapshot.docs[0];
            const data = docSnap.data() as Tag;
            const expectedEmoji = TAG_EMOJI_MAP[tagName.toLowerCase()];
            if (expectedEmoji && data.emoji !== expectedEmoji) {
                await updateDoc(docSnap.ref, { emoji: expectedEmoji });
            }
        }
    }

    getEmojiForTag(tagName: string): string {
        return TAG_EMOJI_MAP[tagName.toLowerCase()] || '';
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

    async uploadRepairerPhoto(file: File): Promise<string> {
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = `repairer-photos/${Date.now()}_${safeName}`; // Dedicated folder
        try {
            const storageRef = ref(this.storage, filePath);
            const result = await uploadBytes(storageRef, file);
            return await getDownloadURL(result.ref);
        } catch (error) {
            console.error(`Repairer photo upload failed for ${file.name}:`, error);
            throw error;
        }
    }

    async downloadAndUploadPhoto(url: string): Promise<string> {
        try {
            // Fetch the image as a blob
            const response = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));

            // Generate a filename from the URL or use a default
            const safeName = `avatar_${Date.now()}.jpg`;
            const filePath = `repairer-photos/${safeName}`;

            const storageRef = ref(this.storage, filePath);
            const result = await uploadBytes(storageRef, response);
            return await getDownloadURL(result.ref);
        } catch (error) {
            console.error('Error downloading/uploading photo:', error);
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

    public getNextRCDay(): string {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

        // Calculate potential dates (current and next month)
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const sessionThisMonth = this.getThirdSaturday(currentYear, currentMonth);
        if (sessionThisMonth >= todayUTC) {
            return this.generateRCDay(sessionThisMonth);
        }

        const sessionNextMonth = this.getThirdSaturday(currentYear, currentMonth + 1);
        const next = this.generateRCDay(sessionNextMonth);

        return next;
    }

    async addRepairItem(item: Omit<RepairItem, 'id' | 'creationDate' | 'displayNumber' | 'itemNumber' | 'rcDayNumber'> & { rcDayNumber?: number, displayNumber?: string, RCDay?: string }) {
        if (item.owner) {
            await this.ensureOwnerExists(item.owner);
        }
        const now = new Date();
        const dateKey = this.getYYMMDD(now);

        // Robust fallback: if RCDay is missing or just an empty/whitespace string, use next session
        let rcDay = item.RCDay;
        if (!rcDay || rcDay.trim() === '') {
            rcDay = this.getNextRCDay();
        }
        // Actually, if we are backdating, the sequence number should probably be relative to THAT day?
        // But the current logic uses `now` for `creationDate`.
        // Let's keep `creationDate` as `now` (when record was created), but `RCDay` as the target event.
        // User asked to "register repair" for a specific RCDay.
        // DisplayNumber `DATE.SEQ`: Should DATE be the RCDay date or Creation Date?
        // Usually it's the event date.
        // But `getYYMMDD(now)` uses current date.
        // If I change `dateKey` to use `RCDay` date, I need to parse `RCDay` string back to date.
        // OR, just leave `displayNumber` as is (based on entry date), and `RCDay` is just a grouping field.
        // Given existing items, `RCDay` and `displayNumber` usually align.
        // I will keep `displayNumber` based on `now` for simplicity and uniqueness of entry, unless user specifies otherwise.

        // If a displayNumber was manually entered, we use it. Otherwise, calculate.
        let displayNumber = item.displayNumber;
        let sequence: number;

        if (!displayNumber) {
            // Count items assigned to THIS RCDay
            const q = query(
                this.repairCollection,
                where('RCDay', '==', rcDay)
            );

            const querySnapshot = await getDocs(q);
            sequence = querySnapshot.size + 1;
            displayNumber = String(sequence);
        } else {
            // Use manual entry as sequence if possible
            sequence = parseInt(displayNumber, 10) || 1;
        }

        // For backwards compatibility we still calculate an rcDayNumber if needed
        let rcDayNumber = item.rcDayNumber;
        if (!rcDayNumber) {
            rcDayNumber = await this.getCalculatedRCDayNumber(rcDay);
        }

        const newItem: RepairItem = {
            ...item,
            itemDescription: this.formatDescription(item.itemDescription),
            itemNumber: sequence,
            rcDayNumber: rcDayNumber,
            creationDate: Timestamp.fromDate(now),
            displayNumber: displayNumber,
            RCDay: rcDay,
            status: item.repairer ? 'Assigned' : 'New'
        };

        // Ensure all tags exist in the master collection
        if (newItem.tags && newItem.tags.length > 0) {
            await Promise.all(newItem.tags.map(tag => this.ensureTagExists(tag)));
        }

        return addDoc(this.repairCollection, newItem);
    }

    async getSuggestedDisplayNumber(rcDay: string): Promise<string> {
        if (!rcDay) return '1';

        const q = query(
            this.repairCollection,
            where('RCDay', '==', rcDay)
        );
        const querySnapshot = await getDocs(q);
        const sequence = querySnapshot.size + 1;

        return String(sequence);
    }

    private getYYMMDD(date: Date): string {
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}${mm}${dd}`;
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

    public generateRCDay(date: Date): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        // Use UTC methods to ensure the "Saturday" doesn't shift to "Friday" in other timezones
        const dayOfWeek = days[date.getUTCDay()];
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = date.getUTCFullYear();
        return `${dayOfWeek}, ${dd}, ${mm}, ${yyyy}`;
    }

    public getThirdSaturday(year: number, month: number): Date {
        // Create date in UTC
        const date = new Date(Date.UTC(year, month, 1));
        const day = date.getUTCDay();
        const daysUntilFirstSat = (6 - day + 7) % 7;
        const firstSatDate = 1 + daysUntilFirstSat;
        const thirdSatDate = firstSatDate + 14;
        return new Date(Date.UTC(year, month, thirdSatDate));
    }

    /**
     * Returns exactly 7 dates: last 3 sessions and next 4 sessions (including today/upcoming)
     */
    public getAvailableRCDates(): { label: string, value: string, date: Date }[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find current month's 3rd Saturday
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        // We'll collect potential dates around the current month
        const potentialDates: Date[] = [];
        // Look back 6 months and forward 6 months to be safe
        for (let i = -6; i <= 6; i++) {
            const d = new Date(currentYear, currentMonth + i, 1);
            potentialDates.push(this.getThirdSaturday(d.getFullYear(), d.getMonth()));
        }

        // Sort just in case
        potentialDates.sort((a, b) => a.getTime() - b.getTime());

        // Find the index of the first date that is >= today
        const nextIndex = potentialDates.findIndex(d => d >= today);

        if (nextIndex === -1) return []; // Should not happen with +/- 6 months

        // Last 3 sessions: nextIndex-3, nextIndex-2, nextIndex-1
        // Next 4 sessions: nextIndex, nextIndex+1, nextIndex+2, nextIndex+3
        const resultRange = potentialDates.slice(Math.max(0, nextIndex - 3), nextIndex + 4);

        return resultRange.map(date => ({
            label: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
            value: this.generateRCDay(date),
            date: date
        }));
    }

    private formatDisplayNumber(date: Date, sequence: number): string {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const ddd = days[date.getDay()];
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const xxx = String(sequence).padStart(3, '0');
        return `${ddd}${dd}${mm}${xxx}`;
    }

    async updateRepairItem(id: string, item: Partial<RepairItem>) {
        if (item.owner) {
            await this.ensureOwnerExists(item.owner);
        }
        const itemDoc = doc(this.firestore, `repairItems/${id}`);
        const updateData = { ...item };

        // Guard against blank RCDay in updates
        if ('RCDay' in updateData && (!updateData.RCDay || updateData.RCDay.trim() === '')) {
            delete updateData.RCDay;
        }

        if (updateData.itemDescription) {
            updateData.itemDescription = this.formatDescription(updateData.itemDescription);
        }

        // Ensure all tags exist in the master collection if they are being updated
        if (updateData.tags && updateData.tags.length > 0) {
            await Promise.all(updateData.tags.map(tag => this.ensureTagExists(tag)));
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
                // Delete all associated photos from storage (handle legacy string[] and new RepairPhoto[])
                await Promise.all(item.photos.map((p: any) => this.deletePhoto(typeof p === 'string' ? p : p.url)));
            }
        }

        return deleteDoc(itemDoc);
    }

    getRepairers(): Observable<Repairer[]> {
        const q = query(this.repairersCollection, orderBy('name'));
        return collectionData(q, { idField: 'id' }) as Observable<Repairer[]>;
    }

    async addRepairer(name: string, photoUrl?: string, isPrimary?: boolean): Promise<void> {
        if (!name) return;
        await addDoc(this.repairersCollection, {
            name,
            createdAt: Timestamp.now(),
            photoUrl: photoUrl || null,
            isPrimary: isPrimary || false
        });
    }

    getPrimaryRepairers(): Observable<Repairer[]> {
        return this.getRepairers().pipe(
            map(repairers => repairers.filter(r => r.isPrimary === true))
        );
    }

    async updateRepairer(id: string, data: Partial<Repairer>): Promise<void> {
        const docRef = doc(this.firestore, 'repairers', id);
        return updateDoc(docRef, data);
    }

    async deleteRepairer(id: string): Promise<void> {
        const docRef = doc(this.firestore, 'repairers', id);

        // Delete photo if exists
        try {
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data = snapshot.data() as Repairer;
                if (data.photoUrl) {
                    await this.deletePhoto(data.photoUrl);
                }
            }
        } catch (e) {
            console.warn('Error checking/deleting repairer photo:', e);
        }

        await deleteDoc(docRef);
    }

    getCollectionData(collectionName: string): Observable<any[]> {
        const colRef = collection(this.firestore, collectionName);
        return collectionData(colRef, { idField: 'id' });
    }

    async getCollectionDataOnce(collectionName: string): Promise<any[]> {
        const colRef = collection(this.firestore, collectionName);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    getTrackedCollections(): Observable<string[]> {
        const sysCol = collection(this.firestore, 'sys_collections');
        return collectionData(sysCol).pipe(
            map((cols: any[]) => {
                const defaults = ['repairItems', 'repairers', 'tags', 'owners'];
                const dynamic = cols.map(c => c.name);
                // Merge and unique
                const combined = Array.from(new Set([...defaults, ...dynamic]));
                return combined.sort();
            })
        );
    }
    async trackCollection(name: string): Promise<void> {
        if (!name) return;
        const sysColRef = doc(this.firestore, 'sys_collections', name);
        await setDoc(sysColRef, {
            name: name,
            lastImportAt: Timestamp.now()
        }, { merge: true });
    }

    async deleteCollection(collectionName: string): Promise<void> {
        if (!collectionName) return;

        // 1. Delete all documents in the collection
        const colRef = collection(this.firestore, collectionName);
        const snapshot = await getDocs(colRef);
        const batch = writeBatch(this.firestore);

        // Note: Batches are limited to 500 ops. For very large collections 
        // this should be chunked, but for this scale a single batch loop is ok for now 
        // or we can implement a simple loop.
        let opCount = 0;
        let batchCount = 0;
        let currentBatch = writeBatch(this.firestore);

        for (const doc of snapshot.docs) {
            currentBatch.delete(doc.ref);
            opCount++;

            if (opCount >= 450) {
                await currentBatch.commit();
                currentBatch = writeBatch(this.firestore);
                opCount = 0;
                batchCount++;
            }
        }

        if (opCount > 0) {
            await currentBatch.commit();
        }

        // 2. Remove from sys_collections tracking
        const sysColRef = doc(this.firestore, 'sys_collections', collectionName);
        await deleteDoc(sysColRef);
    }

    async deleteMultipleRecords(collectionName: string, ids: string[]): Promise<void> {
        if (!ids || ids.length === 0 || !collectionName) return;

        const batch = writeBatch(this.firestore);

        for (const id of ids) {
            const docRef = doc(this.firestore, collectionName, id);
            batch.delete(docRef);
        }

        await batch.commit();
    }

    async deleteMultipleRepairItems(ids: string[]): Promise<void> {
        return this.deleteMultipleRecords('repairItems', ids);
    }

    async updateRecord(collectionName: string, id: string, updates: any): Promise<void> {
        const docRef = doc(this.firestore, collectionName, id);
        return updateDoc(docRef, updates);
    }

    // Issues
    getIssues(): Observable<Issue[]> {
        const issuesCollection = collection(this.firestore, 'issues');
        const q = query(issuesCollection, orderBy('dateRaised', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
    }

    async addIssue(description: string, raisedBy?: string): Promise<void> {
        const issuesCollection = collection(this.firestore, 'issues');
        await addDoc(issuesCollection, {
            description,
            dateRaised: Timestamp.now(),
            status: 'New',
            ...(raisedBy ? { raisedBy } : {})
        });
    }

    async updateIssue(id: string, data: Partial<Issue>): Promise<void> {
        const docRef = doc(this.firestore, 'issues', id);
        await updateDoc(docRef, data);
    }

    async deleteIssue(id: string): Promise<void> {
        const docRef = doc(this.firestore, 'issues', id);
        await deleteDoc(docRef);
    }

    // Users
    getUsers(): Observable<any[]> {
        const usersCollection = collection(this.firestore, 'users');
        return collectionData(usersCollection, { idField: 'id' }) as Observable<any[]>;
    }

    getAdmins(): Observable<string[]> {
        const adminsCollection = collection(this.firestore, 'admins');
        return collectionData(adminsCollection, { idField: 'id' }).pipe(
            map((docs: any[]) => docs.map(d => d.id))
        );
    }

    async setAdminStatus(uid: string, isAdmin: boolean): Promise<void> {
        const adminRef = doc(this.firestore, 'admins', uid);
        if (isAdmin) {
            await setDoc(adminRef, { uid });
        } else {
            await deleteDoc(adminRef);
        }
    }

    // App Version
    private parseVersion(v: string): number[] {
        return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    }

    private isNewerVersion(a: string, b: string): boolean {
        const av = this.parseVersion(a);
        const bv = this.parseVersion(b);
        for (let i = 0; i < Math.max(av.length, bv.length); i++) {
            const diff = (av[i] || 0) - (bv[i] || 0);
            if (diff !== 0) return diff > 0;
        }
        return false;
    }

    getAppVersion(): Observable<{ version: string, description: string }> {
        const versionDocRef = doc(this.firestore, 'sys_settings', 'app_version');
        const local = { version: APP_VERSION.version, description: APP_VERSION.description };
        return docData(versionDocRef).pipe(
            map((data: any) => {
                if (!data?.version || this.isNewerVersion(local.version, data.version)) {
                    // Deployed version is newer — push it to Firestore so all clients stay in sync
                    setDoc(versionDocRef, local).catch(e => console.warn('Version sync to Firestore failed:', e));
                    return local;
                }
                return data;
            }),
            catchError(() => of(local))
        );
    }

    async updateAppVersion(version: string, description: string): Promise<void> {
        const versionDocRef = doc(this.firestore, 'sys_settings', 'app_version');
        await setDoc(versionDocRef, { version, description });
    }
    async syncOwnersFromRepairItems(): Promise<void> {
        const itemsSnapshot = await getDocs(this.repairCollection);
        const ownersSet = new Set<string>();

        itemsSnapshot.forEach(doc => {
            const data = doc.data() as RepairItem;
            if (data.owner) {
                ownersSet.add(data.owner.trim());
            }
        });

        if (ownersSet.size > 0) {
            const syncPromises = Array.from(ownersSet).map(owner => this.ensureOwnerExists(owner));
            await Promise.all(syncPromises);
        }
    }

    // Owner Methods
    getOwners(): Observable<Owner[]> {
        // Trigger background sync – not blocking the return of the observable
        this.getAllOwners().catch(err => console.error('Error in initial owners load/sync:', err));

        const q = query(this.ownersCollection, orderBy('name'));
        return collectionData(q, { idField: 'id' }) as Observable<Owner[]>;
    }

    private async getAllOwners(): Promise<Owner[]> {
        let querySnapshot = await getDocs(this.ownersCollection);
        if (querySnapshot.empty) {
            await this.syncOwnersFromRepairItems();
        }
        return []; // Actual data comes via observable
    }

    async ensureOwnerExists(name: string): Promise<void> {
        if (!name) return;
        const normalizedName = name.trim();
        const q = query(this.ownersCollection, where('name', '==', normalizedName));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            await addDoc(this.ownersCollection, {
                name: normalizedName,
                firstSeen: Timestamp.now()
            });
        }
    }


}
