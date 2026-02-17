export interface Issue {
    id?: string;
    description: string;
    dateRaised: any; // Timestamp
    status: 'New' | 'Assigned' | 'Fixed';
}
