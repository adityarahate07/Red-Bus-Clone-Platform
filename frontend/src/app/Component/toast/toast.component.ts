import { Component } from '@angular/core';
import { NotificationService, ToastNotification } from '../../service/notification.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  toasts$ = this.notificationService.toasts$;

  constructor(private notificationService: NotificationService) {}

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }

  trackById(_index: number, item: ToastNotification): number {
    return item.id;
  }
}
