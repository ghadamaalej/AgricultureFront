import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
@Injectable({
  providedIn: 'root'
})
export class AuthInterceptorService implements HttpInterceptor{
  constructor(private authService: AuthService) {}

 intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Récupérer le token stocké (sans "Bearer ")
    const token = this.authService.getToken();
    
    if (token) {
      // Cloner la requête et ajouter l'en-tête Authorization avec "Bearer "
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      console.log('Token ajouté à la requête:', `Bearer ${token}`);
      return next.handle(authReq);
    }
    
    console.log('Aucun token trouvé pour la requête:', req.url);
    return next.handle(req);
  }
}
