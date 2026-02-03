export interface RepairItem {
  id?: string;
  itemNumber: number; // Sequence number starting at 1 for each RCDay
  itemDescription: string;
  creationDate: any; // Using any for Firestore compatibility (Timestamp)
  displayNumber: string;
  RCDay: string;
  rcDayNumber: number;
  tags?: string[];
  photos?: string[];
}
