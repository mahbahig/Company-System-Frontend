import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { Customer360 } from '../models/customer-360.interface';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

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
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, StatusBadgeComponent, ...TABLE_IMPORTS],
  templateUrl: './customer-activities.component.html',
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
