import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, OAuthProvider, FacebookAuthProvider, signInWithPopup, signOut, user, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, Timestamp } from '@angular/fire/firestore';
import { Observable, from, map, of, switchMap, catchError } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    private firestore: Firestore = inject(Firestore);
    user$: Observable<User | null> = user(this.auth);

    isAdmin$: Observable<boolean> = this.user$.pipe(
        switchMap(currentUser => {
            if (!currentUser) return of(false);
            return from(getDoc(doc(this.firestore, 'admins', currentUser.uid))).pipe(
                map(snapshot => snapshot.exists()),
                catchError(() => of(false))
            );
        })
    );

    private async saveUserProfile(user: User): Promise<void> {
        const userRef = doc(this.firestore, 'users', user.uid);
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            lastSeen: Timestamp.now()
        }, { merge: true });
    }

    async loginWithGoogle(): Promise<any> {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        provider.addScope('https://www.googleapis.com/auth/drive');

        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            await this.saveUserProfile(result.user);
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
            await this.saveUserProfile(result.user);
            return { user: result.user, token: credential?.accessToken };
        } catch (error) {
            console.error('Apple Login error:', error);
            throw error;
        }
    }

    async loginWithMicrosoft(): Promise<any> {
        const provider = new OAuthProvider('microsoft.com');
        provider.addScope('email');
        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = OAuthProvider.credentialFromResult(result);
            await this.saveUserProfile(result.user);
            return { user: result.user, token: credential?.accessToken };
        } catch (error) {
            console.error('Microsoft Login error:', error);
            throw error;
        }
    }

    async loginWithFacebook(): Promise<any> {
        const provider = new FacebookAuthProvider();
        provider.addScope('email');
        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = FacebookAuthProvider.credentialFromResult(result);
            await this.saveUserProfile(result.user);
            return { user: result.user, token: credential?.accessToken };
        } catch (error) {
            console.error('Facebook Login error:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        await signOut(this.auth);
    }

    async loginWithEmail(email: string, password: string): Promise<any> {
        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            await this.saveUserProfile(result.user);
            return { user: result.user };
        } catch (error) {
            console.error('Email Login error:', error);
            throw error;
        }
    }

    async signUpWithEmail(email: string, password: string): Promise<any> {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);
            await this.saveUserProfile(result.user);
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
