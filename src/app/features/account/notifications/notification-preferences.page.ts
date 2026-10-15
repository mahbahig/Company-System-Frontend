import { Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi, type CategoryChannels, type NotificationPreferences } from '../account-api.service';

type Channel = 'email' | 'push' | 'whatsapp' | 'digest';
const CHANNELS: Channel[] = ['email', 'push', 'whatsapp', 'digest'];

/**
 * NOTIF-01 per-category channels (in-app is always on), the daily digest,
 * the WhatsApp number, and browser push for this device (NFR-009 PWA).
 * Critical categories cannot be switched off entirely.
 */
@Component({
  selector: 'app-notification-preferences-page',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './notification-preferences.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class NotificationPreferencesPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly channels = CHANNELS;
  protected readonly pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  protected readonly data = rxResource({ stream: () => this.api.preferences() });
  protected readonly matrix = signal<Record<string, CategoryChannels>>({});
  protected readonly digest = signal(true);
  protected readonly whatsapp = signal('');

  constructor() {
    effect(() => {
      const prefs = this.data.value();
      if (prefs) this.load(prefs);
    });
  }

  private load(prefs: NotificationPreferences): void {
    this.matrix.set(Object.fromEntries(prefs.categories.map((row) => [row.category, { ...row.channels }])));
    this.digest.set(prefs.digestEnabled);
    this.whatsapp.set(prefs.whatsappNumber ?? '');
  }

  protected toggle(category: string, channel: Channel, value: boolean): void {
    this.matrix.update((m) => ({ ...m, [category]: { ...m[category], [channel]: value } }));
  }

  protected save(): void {
    void this.actions.run(
      this.api.updatePreferences({ categories: this.matrix(), digestEnabled: this.digest(), whatsappNumber: this.whatsapp().trim() || null }),
      'account.notifications.saved',
      (prefs) => this.data.set(prefs),
    );
  }

  protected async subscribe(publicKey: string): Promise<void> {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.actions.error.set(this.i18n.t('account.notifications.pushDenied'));
        return;
      }
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await this.actions.run(this.api.subscribePush(subscription.toJSON()), 'account.notifications.pushEnabled', () => this.data.reload());
    } catch {
      this.actions.error.set(this.i18n.t('account.notifications.pushFailed'));
    }
  }

  protected async unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await this.actions.run(this.api.unsubscribePush(subscription.endpoint), 'account.notifications.pushDisabled', () => this.data.reload());
    await subscription.unsubscribe();
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
