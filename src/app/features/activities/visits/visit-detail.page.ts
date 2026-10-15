import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
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
import { ActivitiesApi, refId, refLabel } from '../activities-api.service';
import { GeoReadingComponent } from '../shared/geo-reading.component';

/**
 * E13 site visit: GPS check-in / check-out (distance from the planned site
 * only with `visits.view_locations`), outcome, report, photos and documents,
 * next action and follow-up; cancel with a reason.
 */
@Component({
  selector: 'app-visit-detail-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, DetailItemComponent, DocumentsPanelComponent, GpsCaptureComponent, GeoReadingComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './visit-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class VisitDetailPage {
  protected readonly api = inject(ActivitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly refId = refId;

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.visit(params) });
  protected readonly reload = () => this.data.reload();
  protected readonly canEdit = computed(() => this.auth.can('visits.edit'));
  protected readonly editable = computed(() => this.canEdit() && this.data.value()?.status !== 'cancelled');
  protected readonly cancelReason = signal('');
  protected readonly report = signal({ outcomeCode: '', report: '', notes: '', nextAction: '', requiresTechnicalAssessment: false, followUpRequired: false, followUpAt: '' });

  constructor() {
    void this.reference.load();
    effect(() => {
      const v = this.data.value();
      if (v) {
        this.report.set({
          outcomeCode: v.outcomeCode ?? '',
          report: v.report ?? '',
          notes: v.notes ?? '',
          nextAction: v.nextAction ?? '',
          requiresTechnicalAssessment: v.requiresTechnicalAssessment,
          followUpRequired: !!v.followUpAt,
          followUpAt: v.followUpAt ? v.followUpAt.slice(0, 16) : '',
        });
      }
    });
  }

  protected open(status: string): boolean {
    return ['planned', 'rescheduled', 'in_progress'].includes(status);
  }

  protected label(value: Parameters<typeof refLabel>[1]): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), value) || '—';
  }

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected setReport(key: string, value: unknown): void {
    this.report.update((r) => ({ ...r, [key]: value }));
  }

  protected saveReport(event: Event): void {
    event.preventDefault();
    const r = this.report();
    void this.actions.run(
      this.api.updateVisit(this.id(), {
        outcomeCode: r.outcomeCode || undefined,
        report: r.report || undefined,
        notes: r.notes || undefined,
        nextAction: r.nextAction || undefined,
        requiresTechnicalAssessment: r.requiresTechnicalAssessment,
        followUpRequired: r.followUpRequired,
        followUpAt: r.followUpRequired && r.followUpAt ? new Date(r.followUpAt).toISOString() : null,
      }),
      'prop.saved',
      this.reload,
    );
  }

  protected checkIn(capture: GeoCapture): void {
    void this.actions.run(this.api.checkIn(this.id(), capture), 'act.visits.checkedIn', this.reload);
  }

  protected checkOut(capture: GeoCapture): void {
    void this.actions.run(this.api.checkOut(this.id(), capture), 'act.visits.checkedOut', this.reload);
  }
}
