import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { url } from '../config';
import {
  ChannelDelivery,
  NotificationChannelType,
  NotificationEventType,
  NotificationItem,
  NotificationPreferences
} from '../model/notification-center.model';
import { NotificationService } from './notification.service';
import { TranslationService } from './translation.service';
import { UserSessionService } from './user-session.service';

const NOTIFS_STORAGE_KEY = 'tedbus_notifications_log';
const PREFS_STORAGE_KEY = 'tedbus_notification_prefs';

const DEFAULT_PREFS: NotificationPreferences = {
  inApp: true,
  email: true,
  push: true,
  promotionalOptIn: true
};

@Injectable({
  providedIn: 'root'
})
export class NotificationCenterService {
  private readonly apiBase = `${url}notifications`;

  private readonly notificationsSubject = new BehaviorSubject<NotificationItem[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  private readonly preferencesSubject = new BehaviorSubject<NotificationPreferences>({
    ...DEFAULT_PREFS
  });
  readonly preferences$ = this.preferencesSubject.asObservable();

  readonly unreadCount$: Observable<number> = this.notifications$.pipe(
    map((items) => items.filter((n) => !n.read).length)
  );

  constructor(
    private http: HttpClient,
    private toastService: NotificationService,
    private translationService: TranslationService,
    private userSession: UserSessionService
  ) {
    this.loadPreferences();
    this.ensureSeedNotifications();
    this.syncFromBackend();

    this.userSession.currentUser$.subscribe(() => {
      this.loadPreferences();
      this.syncFromBackend();
    });
  }

  get activeUserId(): string {
    return this.userSession.currentUser?._id || 'guest-traveler';
  }

  get preferences(): NotificationPreferences {
    return this.preferencesSubject.value;
  }

  get notifications(): NotificationItem[] {
    return this.notificationsSubject.value;
  }

  syncFromBackend(): void {
    const userId = this.activeUserId;
    this.http.get<any>(`${this.apiBase}/user/${userId}`).pipe(
      catchError(() => of(null))
    ).subscribe((res) => {
      if (res?.notifications && Array.isArray(res.notifications) && res.notifications.length > 0) {
        const merged = this.mergeNotifications(res.notifications, this.readLocalNotifications());
        this.writeLocalNotifications(merged);
        this.notificationsSubject.next(merged);
      } else {
        this.notificationsSubject.next(this.readLocalNotifications());
      }
      if (res?.preferences) {
        const mergedPrefs = { ...DEFAULT_PREFS, ...res.preferences };
        this.preferencesSubject.next(mergedPrefs);
        this.writeLocalPreferences(mergedPrefs);
      }
    });
  }

  updatePreferences(prefs: NotificationPreferences): void {
    const normalized: NotificationPreferences = {
      inApp: !!prefs.inApp,
      email: !!prefs.email,
      push: !!prefs.push,
      promotionalOptIn: !!prefs.promotionalOptIn
    };
    this.preferencesSubject.next(normalized);
    this.writeLocalPreferences(normalized);

    this.http
      .put<NotificationPreferences>(`${this.apiBase}/preferences/${this.activeUserId}`, normalized)
      .pipe(catchError(() => of(normalized)))
      .subscribe();

    this.toastService.show('notifCenter.prefsSaved', 'success', undefined, 2200);
  }

  dispatchEvent(
    eventType: NotificationEventType,
    params: Record<string, string | number>,
    options?: { simulateFailure?: boolean }
  ): NotificationItem | null {
    const prefs = this.preferences;

    if (eventType === 'promotional_offer' && !prefs.promotionalOptIn) {
      this.toastService.show('notifCenter.promoOptedOut', 'info', undefined, 3000);
      return null;
    }

    const enabledChannels: NotificationChannelType[] = [];
    if (prefs.inApp) enabledChannels.push('in_app');
    if (prefs.email) enabledChannels.push('email');
    if (prefs.push) enabledChannels.push('push');

    if (enabledChannels.length === 0) {
      this.toastService.show('notifCenter.noChannelsEnabled', 'warning', undefined, 3000);
      return null;
    }

    const nowIso = new Date().toISOString();
    const channels: ChannelDelivery[] = enabledChannels.map((ch) => {
      const shouldFail =
        !!options?.simulateFailure && (ch === 'email' || ch === 'push');
      return {
        channel: ch,
        status: shouldFail ? 'Failed' : ch === 'in_app' ? 'Delivered' : 'Sent',
        attempts: 1,
        lastAttemptAt: nowIso,
        error: shouldFail ? 'Gateway timeout — retry required' : ''
      };
    });

    const titleKey = `notifCenter.templates.${eventType}_title`;
    const messageKey = `notifCenter.templates.${eventType}_msg`;

    const item: NotificationItem = {
      _id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: this.activeUserId,
      eventType,
      titleKey,
      messageKey,
      params,
      channels,
      language: this.translationService.currentLang,
      read: false,
      createdAt: nowIso
    };

    const updatedList = [item, ...this.readLocalNotifications()];
    this.writeLocalNotifications(updatedList);
    this.notificationsSubject.next(updatedList);

    // Show real-time localized In-App toast if In-App channel is active
    if (prefs.inApp) {
      const toastType =
        eventType === 'cancellation'
          ? 'warning'
          : eventType === 'booking_confirmation'
            ? 'success'
            : 'info';
      this.toastService.show(messageKey, toastType, this.localizeParams(params), 4500);
    }

    // Persist to backend if available
    this.http
      .post<NotificationItem>(this.apiBase, item)
      .pipe(catchError(() => of(null)))
      .subscribe((saved) => {
        if (saved?._id && saved._id !== item._id) {
          const list = this.readLocalNotifications().map((n) =>
            n._id === item._id ? { ...n, _id: saved._id } : n
          );
          this.writeLocalNotifications(list);
          this.notificationsSubject.next(list);
        }
      });

    // Simulate async transition from 'Sent' -> 'Delivered' for non-failing Email/Push channels
    if (channels.some((c) => c.status === 'Sent')) {
      setTimeout(() => {
        const list = this.readLocalNotifications();
        const target = list.find((n) => n._id === item._id);
        if (target) {
          let changed = false;
          target.channels.forEach((c) => {
            if (c.status === 'Sent') {
              c.status = 'Delivered';
              c.lastAttemptAt = new Date().toISOString();
              changed = true;
            }
          });
          if (changed) {
            this.writeLocalNotifications(list);
            this.notificationsSubject.next([...list]);
          }
        }
      }, 1500);
    }

    return item;
  }

  retryDelivery(notificationId: string, channel?: NotificationChannelType): void {
    const list = this.readLocalNotifications();
    const target = list.find((n) => n._id === notificationId);
    if (!target) {
      return;
    }

    target.channels.forEach((ch) => {
      if (ch.status === 'Failed' && (!channel || ch.channel === channel)) {
        ch.status = 'Sent';
        ch.attempts = (ch.attempts || 1) + 1;
        ch.lastAttemptAt = new Date().toISOString();
        ch.error = '';
      }
    });
    this.writeLocalNotifications(list);
    this.notificationsSubject.next([...list]);

    this.http
      .post<NotificationItem>(`${this.apiBase}/${notificationId}/retry`, { channel })
      .pipe(catchError(() => of(null)))
      .subscribe();

    setTimeout(() => {
      const latest = this.readLocalNotifications();
      const item = latest.find((n) => n._id === notificationId);
      if (item) {
        item.channels.forEach((ch) => {
          if (ch.status === 'Sent' && (!channel || ch.channel === channel)) {
            ch.status = 'Delivered';
            ch.lastAttemptAt = new Date().toISOString();
          }
        });
        this.writeLocalNotifications(latest);
        this.notificationsSubject.next([...latest]);
        this.toastService.show('notifCenter.retrySuccess', 'success', undefined, 2500);
      }
    }, 650);
  }

  markRead(notificationId: string): void {
    const list = this.readLocalNotifications();
    const target = list.find((n) => n._id === notificationId);
    if (target && !target.read) {
      target.read = true;
      this.writeLocalNotifications(list);
      this.notificationsSubject.next([...list]);
      this.http
        .patch(`${this.apiBase}/${notificationId}/read`, {})
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  markAllRead(): void {
    const list = this.readLocalNotifications().map((n) => ({ ...n, read: true }));
    this.writeLocalNotifications(list);
    this.notificationsSubject.next(list);
    this.http
      .patch(`${this.apiBase}/user/${this.activeUserId}/read-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  localizeParams(params: Record<string, string | number>): Record<string, string | number> {
    const out: Record<string, string | number> = { ...params };
    if (typeof out['from'] === 'string') {
      out['from'] = this.translationService.translateCity(out['from']);
    }
    if (typeof out['to'] === 'string') {
      out['to'] = this.translationService.translateCity(out['to']);
    }
    return out;
  }

  private loadPreferences(): void {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        this.preferencesSubject.next({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        return;
      }
    } catch {
      // Fallback
    }
    this.preferencesSubject.next({ ...DEFAULT_PREFS });
  }

  private writeLocalPreferences(prefs: NotificationPreferences): void {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  }

  private readLocalNotifications(): NotificationItem[] {
    try {
      const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
      const parsed: NotificationItem[] = raw ? JSON.parse(raw) : [];
      return parsed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  private writeLocalNotifications(items: NotificationItem[]): void {
    try {
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }

  private mergeNotifications(
    serverList: NotificationItem[],
    localList: NotificationItem[]
  ): NotificationItem[] {
    const mapById = new Map<string, NotificationItem>();
    localList.forEach((n) => mapById.set(n._id, n));
    serverList.forEach((n) => mapById.set(n._id, n));
    return Array.from(mapById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private ensureSeedNotifications(): void {
    if (this.readLocalNotifications().length > 0) {
      this.notificationsSubject.next(this.readLocalNotifications());
      return;
    }

    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

    const seeds: NotificationItem[] = [
      {
        _id: 'seed-ntf-1',
        userId: 'demo-user-aarav',
        eventType: 'booking_confirmation',
        titleKey: 'notifCenter.templates.booking_confirmation_title',
        messageKey: 'notifCenter.templates.booking_confirmation_msg',
        params: {
          from: 'Delhi',
          to: 'Jaipur',
          date: '2026-11-22',
          operator: 'TravelXpress',
          fare: 625
        },
        channels: [
          { channel: 'in_app', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(4) },
          { channel: 'email', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(4) },
          { channel: 'push', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(4) }
        ],
        language: 'en',
        read: false,
        createdAt: hoursAgo(4)
      },
      {
        _id: 'seed-ntf-2',
        userId: 'demo-user-aarav',
        eventType: 'schedule_change',
        titleKey: 'notifCenter.templates.schedule_change_title',
        messageKey: 'notifCenter.templates.schedule_change_msg',
        params: {
          from: 'Mumbai',
          to: 'Goa',
          operator: 'FastTransit',
          delay: 20,
          newTime: '21:20'
        },
        channels: [
          { channel: 'in_app', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(2) },
          {
            channel: 'email',
            status: 'Failed',
            attempts: 1,
            lastAttemptAt: hoursAgo(2),
            error: 'SMTP relay timeout'
          },
          { channel: 'push', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(2) }
        ],
        language: 'en',
        read: false,
        createdAt: hoursAgo(2)
      },
      {
        _id: 'seed-ntf-3',
        userId: 'demo-user-aarav',
        eventType: 'promotional_offer',
        titleKey: 'notifCenter.templates.promotional_offer_title',
        messageKey: 'notifCenter.templates.promotional_offer_msg',
        params: { code: 'BUS300', discount: 300 },
        channels: [
          { channel: 'in_app', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(12) },
          { channel: 'push', status: 'Delivered', attempts: 1, lastAttemptAt: hoursAgo(12) }
        ],
        language: 'en',
        read: true,
        createdAt: hoursAgo(12)
      }
    ];

    this.writeLocalNotifications(seeds);
    this.notificationsSubject.next(seeds);
  }
}
