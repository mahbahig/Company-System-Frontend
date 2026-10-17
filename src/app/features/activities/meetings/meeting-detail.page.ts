import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { GeolocationError, GeolocationService } from '../../../core/geo/geolocation.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { ActivitiesApi, refId, refLabel, type GeoReading, type Meeting } from '../activities-api.service';
import { MeetingLocationComponent } from './meeting-location.component';

/** Which capture is running, and its step: reading the device position, then saving it. */
type Capture = { kind: 'start' | 'end'; step: 'locating' | 'saving' };

/**
 * E12 meeting: start / end with location verification, minutes, decisions,
 * action items and follow-up; cancel with a reason.
 *
 * Starting and ending each read the owner's device position at that moment
 * (a fresh reading — never cached, never the start position again, no
 * tracking in between) and send only its coordinates and accuracy; without a
 * position nothing is started or ended, and the reason is said plainly. The
 * API computes the distance and the verdict; coordinates and the map are
 * shown only when the API sends them (`meetings.view_locations`).
 */
@Component({
  selector: 'app-meeting-detail-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, DetailItemComponent, DocumentsPanelComponent, MeetingLocationComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './meeting-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class MeetingDetailPage {
  protected readonly api = inject(ActivitiesApi);
  private readonly auth = inject(AuthService);
  private readonly geolocation = inject(GeolocationService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly refId = refId;

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.meeting(params) });
  protected readonly reload = () => this.data.reload();
  protected readonly canEdit = computed(() => this.auth.can('meetings.edit'));
  protected readonly editable = computed(() => this.canEdit() && this.data.value()?.status !== 'cancelled');
  protected readonly cancelReason = signal('');
  /** The start / end in progress (one at a time — a second click does nothing), and why the last position could not be read. */
  protected readonly capture = signal<Capture | null>(null);
  protected readonly locationError = signal<string | null>(null);
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

  /** Only the meeting's owner starts and ends it (their position is captured; the API refuses anyone else). */
  protected isOwner(meeting: Meeting): boolean {
    return refId(meeting.ownerId as never) === this.auth.user()?.id;
  }

  protected canStart(meeting: Meeting): boolean {
    return this.canEdit() && this.isOwner(meeting) && !meeting.arrival && this.open(meeting.status);
  }

  protected canEnd(meeting: Meeting): boolean {
    return this.canEdit() && this.isOwner(meeting) && !!meeting.arrival && !meeting.departure && this.open(meeting.status);
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

  /**
   * Start or end: a fresh device position first, then the API. A position
   * that cannot be read stops here with a clear message — nothing is sent, no
   * stand-in position is made up.
   */
  protected async record(kind: 'start' | 'end'): Promise<void> {
    if (this.capture() || this.actions.busy()) return;
    this.locationError.set(null);
    this.capture.set({ kind, step: 'locating' });
    try {
      const position = await this.geolocation.current();
      this.capture.set({ kind, step: 'saving' });
      const request = kind === 'start' ? this.api.arrive(this.id(), position) : this.api.depart(this.id(), position);
      await this.actions.run(request, kind === 'start' ? 'act.meetings.started' : 'act.meetings.ended', this.reload);
    } catch (error) {
      const reason = error instanceof GeolocationError ? error.reason : 'unavailable';
      this.locationError.set(this.i18n.t(`act.meetings.location.errors.${reason}`));
    } finally {
      this.capture.set(null);
    }
  }

  /** The button's words for one capture: its step while running. */
  protected captureLabel(kind: 'start' | 'end'): string {
    const capture = this.capture();
    if (capture?.kind !== kind) return this.i18n.t(kind === 'start' ? 'act.meetings.start' : 'act.meetings.end');
    return this.i18n.t(capture.step === 'locating' ? 'act.meetings.gettingLocation' : kind === 'start' ? 'act.meetings.starting' : 'act.meetings.ending');
  }
}

export type { GeoReading };
