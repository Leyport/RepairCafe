export interface RepairItem {
  id?: string;
  itemNumber: number; // Sequence number starting at 1 for each RCDay
  itemDescription: string;
  creationDate: any; // Using any for Firestore compatibility (Timestamp)
  displayNumber: string; // DDDddMMXXX format
  RCDay: string; // "DayOfWeek, Day, Month, Year"
}
