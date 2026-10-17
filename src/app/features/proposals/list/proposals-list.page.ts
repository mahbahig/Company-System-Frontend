import { Component, computed, effect, inject, input, numberAttribute, untracked } from '@angular/core';
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
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { PagerState } from '../../../shared/crm/pagination/local-pager';

const STATUSES = ['draft', 'pending_approval', 'approved', 'released', 'sent', 'presented', 'under_negotiation', 'revision_requested', 'accepted', 'rejected', 'expired', 'superseded'];

/** All combined proposals in the user's scope — the PM's assembly queue, Finance's approvals and Sales' released inbox. */
@Component({
  selector: 'app-proposals-list-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, BadgeComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  templateUrl: './proposals-list.page.html',
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
  /** Exceptions Center: versions expiring within 7 days or recently expired. */
  readonly expiring = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), mine: this.mine() === '1' || undefined, expiring: this.expiring() === '1' || undefined, page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.combinedList(params),
  });
  /** Open opportunities the user can reach: where a new technical proposal is started (the workspace lives under the opportunity). */
  /** Open opportunities to start a proposal from, paged by the API; a new search starts from page 1. */
  protected readonly opportunitiesPager = new PagerState();
  protected readonly opportunities = rxResource({
    params: () => ({ q: this.q(), outcome: 'open' as const, page: this.opportunitiesPager.page(), pageSize: this.opportunitiesPager.pageSize() }),
    stream: ({ params }) => this.opportunitiesApi.list(params as never),
  });
  protected readonly opportunityRows = computed(() => (this.opportunities.hasValue() ? this.opportunities.value().rows : []));
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('prop.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.combinedProposalStatus.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [{ name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: this.mine() === '1' }]);

  constructor() {
    effect(() => {
      this.q();
      untracked(() => this.opportunitiesPager.reset());
    });
    void this.reference.load();
  }
}
