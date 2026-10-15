import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { ActivitiesApi, refLabel, type Activity } from '../activities-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

const CHANNELS = ['whatsapp', 'sms', 'email', 'social', 'customer_request', 'follow_up', 'note', 'other'];

/**
 * ACT-01..03 general interaction log (WhatsApp, SMS, e-mail, notes...). Each
 * entry links to a customer, lead or opportunity; a next action creates a
 * follow-up task.
 */
@Component({
  selector: 'app-activity-log-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, RecordPickerComponent, DialogComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './activity-log.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ActivityLogPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly channels = CHANNELS;

  readonly q = input<string>();
  readonly channel = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({ params: () => ({ q: this.q(), channel: this.channel(), page: this.page() }), stream: ({ params }) => this.api.activities(params) });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'channel', label: this.i18n.t('act.fields.channel'), options: CHANNELS.map((value) => ({ value, label: this.i18n.t(`enums.activityChannel.${value}`) })), value: this.channel() ?? '' },
  ]);

  protected readonly dialogOpen = signal(false);
  protected readonly customer = signal('');
  protected readonly lead = signal('');
  protected readonly opportunity = signal('');
  protected readonly form = signal(this.blank());

  private blank() {
    return { channel: 'whatsapp', direction: 'outbound', occurredAt: '', subject: '', body: '', nextAction: '', nextActionAt: '' };
  }

  protected set(key: string, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected withLabel(row: Activity): string {
    const pick = (ar?: string | null, en?: string | null) => this.i18n.pick(ar, en);
    return refLabel(pick, row.customerId) || refLabel(pick, row.leadId) || refLabel(pick, row.opportunityId) || '—';
  }

  protected owner(row: Activity): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.ownerId);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.createActivity({
        channel: f.channel,
        direction: f.direction,
        customerId: this.customer() || undefined,
        leadId: this.lead() || undefined,
        opportunityId: this.opportunity() || undefined,
        occurredAt: f.occurredAt ? new Date(f.occurredAt).toISOString() : undefined,
        subject: f.subject || undefined,
        body: f.body || undefined,
        nextAction: f.nextAction || undefined,
        nextActionAt: f.nextActionAt ? new Date(f.nextActionAt).toISOString() : undefined,
      }),
      'act.log.saved',
      () => {
        this.dialogOpen.set(false);
        this.form.set(this.blank());
        this.customer.set('');
        this.lead.set('');
        this.opportunity.set('');
        this.result.reload();
      },
    );
  }
}
