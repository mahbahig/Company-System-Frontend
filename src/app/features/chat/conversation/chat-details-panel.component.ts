import { Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Lock, ShieldCheck, UserMinus, X } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { ChatApi } from '../../../core/chat/chat-api.service';
import { GROUP_NAME_MAX_LENGTH, MIN_GROUP_MEMBERS, type ChatDetails, type ChatDirectoryPerson, type ChatMember } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { PeoplePickerComponent } from '../shared/people-picker.component';
import { chatTitle } from '../shared/chat-display';

/**
 * Who is in the conversation and what its admins can change — the controls
 * appear only when the API says this member may use them
 * (`capabilities`), and the API re-checks every one: add and remove people
 * (never below three), make or unmake admins, rename, admin-only messaging.
 * Team chats follow their team (no manual members); private chats and the
 * company chat have nothing to administer.
 */
@Component({
  selector: 'app-chat-details-panel',
  imports: [TranslatePipe, AlertComponent, AvatarComponent, BadgeComponent, ButtonDirective, CreateIconComponent, DialogComponent, IconComponent, PeoplePickerComponent, ...FORM_IMPORTS],
  templateUrl: './chat-details-panel.component.html',
  host: { class: 'flex min-h-0 flex-col' },
})
export class ChatDetailsPanelComponent {
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly details = input.required<ChatDetails>();
  /** The details after a change (the conversation keeps them). */
  readonly changed = output<ChatDetails>();
  readonly closed = output<void>();

  protected readonly icons = { close: X, lock: Lock, admin: ShieldCheck, remove: UserMinus };
  protected readonly nameMax = GROUP_NAME_MAX_LENGTH;
  protected readonly renaming = signal(false);
  protected readonly newName = signal('');
  protected readonly adding = signal(false);
  protected readonly toAdd = signal<ChatDirectoryPerson[]>([]);
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly title = computed(() => chatTitle(this.details(), this.i18n));
  protected readonly atMinimum = computed(() => this.details().memberCount <= MIN_GROUP_MEMBERS);
  protected readonly memberIds = computed(() => this.details().members.map((member) => member.id));
  protected readonly sortedMembers = computed(() =>
    [...this.details().members].sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin') || this.name(a).localeCompare(this.name(b))),
  );

  protected name(member: ChatMember): string {
    return this.i18n.pick(member.nameAr, member.nameEn);
  }

  protected startRename(): void {
    this.newName.set(this.details().name ?? '');
    this.renaming.set(true);
  }

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name || this.actions.busy()) return;
    const updated = await this.actions.run(this.api.update(this.details().id, { name }), 'chat.details.renamed');
    if (updated) {
      this.renaming.set(false);
      this.changed.emit(updated);
    }
  }

  protected async toggleAdminOnly(): Promise<void> {
    const enable = !this.details().adminOnly;
    await this.confirm.confirm({
      heading: this.i18n.t(enable ? 'chat.details.adminOnlyOnTitle' : 'chat.details.adminOnlyOffTitle', { name: this.title() }),
      message: this.i18n.t(enable ? 'chat.details.adminOnlyOnBody' : 'chat.details.adminOnlyOffBody'),
      confirmLabel: this.i18n.t(enable ? 'chat.details.adminOnlyOn' : 'chat.details.adminOnlyOff'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      variant: enable ? 'warning' : 'default',
      action: async () => this.changed.emit(await firstValueFrom(this.api.update(this.details().id, { adminOnly: enable }))),
    });
  }

  protected async addPeople(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.toAdd().length || this.actions.busy()) return;
    const updated = await this.actions.run(
      this.api.addMembers(
        this.details().id,
        this.toAdd().map((person) => person.id),
      ),
      'chat.details.membersAdded',
    );
    if (updated) {
      this.adding.set(false);
      this.toAdd.set([]);
      this.changed.emit(updated);
    }
  }

  protected async remove(member: ChatMember): Promise<void> {
    await this.confirm.confirm({
      heading: this.i18n.t('chat.details.removeTitle', { name: this.name(member), group: this.title() }),
      message: this.i18n.t('chat.details.removeBody'),
      confirmLabel: this.i18n.t('chat.details.removeMember'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      variant: 'danger',
      action: async () => this.changed.emit(await firstValueFrom(this.api.removeMember(this.details().id, member.id))),
    });
  }

  protected async setRole(member: ChatMember, role: 'admin' | 'member'): Promise<void> {
    await this.confirm.confirm({
      heading: this.i18n.t(role === 'admin' ? 'chat.details.makeAdminTitle' : 'chat.details.removeAdminTitle', { name: this.name(member) }),
      message: this.i18n.t(role === 'admin' ? 'chat.details.makeAdminBody' : 'chat.details.removeAdminBody'),
      confirmLabel: this.i18n.t(role === 'admin' ? 'chat.details.makeAdmin' : 'chat.details.removeAdmin'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      action: async () => this.changed.emit(await firstValueFrom(this.api.changeRole(this.details().id, member.id, role))),
    });
  }
}
