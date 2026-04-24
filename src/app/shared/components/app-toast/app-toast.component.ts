import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastMessage, ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-toast-stack',
  templateUrl: './app-toast.component.html',
  styleUrls: ['./app-toast.component.css']
})
export class AppToastComponent {
  toasts$: Observable<ToastMessage[]>;

  constructor(public toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  trackByToastId(index: number, toast: ToastMessage): number {
    return toast.id;
  }

  closeToast(id: number): void {
    this.toastService.remove(id);
  }
}
