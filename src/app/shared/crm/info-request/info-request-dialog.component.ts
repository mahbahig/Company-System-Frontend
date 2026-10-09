import { Component, inject, input, model, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../ui/alert/alert.component';
import { ButtonDirective } from '../../ui/button/button.directive';
import { DialogComponent } from '../../ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../ui/form/form.imports';
import { EnumLabelPipe } from '../status-badge/enum-label.pipe';
import { UserSelectComponent } from '../user-select/user-select.component';

/**
 * CPL-03 "Request from…" / PDC-03 request from the customer: asks for the
 * selected missing items and tracks it through a task (`POST /information-requests`).
 */
@Component({
  selector: 'app-info-request-dialog',
  imports: [TranslatePipe, EnumLabelPipe, AlertComponent, ButtonDirective, DialogComponent, UserSelectComponent, ...FORM_IMPORTS],
  template: `
    <app-dialog [(open)]="open" [heading]="'infoRequest.title' | t" [description]="'infoRequest.description' | t">
      <form class="flex flex-col gap-4" (submit)="submit($event)">
        @if (error(); as message) {
          <app-alert variant="destructive">{{ message }}</app-alert>
        }
        <div>
          <p class="text-sm font-medium">{{ 'infoRequest.items' | t }}</p>
          <ul class="mt-1 list-disc ps-5 text-sm">
            @for (item of items(); track item.id) {
              <li>{{ item.label }}</li>
            }
          </ul>
        </div>
        <fieldset class="flex gap-4">
          <legend class="mb-1 text-sm font-medium">{{ 'infoRequest.target' | t }}</legend>
          <label class="flex items-center gap-2 text-sm"><input type="radio" name="target" [checked]="target() === 'user'" (change)="target.set('user')" /> {{ 'infoRequest.targetUser' | t }}</label>
          <label class="flex items-center gap-2 text-sm"><input type="radio" name="target" [checked]="target() === 'customer'" (change)="target.set('customer')" /> {{ 'infoRequest.targetCustomer' | t }}</label>
        </fieldset>
        @if (target() === 'user') {
          <div>
            <label appLabel for="ir-assignee">{{ 'infoRequest.assignee' | t }}</label>
            <app-user-select inputId="ir-assignee" [roles]="roles()" [(value)]="assigneeId" />
            <p class="mt-1 text-xs text-muted-foreground">{{ 'infoRequest.assigneeHint' | t }}</p>
          </div>
        } @else {
          <div>
            <label appLabel for="ir-channel" required>{{ 'infoRequest.channel' | t }}</label>
            <app-select>
              <select appSelect id="ir-channel" [value]="channel()" (change)="channel.set($any($event.target).value)">
                @for (value of channels; track value) {
                  <option [value]="value">{{ value | enum: 'activityChannel' }}</option>
                }
              </select>
            </app-select>
          </div>
          @if (contactId()) {
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="send()" (change)="send.set($any($event.target).checked)" /> {{ 'infoRequest.send' | t }}</label>
          }
        }
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label appLabel for="ir-due">{{ 'infoRequest.dueAt' | t }}</label>
            <input appInput id="ir-due" type="date" dir="ltr" [value]="dueAt()" (change)="dueAt.set($any($event.target).value)" />
          </div>
        </div>
        <div>
          <label appLabel for="ir-note">{{ 'infoRequest.note' | t }}</label>
          <textarea appTextarea id="ir-note" rows="3" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" appButton variant="ghost" (click)="open.set(false)">{{ 'crm.common.cancel' | t }}</button>
          <button type="submit" appButton [disabled]="busy()">{{ 'infoRequest.submit' | t }}</button>
        </div>
      </form>
    </app-dialog>
  `,
})
export class InfoRequestDialogComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  readonly items = input.required<Array<{ id: string; label: string }>>();
  /** Limit the colleague picker to the responsible roles. */
  readonly roles = input<string>();
  /** The customer's contact to address (enables sending). */
  readonly contactId = input<string | null>(null);
  readonly created = output<void>();

  protected readonly channels = ['email', 'whatsapp', 'sms', 'other'];
  protected readonly target = signal<'user' | 'customer'>('user');
  protected readonly assigneeId = signal('');
  protected readonly channel = signal('email');
  protected readonly send = signal(false);
  protected readonly note = signal('');
  protected readonly dueAt = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.post('information-requests', {
          entityType: this.entityType(),
          entityId: this.entityId(),
          items: this.items(),
          target: this.target(),
          assigneeId: this.target() === 'user' ? this.assigneeId() || undefined : undefined,
          contactId: this.target() === 'customer' ? this.contactId() || undefined : undefined,
          channel: this.target() === 'customer' ? this.channel() : undefined,
          send: this.target() === 'customer' ? this.send() : undefined,
          note: this.note().trim() || undefined,
          dueAt: this.dueAt() ? new Date(`${this.dueAt()}T17:00:00`).toISOString() : undefined,
        }),
      );
      this.open.set(false);
      this.note.set('');
      this.created.emit();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}
