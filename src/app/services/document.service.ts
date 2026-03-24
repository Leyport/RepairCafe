import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, addDoc, Timestamp,
  doc, deleteDoc, query, where, getDocs, orderBy, updateDoc
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RCDocument } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private documentsCollection = collection(this.firestore, 'documents');

  getDocuments(): Observable<RCDocument[]> {
    const q = query(this.documentsCollection, orderBy('uploadedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<RCDocument[]>;
  }

  getDocumentsByFolder(folder: string): Observable<RCDocument[]> {
    const q = query(
      this.documentsCollection,
      where('folder', '==', folder),
      orderBy('uploadedAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<RCDocument[]>;
  }

  getFolders(): Observable<string[]> {
    return this.getDocuments().pipe(
      map(docs => {
        const folders = new Set(docs.map(d => d.folder));
        return Array.from(folders).sort();
      })
    );
  }

  async uploadDocument(
    file: File,
    folder: string,
    description: string,
    tags: string[],
    uploadedBy: string
  ): Promise<void> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `documents/${folder}/${Date.now()}_${safeName}`;
    const storageRef = ref(this.storage, filePath);
    const result = await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(result.ref);

    await addDoc(this.documentsCollection, {
      name: file.name,
      folder: folder || 'Uncategorized',
      fileUrl,
      fileType: file.type || this.guessFileType(file.name),
      fileSize: file.size,
      uploadedAt: Timestamp.now(),
      uploadedBy: uploadedBy || 'Unknown',
      tags: tags || [],
      description: description || ''
    });
  }

  async updateDocument(id: string, data: Partial<RCDocument>): Promise<void> {
    const docRef = doc(this.firestore, 'documents', id);
    await updateDoc(docRef, data);
  }

  async deleteDocument(document: RCDocument): Promise<void> {
    if (document.fileUrl) {
      try {
        const storageRef = ref(this.storage, document.fileUrl);
        await deleteObject(storageRef);
      } catch (e) {
        console.warn('Could not delete file from storage:', e);
      }
    }
    if (document.id) {
      const docRef = doc(this.firestore, 'documents', document.id);
      await deleteDoc(docRef);
    }
  }

  private guessFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv'
    };
    return typeMap[ext] || 'application/octet-stream';
  }

  getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return '📊';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('text')) return '📃';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
