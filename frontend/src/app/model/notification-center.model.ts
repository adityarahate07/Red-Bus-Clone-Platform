export type NotificationEventType =
  | 'booking_confirmation'
  | 'cancellation'
  | 'schedule_change'
  | 'journey_reminder'
  | 'promotional_offer';

export type NotificationChannelType = 'in_app' | 'email' | 'push';

export type DeliveryStatus = 'Sent' | 'Delivered' | 'Failed';

export interface ChannelDelivery {
  channel: NotificationChannelType;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt: string;
  error?: string;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  eventType: NotificationEventType;
  titleKey: string;
  messageKey: string;
  params: Record<string, string | number>;
  channels: ChannelDelivery[];
  language: 'en' | 'hi' | 'mr';
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
  promotionalOptIn: boolean;
}
