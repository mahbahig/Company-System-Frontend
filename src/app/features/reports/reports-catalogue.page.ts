import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ReportsApi, type ReportSummary } from './reports-api.service';

const GROUPS: ReportSummary['group'][] = ['management', 'sales', 'marketing', 'operations', 'finance', 'quality'];

/** RPT-01 report centre: only the reports the user's role may open. */
@Component({
  selector: 'app-reports-catalogue-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, PageHeaderComponent, ...CARD_IMPORTS],
  template: `
    <app-page-header [heading]="'reports.title' | t" [subtitle]="'reports.subtitle' | t" class="!mb-0" />
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @for (group of grouped(); track group.key) {
      <section [attr.aria-labelledby]="'rg-' + group.key" class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground" [id]="'rg-' + group.key">{{ 'reports.groups.' + group.key | t }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (report of group.reports; track report.code) {
            <a appCard class="block transition-colors hover:border-primary" [routerLink]="report.code">
              <div appCardHeader>
                <h3 appCardTitle class="text-base">{{ i18n.pick(report.titleAr, report.titleEn) }}</h3>
                <p appCardDescription>{{ 'reports.columnsCount' | t: { count: report.columns.length } }}</p>
              </div>
            </a>
          }
        </div>
      </section>
    } @empty {
      @if (!data.isLoading()) {
        <p class="text-sm text-muted-foreground">{{ 'reports.none' | t }}</p>
      }
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ReportsCataloguePage {
  private readonly api = inject(ReportsApi);
  protected readonly i18n = inject(I18nService);

  protected readonly data = rxResource({ stream: () => this.api.list() });
  protected readonly grouped = computed(() => {
    const reports = this.data.value() ?? [];
    return GROUPS.map((key) => ({ key, reports: reports.filter((r) => r.group === key) })).filter((g) => g.reports.length);
  });
}
