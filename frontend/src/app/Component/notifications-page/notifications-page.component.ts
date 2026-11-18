import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ChannelDelivery,
  NotificationEventType,
  NotificationItem,
  NotificationPreferences
} from '../../model/notification-center.model';
import { NotificationCenterService } from '../../service/notification-center.service';
import { TranslationService } from '../../service/translation.service';

@Component({
  selector: 'app-notifications-page',
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.css'
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  @Input() embedded = false;

  notifications: NotificationItem[] = [];
  preferences: NotificationPreferences = {
    inApp: true,
    email: true,
    push: true,
    promotionalOptIn: true
  };

  activeFilter: 'all' | 'unread' | 'failed' = 'all';
  simulateFailure = false;

  readonly eventTypes: NotificationEventType[] = [
    'booking_confirmation',
    'cancellation',
    'schedule_change',
    'journey_reminder',
    'promotional_offer'
  ];

  private subs: Subscription[] = [];

  constructor(
    public notifCenter: NotificationCenterService,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.notifCenter.notifications$.subscribe((list) => {
        this.notifications = list;
      }),
      this.notifCenter.preferences$.subscribe((prefs) => {
        this.preferences = { ...prefs };
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  get failedCount(): number {
    return this.notifications.filter((n) =>
      n.channels.some((c) => c.status === 'Failed')
    ).length;
  }

  get filteredNotifications(): NotificationItem[] {
    if (this.activeFilter === 'unread') {
      return this.notifications.filter((n) => !n.read);
    }
    if (this.activeFilter === 'failed') {
      return this.notifications.filter((n) =>
        n.channels.some((c) => c.status === 'Failed')
      );
    }
    return this.notifications;
  }

  savePreferences(): void {
    this.notifCenter.updatePreferences(this.preferences);
  }

  triggerDemoEvent(eventType: NotificationEventType): void {
    const sampleParams: Record<NotificationEventType, Record<string, string | number>> = {
      booking_confirmation: {
        from: 'Mumbai',
        to: 'Goa',
        date: new Date().toISOString().split('T')[0],
        operator: 'FastTransit',
        fare: 950
      },
      cancellation: {
        from: 'Delhi',
        to: 'Jaipur',
        date: new Date().toISOString().split('T')[0]
      },
      schedule_change: {
        from: 'Bangalore',
        to: 'Mysore',
        operator: 'EliteTravels',
        delay: 25,
        newTime: '06:25'
      },
      journey_reminder: {
        from: 'Chennai',
        to: 'Pondicherry',
        date: new Date().toISOString().split('T')[0],
        time: '08:00'
      },
      promotional_offer: {
        code: 'SUPERHIT',
        discount: 300
      }
    };

    this.notifCenter.dispatchEvent(eventType, sampleParams[eventType], {
      simulateFailure: this.simulateFailure
    });
  }

  hasFailedChannel(item: NotificationItem): boolean {
    return item.channels.some((c) => c.status === 'Failed');
  }

  retry(item: NotificationItem, ch?: ChannelDelivery): void {
    this.notifCenter.retryDelivery(item._id, ch?.channel);
  }

  markRead(item: NotificationItem): void {
    this.notifCenter.markRead(item._id);
  }

  markAllRead(): void {
    this.notifCenter.markAllRead();
  }

  localizedParams(item: NotificationItem): Record<string, string | number> {
    return this.notifCenter.localizeParams(item.params || {});
  }

  eventIcon(eventType: NotificationEventType): string {
    const icons: Record<NotificationEventType, string> = {
      booking_confirmation: 'fa-ticket text-green-500',
      cancellation: 'fa-ban text-rose-500',
      schedule_change: 'fa-clock-rotate-left text-amber-500',
      journey_reminder: 'fa-bell text-blue-500',
      promotional_offer: 'fa-tags text-purple-500'
    };
    return icons[eventType] || 'fa-bell';
  }
}
