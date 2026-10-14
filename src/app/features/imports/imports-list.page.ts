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

/** DUP-10 bulk import of leads / customers from CSV or Excel. */
@Component({
  selector: 'app-imports-list-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'imports.title' | t" [subtitle]="'imports.subtitle' | t" class="!mb-0" />
    <form appCard class="max-w-3xl" (submit)="upload($event)" aria-labelledby="imp-new">
      <div appCardHeader><h2 appCardTitle id="imp-new">{{ 'imports.new' | t }}</h2></div>
      <div appCardContent class="grid gap-4 sm:grid-cols-3">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-3">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="imp-entity" required>{{ 'imports.entity' | t }}</label>
          <app-select>
            <select appSelect id="imp-entity" [value]="entity()" (change)="entity.set($any($event.target).value)">
              <option value="lead">{{ 'lead' | enum: 'importEntity' }}</option>
              <option value="customer">{{ 'customer' | enum: 'importEntity' }}</option>
            </select>
          </app-select>
        </div>
        <div class="sm:col-span-2">
          <label appLabel for="imp-file" required>{{ 'imports.file' | t }}</label>
          <input appInput id="imp-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="pick($event)" />
          <p class="mt-1 text-xs text-muted-foreground">{{ 'imports.fileHint' | t }}</p>
        </div>
        <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !file()">{{ (actions.busy() ? 'imports.uploading' : 'imports.upload') | t }}</button>
      </div>
    </form>

    @if (jobs.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(jobs.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'imports.history' | t" [attr.aria-busy]="jobs.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'imports.jobNo' | t }}</th>
            <th appTableHead>{{ 'imports.entity' | t }}</th>
            <th appTableHead>{{ 'imports.file' | t }}</th>
            <th appTableHead>{{ 'imports.rows' | t }}</th>
            <th appTableHead>{{ 'imports.status' | t }}</th>
            <th appTableHead>{{ 'imports.created' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (job of rows(); track job.id) {
            <tr appTableRow [appRowLink]="job.id">
              <td appTableCell><a class="tabular text-primary hover:underline" [routerLink]="job.id">{{ job.jobNo }}</a></td>
              <td appTableCell>{{ job.entity | enum: 'importEntity' }}</td>
              <td appTableCell class="max-w-56 truncate" dir="ltr">{{ job.fileName }}</td>
              <td appTableCell class="tabular">{{ i18n.formatNumber(job.totalRows) }}</td>
              <td appTableCell><app-status-badge enum="importJobStatus" [value]="job.status" /></td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(job.createdAt, true) }}</td>
            </tr>
          } @empty {
            @if (jobs.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="6" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="6">{{ 'imports.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (jobs.hasValue()) {
      <app-pagination [page]="jobs.value().page" [pageCount]="jobs.value().pageCount" [total]="jobs.value().total" [pageSize]="jobs.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ImportsListPage {
  private readonly api = inject(ImportsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly jobs = rxResource({ params: () => ({ page: this.page() }), stream: ({ params }) => this.api.list(params) });
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
    void this.actions.run(this.api.upload(this.entity(), file), null, (job) => void this.router.navigate(['/', this.i18n.locale(), 'imports', job.id]));
  }
}
