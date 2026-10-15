import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { GpsCaptureComponent, type GeoCapture } from '../../../shared/crm/gps-capture/gps-capture.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { ActivitiesApi, refId, refLabel, type GeoReading } from '../activities-api.service';
import { GeoReadingComponent } from '../shared/geo-reading.component';

/**
 * E12 meeting: GPS arrival / departure (coordinates and distance only with
 * `meetings.view_locations`), minutes, decisions, action items and follow-up;
 * cancel with a reason.
 */
@Component({
  selector: 'app-meeting-detail-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, DetailItemComponent, DocumentsPanelComponent, GpsCaptureComponent, GeoReadingComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './meeting-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class MeetingDetailPage {
  protected readonly api = inject(ActivitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly refId = refId;

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.meeting(params) });
  protected readonly reload = () => this.data.reload();
  protected readonly canEdit = computed(() => this.auth.can('meetings.edit'));
  protected readonly editable = computed(() => this.canEdit() && this.data.value()?.status !== 'cancelled');
  protected readonly cancelReason = signal('');
  protected readonly outcome = signal({ outcome: '', minutes: '', decisions: '', actionItems: '', followUpRequired: false, followUpAt: '' });

  constructor() {
    effect(() => {
      const m = this.data.value();
      if (m) this.outcome.set({ outcome: m.outcome ?? '', minutes: m.minutes ?? '', decisions: m.decisions ?? '', actionItems: m.actionItems ?? '', followUpRequired: !!m.followUpAt, followUpAt: '' });
    });
  }

  protected open(status: string): boolean {
    return ['planned', 'confirmed', 'rescheduled'].includes(status);
  }

  protected label(value: Parameters<typeof refLabel>[1]): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), value) || '—';
  }

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected setOutcome(key: string, value: unknown): void {
    this.outcome.update((o) => ({ ...o, [key]: value }));
  }

  protected saveOutcome(event: Event): void {
    event.preventDefault();
    const o = this.outcome();
    void this.actions.run(
      this.api.updateMeeting(this.id(), {
        outcome: o.outcome || undefined,
        minutes: o.minutes || undefined,
        decisions: o.decisions || undefined,
        actionItems: o.actionItems || undefined,
        followUpRequired: o.followUpRequired,
        followUpAt: o.followUpRequired && o.followUpAt ? new Date(o.followUpAt).toISOString() : undefined,
      }),
      'prop.saved',
      this.reload,
    );
  }

  protected arrive(capture: GeoCapture): void {
    void this.actions.run(this.api.arrive(this.id(), capture), 'act.meetings.arrived', this.reload);
  }

  protected depart(capture: GeoCapture): void {
    void this.actions.run(this.api.depart(this.id(), capture), 'act.meetings.departed', this.reload);
  }
}

export type { GeoReading };
