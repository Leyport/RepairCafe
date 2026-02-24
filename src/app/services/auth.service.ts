import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, user, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Observable, from, map } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    user$: Observable<User | null> = user(this.auth);

    async loginWithGoogle(): Promise<any> {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        provider.addScope('https://www.googleapis.com/auth/drive.file');

        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            return { user: result.user, token: credential?.accessToken };
        } catch (error) {
            console.error('Google Login error:', error);
            throw error;
        }
    }

    async loginWithApple(): Promise<any> {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');

        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = OAuthProvider.credentialFromResult(result);
            return { user: result.user, token: credential?.accessToken };
        } catch (error) {
            console.error('Apple Login error:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        await signOut(this.auth);
    }

    async loginWithEmail(email: string, password: string): Promise<any> {
        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            return { user: result.user };
        } catch (error) {
            console.error('Email Login error:', error);
            throw error;
        }
    }

    async signUpWithEmail(email: string, password: string): Promise<any> {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);
            return { user: result.user };
        } catch (error) {
            console.error('Email Sign-up error:', error);
            throw error;
        }
    }

    getAccessToken(): Promise<string | null> {
        // Note: In a real app, you might want to handle token expiration/refresh.
        // Firebase Auth doesn't store the 3rd party access token indefinitely.
        // For this specific export task, we expect the user to have just logged in
        // or we'll prompt them again.
        return Promise.resolve(null); // Tokens are usually retrieved during login result
    }
}
