import { Service, inject } from '@angular/core';
import { map, tap, type Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { UploadProgress } from '../../core/api/upload-progress.interface';
import { AuthService } from '../../core/auth/auth.service';
import type { AuthTokens } from '../../core/auth/models/auth-tokens.interface';
import type { MfaCodeSent } from '../../core/auth/models/mfa-challenge.interface';
import type { UserSession } from '../../shared/crm/session-list/user-session.interface';

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

/** Self-service account endpoints (AUTH-02, AUTH-03, AUTH-06, NOTIF-01, NFR-009). */
@Service()
export class AccountApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /**
   * Every other session of the user ends; this one stays signed in with new
   * credentials — the access token answered here (adopted at once: the old
   * one stops working), the refresh cookie replaced by the API.
   */
  changePassword(body: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<void> {
    return this.api.patch<AuthTokens>('auth/change-password', body).pipe(
      tap(({ accessToken }) => this.auth.adoptAccessToken(accessToken)),
      map(() => undefined),
    );
  }
  /** The signed-in user's own sessions, the current one first. */
  sessions(): Observable<UserSession[]> {
    return this.api.get('auth/sessions');
  }
  /** Ends one of the user's OTHER sessions (the API refuses the current one). */
  revokeSession(id: string): Observable<void> {
    return this.api.delete(`auth/sessions/${encodeURIComponent(id)}`);
  }
  forgotPassword(email: string, locale: string): Observable<void> {
    return this.api.post('auth/forgot-password', { email, locale });
  }
  resetPassword(body: { token: string; newPassword: string; confirmPassword: string }): Observable<void> {
    return this.api.post('auth/reset-password', body);
  }
  /** Two-factor sign-in on, step 1: a code is e-mailed to the account's own address. */
  requestMfaEnable(): Observable<MfaCodeSent> {
    return this.api.post('auth/mfa/enable/request');
  }
  resendMfaEnable(): Observable<MfaCodeSent> {
    return this.api.post('auth/mfa/enable/resend');
  }
  /** Step 2: the e-mailed code switches it on. */
  confirmMfaEnable(code: string): Observable<void> {
    return this.api.post('auth/mfa/enable/confirm', { code });
  }
  /** Off, confirmed with the current password. */
  disableMfa(password: string): Observable<void> {
    return this.api.post('auth/mfa/disable', { password });
  }

  /** What the profile-picture upload accepts here (and whether pictures can be stored at all). */
  avatarPolicy(): Observable<{ available: boolean; maxBytes: number; acceptedTypes: string[] }> {
    return this.api.get('auth/me/avatar/policy');
  }
  /** Replaces the signed-in user's own picture (never anyone else's — the API takes the user from the token). */
  uploadAvatar(file: File): Observable<UploadProgress<{ avatarVersion: string }>> {
    const body = new FormData();
    body.append('picture', file, file.name);
    return this.api.uploadWithProgress('auth/me/avatar', body, 'PUT');
  }
  removeAvatar(): Observable<void> {
    return this.api.delete('auth/me/avatar');
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
