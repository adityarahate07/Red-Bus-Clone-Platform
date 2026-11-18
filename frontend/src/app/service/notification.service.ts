import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastNotification {
  id: number;
  translationKey: string;
  params?: Record<string, string | number>;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private counter = 0;
  private readonly toastsSubject = new BehaviorSubject<ToastNotification[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();

  show(
    translationKey: string,
    type: ToastType = 'info',
    params?: Record<string, string | number>,
    durationMs = 3500
  ): void {
    const id = ++this.counter;
    const toast: ToastNotification = { id, translationKey, params, type };
    this.toastsSubject.next([...this.toastsSubject.value, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }
}
