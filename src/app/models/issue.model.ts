export interface Issue {
    id?: string;
    description: string;
    fix?: string;
    dateRaised: any; // Timestamp
    status: 'New' | 'Assigned' | 'Fixed';
}
