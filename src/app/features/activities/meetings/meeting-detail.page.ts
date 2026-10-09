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
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as m) {
      <app-page-header [heading]="m.subject" [subtitle]="i18n.formatDate(m.scheduledAt, true)">
        <app-status-badge enum="meetingStatus" [value]="m.status" />
      </app-page-header>
      @if (actions.message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (actions.error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }
      @if (m.cancellationReason) {
        <app-alert variant="destructive">{{ m.cancellationReason }}</app-alert>
      }
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="flex flex-col gap-6 lg:col-span-2">
          <section appCard>
            <dl appCardContent class="grid gap-4 sm:grid-cols-2">
              <div appDetailItem [label]="'act.fields.customer' | t">
                @if (refId(m.customerId)) {
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'customers', refId(m.customerId)]">{{ label(m.customerId) }}</a>
                }
              </div>
              <div appDetailItem [label]="'act.fields.opportunity' | t">
                @if (refId(m.opportunityId)) {
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'opportunities', refId(m.opportunityId)]">{{ label(m.opportunityId) }}</a>
                } @else {
                  —
                }
              </div>
              <div appDetailItem [label]="'act.fields.mode' | t">{{ m.mode | enum: 'meetingMode' }}</div>
              <div appDetailItem [label]="'act.fields.location' | t">{{ m.location || m.onlineUrl || '—' }}</div>
              <div appDetailItem [label]="'act.columns.owner' | t">{{ name(m.ownerId) }}</div>
              <div appDetailItem [label]="'act.fields.attendees' | t">
                @for (a of m.attendees; track $index) {
                  <span class="me-2 inline-block">{{ a.externalName || name(a.userId ?? null) }}</span>
                } @empty {
                  —
                }
              </div>
              @if (m.agenda) {
                <div appDetailItem class="sm:col-span-2" [label]="'act.fields.agenda' | t"><p class="whitespace-pre-line">{{ m.agenda }}</p></div>
              }
              <div appDetailItem [label]="'act.fields.arrival' | t"><app-geo-reading [reading]="m.arrival" /></div>
              <div appDetailItem [label]="'act.fields.departure' | t"><app-geo-reading [reading]="m.departure" /></div>
            </dl>
          </section>

          <form appCard aria-labelledby="mt-outcome" (submit)="saveOutcome($event)">
            <div appCardHeader><h2 appCardTitle id="mt-outcome">{{ 'act.meetings.outcome' | t }}</h2></div>
            <fieldset appCardContent class="grid gap-4 sm:grid-cols-2" [disabled]="!editable()">
              @for (key of ['outcome', 'minutes', 'decisions', 'actionItems']; track key) {
                <div>
                  <label appLabel [for]="'mt-' + key">{{ 'act.fields.' + key | t }}</label>
                  <textarea appTextarea rows="3" [id]="'mt-' + key" [value]="$any(outcome())[key]" (input)="setOutcome(key, $any($event.target).value)"></textarea>
                </div>
              }
              <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [checked]="outcome().followUpRequired" (change)="setOutcome('followUpRequired', $any($event.target).checked)" /> {{ 'act.fields.followUpRequired' | t }}</label>
              @if (outcome().followUpRequired) {
                <div>
                  <label appLabel for="mt-fu" required>{{ 'act.columns.followUp' | t }}</label>
                  <input appInput id="mt-fu" type="datetime-local" dir="ltr" [value]="outcome().followUpAt" (change)="setOutcome('followUpAt', $any($event.target).value)" />
                </div>
              }
              @if (editable()) {
                <button type="submit" appButton class="self-start sm:col-span-2" [disabled]="actions.busy()">{{ 'act.meetings.saveOutcome' | t }}</button>
              }
            </fieldset>
          </form>
        </div>

        <div class="flex flex-col gap-6">
          @if (canEdit() && !m.arrival && open(m.status)) {
            <section appCard aria-labelledby="mt-arrive">
              <div appCardHeader><h2 appCardTitle id="mt-arrive">{{ 'act.fields.arrival' | t }}</h2></div>
              <div appCardContent><app-gps-capture idPrefix="arrive" [confirmLabel]="'act.meetings.arrive' | t" [busy]="actions.busy()" (captured)="arrive($event)" /></div>
            </section>
          }
          @if (canEdit() && m.arrival && !m.departure && open(m.status)) {
            <section appCard aria-labelledby="mt-depart">
              <div appCardHeader><h2 appCardTitle id="mt-depart">{{ 'act.fields.departure' | t }}</h2></div>
              <div appCardContent><app-gps-capture idPrefix="depart" [confirmLabel]="'act.meetings.depart' | t" [busy]="actions.busy()" (captured)="depart($event)" /></div>
            </section>
          }
          @if (canEdit() && open(m.status)) {
            <section appCard aria-labelledby="mt-cancel">
              <div appCardHeader><h2 appCardTitle id="mt-cancel">{{ 'act.cancel' | t }}</h2></div>
              <div appCardContent class="flex flex-col gap-2">
                <label appLabel for="mt-cancel-reason" required>{{ 'handoffs.reason' | t }}</label>
                <input appInput id="mt-cancel-reason" [value]="cancelReason()" (input)="cancelReason.set($any($event.target).value)" />
                <button type="button" appButton variant="destructive" [disabled]="actions.busy() || !cancelReason().trim()" (click)="actions.run(api.cancelMeeting(id(), cancelReason().trim()), 'act.cancelled', reload)">{{ 'act.cancel' | t }}</button>
              </div>
            </section>
          }
          <app-documents-panel entityType="meeting" [entityId]="id()" />
        </div>
      </div>
    }
  `,
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
