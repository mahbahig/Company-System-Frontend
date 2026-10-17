import { Component, computed, inject, model, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ChatApi } from '../../../core/chat/chat-api.service';
import { ChatStore } from '../../../core/chat/chat-store.service';
import { GROUP_NAME_MAX_LENGTH, MIN_GROUP_MEMBERS, type ChatDirectoryPerson, summaryOf } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { PeoplePickerComponent } from '../shared/people-picker.component';

/** "+ New message": pick a colleague; the existing conversation with them opens, or a new one. */
@Component({
  selector: 'app-new-chat-dialog',
  imports: [TranslatePipe, AlertComponent, DialogComponent, PeoplePickerComponent],
  template: `
    <app-dialog [(open)]="open" [heading]="'chat.newMessage' | t" [description]="'chat.newMessageHint' | t">
      @if (actions.error(); as text) {
        <app-alert variant="destructive" class="mb-3">{{ text }}</app-alert>
      }
      <app-people-picker (pick)="start($event)" />
    </app-dialog>
  `,
})
export class NewChatDialogComponent {
  private readonly api = inject(ChatApi);
  private readonly store = inject(ChatStore);
  private readonly router = inject(Router);
  protected readonly actions = new ActionRunner(inject(I18nService));

  readonly open = model(false);

  protected async start(person: ChatDirectoryPerson): Promise<void> {
    if (this.actions.busy()) return;
    const chat = await this.actions.run(this.api.openPrivate(person.id), null);
    if (!chat) return;
    this.store.upsert(summaryOf(chat));
    this.open.set(false);
    void this.router.navigate(['/', 'chat', chat.id]);
  }
}

/**
 * "+ New group": the name the creator types (required, marked with the red
 * asterisk; trimmed, so blank is empty — nothing generated) and at least two
 * colleagues, so the group has three members with its creator, who becomes
 * its admin. The API checks it all again (the same rules: required, trimmed,
 * at most 80 characters).
 */
@Component({
  selector: 'app-new-group-dialog',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, CreateIconComponent, DialogComponent, PeoplePickerComponent, ...FORM_IMPORTS],
  template: `
    <app-dialog [(open)]="open" [heading]="'chat.newGroup' | t" [description]="'chat.newGroupHint' | t" [dirty]="dirty">
      <form class="flex flex-col gap-4" novalidate (submit)="create($event)">
        <div>
          <label appLabel for="group-name" required>{{ 'chat.groupName' | t }}</label>
          <input
            appInput
            id="group-name"
            data-testid="group-name"
            autocomplete="off"
            required
            aria-required="true"
            [maxLength]="nameMax"
            [value]="name()"
            [attr.aria-invalid]="!!nameError()"
            [attr.aria-describedby]="nameError() ? 'group-name-error' : null"
            (input)="name.set($any($event.target).value)"
            (blur)="touched.set(true)"
          />
          @if (nameError(); as key) {
            <p id="group-name-error" class="mt-1 text-xs text-destructive-tint">{{ key | t }}</p>
          }
        </div>
        <div>
          <p class="mb-2 text-sm font-medium">{{ 'chat.groupMembers' | t }}</p>
          <app-people-picker [multiple]="true" [groupsOnly]="true" [(selected)]="members" />
          <p class="mt-2 text-xs" [class.text-muted-foreground]="enough()" [class.text-warning-tint]="!enough()">
            {{ 'chat.groupMinimum' | t: { count: members().length + 1, minimum: minimum } }}
          </p>
        </div>
        @if (actions.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" appButton variant="outline" (click)="open.set(false)">{{ 'common.actions.cancel' | t }}</button>
          <button type="submit" appButton data-testid="create-group" [disabled]="!valid() || actions.busy()">
            <app-create-icon />{{ (actions.busy() ? 'chat.creatingGroup' : 'chat.createGroup') | t }}
          </button>
        </div>
      </form>
    </app-dialog>
  `,
})
export class NewGroupDialogComponent {
  private readonly api = inject(ChatApi);
  private readonly store = inject(ChatStore);
  private readonly router = inject(Router);
  protected readonly actions = new ActionRunner(inject(I18nService));

  readonly open = model(false);
  protected readonly nameMax = GROUP_NAME_MAX_LENGTH;
  protected readonly minimum = MIN_GROUP_MEMBERS;
  protected readonly name = signal('');
  protected readonly members = signal<ChatDirectoryPerson[]>([]);
  /** Left the name field (or tried to create): an empty or blank name is then reported. */
  protected readonly touched = signal(false);
  protected readonly enough = computed(() => this.members().length + 1 >= MIN_GROUP_MEMBERS);
  protected readonly nameError = computed(() => (this.touched() && !this.name().trim() ? 'chat.groupNameRequired' : (this.actions.fieldErrors()['name'] ?? null)));
  protected readonly valid = computed(() => !!this.name().trim() && this.enough());
  protected readonly dirty = () => !!this.name().trim() || this.members().length > 0;

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.touched.set(true);
    if (!this.valid() || this.actions.busy()) return;
    const chat = await this.actions.run(
      this.api.createGroup(
        this.name().trim(),
        this.members().map((person) => person.id),
      ),
      null,
    );
    if (!chat) return;
    this.store.upsert(summaryOf(chat));
    this.name.set('');
    this.members.set([]);
    this.touched.set(false);
    this.open.set(false);
    void this.router.navigate(['/', 'chat', chat.id]);
  }
}
