import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { Customer360 } from '../models/customer-360.interface';

interface Row {
  id: string;
  at: string;
  kind: 'call' | 'meeting' | 'visit' | 'activity';
  title: string;
  status?: string;
  statusEnum?: string;
  link?: unknown[];
}

/** CUST-03 recent calls, meetings, visits and logged interactions, plus open tasks. */
@Component({
  selector: 'app-customer-activities',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, ...TABLE_IMPORTS],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="c360-acts">
      <h2 id="c360-acts" class="text-lg font-semibold">{{ 'customer360.recentActivity' | t }}</h2>
      <app-table-wrapper [label]="'customer360.recentActivity' | t">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'act.columns.when' | t }}</th>
              <th appTableHead>{{ 'customer360.type' | t }}</th>
              <th appTableHead>{{ 'act.fields.subject' | t }}</th>
              <th appTableHead>{{ 'act.columns.status' | t }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (row of rows(); track row.kind + row.id) {
              <tr appTableRow>
                <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.at, true) }}</td>
                <td appTableCell>{{ 'customer360.kinds.' + row.kind | t }}</td>
                <td appTableCell>
                  @if (row.link) {
                    <a class="text-primary hover:underline" [routerLink]="row.link">{{ row.title }}</a>
                  } @else {
                    {{ row.title }}
                  }
                </td>
                <td appTableCell>
                  @if (row.status && row.statusEnum) {
                    <app-status-badge [enum]="row.statusEnum" [value]="row.status" />
                  } @else {
                    {{ row.status || '—' }}
                  }
                </td>
              </tr>
            } @empty {
              <tr app-table-empty [colSpan]="4">{{ (data() ? 'customer360.none' : 'common.labels.loading') | t }}</tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="c360-tasks">
      <h2 id="c360-tasks" class="text-lg font-semibold">{{ 'customer360.openTasks' | t }}</h2>
      <app-table-wrapper [label]="'customer360.openTasks' | t">
        <table appTable>
          <thead appTableHeader>
            <tr appTableRow>
              <th appTableHead>{{ 'customer360.task' | t }}</th>
              <th appTableHead>{{ 'customer360.due' | t }}</th>
              <th appTableHead>{{ 'act.columns.status' | t }}</th>
            </tr>
          </thead>
          <tbody appTableBody>
            @for (task of data()?.tasks ?? []; track task.id) {
              <tr appTableRow>
                <td appTableCell><a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'tasks', task.id]">{{ task.title }}</a></td>
                <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(task.dueAt, true) || '—' }}</td>
                <td appTableCell><app-status-badge enum="taskStatus" [value]="task.status" /></td>
              </tr>
            } @empty {
              <tr app-table-empty [colSpan]="3">{{ 'customer360.none' | t }}</tr>
            }
          </tbody>
        </table>
      </app-table-wrapper>
    </section>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerActivitiesComponent {
  protected readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);
  readonly data = input<Customer360 | undefined>();

  protected readonly rows = computed<Row[]>(() => {
    const d = this.data();
    if (!d) return [];
    const locale = this.i18n.locale();
    const rows: Row[] = [
      ...d.activities.calls.map((c): Row => ({ id: c.id, at: c.occurredAt, kind: 'call', title: c.summary || this.reference.label('call_outcome', c.outcomeCode), link: ['/', locale, 'calls', c.id] })),
      ...d.activities.meetings.map((m): Row => ({ id: m.id, at: m.scheduledAt, kind: 'meeting', title: m.subject, status: m.status, statusEnum: 'meetingStatus', link: ['/', locale, 'meetings', m.id] })),
      ...d.activities.visits.map((v): Row => ({ id: v.id, at: v.scheduledAt, kind: 'visit', title: `${v.visitNo} · ${this.i18n.t('enums.visitPurpose.' + v.purpose)}`, status: v.status, statusEnum: 'visitStatus', link: ['/', locale, 'visits', v.id] })),
      ...d.activities.activities.map((a): Row => ({ id: a.id, at: a.occurredAt, kind: 'activity', title: a.subject || a.body || this.i18n.t('enums.activityChannel.' + a.channel) })),
    ];
    return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  });
}
