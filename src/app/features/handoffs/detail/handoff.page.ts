import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { userName } from '../../../shared/utils/display-name';
import { HandoffsApi } from '../handoffs-api.service';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

const SUBMITTABLE = ['draft', 'returned', 'withdrawn'];
const DECIDABLE = ['submitted', 'under_review', 'resubmitted', 'clarification_requested'];

/**
 * HAND-01..08 one opportunity's handoff: the auto-assembled package with ✓/✗
 * per required item, Sales submission (override with reason when allowed),
 * and the PM's Accept (with engineer / tech-lead assignment) · Return for
 * information (reason + missing items) · Request clarification thread.
 */
@Component({
  selector: 'app-handoff-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, CompletenessPanelComponent, DocumentsPanelComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PagerComponent, PagerSizeComponent],
  templateUrl: './handoff.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class HandoffPage {
  protected readonly api = inject(HandoffsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  /** Opportunity id (route param). */
  readonly id = input.required<string>();

  protected readonly view = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  /** The handoff's versions, paged in memory. */
  protected readonly versionsPager = new LocalPager(() => this.view.value()?.handoff.versions);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly overrideReason = signal('');
  protected readonly text = signal('');
  protected readonly question = signal('');
  protected readonly engineerId = signal('');
  protected readonly techLeadId = signal('');
  protected readonly returnReason = signal('');
  protected readonly returnItems = signal<string[]>([]);
  protected readonly otherItem = signal('');

  protected readonly canSubmit = computed(() => this.auth.can('handoffs.submit'));
  protected readonly canDecide = computed(() => this.auth.can('handoffs.decide'));
  protected readonly submittable = computed(() => SUBMITTABLE.includes(this.view.value()?.handoff.status ?? ''));
  protected readonly decidable = computed(() => DECIDABLE.includes(this.view.value()?.handoff.status ?? ''));
  protected readonly openClarification = computed(() => this.view.value()?.handoff.clarifications.find((entry) => !entry.answer)?.question ?? null);

  /** ✓/✗ per required package item (gate items of the handoff rules + site rules). */
  protected readonly checklist = computed(() => {
    const v = this.view.value();
    if (!v) return [];
    const missing = new Set(v.readiness.missing.map((item) => `${item.entity}.${item.id}`));
    const handoffMissing = v.readiness.completeness.missing.filter((item) => item.level !== 'recommended').map((item) => item.id);
    const all = new Set([...HANDOFF_ITEMS, ...handoffMissing]);
    const rows = [...all].map((id) => ({ key: `handoff.${id}`, label: this.label(id), ok: !missing.has(`handoff.${id}`) }));
    for (const item of v.readiness.missing.filter((entry) => entry.entity === 'site')) rows.push({ key: `site.${item.id}`, label: this.label(item.id), ok: false });
    return rows;
  });

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected toggleItem(key: string): void {
    this.returnItems.update((items) => (items.includes(key) ? items.filter((item) => item !== key) : [...items, key]));
  }

  protected returnHandoff(event: Event): void {
    const items = [...this.returnItems(), ...(this.otherItem().trim() ? [this.otherItem().trim()] : [])];
    void this.run(event, this.api.returnForInformation(this.id(), { reason: this.returnReason().trim(), missingItemIds: items }), 'handoffs.returnedMessage');
  }

  protected async run(event: Event, action: Observable<unknown>, successKey: string): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await firstValueFrom(action);
      this.message.set(this.i18n.t(successKey));
      this.text.set('');
      this.question.set('');
      this.overrideReason.set('');
      this.view.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  private label(id: string): string {
    const key = `completeness.items.${id}`;
    return this.i18n.has(key) ? this.i18n.t(key) : id;
  }
}

/** HAND-02 package items (gate rules of the handoff), shown even when satisfied. */
const HANDOFF_ITEMS = ['customer', 'primaryContact', 'decisionMaker', 'site', 'siteDetails', 'utilityBills', 'sitePhotos', 'technicalIntake', 'consumption', 'expectedSystem', 'commercialRequirements', 'budgetFinancing', 'timeline'];
