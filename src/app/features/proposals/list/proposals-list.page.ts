import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../../shared/crm/list-toolbar/toggle-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { OpportunitiesApi } from '../../opportunities/opportunities-api.service';
import { ProposalsApi } from '../proposals-api.service';

const STATUSES = ['draft', 'pending_approval', 'approved', 'released', 'sent', 'presented', 'under_negotiation', 'revision_requested', 'accepted', 'rejected', 'expired', 'superseded'];

/** All combined proposals in the user's scope — the PM's assembly queue, Finance's approvals and Sales' released inbox. */
@Component({
  selector: 'app-proposals-list-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, BadgeComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'prop.listTitle' | t" [subtitle]="'prop.listSubtitle' | t" class="!mb-0" />
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" [toggles]="toggles()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <section class="flex flex-col gap-3" aria-labelledby="prop-pick-heading">
      <div>
        <h2 id="prop-pick-heading" class="text-lg font-semibold">{{ 'prop.pickOpportunity' | t }}</h2>
        <p class="text-sm text-muted-foreground">{{ 'prop.pickOpportunityHint' | t }}</p>
      </div>
      @if (opportunities.error()) {
        <app-alert variant="destructive">{{ i18n.errorText(opportunities.error()) }}</app-alert>
      }
      <app-table-wrapper [label]="'prop.pickOpportunity' | t" [attr.aria-busy]="opportunities.isLoading()">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'prop.columns.opportunity' | t }}</th>
              <th appTableHead>{{ 'prop.columns.stage' | t }}</th>
              <th appTableHead>{{ 'prop.columns.handoff' | t }}</th>
              <th appTableHead><span class="sr-only">{{ 'prop.workspaceTitle' | t }}</span></th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (row of opportunityRows(); track row.id) {
              <tr appTableRow>
                <td appTableCell>
                  <span class="tabular me-2 text-muted-foreground" dir="ltr">{{ row.opportunityNo }}</span>
                  <a class="font-medium text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', row.id, 'proposals']">{{ row.name }}</a>
                </td>
                <td appTableCell>{{ reference.label('pipeline_stage', row.stage) }}</td>
                <td appTableCell>
                  @if (row.handoffStatus) {
                    <app-status-badge enum="handoffStatus" [value]="row.handoffStatus" />
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td appTableCell class="text-end">
                  <a class="text-sm text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', row.id, 'proposals']">{{ 'prop.workspaceTitle' | t }}</a>
                </td>
              </tr>
            } @empty {
              <tr app-table-empty [colSpan]="4">{{ (opportunities.isLoading() ? 'common.labels.loading' : 'prop.noOpportunities') | t }}</tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
    </section>

    <h2 class="text-lg font-semibold">{{ 'prop.listTitle' | t }}</h2>
    <app-table-wrapper [label]="'prop.listTitle' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'prop.columns.number' | t }}</th>
            <th appTableHead>{{ 'prop.columns.version' | t }}</th>
            <th appTableHead>{{ 'prop.columns.status' | t }}</th>
            <th appTableHead>{{ 'prop.columns.capacity' | t }}</th>
            <th appTableHead>{{ 'prop.columns.price' | t }}</th>
            <th appTableHead>{{ 'prop.columns.validUntil' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">
                <a class="text-primary hover:underline" [routerLink]="['combined', row.id]" dir="ltr">{{ row.proposalNo }}</a>
                @if (row.isFinal) {
                  <app-badge tone="success" class="ms-1">{{ 'prop.final' | t }}</app-badge>
                }
              </td>
              <td appTableCell class="tabular">v{{ row.versionNo }}</td>
              <td appTableCell><app-status-badge enum="combinedProposalStatus" [value]="row.status" /></td>
              <td appTableCell class="tabular">{{ row.kwp }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.price) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.validUntil) || '—' }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="6">{{ (result.isLoading() ? 'common.labels.loading' : 'prop.emptyVersions') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (result.hasValue()) {
      <app-pagination [page]="result.value().page" [pageCount]="result.value().pageCount" [total]="result.value().total" [pageSize]="result.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ProposalsListPage {
  private readonly api = inject(ProposalsApi);
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly mine = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), mine: this.mine() === '1' || undefined, page: this.page() }),
    stream: ({ params }) => this.api.combinedList(params),
  });
  /** Open opportunities the user can reach: where a new technical proposal is started (the workspace lives under the opportunity). */
  protected readonly opportunities = rxResource({
    params: () => ({ q: this.q(), outcome: 'open' as const, pageSize: 50 }),
    stream: ({ params }) => this.opportunitiesApi.list(params as never),
  });
  protected readonly opportunityRows = computed(() => (this.opportunities.hasValue() ? this.opportunities.value().rows : []));
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('prop.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.combinedProposalStatus.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [{ name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: this.mine() === '1' }]);

  constructor() {
    void this.reference.load();
  }
}
