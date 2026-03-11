export interface Repairer {
    id?: string;
    name: string;
    createdAt?: any;
    photoUrl?: string; // URL to avatar image
    isPrimary?: boolean; // Primary repairers can be assigned to repair items
}
