# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server at http://localhost:4200
npm run build      # Production build → dist/repair-cafe/
npm run watch      # Build in watch mode (development)
npm test           # Run Karma/Jasmine tests
ng generate component components/<name>   # Scaffold a component
ng generate service services/<name>       # Scaffold a service
```

## Architecture

**RepairCafe** is an Angular 17 standalone-component app for managing community repair events ("Repair Cafés"). Firebase is the sole backend (Firestore + Storage + Auth).

### Data Flow

All data access goes through `RepairService` (`src/app/services/repair.service.ts`) — the central service (~23KB) that wraps all Firestore collection operations, Firebase Storage uploads, and business logic. Components inject this service; they do not query Firestore directly.

### Core Domain Concepts

- **RCDay**: A Repair Café event, always scheduled on the third Saturday of a month. Identified by the string `"Saturday, DD, MM, YYYY"`. `RepairService.getThirdSaturday()` and `getNextRCDay()` handle scheduling.
- **RepairItem**: The main record. Each item gets a `displayNumber` formatted as `YYMMDD.sequence` (e.g., `260212.3`). `itemNumber` is a per-RCDay sequence; sequencing logic lives in `RepairService.addRepairItem()`.
- **Tags**: Freeform labels with auto-assigned emojis (e.g., `electrical` → `⚡`). Emoji mapping is in `RepairService`.

### Firestore Collections

| Collection | Purpose |
|---|---|
| `repairItems` | Main repair records |
| `repairers` | Volunteer repairer profiles |
| `tags` | Tag definitions with emojis |
| `owners` | Auto-synced owner contact list |
| `issues` | In-app feedback/bug reports |
| `sys_collections` | Metadata for custom collections |

Firebase config (project `repaircafe-6792c`, region `eur3`) is in `src/environments/environment.ts`. Storage paths: `repair-photos/` for item photos, `repairer-photos/` for avatars.

### Routing

Routes are defined in `src/app/app.routes.ts`. Key routes:

- `/` → redirects to `/admin/database`
- `/repairs` — repair list
- `/new`, `/edit/:id` — create/edit repair
- `/item/:id` — repair detail
- `/admin` → admin panel with child routes: `/repairers`, `/import`, `/database`
- `/rcd-dashboard/:date` — per-event dashboard
- `/schedule`, `/issues`

### TypeScript

Strict mode is enabled (`tsconfig.json`). All models are in `src/app/models/`. The primary model is `RepairItem` in `repair-item.model.ts`; `Repairer`, `Tag`, and `Issue` are in their respective model files.

### Batch Operations

Firestore batch writes are capped at 500 operations. `RepairService.deleteCollection()` respects this limit — follow the same pattern for any bulk writes.
