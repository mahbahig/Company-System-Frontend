import { Component, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import type { KpiMap } from '../models/kpi-value.interface';
import { formatKpi, kpiHint } from './kpi-format';

/** A responsive grid of §15 KPI tiles; each tile states its formula (RPT-02, "definitions stated on each widget"). */
@Component({
  selector: 'app-kpi-grid',
  imports: [StatCardComponent],
  template: `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      @for (code of codes(); track code) {
        <app-stat-card [label]="i18n.t('kpi.label.' + code)" [value]="format(code)" [hint]="hint(code)" />
      }
    </div>
  `,
  host: { class: 'block' },
})
export class KpiGridComponent {
  protected readonly i18n = inject(I18nService);

  readonly kpis = input.required<KpiMap>();
  readonly codes = input.required<string[]>();

  protected format(code: string): string {
    return formatKpi(this.i18n, this.kpis()[code]);
  }

  protected hint(code: string): string {
    return kpiHint(this.i18n, this.kpis()[code]);
  }
}
