import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  text: string;
  type: ToastType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<ToastMessage>();
  toast$ = this.toastSubject.asObservable();

  show(text: string, type: ToastType = 'info', duration = 3000) {
    this.toastSubject.next({ text, type, duration });
  }

  success(text: string, duration = 3000) {
    this.show(text, 'success', duration);
  }

  error(text: string, duration = 4000) {
    this.show(text, 'error', duration);
  }

  info(text: string, duration = 3000) {
    this.show(text, 'info', duration);
  }

  warning(text: string, duration = 3500) {
    this.show(text, 'warning', duration);
  }
}