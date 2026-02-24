import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AvatarService {
    private styles = [
        'adventurer', 'avataaars', 'big-ears', 'big-smile', 'bottts',
        'croodles', 'fun-emoji', 'lorelei', 'notionists', 'open-peeps',
        'pixel-art', 'shapes', 'thumbs', 'lorelei-neutral', 'micah', 'miniavs'
    ];

    searchAvatars(query: string): Observable<string[]> {
        const seed = encodeURIComponent(query.trim() || 'avatar');
        // Using PNG format for better compatibility with existing upload/preview logic
        const results = this.styles.map(style =>
            `https://api.dicebear.com/7.x/${style}/png?seed=${seed}`
        );
        return of(results);
    }
}
