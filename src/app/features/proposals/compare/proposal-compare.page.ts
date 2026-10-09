import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ProposalsApi } from '../proposals-api.service';

const FIELDS = ['price', 'priceWithVat', 'kwp', 'storageKwh', 'discountPct', 'marginPct', 'downPaymentPct', 'validityDays', 'validUntil', 'paymentMilestones', 'expectedAnnualGenerationKwh', 'scope', 'equipment'];
const MONEY = new Set(['price', 'priceWithVat']);

/** PROP-14 side-by-side comparison of two versions (margin only for cost-visible roles). */
@Component({
  selector: 'app-proposal-compare-page',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, PageHeaderComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'prop.compareTitle' | t" class="!mb-0" />
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <app-table-wrapper [label]="'prop.compareTitle' | t">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead></th>
              <th appTableHead>v{{ d.a['versionNo'] }}</th>
              <th appTableHead>v{{ d.b['versionNo'] }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (field of fields(); track field) {
              <tr appTableRow [class.bg-warning/10]="d.differences.includes(field)">
                <th appTableCell scope="row" class="font-medium">
                  {{ label(field) }}
                  @if (d.differences.includes(field)) {
                    <app-badge tone="warning" class="ms-1">{{ 'prop.difference' | t }}</app-badge>
                  }
                </th>
                <td appTableCell class="align-top">{{ format(field, d.a[field]) }}</td>
                <td appTableCell class="align-top">{{ format(field, d.b[field]) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ProposalComparePage {
  private readonly api = inject(ProposalsApi);
  protected readonly i18n = inject(I18nService);

  readonly a = input<string>();
  readonly b = input<string>();

  protected readonly data = rxResource({ params: () => (this.a() && this.b() ? { a: this.a()!, b: this.b()! } : undefined), stream: ({ params }) => (params ? this.api.compare(params.a, params.b) : of(undefined)) });
  protected readonly fields = computed(() => FIELDS.filter((field) => field in (this.data.value()?.a ?? {})));

  protected label(field: string): string {
    const key = `prop.fields.${field}`;
    return this.i18n.has(key) ? this.i18n.t(key) : field;
  }

  protected format(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (MONEY.has(field) && typeof value === 'number') return this.i18n.formatMoney(value);
    if (field === 'validUntil') return this.i18n.formatDate(String(value));
    if (field.endsWith('Pct') && typeof value === 'number') return `${this.i18n.formatNumber(value)}%`;
    if (typeof value === 'number') return this.i18n.formatNumber(value);
    if (Array.isArray(value)) {
      return value
        .map((item) => (item && typeof item === 'object' ? Object.values(item as Record<string, unknown>).filter((v) => v !== null && v !== undefined).join(' · ') : String(item)))
        .join(' | ');
    }
    return String(value);
  }
}
