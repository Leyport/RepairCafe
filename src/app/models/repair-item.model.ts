import { Timestamp } from '@angular/fire/firestore';

export interface RepairPhoto {
  url: string;
  type: 'before' | 'after';
}

/** Normalise a photo entry that may be a legacy plain URL string or the new RepairPhoto object */
export function toRepairPhoto(p: RepairPhoto | string): RepairPhoto {
  return typeof p === 'string' ? { url: p, type: 'before' } : p;
}

export interface RepairItem {
  id?: string;
  itemNumber: number; // Sequence number starting at 1 for each RCDay
  itemDescription: string;
  fault?: string;
  ageOfItem?: string;
  repairItem?: string; // The type/name of item (e.g. Toaster)
  repairer?: string; // Name of the repairer assigned (Primary)
  additionalRepairers?: string[]; // Names of additional repairers
  creationDate: any; // Using any for Firestore compatibility (Timestamp)
  rcdate?: any; // RC event date (optional, Timestamp)
  displayNumber: string;
  paperItemNumber?: string; // Number on the paper ticket/form, while the paper system runs in parallel
  RCDay: string;
  rcDayNumber: number;
  status?: string; // Stage: New, Investigating, Taken Home, Completed, Collected (see repair-status.ts)
  outcome?: string; // When Completed/Collected: Repaired, Partially Repaired, Unrepairable, Advice Given
  telephone?: string; // Contact telephone number
  owner?: string; // Name of the owner
  postcode?: string; // Postcode AREA only (outward code, e.g. "SY1") — never the full
  // postcode. Collected for area-coverage reporting, not to identify an individual;
  // see normalizePostcode() in intake.component.ts, which strips any full postcode
  // down to just the outward part before it's ever saved.
  category?: string;
  tags?: string[];
  photos?: RepairPhoto[];
  make?: string;
  model?: string;
  colour?: string;
  serialNumber?: string;
  yearOfManufacture?: string;
  repairVideos?: { url: string; title: string }[];
  ownerSatisfied?: boolean | null; // null = "Neutral", a real selectable outcome, not "unanswered"
  donationAmount?: number;
  investigationNotes?: string;
  completionNotes?: string;
  patTester?: string; // Electrical items: who carried out the PAT test
  patResult?: 'Pass' | 'Fail' | ''; // '' or missing = not tested yet
  patDate?: any; // Timestamp the result was recorded
  sequenceNumber?: number; // Permanent reference number, assigned once and never changed or reused
  importSource?: string; // Set on items imported from a spreadsheet, e.g. "Repair_Data 2025 row 3"
  aiReportUrl?: string;
}

/** Electrical items need a PAT (portable appliance) test. */
export function isElectricalCategory(category: string | undefined | null): boolean {
  return ['electrical', 'electronics'].includes((category || '').trim().toLowerCase());
}

/** Fields to save for a PAT test; the date is stamped when the result is first set or changes. */
export function patFields(item: RepairItem | null | undefined, tester: string, result: 'Pass' | 'Fail' | ''): Partial<RepairItem> {
  const fields: Partial<RepairItem> = { patTester: (tester || '').trim(), patResult: result };
  if (result && result !== item?.patResult) fields.patDate = Timestamp.now();
  if (!result) fields.patDate = null;
  return fields;
}

export interface Owner {
  id?: string;
  name: string;
  telephone?: string;
  firstSeen: any; // Timestamp
  physicalAssistance?: boolean;
  visualAssistance?: boolean;
  hearingAssistance?: boolean;
}

export interface Repairer {
  id?: string;
  name: string;
  createdAt: any;
  photoUrl?: string; // URL to avatar image
}

export interface Tag {
  id?: string;
  name: string;
  emoji: string;
}
