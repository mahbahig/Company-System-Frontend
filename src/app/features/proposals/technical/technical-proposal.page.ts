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
  templateUrl: './technical-proposal.page.html',
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
