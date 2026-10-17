import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TableBodyDirective } from '../../../shared/ui/table/table-body.directive';
import { TableCellDirective } from '../../../shared/ui/table/table-cell.directive';
import { TableEmptyComponent } from '../../../shared/ui/table/table-empty.component';
import { TableHeadDirective } from '../../../shared/ui/table/table-head.directive';
import { TableHeaderDirective } from '../../../shared/ui/table/table-header.directive';
import { TableRowDirective } from '../../../shared/ui/table/table-row.directive';
import { TableWrapperComponent } from '../../../shared/ui/table/table-wrapper.component';
import { TableDirective } from '../../../shared/ui/table/table.directive';
import { LeadsApi } from '../leads-api.service';
import type { RoutingProposal } from '../models/routing-proposal.interface';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { PagerState } from '../../../shared/crm/pagination/local-pager';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';

interface AssignModel {
  ownerId: string;
  reason: string;
}

/** LEAD-09..11 manager distribution: manual assignment and batch preview/confirm. */
@Component({
  selector: 'app-leads-distribute-page',
  imports: [
    SkeletonRowComponent,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    ButtonDirective,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    InputDirective,
    LabelComponent,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent, PaginationComponent, PagerComponent],
  templateUrl: './leads-distribute.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadsDistributePage {
  private readonly leads = inject(LeadsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Unassigned leads, paged by the API (selected leads stay selected across pages). */
  protected readonly unassignedPager = new PagerState();
  protected readonly unassigned = rxResource({
    params: () => ({ unassigned: true, page: this.unassignedPager.page(), pageSize: this.unassignedPager.pageSize() }),
    stream: ({ params }) => this.leads.bank(params),
  });
  protected readonly unassignedCount = computed(() => this.unassigned.value()?.total ?? 0);

  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly assignError = signal<string | null>(null);
  protected readonly assignDone = signal(false);

  private readonly assignModel = signal<AssignModel>({ ownerId: '', reason: '' });
  protected readonly assignForm = form(this.assignModel, (path) => {
    required(path.ownerId, { message: 'validation.required' });
    required(path.reason, { message: 'validation.required' });
  });

  protected readonly proposals = signal<RoutingProposal[] | null>(null);
  /** The proposed distribution, paged in memory. */
  protected readonly proposalsPager = new LocalPager(() => this.proposals());
  protected readonly previewing = signal(false);
  protected readonly confirming = signal(false);
  protected readonly distributeError = signal<string | null>(null);
  protected readonly distributedCount = signal<number | null>(null);

  protected toggleSelected(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected async onAssignSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.assignForm().markAsTouched();
    if (this.assignForm().invalid() || this.selected().size === 0) return;
    this.assignError.set(null);
    try {
      await firstValueFrom(
        this.leads.assign({ leadIds: [...this.selected()], ownerId: this.assignModel().ownerId, reason: this.assignModel().reason }),
      );
      this.assignDone.set(true);
      this.selected.set(new Set());
      this.assignModel.set({ ownerId: '', reason: '' });
      this.unassigned.reload();
    } catch {
      this.assignError.set('errors.db.unexpected');
    }
  }

  protected async preview(): Promise<void> {
    this.previewing.set(true);
    this.distributeError.set(null);
    this.distributedCount.set(null);
    try {
      const { proposals } = await firstValueFrom(this.leads.previewDistribution({}));
      this.proposals.set(proposals);
      this.proposalsPager.reset();
    } catch {
      this.distributeError.set('errors.db.unexpected');
    } finally {
      this.previewing.set(false);
    }
  }

  protected async confirmDistribution(): Promise<void> {
    const proposals = this.proposals();
    if (!proposals) return;
    this.confirming.set(true);
    this.distributeError.set(null);
    try {
      const allocation = proposals.filter((p) => p.ownerId).map((p) => ({ leadId: p.leadId, ownerId: p.ownerId as string }));
      const result = await firstValueFrom(this.leads.distribute({ allocation }));
      this.distributedCount.set(result.assigned);
      this.proposals.set(null);
      this.unassigned.reload();
    } catch {
      this.distributeError.set('errors.db.unexpected');
    } finally {
      this.confirming.set(false);
    }
  }

  constructor() {
    void this.reference.load();
  }
}
