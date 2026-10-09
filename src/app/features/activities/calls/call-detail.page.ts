import { Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { userName } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { ActivitiesApi, refId, refLabel } from '../activities-api.service';

/** E11 one logged call with its links and follow-up. */
@Component({
  selector: 'app-call-detail-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, DetailItemComponent, AlertComponent, PageHeaderComponent, ...CARD_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as c) {
      <app-page-header [heading]="'act.calls.detail' | t" [subtitle]="i18n.formatDate(c.occurredAt, true)" />
      <section appCard class="max-w-3xl">
        <dl appCardContent class="grid gap-4 sm:grid-cols-2">
          <div appDetailItem [label]="'act.columns.direction' | t">{{ c.direction | enum: 'callDirection' }}</div>
          <div appDetailItem [label]="'act.columns.outcome' | t">{{ reference.label('call_outcome', c.outcomeCode) }}</div>
          <div appDetailItem [label]="'act.fields.purpose' | t">{{ c.purposeCode ? reference.label('call_purpose', c.purposeCode) : '—' }}</div>
          <div appDetailItem [label]="'act.columns.phone' | t"><span class="tabular" dir="ltr">{{ c.phoneNumber ? formatPhone(c.phoneNumber) : '—' }}</span></div>
          <div appDetailItem [label]="'act.fields.durationMinutes' | t"><span class="tabular">{{ c.durationSeconds ? i18n.formatNumber(c.durationSeconds / 60) : '—' }}</span></div>
          <div appDetailItem [label]="'act.columns.owner' | t">{{ name(c.ownerId) }}</div>
          @if (refId(c.customerId)) {
            <div appDetailItem [label]="'act.fields.customer' | t"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'customers', refId(c.customerId)]">{{ label(c.customerId) }}</a></div>
          }
          @if (refId(c.leadId)) {
            <div appDetailItem [label]="'act.fields.lead' | t"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'leads', refId(c.leadId)]">{{ label(c.leadId) }}</a></div>
          }
          @if (refId(c.opportunityId)) {
            <div appDetailItem [label]="'act.fields.opportunity' | t"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', refId(c.opportunityId)]">{{ label(c.opportunityId) }}</a></div>
          }
          <div appDetailItem [label]="'act.columns.followUp' | t"><span class="tabular">{{ i18n.formatDate(c.followUpAt, true) || '—' }}</span></div>
          @if (c.summary) {
            <div appDetailItem class="sm:col-span-2" [label]="'act.fields.summary' | t"><p class="whitespace-pre-line">{{ c.summary }}</p></div>
          }
        </dl>
      </section>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CallDetailPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly formatPhone = formatPhone;
  protected readonly refId = refId;

  readonly id = input.required<string>();
  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.call(params) });

  constructor() {
    void this.reference.load();
  }

  protected label(value: Parameters<typeof refLabel>[1]): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), value) || '—';
  }

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }
}
