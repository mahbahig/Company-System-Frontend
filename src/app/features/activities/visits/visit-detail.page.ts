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
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as v) {
      <app-page-header [heading]="v.visitNo" [subtitle]="(v.purpose | enum: 'visitPurpose') + ' · ' + i18n.formatDate(v.scheduledAt, true)">
        <app-status-badge enum="visitStatus" [value]="v.status" />
      </app-page-header>
      @if (actions.message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (actions.error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }
      @if (v.cancellationReason) {
        <app-alert variant="destructive">{{ v.cancellationReason }}</app-alert>
      }
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="flex flex-col gap-6 lg:col-span-2">
          <section appCard>
            <dl appCardContent class="grid gap-4 sm:grid-cols-2">
              <div appDetailItem [label]="'act.fields.customer' | t">
                @if (refId(v.customerId)) {
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'customers', refId(v.customerId)]">{{ label(v.customerId) }}</a>
                }
              </div>
              <div appDetailItem [label]="'act.fields.opportunity' | t">
                @if (refId(v.opportunityId)) {
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', refId(v.opportunityId)]">{{ label(v.opportunityId) }}</a>
                } @else {
                  —
                }
              </div>
              <div appDetailItem [label]="'act.fields.visitType' | t">{{ v.visitTypeCode ? reference.label('visit_type', v.visitTypeCode) : '—' }}</div>
              <div appDetailItem [label]="'act.fields.plannedAddress' | t">{{ v.plannedAddress || label(v.siteId) }}</div>
              <div appDetailItem [label]="'act.columns.owner' | t">{{ name(v.ownerId) }}</div>
              <div appDetailItem [label]="'act.fields.participants' | t">
                @for (p of v.participantIds; track $index) {
                  <span class="me-2 inline-block">{{ name(p) }}</span>
                } @empty {
                  —
                }
              </div>
              <div appDetailItem [label]="'act.fields.checkIn' | t"><app-geo-reading [reading]="v.checkIn" /></div>
              <div appDetailItem [label]="'act.fields.checkOut' | t"><app-geo-reading [reading]="v.checkOut" /></div>
              @if (v.durationMinutes) {
                <div appDetailItem [label]="'act.fields.durationMinutes' | t"><span class="tabular">{{ i18n.formatNumber(v.durationMinutes) }}</span></div>
              }
              @if (v.requiresTechnicalAssessment) {
                <div appDetailItem [label]="'act.fields.requiresTechnicalAssessment' | t">✓</div>
              }
            </dl>
          </section>

          <form appCard aria-labelledby="vs-report" (submit)="saveReport($event)">
            <div appCardHeader><h2 appCardTitle id="vs-report">{{ 'act.visits.report' | t }}</h2></div>
            <fieldset appCardContent class="grid gap-4 sm:grid-cols-2" [disabled]="!editable()">
              <div>
                <label appLabel for="vs-outcome">{{ 'act.columns.outcome' | t }}</label>
                <app-select>
                  <select appSelect id="vs-outcome" [value]="report().outcomeCode" (change)="setReport('outcomeCode', $any($event.target).value)">
                    <option value="">—</option>
                    @for (option of reference.options('visit_outcome'); track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </app-select>
              </div>
              <div>
                <label appLabel for="vs-next">{{ 'act.fields.nextAction' | t }}</label>
                <input appInput id="vs-next" [value]="report().nextAction" (input)="setReport('nextAction', $any($event.target).value)" />
              </div>
              <div class="sm:col-span-2">
                <label appLabel for="vs-report-text">{{ 'act.visits.report' | t }}</label>
                <textarea appTextarea id="vs-report-text" rows="4" [value]="report().report" (input)="setReport('report', $any($event.target).value)"></textarea>
              </div>
              <div class="sm:col-span-2">
                <label appLabel for="vs-notes">{{ 'act.fields.notes' | t }}</label>
                <textarea appTextarea id="vs-notes" rows="2" [value]="report().notes" (input)="setReport('notes', $any($event.target).value)"></textarea>
              </div>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="report().requiresTechnicalAssessment" (change)="setReport('requiresTechnicalAssessment', $any($event.target).checked)" /> {{ 'act.fields.requiresTechnicalAssessment' | t }}</label>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="report().followUpRequired" (change)="setReport('followUpRequired', $any($event.target).checked)" /> {{ 'act.fields.followUpRequired' | t }}</label>
              @if (report().followUpRequired) {
                <div>
                  <label appLabel for="vs-fu" required>{{ 'act.columns.followUp' | t }}</label>
                  <input appInput id="vs-fu" type="datetime-local" dir="ltr" [value]="report().followUpAt" (change)="setReport('followUpAt', $any($event.target).value)" />
                </div>
              }
              @if (editable()) {
                <button type="submit" appButton class="self-start sm:col-span-2" [disabled]="actions.busy() || (report().followUpRequired && !report().followUpAt)">{{ 'act.visits.saveReport' | t }}</button>
              }
            </fieldset>
          </form>
        </div>

        <div class="flex flex-col gap-6">
          @if (canEdit() && !v.checkIn && open(v.status)) {
            <section appCard aria-labelledby="vs-checkin">
              <div appCardHeader><h2 appCardTitle id="vs-checkin">{{ 'act.fields.checkIn' | t }}</h2></div>
              <div appCardContent><app-gps-capture idPrefix="checkin" [confirmLabel]="'act.visits.checkIn' | t" [busy]="actions.busy()" (captured)="checkIn($event)" /></div>
            </section>
          }
          @if (canEdit() && v.checkIn && !v.checkOut && v.status === 'in_progress') {
            <section appCard aria-labelledby="vs-checkout">
              <div appCardHeader><h2 appCardTitle id="vs-checkout">{{ 'act.fields.checkOut' | t }}</h2></div>
              <div appCardContent><app-gps-capture idPrefix="checkout" [confirmLabel]="'act.visits.checkOut' | t" [busy]="actions.busy()" (captured)="checkOut($event)" /></div>
            </section>
          }
          @if (canEdit() && open(v.status)) {
            <section appCard aria-labelledby="vs-cancel">
              <div appCardHeader><h2 appCardTitle id="vs-cancel">{{ 'act.cancel' | t }}</h2></div>
              <div appCardContent class="flex flex-col gap-2">
                <label appLabel for="vs-cancel-reason" required>{{ 'handoffs.reason' | t }}</label>
                <input appInput id="vs-cancel-reason" [value]="cancelReason()" (input)="cancelReason.set($any($event.target).value)" />
                <button type="button" appButton variant="destructive" [disabled]="actions.busy() || !cancelReason().trim()" (click)="actions.run(api.cancelVisit(id(), cancelReason().trim()), 'act.cancelled', reload)">{{ 'act.cancel' | t }}</button>
              </div>
            </section>
          }
          <app-documents-panel entityType="visit" [entityId]="id()" />
        </div>
      </div>
    }
  `,
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
