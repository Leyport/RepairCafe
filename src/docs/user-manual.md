# RepairCafe User Manual

## Overview

RepairCafe is a web application for tracking repair items at Repair Cafe sessions. It allows volunteers to record items brought in for repair, assign repairers, track repair status, and review session statistics.

---

## Getting Started

### Logging In

Sign in with your Google account: press **Continue with Google** and choose your account. Google is the only way to sign in.

The first time you sign in, an admin needs to approve your account before you can see the repair records. The page opens by itself as soon as they do.

Once logged in your name appears in the header. The **Admin** icon is only shown to admins.

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
| **Admin** (grid icon) | Opens the admin panel *(admins only)* |

---

## Repair List

The buttons at the top of the repair list choose which items are shown:

| Button | Shows |
|--------|-------|
| **Active** | Open work for the latest repair cafe session — items that are *New* or *Investigating*. This is the default view. |
| **Taken Home** | Every item a volunteer currently has at home, *whichever session it came from*. The number on the button shows how many items are out. Use this at the start of a session to see what should be coming back. |
| **All** | Every item from every session, whatever its status |
| **Completed** | Items from the latest session that are *Completed* or *Collected* |

> **Taken Home items:** set an item's status to *Taken Home* when a volunteer takes it away between sessions. It then leaves the Active list but stays tracked under **Taken Home**. When it comes back, change its status (for example to *Investigating*, or use **Complete**) and it moves out of the Taken Home list automatically.

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

Each item moves through these steps, in this order:

**1. New → 2. Investigating → 3. Taken Home** *(only if needed)* **→ 4. Completed → 5. Collected**

| Status | Meaning |
|--------|---------|
| **New** | Item registered, no repairer working on it yet |
| **Investigating** | A repairer is looking at the item. Choosing a repairer sets this automatically. |
| **Taken Home** | A volunteer has taken the item home to keep working on it between sessions. These items are not counted as active work for a session; they are listed under the **Taken Home** button at the top of the repair list (with a count), whichever session they came from. |
| **Completed** | The repair work is finished. Every completed item also records how it went (see below). |
| **Collected** | The owner has taken the item away. How the repair went is still kept, e.g. *Collected · Repaired*. |

### How the repair went (when Completed)

| Outcome | Meaning |
|---------|---------|
| **Repaired** | Item successfully fixed |
| **Partially Repaired** | Some repair was carried out but the item is not fully fixed |
| **Unrepairable** | The item could not be fixed |
| **Advice Given** | No repair was made, but the owner was given advice |

### Completing a repair

1. Open the item and press **Complete** (or choose *Complete* from the ⋯ menu in the repair list).
2. Choose how the repair went: Repaired, Partially Repaired, Unrepairable or Advice Given.
3. Answer **Has the owner collected the item?** — usually *Yes* at a session. Choose *Not yet* if the item is waiting to be picked up.
4. Record the owner's satisfaction, any donation and notes, then press **Mark as Complete**.

If an item was completed but not yet collected, open it later and press **👋 Owner has collected it** when the owner picks it up.

You can also change the status at any time from the **Status** dropdown in the repair list or on the Edit screen.

---

## AI Repair Suggestions

The AI helper can suggest what might be wrong with an item and how to fix it. To use it, choose **Investigate (AI)** from the ⋯ menu next to an item in the repair list, then press **Ask AI**.

### What is sent to the AI

- The item's description, the fault, and any other details recorded (make, model, colour and so on)
- **All photos already on the item** — including those added when the item was booked in, on the Edit screen, or imported from the spreadsheet — plus any you add on this screen

The AI looks at the photos and says what it can see, so a clear picture of the fault or the rating label often helps a lot.

> **Photo limit:** up to the 6 most recent photos are sent with each question. If an item has more, add the most useful close-up last.

### Asking follow-up questions

After the first answer you can type a follow-up question. Use the camera or file button beside the question box to add a new photo first — it is saved to the item and sent with your question, together with the item's other photos.

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
- **Completed** — items that are *Completed* or *Collected*
- **In Progress** — items that are *Investigating* or *Taken Home*
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

The admin panel is available to admins only, via the **Admin** (grid) icon. Other users don't see the icon and can't open the admin pages.

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
