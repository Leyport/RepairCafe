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
  repairItem?: string; // The type/name of item (e.g. Toaster)
  repairer?: string; // Name of the repairer assigned (Primary)
  additionalRepairers?: string[]; // Names of additional repairers
  creationDate: any; // Using any for Firestore compatibility (Timestamp)
  rcdate?: any; // RC event date (optional, Timestamp)
  displayNumber: string;
  RCDay: string;
  rcDayNumber: number;
  status?: string; // Status: "New", "Assigned", "Completed"
  telephone?: string; // Contact telephone number
  owner?: string; // Name of the owner
  tags?: string[];
  photos?: RepairPhoto[];
  make?: string;
  model?: string;
  colour?: string;
  serialNumber?: string;
  yearOfManufacture?: string;
  repairVideos?: { url: string; title: string }[];
  ownerSatisfied?: boolean;
  donationAmount?: number;
}

export interface Owner {
  id?: string;
  name: string;
  telephone?: string;
  email?: string;
  firstSeen: any; // Timestamp
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
