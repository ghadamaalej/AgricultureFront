import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  private counter = 0;

  show(text: string, type: ToastType = 'info', duration = 3500): void {
    const toast: ToastMessage = {
      id: ++this.counter,
      text,
      type,
      duration
    };

    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);

    setTimeout(() => {
      this.remove(toast.id);
    }, duration);
  }

  success(text: string, duration = 3500): void {
    this.show(text, 'success', duration);
  }

  error(text: string, duration = 4500): void {
    this.show(text, 'error', duration);
  }

  warning(text: string, duration = 4000): void {
    this.show(text, 'warning', duration);
  }

  info(text: string, duration = 3500): void {
    this.show(text, 'info', duration);
  }

  remove(id: number): void {
    const current = this.toastsSubject.value;
    this.toastsSubject.next(current.filter(t => t.id !== id));
  }

  clear(): void {
    this.toastsSubject.next([]);
  }
}