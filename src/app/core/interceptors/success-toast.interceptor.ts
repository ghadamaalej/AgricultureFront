import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ToastService } from '../services/toast.service';

@Injectable()
export class SuccessToastInterceptor implements HttpInterceptor {
  constructor(private toastService: ToastService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      tap((event) => {
        if (!(event instanceof HttpResponse)) return;
        if (!this.shouldToast(req)) return;

        const messageFromApi = this.extractMessage(event.body);
        const message = messageFromApi || this.defaultMessage(req.method);
        this.toastService.success(message);
      })
    );
  }

  private shouldToast(req: HttpRequest<any>): boolean {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return false;

    const url = req.url.toLowerCase();
    const excluded = ['/login', '/register', '/refresh', '/auth', '/signin', '/signup', '/messages/'];
    return !excluded.some((entry) => url.includes(entry));
  }

  private extractMessage(body: any): string | null {
    if (!body || typeof body !== 'object') return null;
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
    if (typeof body.msg === 'string' && body.msg.trim()) return body.msg.trim();
    return null;
  }

  private defaultMessage(method: string): string {
    switch (method) {
      case 'POST':
        return 'Ajout effectué avec succès.';
      case 'PUT':
      case 'PATCH':
        return 'Modification effectuée avec succès.';
      case 'DELETE':
        return 'Suppression effectuée avec succès.';
      default:
        return 'Action effectuée avec succès.';
    }
  }
}
