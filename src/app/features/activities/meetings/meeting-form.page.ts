import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { ActivitiesApi } from '../activities-api.service';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

interface Attendee {
  userId?: string;
  contactId?: string;
  externalName?: string;
  externalRole?: string;
}

const EMPTY_FORM = { subject: '', scheduledAt: '', endsAt: '', mode: 'in_person', location: '', onlineUrl: '', agenda: '' };

/** E12 schedule a meeting with internal, contact and external attendees. */
@Component({
  selector: 'app-meeting-form-page',
  imports: [SaveShortcutDirective, BreadcrumbsComponent, TranslatePipe, EnumLabelPipe, RecordPickerComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, CreateIconComponent],
  templateUrl: './meeting-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class MeetingFormPage implements HasUnsavedChanges {
  private readonly api = inject(ActivitiesApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly customerId = input<string>();
  readonly opportunityId = input<string>();

  protected readonly customer = linkedSignal(() => this.customerId() ?? '');
  protected readonly opportunity = linkedSignal(() => this.opportunityId() ?? '');
  protected readonly attendees = signal<Attendee[]>([]);
  protected readonly form = signal({ ...EMPTY_FORM });

  private saved = false;
  protected readonly crumbs = computed(() => [{ label: this.i18n.t('navigation.items.meetings'), path: '/meetings' }, { label: this.i18n.t('act.meetings.new') }]);
  /** Why Save is unavailable, in words (instead of a silently disabled button). */
  protected readonly missing = computed(() => (!this.form().subject.trim() || !this.customer() || !this.form().scheduledAt ? 'ux.forms.meetingNeeds' : null));

  constructor() {
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && (JSON.stringify(this.form()) !== JSON.stringify(EMPTY_FORM) || this.customer() !== (this.customerId() ?? '') || this.opportunity() !== (this.opportunityId() ?? ''));
  }

  protected set(key: string, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected setAttendee(index: number, key: keyof Attendee, value: string): void {
    this.attendees.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value || undefined } : row)));
  }

  protected removeAttendee(index: number): void {
    this.attendees.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.createMeeting({
        subject: f.subject.trim(),
        customerId: this.customer(),
        opportunityId: this.opportunity() || undefined,
        scheduledAt: new Date(f.scheduledAt).toISOString(),
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
        mode: f.mode,
        location: f.location || undefined,
        onlineUrl: f.onlineUrl || undefined,
        agenda: f.agenda || undefined,
        attendees: this.attendees().filter((a) => a.userId || a.contactId || a.externalName),
      }),
      null,
      (meeting) => {
        this.saved = true;
        void this.router.navigate(['/', 'meetings', meeting.id]);
      },
    );
  }
}
