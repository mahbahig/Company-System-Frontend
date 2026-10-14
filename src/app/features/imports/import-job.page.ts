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

const ROW_FILTERS = ['', 'valid', 'duplicate', 'invalid', 'imported', 'linked', 'skipped'];

/**
 * DUP-09/10 one import: map columns (auto-suggested), validate, review every
 * suspected duplicate (create anyway / skip / link to the existing record),
 * commit, download the error report, or roll the whole batch back.
 */
@Component({
  selector: 'app-import-job-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (job.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(job.error()) }}</app-alert>
    }
    @if (job.value(); as j) {
      <app-page-header [heading]="j.jobNo" [subtitle]="(j.entity | enum: 'importEntity') + ' · ' + j.fileName">
        <app-status-badge enum="importJobStatus" [value]="j.status" />
      </app-page-header>
      @if (actions.message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (actions.error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }
      @if (j.error) {
        <app-alert variant="destructive">{{ i18n.t(j.error) }}</app-alert>
      }

      <section class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" [attr.aria-label]="'imports.counts' | t">
        @for (key of countKeys; track key) {
          <div class="rounded-lg border border-border bg-card p-3">
            <p class="text-xs text-muted-foreground">{{ key | enum: 'importRowStatus' }}</p>
            <p class="tabular text-xl font-semibold">{{ i18n.formatNumber(j.counts[key] ?? 0) }}</p>
          </div>
        }
      </section>

      @if (editable()) {
        <form appCard (submit)="saveMapping($event)" aria-labelledby="imp-map">
          <div appCardHeader>
            <h2 appCardTitle id="imp-map">{{ 'imports.mapping' | t }}</h2>
            <p appCardDescription>{{ 'imports.mappingHint' | t }}</p>
          </div>
          <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (field of fields.value() ?? []; track field.key) {
              <div>
                <label appLabel [for]="'map-' + field.key" [required]="!!field.required">{{ i18n.pick(field.labelAr, field.labelEn) }}</label>
                <app-select>
                  <select appSelect [id]="'map-' + field.key" [value]="mapping()[field.key] ?? ''" (change)="setMap(field.key, $any($event.target).value)">
                    <option value="">{{ 'imports.notMapped' | t }}</option>
                    @for (header of j.headers; track header) {
                      <option [value]="header">{{ header }}</option>
                    }
                  </select>
                </app-select>
              </div>
            }
          </div>
          <div appCardContent class="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <p class="text-sm font-medium sm:col-span-2 lg:col-span-4">{{ 'imports.defaults' | t }}</p>
            <div>
              <label appLabel for="def-source">{{ 'imports.defaultSource' | t }}</label>
              <app-select>
                <select appSelect id="def-source" [value]="defaults()['sourceCode'] ?? ''" (change)="setDefault('sourceCode', $any($event.target).value)">
                  <option value="">—</option>
                  @for (option of reference.options('lead_source'); track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </app-select>
            </div>
            <div>
              <label appLabel for="def-campaign">{{ 'imports.defaultCampaign' | t }}</label>
              <app-select>
                <select appSelect id="def-campaign" [value]="defaults()['campaignCode'] ?? ''" (change)="setDefault('campaignCode', $any($event.target).value)">
                  <option value="">—</option>
                  @for (option of reference.options('campaign'); track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </app-select>
            </div>
            @if (j.entity === 'lead') {
              <div>
                <label appLabel for="def-owner">{{ 'imports.defaultOwner' | t }}</label>
                <app-user-select inputId="def-owner" [value]="defaults()['ownerId'] ?? ''" (valueChange)="setDefault('ownerId', $event)" />
              </div>
            }
            <div class="flex items-end">
              <button type="submit" appButton [disabled]="actions.busy()">{{ 'imports.saveMapping' | t }}</button>
            </div>
          </div>
        </form>
      }

      <section class="flex flex-wrap items-center gap-2" [attr.aria-label]="'imports.actions' | t">
        @if (editable()) {
          <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy()" (click)="run(api.decideAll(id(), { status: 'duplicate', decision: 'skip' }), 'imports.decided')">{{ 'imports.skipAllDuplicates' | t }}</button>
          <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy()" (click)="run(api.decideAll(id(), { status: 'duplicate', decision: 'create' }), 'imports.decided')">{{ 'imports.createAllDuplicates' | t }}</button>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="skipUndecided()" (change)="skipUndecided.set($any($event.target).checked)" /> {{ 'imports.skipUndecided' | t }}</label>
          <button type="button" appButton [disabled]="actions.busy() || !(j.counts['valid'] || j.counts['duplicate'])" (click)="run(api.commit(id(), skipUndecided()), 'imports.committed')">{{ 'imports.commit' | t }}</button>
        }
        @if (j.counts['invalid']) {
          <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="actions.run(api.errorReport(id(), j.jobNo), null)">{{ 'imports.errorReport' | t }}</button>
        }
        @if (j.status === 'committed') {
          <button type="button" appButton variant="destructive" size="sm" [disabled]="actions.busy()" (click)="rollback()">{{ 'imports.rollback' | t }}</button>
        }
        @if (j.rollbackResult; as r) {
          <span class="text-sm text-muted-foreground">{{ 'imports.rolledBack' | t: { removed: r.removed, kept: r.kept } }}</span>
        }
      </section>

      <div class="flex flex-wrap gap-1" role="tablist" [attr.aria-label]="'imports.rowFilter' | t">
        @for (filter of rowFilters; track filter) {
          <button type="button" role="tab" appButton size="sm" [variant]="(status() ?? '') === filter ? 'default' : 'ghost'" [attr.aria-selected]="(status() ?? '') === filter" (click)="filterRows(filter)">
            {{ filter ? (filter | enum: 'importRowStatus') : ('imports.allRows' | t) }}
          </button>
        }
      </div>

      <app-table-wrapper [label]="'imports.rows' | t" [attr.aria-busy]="rows.isLoading()">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>#</th>
              <th appTableHead>{{ 'imports.record' | t }}</th>
              <th appTableHead>{{ 'imports.status' | t }}</th>
              <th appTableHead>{{ 'imports.issuesMatches' | t }}</th>
              <th appTableHead>{{ 'imports.decision' | t }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (row of rowList(); track row.id) {
              <tr appTableRow>
                <td appTableCell class="tabular">{{ row.rowNo }}</td>
                <td appTableCell class="max-w-72">
                  <span class="block truncate font-medium">{{ summary(row) }}</span>
                  <span class="block truncate text-xs text-muted-foreground" dir="ltr">{{ contact(row) }}</span>
                </td>
                <td appTableCell><app-status-badge enum="importRowStatus" [value]="row.status" /></td>
                <td appTableCell class="max-w-80 text-xs">
                  @for (issue of issues(row); track issue.field) {
                    <span class="block text-destructive">{{ issue.field }}: {{ i18n.t(issue.key) }}</span>
                  }
                  @for (match of row.matches; track match.id) {
                    <span class="block">
                      {{ match.kind | enum: 'importMatchKind' }} · {{ match.label }} <span class="tabular text-muted-foreground">({{ i18n.formatNumber(match.score * 100, { maximumFractionDigits: 0 }) }}%)</span>
                      @if (editable() && match.kind !== 'row') {
                        <button type="button" class="ms-1 text-primary hover:underline" (click)="run(api.decide(id(), row.id, { decision: 'link', linkedId: match.id }), 'imports.decided')">{{ 'imports.link' | t }}</button>
                      }
                    </span>
                  }
                </td>
                <td appTableCell>
                  <span class="block text-xs">{{ row.decision | enum: 'importDecision' }}</span>
                  @if (editable() && (row.status === 'valid' || row.status === 'duplicate')) {
                    <div class="mt-1 flex gap-1">
                      <button type="button" appButton variant="outline" size="sm" [disabled]="actions.busy()" (click)="run(api.decide(id(), row.id, { decision: 'create' }), 'imports.decided')">{{ 'imports.create' | t }}</button>
                      <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="run(api.decide(id(), row.id, { decision: 'skip' }), 'imports.decided')">{{ 'imports.skip' | t }}</button>
                    </div>
                  }
                </td>
              </tr>
            } @empty {
              @if (rows.isLoading()) {
                @for (i of [0, 1, 2, 3, 4]; track i) {
                  <tr app-skeleton-row [columns]="5" [index]="i"></tr>
                }
              } @else {
                <tr app-table-empty [colSpan]="5">{{ 'imports.noRows' | t }}</tr>
              }
            }
          </tbody>
        </table>
      </app-table-wrapper>
      @if (rows.hasValue()) {
        <app-pagination [page]="rows.value().page" [pageCount]="rows.value().pageCount" [total]="rows.value().total" [pageSize]="rows.value().pageSize" />
      }
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ImportJobPage {
  protected readonly api = inject(ImportsApi);
  private readonly router = inject(Router);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly rowFilters = ROW_FILTERS;
  protected readonly countKeys = ['valid', 'duplicate', 'invalid', 'imported', 'linked', 'skipped'];

  readonly id = input.required<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly job = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly fields = rxResource({ params: () => this.job.value()?.entity, stream: ({ params }) => this.api.fields(params) });
  protected readonly rows = rxResource({ params: () => ({ id: this.id(), status: this.status(), page: this.page() }), stream: ({ params }) => this.api.rows(params.id, { status: params.status, page: params.page }) });
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

  protected rollback(): void {
    if (!confirm(this.i18n.t('imports.rollbackConfirm'))) return;
    this.run(this.api.rollback(this.id()), 'imports.rolledBackNotice');
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
