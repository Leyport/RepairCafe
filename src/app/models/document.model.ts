import { Timestamp } from '@angular/fire/firestore';

export interface RCDocument {
  id?: string;
  name: string;
  folder: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  tags: string[];
  description: string;
}
