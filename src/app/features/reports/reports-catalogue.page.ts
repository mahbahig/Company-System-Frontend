import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ArrowRight, Download, FolderKanban, Gauge, ListChecks, Megaphone, Table2, Target, Wallet, type IconNode } from 'lucide';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ReportsApi, type ReportSummary } from './reports-api.service';

const GROUPS: ReportSummary['group'][] = ['management', 'sales', 'marketing', 'operations', 'finance', 'quality'];
const GROUP_ICONS: Record<ReportSummary['group'], IconNode> = {
  management: Gauge,
  sales: Target,
  marketing: Megaphone,
  operations: FolderKanban,
  finance: Wallet,
  quality: ListChecks,
};

/**
 * RPT-01 report centre: only the reports the user's role may open, grouped by
 * area. Each report is a card that lifts slightly on hover (elevation and a
 * small translate — never a coloured border), with what it contains at a glance.
 */
@Component({
  selector: 'app-reports-catalogue-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, IconComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-page-header [heading]="'reports.title' | t" [subtitle]="'reports.subtitle' | t" class="!mb-0" />
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }

    @if (data.isLoading()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" [attr.aria-label]="'common.labels.loading' | t">
        @for (tile of [0, 1, 2, 3, 4, 5]; track tile) {
          <div class="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-6">
            <app-skeleton class="size-10 rounded-lg" />
            <app-skeleton class="h-4 w-3/4" />
            <app-skeleton class="h-3 w-1/3" />
          </div>
        }
      </div>
    }

    @for (group of grouped(); track group.key; let groupIndex = $index) {
      <section [attr.aria-labelledby]="'rg-' + group.key" class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <app-icon [icon]="groupIcon(group.key)" svgClass="size-4" />
          </span>
          <h2 class="text-sm font-semibold tracking-tight text-foreground" [id]="'rg-' + group.key">{{ 'reports.groups.' + group.key | t }}</h2>
          <span class="tabular rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">{{ group.reports.length }}</span>
          <span class="h-px flex-1 bg-border/70" aria-hidden="true"></span>
        </div>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (report of group.reports; track report.code; let index = $index) {
            <li class="animate-fade-in-up [animation-duration:380ms]" [style.animation-delay.ms]="(groupIndex * 3 + index) * 35">
              <a
                [routerLink]="report.code"
                class="group/report flex h-full flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 text-card-foreground shadow-sm outline-none transition-[transform,box-shadow] duration-200 ease-premium hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 active:shadow-md motion-reduce:hover:translate-y-0"
              >
                <div class="flex items-start justify-between gap-3">
                  <span class="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-200 group-hover/report:text-foreground" aria-hidden="true">
                    <app-icon [icon]="tableIcon" svgClass="size-5" />
                  </span>
                  <app-icon [icon]="arrowIcon" svgClass="size-4 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 ease-premium group-hover/report:translate-x-0.5 group-hover/report:opacity-100 group-focus-visible/report:opacity-100 rtl:-scale-x-100" />
                </div>
                <div class="flex flex-1 flex-col gap-1.5">
                  <h3 class="text-base font-semibold leading-snug tracking-tight">{{ i18n.pick(report.titleAr, report.titleEn) }}</h3>
                  <p class="text-sm text-muted-foreground">{{ 'reports.columnsCount' | t: { count: report.columns.length } }}</p>
                </div>
                @if (report.exportable) {
                  <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <app-icon [icon]="downloadIcon" svgClass="size-3.5" />
                    {{ 'ux.reports.exportable' | t }}
                  </p>
                }
              </a>
            </li>
          }
        </ul>
      </section>
    } @empty {
      @if (!data.isLoading() && !data.error()) {
        <div class="rounded-xl border border-dashed border-border p-10 text-center">
          <p class="text-sm text-muted-foreground">{{ 'reports.none' | t }}</p>
        </div>
      }
    }
  `,
  host: { class: 'flex flex-col gap-8' },
})
export class ReportsCataloguePage {
  private readonly api = inject(ReportsApi);
  protected readonly i18n = inject(I18nService);

  protected readonly tableIcon = Table2;
  protected readonly arrowIcon = ArrowRight;
  protected readonly downloadIcon = Download;
  protected readonly data = rxResource({ stream: () => this.api.list() });
  protected readonly grouped = computed(() => {
    const reports = this.data.value() ?? [];
    return GROUPS.map((key) => ({ key, reports: reports.filter((r) => r.group === key) })).filter((g) => g.reports.length);
  });

  protected groupIcon(group: ReportSummary['group']): IconNode {
    return GROUP_ICONS[group];
  }
}
