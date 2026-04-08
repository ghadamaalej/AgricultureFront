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
  token: string | null;
  userId: number | null;
  username: string | null;
  email: string;
  role: string | null;
  message: string;
}

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: BackendRole;
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
            userId: response.userId,
            username: response.username || response.email,
            email: response.email,
            role: response.role as BackendRole
          };
          this.storeToken(response.token);
          this.storeUser(user);
          this.currentUserSubject.next(user);
        }
        return response;
      })
    );
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

  getToken(): string | null {
    return localStorage.getItem('authToken');
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

  hasRole(role: BackendRole): boolean {
    const user = this.getCurrentUser();
    return user ? user.role.toUpperCase() === role.toUpperCase() : false;
  }

  hasAnyRole(...roles: BackendRole[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.map(r => r.toUpperCase()).includes(user.role.toUpperCase()) : false;
  }

  getDefaultRouteForRole(role: BackendRole | null): string {
  if (!role) {
    return '/';
  }

  switch (role) {
    case 'ADMIN':
      return '/dashboard';

    case 'AGRICULTEUR':
    case 'ACHETEUR':
    case 'EXPERT_AGRICOLE':
    case 'ORGANISATEUR_EVENEMENT':
    case 'TRANSPORTEUR':
    case 'VETERINAIRE':
    case 'AGENT':
      return '/marketplace';

    default:
      return '/';
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
