import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../shared/crm/status-badge/status-badge.component';
import { UserSelectComponent } from '../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { ImportsApi, type ImportRow } from './imports-api.service';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../shared/crm/pagination/page-size';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';

const ROW_FILTERS = ['', 'valid', 'duplicate', 'invalid', 'imported', 'linked', 'skipped'];

/**
 * DUP-09/10 one import: map columns (auto-suggested), validate, review every
 * suspected duplicate (create anyway / skip / link to the existing record),
 * commit, download the error report, or roll the whole batch back.
 */
@Component({
  selector: 'app-import-job-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './import-job.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ImportJobPage {
  protected readonly api = inject(ImportsApi);
  private readonly router = inject(Router);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  private readonly confirm = inject(ConfirmService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly rowFilters = ROW_FILTERS;
  protected readonly countKeys = ['valid', 'duplicate', 'invalid', 'imported', 'linked', 'skipped'];

  readonly id = input.required<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly job = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly fields = rxResource({ params: () => this.job.value()?.entity, stream: ({ params }) => this.api.fields(params) });
  protected readonly rows = rxResource({ params: () => ({ id: this.id(), status: this.status(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.rows(params.id, { status: params.status, page: params.page }) });
  protected readonly rowList = computed(() => (this.rows.hasValue() ? this.rows.value().rows : []));
  protected readonly editable = computed(() => ['uploaded', 'review', 'failed'].includes(this.job.value()?.status ?? ''));

  protected readonly mapping = signal<Record<string, string>>({});
  protected readonly defaults = signal<Record<string, string | undefined>>({});
  protected readonly skipUndecided = signal(false);

  constructor() {
    void this.reference.load();
    effect(() => {
      const j = this.job.value();
      if (j) {
        this.mapping.set({ ...j.mapping });
        this.defaults.set({ ...j.defaults });
      }
    });
  }

  protected setMap(key: string, header: string): void {
    this.mapping.update((m) => {
      const next = { ...m };
      if (header) next[key] = header;
      else delete next[key];
      return next;
    });
  }

  protected setDefault(key: string, value: string): void {
    this.defaults.update((d) => ({ ...d, [key]: value || undefined }));
  }

  protected saveMapping(event: Event): void {
    event.preventDefault();
    this.run(this.api.setMapping(this.id(), { mapping: this.mapping(), defaults: this.defaults() }), 'imports.validated');
  }

  protected run(action: Parameters<ActionRunner['run']>[0], key: string): void {
    void this.actions.run(action, key, () => {
      this.job.reload();
      this.rows.reload();
    });
  }

  /** Removes what the import created — asked in the application's own dialog, which stays busy until the API is done. */
  protected async rollback(): Promise<void> {
    const rolledBack = await this.confirm.confirm({
      heading: this.i18n.t('imports.rollbackTitle', { name: this.job.value()?.fileName ?? '' }),
      message: this.i18n.t('imports.rollbackConfirm'),
      details: [this.i18n.t('imports.rollbackKept')],
      irreversible: true,
      confirmLabel: this.i18n.t('imports.rollbackAction'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'danger',
      action: () => this.api.rollback(this.id()),
    });
    if (!rolledBack) return;
    this.actions.message.set(this.i18n.t('imports.rolledBackNotice'));
    this.job.reload();
    this.rows.reload();
  }

  protected filterRows(status: string): void {
    void this.router.navigate([], { queryParams: { status: status || null, page: null }, queryParamsHandling: 'merge' });
  }

  protected summary(row: ImportRow): string {
    const d = { ...row.data, ...row.overrides } as Record<string, unknown>;
    const text = (key: string) => (typeof d[key] === 'string' ? (d[key] as string) : '');
    return text('name') || text('nameAr') || text('nameEn') || text('companyName') || text('contactName') || Object.values(row.raw)[0] || '—';
  }

  protected contact(row: ImportRow): string {
    const d = { ...row.data, ...row.overrides } as Record<string, unknown>;
    return [d['phone'], d['mobile'], d['email']].filter((v) => typeof v === 'string' && v).join(' · ');
  }

  protected issues(row: ImportRow): Array<{ field: string; key: string }> {
    return Object.entries(row.issues ?? {}).map(([field, key]) => ({ field, key }));
  }
}
