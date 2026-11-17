export interface Issue {
    id?: string;
    description: string;
    fix?: string;
    dateRaised: any; // Timestamp
    status: 'New' | 'Assigned' | 'Fixed';
    raisedBy?: string;
    raisedByUid?: string;
    /** Conversation between the person who raised the issue and whoever is fixing it. */
    messages?: IssueMessage[];
    lastMessageAt?: any; // Timestamp of the newest message
}

export interface IssueMessage {
    text: string;
    by: string;     // display name
    byUid?: string;
    at: any;        // Timestamp
}
