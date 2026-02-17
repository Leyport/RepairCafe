# Migration Instructions - Item Number Format

## What This Does
Converts all item numbers from the old format to **YYMMDD.sequence** format (e.g., 260212.1, 260212.2).

## Before Running
1. **Backup your database** - This updates ALL records!
2. Ensure you have Firebase credentials configured
3. The migration script is already configured with your Firebase settings

## Run Migration

### Option 1: Using ts-node (Recommended)
```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run the migration
ts-node migrate-item-numbers.ts
```

### Option 2: Compile and Run
```bash
# Compile TypeScript
npx tsc migrate-item-numbers.ts --moduleResolution node --module commonjs --target es2020

# Run compiled JavaScript
node migrate-item-numbers.js
```

## What Happens
1. Fetches all repair items from Firestore
2. Groups them by creation date
3. Sorts items within each date by timestamp
4. Assigns sequential numbers (starting at 1) for each date
5. Updates displayNumber field to YYMMDD.sequence format
6. Commits changes in batches

## After Migration
- Old format (e.g., "1", "2", "3") → New format (e.g., "260212.1", "260212.2")
- All future items (manual or imported) will use new format automatically
- Multiple items on same date will have consecutive sequences

## Verify Results
Check a few items in Firestore Console to confirm displayNumber format is correct.
