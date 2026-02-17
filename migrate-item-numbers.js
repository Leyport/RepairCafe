const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

// Firebase config from environment.ts
const firebaseConfig = {
    apiKey: "AIzaSyDjYfEIMTfe47uXo4MbpWr4oEV5baAHCa0",
    authDomain: "repaircafe-6792c.firebaseapp.com",
    projectId: "repaircafe-6792c",
    storageBucket: "repaircafe-6792c.firebasestorage.app",
    messagingSenderId: "240446230326",
    appId: "1:240446230326:web:2bcef6746804407171ed97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function formatDate(timestamp) {
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

    const items = [];
    snapshot.forEach(docSnap => {
        items.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    console.log(`Found ${items.length} items`);

    // 2. Group by date and sort
    const itemsByDate = new Map();

    for (const item of items) {
        const dateKey = formatDate(item.creationDate);
        if (!dateKey) {
            console.warn(`Item ${item.id} has no creation date, skipping`);
            continue;
        }

        if (!itemsByDate.has(dateKey)) {
            itemsByDate.set(dateKey, []);
        }
        itemsByDate.get(dateKey).push(item);
    }

    console.log(`Items grouped into ${itemsByDate.size} dates`);

    // 3. Assign sequences and prepare updates
    const updates = [];

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
