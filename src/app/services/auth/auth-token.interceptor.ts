import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let finalUrl = req.url;
    let isApiRequest = false;

    if (finalUrl.startsWith('http://localhost:8089')) {
      finalUrl = finalUrl.replace('http://localhost:8089', '');
      isApiRequest = true;
    } else if (finalUrl.startsWith('http://localhost:8095')) {
      finalUrl = finalUrl.replace('http://localhost:8095', '');
      isApiRequest = true;
    } else if (
      finalUrl.startsWith('/forums/') ||
      finalUrl.startsWith('/user/') ||
      finalUrl.startsWith('/livraison/') ||
      finalUrl.startsWith('/osrm/') ||
      finalUrl.startsWith('/Vente/') ||
      finalUrl.startsWith('/formation/') ||
      finalUrl.startsWith('/explorer/') ||
      finalUrl.startsWith('/evenement/') ||
      finalUrl.startsWith('/support/') ||
      finalUrl.startsWith('/reclamations/') ||
      finalUrl.startsWith('/pret/') ||
      finalUrl.startsWith('/inventaires/') ||
      finalUrl.startsWith('/assistance/') ||
      finalUrl.startsWith('/paiement/')
    ) {
      isApiRequest = true;
    }

    const token = localStorage.getItem('authToken');
    
    if (!isApiRequest) {
      if (finalUrl !== req.url) {
        return next.handle(req.clone({ url: finalUrl }));
      }
      return next.handle(req);
    }

    let authReqInfo: any = {};
    if (token) {
      authReqInfo.setHeaders = {
        Authorization: `Bearer ${token}`
      };
    }
    
    if (finalUrl !== req.url) {
      authReqInfo.url = finalUrl;
    }

    if (Object.keys(authReqInfo).length > 0) {
      const authReq = req.clone(authReqInfo);
      return next.handle(authReq);
    }

    return next.handle(req);
  }
}
