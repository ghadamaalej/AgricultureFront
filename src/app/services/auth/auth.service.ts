import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type BackendRole =
    | 'AGRICULTEUR'
    | 'EXPERT_AGRICOLE'
    | 'ORGANISATEUR_EVENEMENT'
    | 'TRANSPORTEUR'
    | 'VETERINAIRE'
    | 'ADMIN'
    | 'ACHETEUR'
    | 'AGENT';

export interface LoginResponse {
    token:                    string | null;
    userId:                   number | null;
    username:                 string | null;
    email:                    string;
    role:                     string | null;
    statutCompte?:            string | null;
    emailVerificationStatus?: string | null;
    profileValidationStatus?: string | null;
    nextStep?:                'LOGIN' | 'VERIFY_EMAIL' | 'SIGNUP_STEP2' | 'ACCESS_GRANTED' | string | null;
    verificationRequired?:    boolean;
    message:                  string;
}

export interface SignupResponse {
    userId:                   number | null;
    email:                    string | null;
    role:                     string | null;
    statutCompte:             string | null;
    emailVerificationStatus?: string | null;
    profileValidationStatus?: string | null;
    nextStep?:                'VERIFY_EMAIL' | 'SIGNUP_STEP2' | 'LOGIN' | string | null;
    message:                  string;
}

export interface SignupStep1Request {
    nom:        string;
    prenom:     string;
    email:      string;
    motDePasse: string;
    role:       string;
    photo?:     string | null;
    telephone?: string | null;
}

export interface SignupStep2Request {
    photo?:               string | null;
    telephone?:           string | null;
    region?:              string | null;
    diplomeExpert?:       string | null;
    documentUrl?:         string | null;
    vehicule?:            string | null;
    capacite?:            number | null;
    agence?:              string | null;
    certificatTravail?:   string | null;
    organizationLogo?:    string | null;
    cin?:                 string | null;
    adresseCabinet?:      string | null;
    presentationCarriere?: string | null;
    telephoneCabinet?:    string | null;
    nomOrganisation?:     string | null;
    description?:         string | null;
}

export interface AuthUser {
    userId:       number;
    username:     string;
    email:        string;
    role:         BackendRole;
    statutCompte?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://localhost:8089/user/api/auth';
    private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getUserFromStorage());
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {}

    login(email: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
            email,
            motDePasse: password
        }).pipe(
            map(response => {
                if (response.token && response.userId !== null && response.role) {
                    const user: AuthUser = {
                        userId:       response.userId,
                        username:     response.username || response.email,
                        email:        response.email,
                        role:         response.role as BackendRole,
                        statutCompte: response.statutCompte || undefined
                    };
                    this.storeToken(response.token);
                    this.storeUser(user);
                    this.currentUserSubject.next(user);

                    console.log('🔐 User logged in successfully!');
                    console.log('👤 User Role:', response.role);
                    console.log('🆔 User ID:', response.userId);
                    console.log('📧 User Email:', response.email);
                    console.log('📊 Account Status (Statut Compte):', response.statutCompte || 'Not provided');
                    console.log('✅ Is Approved:', response.statutCompte === 'APPROUVE');
                }
                return response;
            })
        );
    }

    signupStep1(payload: SignupStep1Request): Observable<SignupResponse> {
        return this.http.post<SignupResponse>(`${this.apiUrl}/signup/step1`, payload);
    }

    signupStep2(userId: number, payload: SignupStep2Request): Observable<SignupResponse> {
        return this.http.put<SignupResponse>(`${this.apiUrl}/signup/step2/${userId}`, payload);
    }

    verifyEmail(userId: number): Observable<SignupResponse> {
        return this.http.post<SignupResponse>(`${this.apiUrl}/verify-email/${userId}`, {});
    }

    logout(): void {
        this.clearSession();
        this.currentUserSubject.next(null);
    }

    hasActiveSession(): boolean {
        return !!this.getToken() && !!this.getCurrentUser();
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    // ← Defensive version from second file: guards against 'null'/'undefined' strings in localStorage
    getToken(): string | null {
        const token = localStorage.getItem('authToken');
        if (token && token !== 'null' && token !== 'undefined') {
            return token;
        }
        return null;
    }

    getCurrentUser(): AuthUser | null {
        return this.currentUserSubject.value;
    }

    getCurrentRole(): BackendRole | null {
        return this.getCurrentUser()?.role ?? null;
    }

    getCurrentUserId(): number | null {
        return this.getCurrentUser()?.userId ?? null;
    }

    getAccountStatus(): string | undefined {
        return this.getCurrentUser()?.statutCompte;
    }

    isAccountApproved(): boolean {
        return this.getCurrentUser()?.statutCompte === 'APPROUVE';
    }

    hasRole(role: BackendRole): boolean {
        const user = this.getCurrentUser();
        return user ? user.role.toUpperCase() === role.toUpperCase() : false;
    }

    hasAnyRole(...roles: BackendRole[]): boolean {
        const user = this.getCurrentUser();
        return user ? roles.map(r => r.toUpperCase()).includes(user.role.toUpperCase()) : false;
    }

    getDefaultRouteForRole(role: BackendRole | null): string {
        if (!role) return '/';
        switch (role) {
            case 'ADMIN':                  return '/dashboard';
            case 'ACHETEUR':               return '/marketplace';
            case 'AGRICULTEUR':            return '/delivery';
            case 'EXPERT_AGRICOLE':        return '/expert/home';
            case 'TRANSPORTEUR':           return '/transporter/home';
            case 'VETERINAIRE':            return '/appointments';
            case 'AGENT':                  return '/agent/home';
            case 'ORGANISATEUR_EVENEMENT': return '/organizer/home';
            default:                       return '/';
        }
    }

    private storeToken(token: string): void {
        localStorage.setItem('authToken', token);
    }

    private storeUser(user: AuthUser): void {
        localStorage.setItem('authUser', JSON.stringify(user));
    }

    private getUserFromStorage(): AuthUser | null {
        const user = localStorage.getItem('authUser');
        return user ? JSON.parse(user) as AuthUser : null;
    }

    private clearSession(): void {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
    }
}