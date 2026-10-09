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

const CHANNELS = ['whatsapp', 'sms', 'email', 'social', 'customer_request', 'follow_up', 'note', 'other'];

/**
 * ACT-01..03 general interaction log (WhatsApp, SMS, e-mail, notes...). Each
 * entry links to a customer, lead or opportunity; a next action creates a
 * follow-up task.
 */
@Component({
  selector: 'app-activity-log-page',
  imports: [TranslatePipe, EnumLabelPipe, RecordPickerComponent, DialogComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'act.log.title' | t" [subtitle]="'act.log.subtitle' | t" class="!mb-0">
      @if (auth.can('activities.create')) {
        <button type="button" appButton (click)="dialogOpen.set(true)">{{ 'act.log.new' | t }}</button>
      }
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'act.log.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'act.columns.when' | t }}</th>
            <th appTableHead>{{ 'act.fields.channel' | t }}</th>
            <th appTableHead>{{ 'act.columns.with' | t }}</th>
            <th appTableHead>{{ 'act.fields.subject' | t }}</th>
            <th appTableHead>{{ 'act.fields.nextAction' | t }}</th>
            <th appTableHead>{{ 'act.columns.owner' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.occurredAt, true) }}</td>
              <td appTableCell>{{ row.channel | enum: 'activityChannel' }} · {{ row.direction | enum: 'callDirection' }}</td>
              <td appTableCell>{{ withLabel(row) }}</td>
              <td appTableCell>
                <span class="font-medium">{{ row.subject || '—' }}</span>
                @if (row.body) {
                  <span class="block max-w-md truncate text-xs text-muted-foreground">{{ row.body }}</span>
                }
              </td>
              <td appTableCell>
                {{ row.nextAction || '—' }}
                @if (row.nextActionAt) {
                  <span class="block text-xs tabular text-muted-foreground">{{ i18n.formatDate(row.nextActionAt) }}</span>
                }
              </td>
              <td appTableCell>{{ owner(row) }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="6">{{ (result.isLoading() ? 'common.labels.loading' : 'act.empty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (result.hasValue()) {
      <app-pagination [page]="result.value().page" [pageCount]="result.value().pageCount" [total]="result.value().total" [pageSize]="result.value().pageSize" />
    }

    <app-dialog [(open)]="dialogOpen" [heading]="'act.log.new' | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="al-channel" required>{{ 'act.fields.channel' | t }}</label>
          <app-select>
            <select appSelect id="al-channel" [value]="form().channel" (change)="set('channel', $any($event.target).value)">
              @for (channel of channels; track channel) {
                <option [value]="channel">{{ channel | enum: 'activityChannel' }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="al-direction">{{ 'act.columns.direction' | t }}</label>
          <app-select>
            <select appSelect id="al-direction" [value]="form().direction" (change)="set('direction', $any($event.target).value)">
              <option value="outbound">{{ 'outbound' | enum: 'callDirection' }}</option>
              <option value="inbound">{{ 'inbound' | enum: 'callDirection' }}</option>
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="al-customer">{{ 'act.fields.customer' | t }}</label>
          <app-record-picker kind="customer" inputId="al-customer" [(value)]="customer" />
        </div>
        <div>
          <label appLabel for="al-lead">{{ 'act.fields.lead' | t }}</label>
          <app-record-picker kind="lead" inputId="al-lead" [(value)]="lead" />
        </div>
        <div>
          <label appLabel for="al-opp">{{ 'act.fields.opportunity' | t }}</label>
          <app-record-picker kind="opportunity" inputId="al-opp" [parentId]="customer() || undefined" [(value)]="opportunity" />
        </div>
        <div>
          <label appLabel for="al-at">{{ 'act.columns.when' | t }}</label>
          <input appInput id="al-at" type="datetime-local" dir="ltr" [value]="form().occurredAt" (change)="set('occurredAt', $any($event.target).value)" />
        </div>
        <div class="sm:col-span-2">
          <label appLabel for="al-subject">{{ 'act.fields.subject' | t }}</label>
          <input appInput id="al-subject" [value]="form().subject" (input)="set('subject', $any($event.target).value)" />
        </div>
        <div class="sm:col-span-2">
          <label appLabel for="al-body">{{ 'act.fields.summary' | t }}</label>
          <textarea appTextarea id="al-body" rows="3" [value]="form().body" (input)="set('body', $any($event.target).value)"></textarea>
        </div>
        <div>
          <label appLabel for="al-next">{{ 'act.fields.nextAction' | t }}</label>
          <input appInput id="al-next" [value]="form().nextAction" (input)="set('nextAction', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="al-next-at" [required]="!!form().nextAction">{{ 'act.columns.followUp' | t }}</label>
          <input appInput id="al-next-at" type="datetime-local" dir="ltr" [value]="form().nextActionAt" (change)="set('nextActionAt', $any($event.target).value)" />
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" appButton [disabled]="actions.busy() || !(customer() || lead() || opportunity()) || (!!form().nextAction && !form().nextActionAt)">{{ 'crm.common.save' | t }}</button>
          <button type="button" appButton variant="outline" (click)="dialogOpen.set(false)">{{ 'crm.common.cancel' | t }}</button>
        </div>
      </form>
    </app-dialog>
  `,
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
