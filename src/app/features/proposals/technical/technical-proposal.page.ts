import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { BomEditorComponent } from '../../solar/editors/bom-editor.component';
import { DesignEditorComponent } from '../../solar/editors/design-editor.component';
import type { BomItem, SystemDesign } from '../../solar/solar.models';
import type { Person } from '../proposals.models';
import { ProposalsApi } from '../proposals-api.service';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/**
 * TPROP-01..05 technical proposal version. Only the assigned technical team
 * edits (PROP-10); everyone else gets an explicit read-only view. Submit →
 * Technical Lead approve / return; an approved version is locked.
 */
@Component({
  selector: 'app-technical-proposal-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, CompletenessPanelComponent, DocumentsPanelComponent, AlertComponent, ButtonDirective, PageHeaderComponent, DesignEditorComponent, BomEditorComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      @let p = d.proposal;
      <app-page-header [eyebrow]="p.number + ' · v' + p.versionNo" [heading]="'prop.tabs.technical' | t" [subtitle]="'assess.engineer' | t: { name: name(p.authorId) }">
        <app-status-badge enum="technicalProposalStatus" [value]="p.status" />
        <a appButton variant="outline" [routerLink]="['/', i18n.locale(), 'opportunities', p.opportunityId, 'proposals']" [queryParams]="{ tab: 'technical' }">{{ 'prop.workspaceTitle' | t }}</a>
      </app-page-header>

      @if (actions.message(); as text) {
        <app-alert>{{ text }}</app-alert>
      }
      @if (actions.error(); as text) {
        <app-alert variant="destructive">{{ text }}</app-alert>
      }
      @if (!d.canEdit) {
        <app-alert>{{ (p.status === 'approved' || p.status === 'superseded' ? 'prop.lockedNotice' : 'prop.readOnlyNotice') | t }}</app-alert>
      }
      @if (p.decisionReason && p.status === 'returned') {
        <app-alert variant="destructive">{{ 'assess.returnReason' | t }}: {{ p.decisionReason }}</app-alert>
      }

      <div class="grid gap-6 lg:grid-cols-3">
        <form class="flex flex-col gap-6 lg:col-span-2" (submit)="save($event)">
          <section appCard aria-labelledby="tp-design">
            <div appCardHeader><h2 appCardTitle id="tp-design">{{ 'crm.assessments.sections.design' | t }}</h2></div>
            <div appCardContent class="flex flex-col gap-4">
              <fieldset class="grid gap-4 sm:grid-cols-2" [disabled]="!d.canEdit">
                <div>
                  <label appLabel for="tp-kwp" required>{{ 'prop.fields.capacityKwp' | t }}</label>
                  <input appInput id="tp-kwp" type="number" step="any" dir="ltr" [attr.aria-invalid]="actions.failed() && capacity() === undefined ? 'true' : null" [value]="capacity() ?? ''" (input)="capacity.set(num($any($event.target).value))" />
                  @if (actions.failed() && capacity() === undefined) {
                    <p class="mt-1 text-xs text-destructive" role="alert">{{ 'common.labels.required' | t }}</p>
                  }
                </div>
                <div>
                  <label appLabel for="tp-storage">{{ 'prop.fields.storageKwh' | t }}</label>
                  <input appInput id="tp-storage" type="number" step="any" dir="ltr" [value]="storage() ?? ''" (input)="storage.set(num($any($event.target).value))" />
                </div>
              </fieldset>
              <app-design-editor [(design)]="design" [readonly]="!d.canEdit" prefix="tp-" requireTerms hideCapacity [flag]="actions.failed()" />
            </div>
          </section>
          <section appCard aria-labelledby="tp-equipment">
            <div appCardHeader><h2 appCardTitle id="tp-equipment">{{ 'prop.fields.equipment' | t }} <span aria-hidden="true" class="text-destructive">*</span></h2></div>
            <div appCardContent><app-bom-editor [(items)]="equipment" [readonly]="!d.canEdit" requireLine [flag]="actions.failed()" /></div>
          </section>
          <section appCard aria-labelledby="tp-bom">
            <div appCardHeader><h2 appCardTitle id="tp-bom">{{ 'solar.bom.title' | t }}</h2></div>
            <div appCardContent><app-bom-editor [(items)]="bom" [readonly]="!d.canEdit" /></div>
          </section>
          <section appCard aria-labelledby="tp-warranty">
            <div appCardHeader><h2 appCardTitle id="tp-warranty">{{ 'prop.fields.warranties' | t }}</h2></div>
            <fieldset appCardContent [disabled]="!d.canEdit">
              <label appLabel for="tp-warranties" class="sr-only">{{ 'prop.fields.warranties' | t }}</label>
              <textarea appTextarea id="tp-warranties" rows="3" [attr.aria-invalid]="actions.problems().has('warranties') ? 'true' : null" [value]="warranties()" (input)="warranties.set($any($event.target).value)"></textarea>
            </fieldset>
          </section>
          @if (d.canEdit) {
            <p class="text-sm text-muted-foreground">{{ 'prop.submitHint' | t }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="submit" appButton [disabled]="actions.busy()">{{ 'crm.common.save' | t }}</button>
              <button type="button" appButton variant="outline" [disabled]="actions.busy()" (click)="submit()">{{ 'prop.submitForReview' | t }}</button>
            </div>
          }
        </form>

        <div class="flex flex-col gap-6">
          @if (d.canReview) {
            <section appCard aria-labelledby="tp-review">
              <div appCardHeader><h2 appCardTitle id="tp-review">{{ 'crm.assessments.sections.review' | t }}</h2></div>
              <div appCardContent class="flex flex-col gap-3">
                <label appLabel for="tp-reason">{{ 'prop.decisionReason' | t }}</label>
                <textarea appTextarea id="tp-reason" rows="2" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
                <label appLabel for="tp-conditions">{{ 'prop.feasibility.conditions' | t }}</label>
                <textarea appTextarea id="tp-conditions" rows="2" [value]="conditions()" (input)="conditions.set($any($event.target).value)"></textarea>
                <div class="flex flex-wrap gap-2">
                  <button type="button" appButton [disabled]="actions.busy()" (click)="actions.run(api.decideTechnical(id(), { decision: 'approve' }), 'prop.decided', reload)">{{ 'prop.approve' | t }}</button>
                  <button type="button" appButton variant="outline" [disabled]="actions.busy() || !conditions().trim()" (click)="actions.run(api.decideTechnical(id(), { decision: 'approve_with_conditions', conditions: conditions().trim() }), 'prop.decided', reload)">{{ 'prop.feasibility.approveWithConditions' | t }}</button>
                  <button type="button" appButton variant="outline" [disabled]="actions.busy() || !reason().trim()" (click)="actions.run(api.decideTechnical(id(), { decision: 'return', reason: reason().trim() }), 'prop.decided', reload)">{{ 'prop.returnVersion' | t }}</button>
                  <button type="button" appButton variant="destructive" [disabled]="actions.busy() || !reason().trim()" (click)="actions.run(api.decideTechnical(id(), { decision: 'reject', reason: reason().trim() }), 'prop.decided', reload)">{{ 'prop.feasibility.reject' | t }}</button>
                </div>
                <p class="text-xs text-muted-foreground">{{ 'prop.feasibility.rejectHint' | t }}</p>
              </div>
            </section>
          }
          <app-completeness-panel [result]="d.completeness" entityType="technical_proposal" [entityId]="id()" />
          <section appCard aria-labelledby="tp-versions">
            <div appCardHeader><h2 appCardTitle id="tp-versions">{{ 'prop.versions' | t }}</h2></div>
            <ul appCardContent class="flex flex-col gap-2 text-sm">
              @for (v of d.versions; track v.id) {
                <li class="flex items-center justify-between gap-2">
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'proposals', 'technical', v.id]">v{{ v.versionNo }}</a>
                  <app-status-badge enum="technicalProposalStatus" [value]="v.status" />
                </li>
              }
            </ul>
          </section>
          @if (actions.problems().has('designFiles')) {
            <app-alert variant="destructive">{{ 'prop.designFilesNeeded' | t }}</app-alert>
          }
          <app-documents-panel entityType="technical_proposal" [entityId]="id()" />
        </div>
      </div>
    } @else if (data.isLoading()) {
      <app-detail-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class TechnicalProposalPage {
  protected readonly api = inject(ProposalsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.technical(params) });
  protected readonly capacity = signal<number | undefined>(undefined);
  protected readonly storage = signal<number | undefined>(undefined);
  protected readonly design = signal<SystemDesign>({});
  protected readonly equipment = signal<BomItem[]>([]);
  protected readonly bom = signal<BomItem[]>([]);
  protected readonly warranties = signal('');
  protected readonly reason = signal('');
  protected readonly conditions = signal('');
  protected readonly reload = () => this.data.reload();
  protected readonly proposal = computed(() => this.data.value()?.proposal);

  constructor() {
    effect(() => {
      const p = this.proposal();
      if (!p) return;
      this.capacity.set(p.capacityKwp);
      this.storage.set(p.storageKwh);
      this.design.set({ ...(p.design ?? {}), scope: p.scope ?? p.design?.scope, assumptions: p.assumptions ?? p.design?.assumptions, exclusions: p.exclusions ?? p.design?.exclusions, technicalTerms: p.technicalTerms ?? p.design?.technicalTerms });
      this.equipment.set(normalise(p.equipment));
      this.bom.set(normalise(p.bom));
      this.warranties.set(p.warranties ?? '');
    });
  }

  protected num(raw: string): number | undefined {
    return raw === '' ? undefined : Number(raw);
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected save(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.saveRequest(), 'prop.saved', this.reload);
  }

  /** Submit sends what is on screen: save first, so unsaved entries are not reported as missing. */
  protected submit(): void {
    void this.actions.run(this.saveRequest().pipe(switchMap(() => this.api.submitTechnical(this.id()))), 'prop.submitted', this.reload);
  }

  private saveRequest() {
    const design = { ...this.design(), capacityKwp: this.capacity() };
    return this.api.updateTechnical(this.id(), {
      capacityKwp: this.capacity(),
      storageKwh: this.storage(),
      design,
      equipment: this.equipment().filter((line) => line.description.trim()),
      bom: this.bom().filter((line) => line.description.trim()),
      expectedAnnualGenerationKwh: design.expectedAnnualGenerationKwh,
      specificYield: design.specificYield,
      performanceRatio: design.performanceRatio,
      scope: design.scope,
      assumptions: design.assumptions,
      exclusions: design.exclusions,
      technicalTerms: design.technicalTerms,
      warranties: this.warranties(),
    });
  }
}

function normalise(lines: BomItem[] | undefined): BomItem[] {
  return (lines ?? []).map((line) => ({ ...line, equipmentId: line.equipmentId ? String(line.equipmentId) : null }));
}
