import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';

// Firebase config - replace with your actual config
const firebaseConfig = {
    // Your config here - get from Firebase Console
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface RepairItem {
    id: string;
    creationDate: any;
    displayNumber?: string;
    [key: string]: any;
}

function formatDate(timestamp: any): string {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yy}${mm}${dd}`;
}

async function migrateItemNumbers() {
    console.log('Starting migration...');

    // 1. Fetch all repair items
    const itemsRef = collection(db, 'repairItems');
    const snapshot = await getDocs(itemsRef);

    const items: RepairItem[] = [];
    snapshot.forEach(doc => {
        items.push({
            id: doc.id,
            ...doc.data()
        } as RepairItem);
    });

    console.log(`Found ${items.length} items`);

    // 2. Group by date and sort
    const itemsByDate = new Map<string, RepairItem[]>();

    for (const item of items) {
        const dateKey = formatDate(item.creationDate);
        if (!dateKey) {
            console.warn(`Item ${item.id} has no creation date, skipping`);
            continue;
        }

        if (!itemsByDate.has(dateKey)) {
            itemsByDate.set(dateKey, []);
        }
        itemsByDate.get(dateKey)!.push(item);
    }

    console.log(`Items grouped into ${itemsByDate.size} dates`);

    // 3. Assign sequences and prepare updates
    const updates: { id: string; displayNumber: string }[] = [];

    for (const [dateKey, dateItems] of itemsByDate) {
        // Sort by creation timestamp
        dateItems.sort((a, b) => {
            const aTime = a.creationDate?.toMillis ? a.creationDate.toMillis() : 0;
            const bTime = b.creationDate?.toMillis ? b.creationDate.toMillis() : 0;
            return aTime - bTime;
        });

        // Assign sequences
        dateItems.forEach((item, index) => {
            const sequence = index + 1;
            const displayNumber = `${dateKey}.${sequence}`;
            updates.push({ id: item.id, displayNumber });
            console.log(`${item.id}: ${item.displayNumber || 'none'} -> ${displayNumber}`);
        });
    }

    // 4. Batch update (Firestore limit is 500 ops per batch)
    console.log(`\nUpdating ${updates.length} items...`);

    const batchSize = 450;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = updates.slice(i, i + batchSize);

        for (const update of chunk) {
            const docRef = doc(db, 'repairItems', update.id);
            batch.update(docRef, { displayNumber: update.displayNumber });
        }

        await batch.commit();
        console.log(`Batch ${Math.floor(i / batchSize) + 1} committed (${chunk.length} items)`);
    }

    console.log('\n✅ Migration complete!');
}

// Run migration
migrateItemNumbers()
    .then(() => {
        console.log('Done');
        process.exit(0);
    })
    .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
