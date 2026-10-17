import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Camera, Trash2 } from 'lucide';
import { lastValueFrom, tap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AvatarStore } from '../../../core/users/avatar-store.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { requestErrorText } from '../../../shared/utils/request-error-text';
import { AccountApi } from '../account-api.service';

const DEFAULT_POLICY = { available: true, maxBytes: 5 * 1024 * 1024, acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'] };

/**
 * The signed-in user's profile picture: shown large, changed (choose → preview
 * → save, with upload progress) or removed. The browser checks type and size
 * for quick feedback; the API checks the actual file by its content. After a
 * change the profile is refreshed so every avatar — the navbar's included —
 * shows the new picture at once.
 */
@Component({
  selector: 'app-profile-picture-card',
  imports: [TranslatePipe, AlertComponent, AvatarComponent, ButtonDirective, IconComponent],
  templateUrl: './profile-picture-card.component.html',
})
export class ProfilePictureCardComponent {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly avatars = inject(AvatarStore);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly icons = { change: Camera, remove: Trash2 };
  protected readonly user = this.auth.user;
  protected readonly name = computed(() => {
    const user = this.user();
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '';
  });
  protected readonly policy = rxResource({ stream: () => this.api.avatarPolicy() });
  protected readonly limits = computed(() => this.policy.value() ?? DEFAULT_POLICY);
  protected readonly accept = computed(() => this.limits().acceptedTypes.join(','));
  protected readonly maxMb = computed(() => Math.round(this.limits().maxBytes / (1024 * 1024)));
  /** The chosen file and its local preview, until it is saved or dropped. */
  protected readonly chosen = signal<{ file: File; preview: string } | null>(null);
  protected readonly progress = signal<number | null>(null);
  protected readonly hasPicture = computed(() => !!this.user()?.avatarVersion);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dropChoice());
  }

  protected choose(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.actions.error.set(null);
    this.actions.message.set(null);
    if (!this.limits().acceptedTypes.includes(file.type)) return this.actions.error.set(this.i18n.t('server.errors.profilePictureTypeNotAllowed'));
    if (file.size > this.limits().maxBytes) return this.actions.error.set(this.i18n.t('account.picture.tooLarge', { size: this.maxMb() }));
    this.dropChoice();
    this.chosen.set({ file, preview: URL.createObjectURL(file) });
  }

  protected async save(): Promise<void> {
    const chosen = this.chosen();
    if (!chosen || this.actions.busy()) return;
    this.progress.set(0);
    this.actions.busy.set(true);
    this.actions.error.set(null);
    try {
      await lastValueFrom(this.api.uploadAvatar(chosen.file).pipe(tap((step) => this.progress.set(step.progress))));
      await this.applied('account.picture.saved');
    } catch (error) {
      this.actions.error.set(requestErrorText(this.i18n, error, 'picture'));
    } finally {
      this.actions.busy.set(false);
      this.progress.set(null);
    }
  }

  protected cancel(): void {
    this.dropChoice();
    this.actions.error.set(null);
  }

  /** Asks first (what happens, named after the action); the dialog stays busy until the API removed it. */
  protected async remove(): Promise<void> {
    this.actions.error.set(null);
    const removed = await this.confirm.confirm({
      heading: this.i18n.t('account.picture.removeTitle'),
      message: this.i18n.t('account.picture.removeContextual'),
      confirmLabel: this.i18n.t('account.picture.removeAction'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'warning',
      action: () => lastValueFrom(this.api.removeAvatar(), { defaultValue: undefined }),
    });
    if (!removed) return;
    this.actions.busy.set(true);
    try {
      await this.applied('account.picture.removed');
    } catch (error) {
      this.actions.error.set(requestErrorText(this.i18n, error, 'picture'));
    } finally {
      this.actions.busy.set(false);
    }
  }

  /** The profile (and so every avatar) follows the change. */
  private async applied(noticeKey: string): Promise<void> {
    const userId = this.user()?.id;
    if (userId) this.avatars.forget(userId);
    this.dropChoice();
    await this.auth.loadProfile().catch(() => undefined);
    this.actions.message.set(this.i18n.t(noticeKey));
  }

  private dropChoice(): void {
    const chosen = this.chosen();
    if (chosen) URL.revokeObjectURL(chosen.preview);
    this.chosen.set(null);
  }
}
