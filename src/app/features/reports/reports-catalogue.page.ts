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
  templateUrl: './reports-catalogue.page.html',
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
