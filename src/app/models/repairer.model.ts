export interface Repairer {
    id?: string;
    name: string;
    createdAt?: any;
    photoUrl?: string; // URL to avatar image
    canBePrimary?: boolean; // Whether this repairer can be assigned as a primary repairer
}
