import { Component, booleanAttribute, input, model } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import type { SystemDesign } from '../solar.models';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

type Numeric = 'capacityKwp' | 'expectedAnnualGenerationKwh' | 'specificYield' | 'performanceRatio' | 'expectedSelfConsumptionPct';
type Long = 'mounting' | 'cablingProtection' | 'technicalSpecifications' | 'installationRequirements' | 'scope' | 'assumptions' | 'exclusions' | 'technicalTerms';

/** TECH-03 system design editor: capacity, panels, inverters, batteries, yield, scope and terms. */
@Component({
  selector: 'app-design-editor',
  imports: [TranslatePipe, ButtonDirective, ...FORM_IMPORTS, CreateIconComponent],
  templateUrl: './design-editor.component.html',
  host: { class: 'block' },
})
export class DesignEditorComponent {
  readonly design = model<SystemDesign>({});
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly prefix = input('design-');
  /** Technical proposal: scope, assumptions and exclusions are required to submit. */
  readonly requireTerms = input(false, { transform: booleanAttribute });
  /** The page already has its own required capacity field (technical proposal), so the design's copy is not shown. */
  readonly hideCapacity = input(false, { transform: booleanAttribute });
  /** A save / submit was rejected: mark the required fields that are still empty. */
  readonly flag = input(false, { transform: booleanAttribute });

  protected readonly numeric: Numeric[] = ['capacityKwp', 'expectedAnnualGenerationKwh', 'specificYield', 'performanceRatio', 'expectedSelfConsumptionPct'];
  protected readonly long: Long[] = ['mounting', 'cablingProtection', 'technicalSpecifications', 'installationRequirements', 'scope', 'assumptions', 'exclusions', 'technicalTerms'];
  protected readonly groups = [
    { key: 'inverters' as const, rating: 'ratedKw' },
    { key: 'batteries' as const, rating: 'capacityKwh' },
  ];

  protected isRequired(key: Numeric | Long): boolean {
    if (key === 'capacityKwp' || key === 'expectedAnnualGenerationKwh') return true;
    return this.requireTerms() && (key === 'scope' || key === 'assumptions' || key === 'exclusions');
  }

  protected invalid(key: Numeric | Long): boolean {
    if (!this.flag() || this.readonly() || !this.isRequired(key)) return false;
    const value = this.design()[key];
    return typeof value === 'string' ? !value.trim() : !value;
  }

  protected rows(key: 'inverters' | 'batteries'): Array<{ manufacturer?: string; model?: string; quantity?: number }> {
    return (this.design()[key] ?? []) as Array<{ manufacturer?: string; model?: string; quantity?: number }>;
  }

  protected setNumber(key: Numeric, raw: string): void {
    this.design.update((d) => ({ ...d, [key]: raw === '' ? undefined : Number(raw) }));
  }

  protected setText(key: Long, value: string): void {
    this.design.update((d) => ({ ...d, [key]: value }));
  }

  protected setPanel(key: string, value: string | number): void {
    this.design.update((d) => ({ ...d, panels: { ...(d.panels ?? {}), [key]: value } }));
  }

  protected setRow(group: 'inverters' | 'batteries', index: number, key: string, value: string | number): void {
    this.design.update((d) => ({ ...d, [group]: (d[group] ?? []).map((row, i) => (i === index ? { ...row, [key]: value } : row)) }));
  }

  protected addRow(group: 'inverters' | 'batteries'): void {
    this.design.update((d) => ({ ...d, [group]: [...(d[group] ?? []), {}] }));
  }

  protected removeRow(group: 'inverters' | 'batteries', index: number): void {
    this.design.update((d) => ({ ...d, [group]: (d[group] ?? []).filter((_, i) => i !== index) }));
  }
}
