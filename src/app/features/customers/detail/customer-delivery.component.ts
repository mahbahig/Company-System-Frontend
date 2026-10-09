import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { Customer360 } from '../models/customer-360.interface';

/** CUST-03 the customer's leads, customer-facing proposals, contracts and projects. */
@Component({
  selector: 'app-customer-delivery',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, ...TABLE_IMPORTS],
  template: `
    @if (data(); as d) {
      <section class="flex flex-col gap-3" aria-labelledby="c360-proposals">
        <h2 id="c360-proposals" class="text-lg font-semibold">{{ 'customer360.proposals' | t }}</h2>
        <app-table-wrapper [label]="'customer360.proposals' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'customer360.number' | t }}</th>
                <th appTableHead>{{ 'customer360.status' | t }}</th>
                <th appTableHead class="text-end">kWp</th>
                <th appTableHead class="text-end">{{ 'customer360.value' | t }}</th>
                <th appTableHead>{{ 'customer360.validUntil' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.proposals; track row.id) {
                <tr appTableRow>
                  <td appTableCell class="tabular" dir="ltr">
                    <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', row.opportunityId, 'proposals']">{{ row.proposalNo }} v{{ row.versionNo }}</a>
                  </td>
                  <td appTableCell><app-status-badge enum="combinedProposalStatus" [value]="row.status" /></td>
                  <td appTableCell class="tabular text-end">{{ i18n.formatNumber(row.kwp) }}</td>
                  <td appTableCell class="tabular text-end">{{ row.priceWithVat !== undefined ? i18n.formatMoney(row.priceWithVat) : '—' }}</td>
                  <td appTableCell class="tabular">{{ i18n.formatDate(row.validUntil) || '—' }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="5">{{ 'customer360.none' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="c360-contracts">
        <h2 id="c360-contracts" class="text-lg font-semibold">{{ 'customer360.contracts' | t }}</h2>
        <app-table-wrapper [label]="'customer360.contracts' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'customer360.number' | t }}</th>
                <th appTableHead>{{ 'customer360.status' | t }}</th>
                <th appTableHead class="text-end">{{ 'customer360.value' | t }}</th>
                <th appTableHead>{{ 'customer360.date' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.contracts; track row.id) {
                <tr appTableRow>
                  <td appTableCell class="tabular" dir="ltr"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'contracts', row.id]">{{ row.contractNo }} v{{ row.versionNo }}</a></td>
                  <td appTableCell><app-status-badge enum="contractStatus" [value]="row.status" /></td>
                  <td appTableCell class="tabular text-end">{{ row.value !== undefined ? i18n.formatMoney(row.value) : '—' }}</td>
                  <td appTableCell class="tabular">{{ i18n.formatDate(row.contractDate) || '—' }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="4">{{ 'customer360.none' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="c360-projects">
        <h2 id="c360-projects" class="text-lg font-semibold">{{ 'customer360.projects' | t }}</h2>
        <app-table-wrapper [label]="'customer360.projects' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'customer360.number' | t }}</th>
                <th appTableHead>{{ 'customer360.name' | t }}</th>
                <th appTableHead>{{ 'customer360.status' | t }}</th>
                <th appTableHead class="text-end">{{ 'customer360.progress' | t }}</th>
                <th appTableHead>{{ 'customer360.targetEnd' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.projects; track row.id) {
                <tr appTableRow>
                  <td appTableCell class="tabular" dir="ltr"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'projects', row.id]">{{ row.projectNo }}</a></td>
                  <td appTableCell>{{ row.name }}</td>
                  <td appTableCell>
                    <app-status-badge enum="projectStatus" [value]="row.status" />
                    @if (row.isDelayed) {
                      <span class="ms-1 text-xs text-destructive">{{ 'customer360.delayed' | t }}</span>
                    }
                  </td>
                  <td appTableCell class="tabular text-end">{{ i18n.formatNumber((row.installationProgressPct ?? 0) / 100, { style: 'percent' }) }}</td>
                  <td appTableCell class="tabular">{{ i18n.formatDate(row.targetEndDate) || '—' }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="5">{{ 'customer360.none' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="c360-leads">
        <h2 id="c360-leads" class="text-lg font-semibold">{{ 'customer360.leads' | t }}</h2>
        <app-table-wrapper [label]="'customer360.leads' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'customer360.number' | t }}</th>
                <th appTableHead>{{ 'customer360.name' | t }}</th>
                <th appTableHead>{{ 'customer360.status' | t }}</th>
                <th appTableHead>{{ 'customer360.date' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.leads; track row.id) {
                <tr appTableRow>
                  <td appTableCell class="tabular" dir="ltr"><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'leads', row.id]">{{ row.leadNo }}</a></td>
                  <td appTableCell>{{ row.name }}</td>
                  <td appTableCell><app-status-badge enum="leadStatus" [value]="row.status" /></td>
                  <td appTableCell class="tabular">{{ i18n.formatDate(row.createdAt) }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="4">{{ 'customer360.none' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>
    } @else {
      <p class="text-sm text-muted-foreground" role="status">{{ 'common.labels.loading' | t }}</p>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerDeliveryComponent {
  protected readonly i18n = inject(I18nService);
  readonly data = input<Customer360 | undefined>();
}
