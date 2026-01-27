export interface RepairItem {
  id?: string;
  itemNumber: string;
  itemDescription: string;
  creationDate: any; // Using any for Firestore compatibility (Timestamp)
  displayNumber: string;
}
