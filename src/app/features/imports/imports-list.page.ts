import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { ImportsApi } from './imports-api.service';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../shared/crm/pagination/page-size';
import { PageSizeSelectComponent } from '../../shared/crm/pagination/page-size-select.component';

/** DUP-10 bulk import of leads / customers from CSV or Excel. */
@Component({
  selector: 'app-imports-list-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PageSizeSelectComponent],
  templateUrl: './imports-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ImportsListPage {
  private readonly api = inject(ImportsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly jobs = rxResource({ params: () => ({ page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.list(params) });
  protected readonly rows = computed(() => (this.jobs.hasValue() ? this.jobs.value().rows : []));
  protected readonly entity = signal<'lead' | 'customer'>('lead');
  protected readonly file = signal<File | null>(null);

  protected pick(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected upload(event: Event): void {
    event.preventDefault();
    const file = this.file();
    if (!file) return;
    void this.actions.run(this.api.upload(this.entity(), file), null, (job) => void this.router.navigate(['/', 'imports', job.id]));
  }
}
