# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start dev server at http://localhost:4200
npm run build      # Production build (output: dist/)
npm test           # Run unit tests via Karma
ng generate component components/my-component  # Scaffold a new component
```

There is no linting script configured. TypeScript compilation errors will surface during `build` or `test`.

## Architecture Overview

This is an **Angular 17 standalone-component app** backed by **Firebase (Firestore + Storage + Auth)**. There is no NgModule — all components use `standalone: true` and declare their own imports.

### Key Concepts

**RCDay** — The core domain concept. Each Repair Cafe session is identified by an `RCDay` string in the format `"Saturday, DD, MM, YYYY"`. Sessions occur on the 3rd Saturday of each month. The `RepairService` has helpers `getThirdSaturday()`, `generateRCDay()`, and `getAvailableRCDates()` for computing these dates.

**RepairItem** — The primary Firestore document (collection: `repairItems`). Key fields:
- `RCDay`: string — which session this item belongs to
- `displayNumber`: string — human-visible sequence number within a session (e.g. "3")
- `itemNumber` / `rcDayNumber`: numeric counters
- `status`: `"New" | "Assigned" | "Completed"`

**Firestore collections**: `repairItems`, `repairers`, `tags`, `owners`, `issues`, `sys_collections` (tracks dynamic collection names)

### Service Layer (`src/app/services/`)

- **`RepairService`** — Central data service. All Firestore reads/writes go through here. Handles repair CRUD, owner/tag auto-sync, photo upload to Storage, repairer management, issues, and dynamic collection management.
- **`AuthService`** — Firebase Auth (Google OAuth, Apple, email/password). Google login also requests Google Sheets/Drive scopes for export.
- **`ExportService`** — Exports repair items to Google Sheets via the Sheets REST API, using the OAuth token from `AuthService`.
- **`ImportService`** — Bulk import of repair items.
- **`AvatarService`** — Handles repairer avatar/photo management.

### Routing (`src/app/app.routes.ts`)

| Path | Component |
|------|-----------|
| `/` | `DatabaseExplorerComponent` (admin view, default) |
| `/repairs` | `RepairListComponent` |
| `/new` | `RepairFormComponent` |
| `/edit/:id` | `RepairFormComponent` |
| `/item/:id` | `RepairDetailComponent` |
| `/admin` | `AdminPanelComponent` (with children: `/repairers`, `/import`, `/database`) |
| `/issues` | `IssuesComponent` |
| `/schedule` | `ScheduleComponent` |
| `/rcd-dashboard/:date` | `RcdDashboardComponent` |

### Component Highlights

- **`RepairFormComponent`** — Create/edit repair items. Handles auto-population of `displayNumber` based on existing items for an `RCDay`, owner autocomplete from Firestore, tag selection, and photo upload.
- **`RcdDashboardComponent`** — Per-session dashboard. Includes Google Drive folder picker and export-to-Sheets functionality.
- **`ScheduleComponent`** — Calendar view of sessions (3rd Saturdays). Clicking a session opens the RCD Dashboard.
- **`DatabaseExplorerComponent`** — Admin tool for browsing/editing raw Firestore collections.

### Firebase Configuration

Firebase config lives in `src/environments/environment.ts`. The project ID is `repaircafe-6792c`. Firestore rules are in `firestore.rules`.

### Styling Approach

All styles are inline within component `styles: [...]` arrays (no separate `.css` files for most components). A shared glass-morphism design language is used throughout: `background: rgba(255,255,255,0.05)`, `backdrop-filter: blur(...)`, `border-radius`. Global styles are in `src/styles.css`.

### Version Tracking

App version is maintained manually in `src/app/constants/version.ts` and displayed in the nav/form header.
