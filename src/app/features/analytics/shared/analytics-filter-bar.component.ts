import { Component, booleanAttribute, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';

/**
 * E4 analytics filters (period, rep, source, campaign, governorate, solution
 * type). Like the list toolbar, the state lives in the URL so a filtered
 * dashboard can be shared and survives a reload.
 */
@Component({
  selector: 'app-analytics-filter-bar',
  imports: [TranslatePipe, ButtonDirective, InputDirective, LabelComponent, SelectComponent, SelectDirective, UserSelectComponent],
  templateUrl: './analytics-filter-bar.component.html',
})
export class AnalyticsFilterBarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly reference = inject(ReferenceDataService);

  readonly filter = input<AnalyticsFilter>({});
  readonly showRep = input(true, { transform: booleanAttribute });

  protected readonly model = linkedSignal<AnalyticsFilter>(() => ({ ...this.filter() }));
  protected readonly selects = [
    { key: 'sourceCode' as const, label: 'analytics.filters.source', type: 'lead_source' as const },
    { key: 'campaignCode' as const, label: 'analytics.filters.campaign', type: 'campaign' as const },
    { key: 'governorateCode' as const, label: 'analytics.filters.governorate', type: 'governorate' as const },
    { key: 'solutionTypeCode' as const, label: 'analytics.filters.solutionType', type: 'solution_type' as const },
  ];

  constructor() {
    void this.reference.load();
  }

  protected set(key: keyof AnalyticsFilter, value: string): void {
    this.model.update((current) => ({ ...current, [key]: value || undefined }));
  }

  protected apply(event: Event): void {
    event.preventDefault();
    const queryParams: Record<string, string | null> = {};
    for (const key of ['from', 'to', 'ownerId', 'sourceCode', 'campaignCode', 'governorateCode', 'solutionTypeCode'] as const) queryParams[key] = this.model()[key] || null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  protected clear(): void {
    this.model.set({});
    const queryParams = { from: null, to: null, ownerId: null, sourceCode: null, campaignCode: null, governorateCode: null, solutionTypeCode: null };
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
