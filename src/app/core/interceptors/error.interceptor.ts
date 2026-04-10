import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private toastService: ToastService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        let message = 'Une erreur inattendue est survenue.';

        if (error.error?.message) {
          message = error.error.message;
        } else if (typeof error.error === 'string' && error.error.trim()) {
          message = error.error;
        } else if (error.status === 0) {
          message = 'Impossible de contacter le serveur.';
        } else if (error.status === 400) {
          message = 'Requête invalide.';
        } else if (error.status === 401) {
          message = 'Vous n’êtes pas autorisé à effectuer cette action.';
        } else if (error.status === 403) {
          message = 'Accès refusé.';
        } else if (error.status === 404) {
          message = 'Ressource introuvable.';
        } else if (error.status === 409) {
          message = 'Conflit de données.';
        } else if (error.status === 500) {
          message = 'Erreur interne du serveur.';
        }

        this.toastService.error(message);
        return throwError(() => error);
      })
    );
  }
}