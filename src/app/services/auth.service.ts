import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User } from '@angular/fire/auth';
import { Observable, from, map } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    user$: Observable<User | null> = user(this.auth);

    async loginWithGoogle(): Promise<any> {
        const provider = new GoogleAuthProvider();
        // Request scopes for Google Sheets and Google Drive
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/drive.readonly');

        try {
            const result = await signInWithPopup(this.auth, provider);
            // The signed-in user info.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;
            return { user: result.user, token };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        await signOut(this.auth);
    }

    getAccessToken(): Promise<string | null> {
        // Note: In a real app, you might want to handle token expiration/refresh.
        // Firebase Auth doesn't store the 3rd party access token indefinitely.
        // For this specific export task, we expect the user to have just logged in
        // or we'll prompt them again.
        return Promise.resolve(null); // Tokens are usually retrieved during login result
    }
}
