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
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, CompletenessPanelComponent, DocumentsPanelComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (view.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(view.error()) }}</app-alert>
    }
    @if (view.value(); as v) {
      @let h = v.handoff;
      <app-page-header [eyebrow]="h.handoffNo ?? ''" [heading]="'handoffs.title' | t" [subtitle]="'handoffs.subtitle' | t">
        <app-status-badge enum="handoffStatus" [value]="h.status" />
        <a appButton variant="outline" [routerLink]="['/', i18n.locale(), 'opportunities', id()]">{{ 'handoffs.backToOpportunity' | t }}</a>
      </app-page-header>

      @if (message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }
      @if (h.status === 'returned' && h.returnReason) {
        <app-alert variant="destructive">{{ 'handoffs.returnedBecause' | t: { reason: h.returnReason } }}</app-alert>
      }

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="flex flex-col gap-6 lg:col-span-2">
          <section appCard aria-labelledby="package-heading">
            <div appCardHeader><h2 appCardTitle id="package-heading">{{ 'handoffs.package' | t }}</h2></div>
            <div appCardContent>
              <ul class="grid gap-2 sm:grid-cols-2">
                @for (item of checklist(); track item.key) {
                  <li class="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" class="flex size-5 items-center justify-center rounded-full text-xs font-bold" [class]="item.ok ? 'bg-success/15 text-success-tint' : 'bg-destructive/15 text-destructive-tint'">{{ item.ok ? '✓' : '✗' }}</span>
                    <span>{{ item.label }}</span>
                    <span class="sr-only">{{ (item.ok ? 'handoffs.itemOk' : 'handoffs.itemMissing') | t }}</span>
                  </li>
                }
              </ul>
            </div>
          </section>

          <app-completeness-panel [result]="v.readiness.completeness" [heading]="'handoffs.readiness' | t" entityType="opportunity" [entityId]="id()" />

          @if (h.clarifications.length) {
            <section appCard aria-labelledby="clarify-heading">
              <div appCardHeader><h2 appCardTitle id="clarify-heading">{{ 'handoffs.clarifications' | t }}</h2></div>
              <div appCardContent class="flex flex-col gap-3">
                @for (entry of h.clarifications; track $index) {
                  <div class="rounded-md border border-border p-3 text-sm">
                    <p class="text-xs text-muted-foreground">{{ name(entry.askedBy) }} · <span class="tabular">{{ i18n.formatDate(entry.askedAt, true) }}</span></p>
                    <p class="mt-1 font-medium">{{ entry.question }}</p>
                    @if (entry.answer) {
                      <p class="mt-2 border-s-2 border-primary ps-3">{{ entry.answer }}</p>
                      <p class="mt-1 text-xs text-muted-foreground">{{ name(entry.answeredBy ?? null) }} · <span class="tabular">{{ i18n.formatDate(entry.answeredAt, true) }}</span></p>
                    }
                  </div>
                }
              </div>
            </section>
          }

          @if (h.versions.length) {
            <section class="flex flex-col gap-3" aria-labelledby="versions-heading">
              <h2 id="versions-heading" class="text-lg font-semibold">{{ 'handoffs.versions' | t }}</h2>
              <app-table-wrapper [label]="'handoffs.versions' | t">
                <table appTable>
                  <thead appTableHeader>
                    <tr appTableRow>
                      <th appTableHead>{{ 'handoffs.version' | t }}</th>
                      <th appTableHead>{{ 'handoffs.columns.submittedBy' | t }}</th>
                      <th appTableHead>{{ 'handoffs.columns.submitted' | t }}</th>
                      <th appTableHead>{{ 'handoffs.override' | t }}</th>
                    </tr>
                  </thead>
                  <tbody appTableBody>
                    @for (version of h.versions; track version.version) {
                      <tr appTableRow>
                        <td appTableCell class="tabular">v{{ version.version }}</td>
                        <td appTableCell>{{ name(version.submittedBy) }}</td>
                        <td appTableCell class="tabular">{{ i18n.formatDate(version.submittedAt, true) }}</td>
                        <td appTableCell>{{ version.overrideReason || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </app-table-wrapper>
            </section>
          }

          <app-documents-panel entityType="opportunity" [entityId]="id()" [opportunityScope]="true" />
        </div>

        <div class="flex flex-col gap-6">
          @if (canSubmit() && submittable()) {
            <section appCard aria-labelledby="submit-heading">
              <div appCardHeader><h2 appCardTitle id="submit-heading">{{ 'handoffs.submitTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="run($event, api.submit(id(), overrideReason().trim() || undefined), 'handoffs.submitted')">
                @if (!v.readiness.ready) {
                  <app-alert variant="destructive">{{ 'handoffs.blocked' | t: { count: v.readiness.missing.length } }}</app-alert>
                  @if (auth.can('gates.override')) {
                    <div>
                      <label appLabel for="override" required>{{ 'handoffs.overrideReason' | t }}</label>
                      <textarea appTextarea id="override" rows="3" [value]="overrideReason()" (input)="overrideReason.set($any($event.target).value)"></textarea>
                    </div>
                  }
                }
                <button type="submit" appButton [disabled]="busy() || (!v.readiness.ready && (!auth.can('gates.override') || !overrideReason().trim()))">{{ 'handoffs.submit' | t }}</button>
              </form>
            </section>
          }

          @if (canSubmit() && openClarification()) {
            <section appCard aria-labelledby="answer-heading">
              <div appCardHeader><h2 appCardTitle id="answer-heading">{{ 'handoffs.answerTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="run($event, api.answer(id(), text().trim()), 'handoffs.answered')">
                <p class="text-sm">{{ openClarification() }}</p>
                <label appLabel for="answer" required>{{ 'handoffs.answer' | t }}</label>
                <textarea appTextarea id="answer" rows="3" [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
                <button type="submit" appButton [disabled]="busy() || !text().trim()">{{ 'handoffs.sendAnswer' | t }}</button>
              </form>
            </section>
          }

          @if (canSubmit() && ['submitted', 'under_review', 'resubmitted'].includes(h.status)) {
            <section appCard aria-labelledby="withdraw-heading">
              <div appCardHeader><h2 appCardTitle id="withdraw-heading">{{ 'handoffs.withdrawTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="run($event, api.withdraw(id(), text().trim()), 'handoffs.withdrawn')">
                <label appLabel for="withdraw-reason" required>{{ 'handoffs.reason' | t }}</label>
                <textarea appTextarea id="withdraw-reason" rows="2" [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
                <button type="submit" appButton variant="outline" [disabled]="busy() || !text().trim()">{{ 'handoffs.withdraw' | t }}</button>
              </form>
            </section>
          }

          @if (canDecide() && decidable()) {
            <section appCard aria-labelledby="accept-heading">
              <div appCardHeader><h2 appCardTitle id="accept-heading">{{ 'handoffs.acceptTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="run($event, api.accept(id(), { engineerId: engineerId(), techLeadId: techLeadId() || null }), 'handoffs.accepted')">
                <div>
                  <label appLabel for="engineer" required>{{ 'handoffs.engineer' | t }}</label>
                  <app-user-select inputId="engineer" roles="technical_proposal_engineer,technical_lead" [(value)]="engineerId" />
                </div>
                <div>
                  <label appLabel for="techlead">{{ 'handoffs.techLead' | t }}</label>
                  <app-user-select inputId="techlead" roles="technical_lead" [(value)]="techLeadId" />
                </div>
                <button type="submit" appButton [disabled]="busy() || !engineerId()">{{ 'handoffs.accept' | t }}</button>
              </form>
            </section>

            <section appCard aria-labelledby="return-heading">
              <div appCardHeader><h2 appCardTitle id="return-heading">{{ 'handoffs.returnTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="returnHandoff($event)">
                <fieldset class="flex flex-col gap-1">
                  <legend class="mb-1 text-sm font-medium">{{ 'handoffs.missingItems' | t }}</legend>
                  @for (item of checklist(); track item.key) {
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="returnItems().includes(item.key)" (change)="toggleItem(item.key)" /> {{ item.label }}</label>
                  }
                </fieldset>
                <div>
                  <label appLabel for="return-other">{{ 'handoffs.otherItem' | t }}</label>
                  <input appInput id="return-other" [value]="otherItem()" (input)="otherItem.set($any($event.target).value)" />
                </div>
                <div>
                  <label appLabel for="return-reason" required>{{ 'handoffs.reason' | t }}</label>
                  <textarea appTextarea id="return-reason" rows="2" [value]="returnReason()" (input)="returnReason.set($any($event.target).value)"></textarea>
                </div>
                <button type="submit" appButton variant="destructive" [disabled]="busy() || !returnReason().trim() || (!returnItems().length && !otherItem().trim())">{{ 'handoffs.return' | t }}</button>
              </form>
            </section>

            <section appCard aria-labelledby="clarify-form-heading">
              <div appCardHeader><h2 appCardTitle id="clarify-form-heading">{{ 'handoffs.clarifyTitle' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-3" (submit)="run($event, api.clarify(id(), question().trim()), 'handoffs.clarificationSent')">
                <label appLabel for="question" required>{{ 'handoffs.question' | t }}</label>
                <textarea appTextarea id="question" rows="2" [value]="question()" (input)="question.set($any($event.target).value)"></textarea>
                <button type="submit" appButton variant="outline" [disabled]="busy() || !question().trim()">{{ 'handoffs.clarify' | t }}</button>
              </form>
            </section>
          }
        </div>
      </div>
    } @else if (view.isLoading()) {
      <p class="text-sm text-muted-foreground">{{ 'common.labels.loading' | t }}</p>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class HandoffPage {
  protected readonly api = inject(HandoffsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  /** Opportunity id (route param). */
  readonly id = input.required<string>();

  protected readonly view = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
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
