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
  itemNumber: number;
  itemDescription: string;
  fault?: string;
  ageOfItem?: string;
  repairItem?: string;
  repairer?: string;
  additionalRepairers?: string[];
  creationDate: any;
  rcdate?: any;
  displayNumber: string;
  RCDay: string;
  rcDayNumber: number;
  status?: string;
  telephone?: string;
  owner?: string;
  category?: string;
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
  // Extended fields
  numberOfVisitors?: number;
  repairOutcome?: string;
  patTest?: string;
  ageRange?: string;
  visitorType?: string;
  path?: string;
  notes?: string;
  comments?: string;
  positive?: string;
  repairConsequence?: string;
  councilWard?: string;
  left?: string;
  likely?: string;
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
