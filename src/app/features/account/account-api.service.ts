import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';

export interface CategoryChannels {
  inApp?: boolean;
  email?: boolean;
  push?: boolean;
  whatsapp?: boolean;
  digest?: boolean;
}

export interface NotificationPreferences {
  digestEnabled: boolean;
  whatsappNumber: string | null;
  pushSubscriptions: number;
  channelsAvailable: { email: boolean; whatsapp: boolean; push: boolean; vapidPublicKey: string | null };
  categories: Array<{ category: string; titleAr: string; titleEn: string; critical: boolean; channels: CategoryChannels }>;
}

/** Self-service account endpoints (AUTH-02, AUTH-06, NOTIF-01, NFR-009). */
@Service()
export class AccountApi {
  private readonly api = inject(ApiService);

  changePassword(body: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<void> {
    return this.api.patch('auth/change-password', body);
  }
  forgotPassword(email: string, locale: string): Observable<void> {
    return this.api.post('auth/forgot-password', { email, locale });
  }
  resetPassword(body: { token: string; newPassword: string; confirmPassword: string }): Observable<void> {
    return this.api.post('auth/reset-password', body);
  }
  setupMfa(): Observable<{ secret: string; otpauthUrl: string }> {
    return this.api.post('auth/mfa/setup');
  }
  enableMfa(code: string): Observable<{ recoveryCodes: string[] }> {
    return this.api.post('auth/mfa/enable', { code });
  }
  disableMfa(password: string, code: string): Observable<void> {
    return this.api.post('auth/mfa/disable', { password, code });
  }

  preferences(): Observable<NotificationPreferences> {
    return this.api.get('notifications/preferences');
  }
  updatePreferences(body: { categories?: Record<string, CategoryChannels>; digestEnabled?: boolean; whatsappNumber?: string | null }): Observable<NotificationPreferences> {
    return this.api.put('notifications/preferences', body);
  }
  subscribePush(subscription: PushSubscriptionJSON): Observable<{ subscribed: boolean }> {
    return this.api.post('notifications/push/subscriptions', subscription);
  }
  unsubscribePush(endpoint: string): Observable<{ subscribed: boolean }> {
    return this.api.delete('notifications/push/subscriptions', { endpoint });
  }
}
