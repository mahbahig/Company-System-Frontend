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
  templateUrl: './info-request-dialog.component.html',
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
