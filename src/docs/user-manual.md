# RepairCafe User Manual

## Overview

RepairCafe is a web application for tracking repair items at Repair Cafe sessions. It allows volunteers to record items brought in for repair, assign repairers, track repair status, and review session statistics.

---

## Getting Started

### Logging In

Click one of the login buttons in the top-right corner of the header:

- **Email icon** — log in with an email address and password
- **Google icon** — log in with a Google account
- **Apple icon** — log in with an Apple account

Once logged in your name appears in the header. Admin-only features (Admin panel, Issues log) become visible.

### Logging Out

Click the logout arrow icon in the top-right corner.

---

## Navigation

The header contains the following buttons (some only visible when logged in):

| Button | What it does |
|--------|-------------|
| **RepairCafe** (title) | Returns to the home / repair list |
| **New** | Opens the form to create a new repair record |
| **Sessions** (calendar icon) | Opens the session schedule |
| **Issues** (circle icon) | Opens the issue tracker *(logged-in users only)* |
| **Admin** (grid icon) | Opens the admin panel *(logged-in users only)* |

---

## Creating a Repair Record

Click **New** in the header to open the new repair form.

Fill in the following fields:

| Field | Description |
|-------|-------------|
| **Owner** | Name of the person who brought the item |
| **Item Type** | Category of the item (e.g. Clothing, Electronics) |
| **Description** | Brief description of the item and the fault |
| **RC Day** | The session date this item belongs to |
| **Primary Repairer** | The volunteer assigned as the lead repairer |
| **Secondary Repairers** | Additional volunteers assisting (optional) |
| **Status** | Current repair status (defaults to *New*) |

Click **Save** to create the record, or **Cancel** to discard it.

---

## Repair Statuses

| Status | Meaning |
|--------|---------|
| **New** | Item registered, not yet assigned |
| **Assigned** | A repairer has been assigned |
| **Repaired** | Item successfully fixed |
| **Advice Given** | Item could not be repaired; advice was provided |
| **Partially Repaired** | Some repair was carried out but not complete |
| **Not Repaired** | Item could not be fixed |

---

## Session Schedule

Click the **Sessions** button to view the Repair Cafe schedule.

- Sessions are held on the **3rd Saturday of every month**.
- The **Next Session** card at the top shows a countdown to the next session and any pre-registered items.
- Each month card shows the date and, for sessions with items, a **mini donut chart** showing the breakdown of repair statuses at a glance.
- Cards marked **Completed** are past sessions. Cards marked **Next Up** are the upcoming session.
- Use the **year buttons** to switch between years.
- Click any session card to open the **Session Dashboard** for that date.

---

## Session Dashboard

The session dashboard shows all repair items recorded for a specific session.

### Summary Cards

At the top you will see four stat cards:

- **Total Items** — all items recorded for the session
- **Completed** — items that have a resolved status (Repaired, Advice Given, Partially Repaired, Not Repaired)
- **In Progress** — items with status *Assigned*
- **Awaiting** — items with status *New*

### Status Distribution Chart

A donut chart shows the proportion of items in each status. A legend below identifies each colour.

### Status Breakdown Bars

Horizontal bars show the count and percentage for each status.

### Items List

The table lists every repair item for the session with the following columns:

| Column | Notes |
|--------|-------|
| **#** | Row number |
| **Owner** | Person who brought the item |
| **Item Type** | Category |
| **Description** | Fault description |
| **Primary Repairer** | Lead repairer assigned |
| **Secondary Repairers** | Additional helpers — click **+** to add, **×** to remove |
| **Status** | Inline dropdown — change directly in the table |

---

## Repairer Dashboard

Each repairer has their own dashboard showing all items assigned to them (as primary or secondary).

To open a repairer's dashboard:

1. Go to **Admin → Repairers**
2. Click the **chart icon** next to the repairer's name

The dashboard shows:

- **Total Assigned**, **As Primary**, **As Helper**, **Completed** stat cards
- A **donut chart** of repair statuses across all assigned items
- A table of every assigned item with session date and role (Primary / Helper)

---

## Issue Tracker

The issue tracker is for logging operational issues with the Repair Cafe (e.g. equipment problems, process improvements).

Access it via the **Issues** icon in the header (logged-in users only).

### Reporting an Issue

1. Click **Report Issue**
2. Enter a description of the issue
3. Click **Submit Issue**

### Managing Issues

| Action | How |
|--------|-----|
| **Edit description** | Click the description text to edit inline. Press Enter or click away to save. Press Escape to cancel. |
| **Enter a fix** | Click the Fix cell to type the resolution. Press Enter or click away to save. |
| **Change status** | Use the status dropdown: *New*, *Assigned*, or *Fixed* |
| **Sort by status** | Click the **Status** column header — toggles ascending/descending |
| **Delete** | Click the 🗑 icon on the row |

Issues with no fix entered are highlighted with an amber border to make them easy to spot.

---

## Admin Panel

The admin panel is accessible to logged-in users via the **Admin** (grid) icon.

### Repairers

Manage the list of volunteer repairers.

- **Add New Repairer** — enter a name and optional photo URL
- **Make Primary / Make Secondary** — toggle whether a repairer appears in the primary repairer list on repair forms
- **Dashboard icon** — view the individual repairer's dashboard
- **Delete** — remove the repairer

### Database Explorer

A full view of all repair records across all sessions.

- Search and filter records
- Click a row to open the full repair detail
- Print a repair receipt (PDF) using the print icon on each row

### User Manager

Lists all users who have logged in. Admins can grant or revoke admin access.

### Version Manager

Shows the current application version and allows the description to be updated. The version displayed on the home page always reflects the latest deployed version automatically.

---

## Tips

- The version number shown in the header and footer is updated automatically on each deployment — no manual steps needed.
- Secondary repairers can be added to any repair item from the session dashboard without opening the full edit form.
- Past session cards on the schedule screen show a small donut chart so you can see at a glance how a session went.
- The issue tracker automatically shows a count badge on the Issues button so open issues are always visible.
