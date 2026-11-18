# RepairCafe User Manual

## Overview

RepairCafe is a web application for tracking repair items at Repair Cafe sessions. It allows volunteers to record items brought in for repair, assign repairers, track repair status, and review session statistics.

---

## Getting Started

### Logging In

Sign in with your Google account: press **Continue with Google** and choose your account. Google is the only way to sign in.

The first time you sign in, an admin needs to approve your account before you can see the repair records. The page opens by itself as soon as they do.

> **Used email/password or Facebook before?** Those sign-in options have been removed. Sign in with **Continue with Google** instead. If Google sign-in says your email address was registered another way, ask a Repair Cafe admin to reset your account to Google.

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
| **Issues** (circle icon) | Opens the issue tracker *(approved users only)* |
| **Notifications** (bell icon) | People waiting for approval, with an *Approve* button *(admins only)* |
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

Electrical items show a **⚡ PAT** badge before the description: **⚡ PAT ✓** passed, **⚡ PAT ✗** failed, or **⚡ PAT ?** not tested yet. On a computer, hover over the badge to see who tested it and when; the item's details page shows this too.

To list items by PAT result, click **⚲ Filters** and use the **⚡ PAT** drop-down next to the description filter: *All electrical*, *PAT passed*, *PAT failed* or *PAT not tested*. It works together with the buttons above — choose **All** to search every session rather than just the latest.

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
4. For **electrical** items, fill in the **⚡ PAT Test**: the name of the PAT tester and whether it *Passed* or *Failed* (leave it on *Not tested yet* if it hasn't been done).
5. Record the owner's satisfaction, any donation and notes, then press **Mark as Complete**.

If an item was completed but not yet collected, open it later and press **👋 Owner has collected it** when the owner picks it up.

You can also change the status at any time from the **Status** dropdown in the repair list or on the Edit screen.

---

### PAT Tests (Electrical Items)

Every item in the **Electrical** category has a **⚡ PAT Test** section showing who tested it, whether it passed or failed, and the date the result was recorded. Fill it in on the **Complete** screen or in the *PAT Test* section of the **Edit** screen; it is shown on the item's details page. Start typing the tester's name to pick from the list of repairers, or type any name.

**Where to see PAT results:**

- **Item details page** — result, tester and date
- **Repair list** — a *⚡ PAT ✓ / ✗ / ?* badge on each electrical item, and a *⚡ PAT* filter under **⚲ Filters** (see Repair List)
- **Session dashboard** — a *⚡ PAT Tests* card counting passed, failed and not tested, a *PAT* column in the items list, and a PAT line for each electrical item in the session report (see Session Dashboard)
- **Analytics** — a *⚡ PAT Tests per Session* chart with a bar for each session (passed in green, failed in red, not tested in grey), plus totals and an overall pass rate. Use the year buttons to look at one year. It only appears on *Live App Data* and only counts electrical items entered in the app, because items imported from old spreadsheets have no PAT details. The pass rate is worked out from the items that were actually tested.

> **Failed PAT test:** an item that fails must not be handed back for use until it has been made safe.

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
- **⚡ PAT Tests** — for sessions with electrical items: how many passed (✓), failed (✗) and are not tested yet (?). The card has a red border if any item failed.

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
| **PAT** | Electrical items: *Passed*, *Failed* or *Not tested*, with the tester's name. Other items show — |

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

Access it via the **Issues** icon in the header (approved users only).

### Reporting an Issue

1. Click **Report Issue**
2. Enter a description of the issue
3. Click **Submit Issue**

### Talking About an Issue

Each issue has its own conversation, so the person who raised it and the person fixing it can ask questions and give updates.

1. Click the **💬 Discuss** button under the issue's description (it shows the number of messages once there are some)
2. Read the conversation — it starts with the original issue, marked *raised this issue*
3. Type your reply in the box at the bottom and click **Send** (or press Ctrl+Enter)

Your own messages appear on the right, everyone else's on the left. A red **New** label on the 💬 button means someone has replied since you last opened that conversation on this device.

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

Lists all users who have logged in. People waiting for approval are shown first — press **Approve** to let them see the repair records. Admins can also grant or revoke admin access.

### Notifications (bell icon)

Admins see a **bell** icon in the header. When someone new signs in and is waiting for approval:

- a red number on the bell shows how many people are waiting;
- if you are signed in at the time, a pop-up appears in the bottom-right corner — click it to review.

Click the bell to see who is waiting and press **Approve** next to their name. They get in straight away, without needing to sign in again. Use **Open Admin → Users** for more options.

### Version Manager

Shows the current application version and allows the description to be updated. The version displayed on the home page always reflects the latest deployed version automatically.

---

## Tips

- The version number shown in the header and footer is updated automatically on each deployment — no manual steps needed.
- Secondary repairers can be added to any repair item from the session dashboard without opening the full edit form.
- Past session cards on the schedule screen show a small donut chart so you can see at a glance how a session went.
- The issue tracker automatically shows a count badge on the Issues button so open issues are always visible.
