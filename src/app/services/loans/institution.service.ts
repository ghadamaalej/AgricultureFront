import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Institution } from '../../loans/models/institution';
import { map, Observable } from 'rxjs';

interface UserInstitutionCandidate {
  id: number;
  role?: string | null;
  statutCompte?: string | null;
  agence?: string | null;
  description?: string | null;
  logo_organisation?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class InstitutionService {
  private readonly apiUrl = 'http://localhost:8089/user/api/user';

  constructor(private http: HttpClient) { }

  getInstitutions(): Observable<Institution[]> {
    return this.http.get<UserInstitutionCandidate[]>(`${this.apiUrl}/getAll`).pipe(
      map((users) => this.mapApprovedAgentsToInstitutions(users))
    );
  }

  private mapApprovedAgentsToInstitutions(users: UserInstitutionCandidate[] | null | undefined): Institution[] {
    return (users ?? [])
      .filter((user) =>
        user.id != null &&
        user.role === 'AGENT' &&
        user.statutCompte === 'APPROUVE' &&
        !!user.agence?.trim()
      )
      .map((user) => ({
        id: user.id,
        agence: user.agence!.trim(),
        description: user.description?.trim() || 'No description available.',
        logo_organisation: user.logo_organisation?.trim() || ''
      }));
  }
}
