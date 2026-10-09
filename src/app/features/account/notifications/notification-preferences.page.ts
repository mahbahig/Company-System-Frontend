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
  template: `
    <app-page-header [heading]="'account.notifications.title' | t" [subtitle]="'account.notifications.subtitle' | t" class="!mb-0" />
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    @if (data.value(); as prefs) {
      <section appCard aria-labelledby="np-general">
        <div appCardHeader><h2 appCardTitle id="np-general">{{ 'account.notifications.general' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="digest()" (change)="digest.set($any($event.target).checked)" /> {{ 'account.notifications.digest' | t }}</label>
          <div>
            <label appLabel for="np-wa">{{ 'account.notifications.whatsappNumber' | t }}</label>
            <input appInput id="np-wa" type="tel" dir="ltr" [value]="whatsapp()" (input)="whatsapp.set($any($event.target).value)" />
            @if (!prefs.channelsAvailable.whatsapp) {
              <p class="mt-1 text-xs text-muted-foreground">{{ 'account.notifications.whatsappOff' | t }}</p>
            }
          </div>
          <div class="flex flex-col gap-2 sm:col-span-2">
            <p class="text-sm font-medium">{{ 'account.notifications.pushTitle' | t }}</p>
            @if (!pushSupported) {
              <p class="text-sm text-muted-foreground">{{ 'account.notifications.pushUnsupported' | t }}</p>
            } @else if (!prefs.channelsAvailable.push || !prefs.channelsAvailable.vapidPublicKey) {
              <p class="text-sm text-muted-foreground">{{ 'account.notifications.pushOff' | t }}</p>
            } @else {
              <p class="text-sm text-muted-foreground">{{ 'account.notifications.pushDevices' | t: { count: prefs.pushSubscriptions } }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy()" (click)="subscribe(prefs.channelsAvailable.vapidPublicKey)">{{ 'account.notifications.pushEnable' | t }}</button>
                <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="unsubscribe()">{{ 'account.notifications.pushDisable' | t }}</button>
              </div>
            }
          </div>
        </div>
      </section>

      <app-table-wrapper [label]="'account.notifications.categories' | t">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'account.notifications.category' | t }}</th>
              @for (channel of channels; track channel) {
                <th appTableHead class="text-center">{{ 'account.notifications.channels.' + channel | t }}</th>
              }
            </tr>
          </thead>
          <tbody appTableBody>
            @for (row of prefs.categories; track row.category) {
              <tr appTableRow>
                <td appTableCell>
                  {{ i18n.pick(row.titleAr, row.titleEn) }}
                  @if (row.critical) {
                    <span class="ms-1 text-xs text-destructive">{{ 'account.notifications.critical' | t }}</span>
                  }
                </td>
                @for (channel of channels; track channel) {
                  <td appTableCell class="text-center">
                    <input
                      type="checkbox"
                      [attr.aria-label]="i18n.pick(row.titleAr, row.titleEn) + ' — ' + ('account.notifications.channels.' + channel | t)"
                      [checked]="!!matrix()[row.category]?.[channel]"
                      (change)="toggle(row.category, channel, $any($event.target).checked)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
      <button type="button" appButton class="self-start" [disabled]="actions.busy()" (click)="save()">{{ 'crm.common.save' | t }}</button>
    }
  `,
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
