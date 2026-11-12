import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, OAuthProvider, FacebookAuthProvider, signInWithPopup, signOut, user, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, linkWithCredential, AuthCredential, UserCredential } from '@angular/fire/auth';
import { Firestore, doc, docData, getDoc, setDoc, Timestamp } from '@angular/fire/firestore';
import { ActivityService } from './activity.service';
import { Observable, from, map, of, switchMap, catchError, combineLatest, shareReplay } from 'rxjs';

/** 'loading' until known; 'pending' = signed in but not yet approved by an admin. */
export type AccessState = 'loading' | 'signed-out' | 'pending' | 'approved';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    private firestore: Firestore = inject(Firestore);
    private activity = inject(ActivityService);
    user$: Observable<User | null> = user(this.auth);

    /**
     * Whether the signed-in person may use the repair data. Admins and accounts an admin has
     * approved (volunteers/{uid}) are approved; the database rules enforce the same thing.
     * Updates live, so a waiting volunteer gets in as soon as they're approved.
     */
    access$: Observable<AccessState> = this.user$.pipe(
        switchMap(u => {
            if (!u) return of<AccessState>('signed-out');
            const exists = (path: string) => docData(doc(this.firestore, path, u.uid)).pipe(
                map(d => d !== undefined),
                catchError(() => of(false))
            );
            return combineLatest([exists('admins'), exists('volunteers')]).pipe(
                map(([admin, volunteer]): AccessState => (admin || volunteer ? 'approved' : 'pending'))
            );
        }),
        shareReplay({ bufferSize: 1, refCount: true })
    );

    /**
     * Facebook sign-in that was refused because the email already belongs to an account made
     * another way (e.g. Google). Held until that person signs in the original way, then linked
     * so both methods open the same account.
     */
    private pendingLink: { credential: AuthCredential; email: string | null } | null = null;

    get pendingLinkEmail(): string | null {
        return this.pendingLink ? (this.pendingLink.email || '') : null;
    }

    cancelPendingLink() {
        this.pendingLink = null;
    }

    /** Called after every successful sign-in. Returns true if Facebook was just linked. */
    private async completeSignIn(result: UserCredential): Promise<boolean> {
        let linked = false;
        if (this.pendingLink) {
            const { credential } = this.pendingLink;
            this.pendingLink = null;
            try {
                await linkWithCredential(result.user, credential);
                linked = true;
            } catch (error: any) {
                // Already linked, or that Facebook account belongs to a different user: sign-in still succeeds.
                console.warn('Could not link Facebook to this account:', error?.code || error);
            }
        }
        await this.saveUserProfile(result.user);
        return linked;
    }

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

    // Plain sign-in only asks for name/email, which Google allows without app verification.
    async loginWithGoogle(): Promise<any> {
        return this.googleSignIn(new GoogleAuthProvider());
    }

    // Drive/Sheets scopes trigger Google's "app not verified" warning, so they are only
    // requested when an admin uses a Google Sheets import/export feature.
    async connectGoogleDrive(): Promise<any> {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        provider.addScope('https://www.googleapis.com/auth/drive');
        return this.googleSignIn(provider);
    }

    private async googleSignIn(provider: GoogleAuthProvider): Promise<any> {
        try {
            const result = await signInWithPopup(this.auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const linkedFacebook = await this.completeSignIn(result);
            return { user: result.user, token: credential?.accessToken, linkedFacebook };
        } catch (error) {
            console.error('Google Login error:', error);
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
            this.pendingLink = null;
            await this.saveUserProfile(result.user);
            return { user: result.user, token: credential?.accessToken };
        } catch (error: any) {
            if (error?.code === 'auth/account-exists-with-different-credential') {
                const credential = FacebookAuthProvider.credentialFromError(error);
                if (credential) this.pendingLink = { credential, email: error.customData?.email ?? null };
            }
            console.error('Facebook Login error:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        await this.activity.logSignOut();
        await signOut(this.auth);
    }

    async loginWithEmail(email: string, password: string): Promise<any> {
        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            const linkedFacebook = await this.completeSignIn(result);
            return { user: result.user, linkedFacebook };
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
