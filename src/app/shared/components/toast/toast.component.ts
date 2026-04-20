import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { ToastMessage, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-legacy',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnInit, OnDestroy {
  message: ToastMessage | null = null;
  visible = false;

  private sub?: Subscription;
  private timerSub?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toast$.subscribe((msg) => {
      this.message = msg;
      this.visible = true;

      this.timerSub?.unsubscribe();
      this.timerSub = timer(msg.duration || 3000).subscribe(() => {
        this.close();
      });
    });
  }

  close(): void {
    this.visible = false;
    setTimeout(() => { this.message = null; }, 200);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timerSub?.unsubscribe();
  }
}
