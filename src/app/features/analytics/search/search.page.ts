import { Component, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { AnalyticsApi } from '../analytics-api.service';
import type { SearchHit } from '../models/exceptions.interface';

/** Global search results (customers, contacts, leads, opportunities, proposals, contracts, projects) inside the user's scope. */
@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, InputDirective, PageHeaderComponent],
  template: `
    <app-page-header [heading]="'search.title' | t" [subtitle]="'search.subtitle' | t" class="!mb-0" />
    <form role="search" class="flex gap-2" (submit)="submit($event)">
      <label for="global-search-page" class="sr-only">{{ 'search.placeholder' | t }}</label>
      <input appInput id="global-search-page" type="search" class="flex-1" [value]="text()" (input)="text.set($any($event.target).value)" [placeholder]="'search.placeholder' | t" autocomplete="off" />
      <button type="submit" appButton>{{ 'common.actions.search' | t }}</button>
    </form>

    @if (q().trim() && q().trim().length < 2) {
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ 'search.tooShort' | t }}</p>
    }
    @if (results.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(results.error()) }}</app-alert>
    }
    @if (q() && results.value(); as r) {
      @if (r.hits.length) {
        <ul class="divide-y divide-border rounded-lg border border-border bg-card">
          @for (hit of r.hits; track hit.type + hit.id) {
            <li>
              <a [routerLink]="link(hit)" class="flex items-center justify-between gap-3 p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span class="min-w-0">
                  <span class="block truncate font-medium">{{ hit.title }}</span>
                  @if (hit.subtitle) {
                    <span class="block truncate text-sm text-muted-foreground" dir="auto">{{ subtitle(hit) }}</span>
                  }
                </span>
                <span class="flex shrink-0 items-center gap-2">
                  @if (hit.number) {
                    <span class="tabular text-sm text-muted-foreground" dir="ltr">{{ hit.number }}</span>
                  }
                  <app-badge tone="info">{{ 'search.types.' + hit.type | t }}</app-badge>
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{{ 'search.noResults' | t: { query: q() } }}</p>
      }
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class SearchPage {
  private readonly api = inject(AnalyticsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);

  readonly q = input<string>('');
  protected readonly text = linkedSignal(() => this.q() ?? '');

  protected readonly results = rxResource({
    params: () => (this.q() && this.q().trim().length >= 2 ? this.q().trim() : undefined),
    stream: ({ params }) => (params ? this.api.search(params) : of({ query: '', hits: [] as SearchHit[] })),
  });

  constructor() {
    void this.reference.load();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.router.navigate([], { queryParams: { q: this.text().trim() || null } });
  }

  protected link(hit: SearchHit): string {
    return `/${this.i18n.locale()}${hit.route.split('?')[0]}`;
  }

  protected subtitle(hit: SearchHit): string {
    if (hit.type === 'opportunity' && hit.subtitle) return this.reference.label('pipeline_stage', hit.subtitle);
    if ((hit.type === 'proposal' || hit.type === 'contract' || hit.type === 'project') && hit.subtitle) {
      const enumName = hit.type === 'proposal' ? 'combinedProposalStatus' : hit.type === 'contract' ? 'contractStatus' : 'projectStatus';
      return this.i18n.t(`enums.${enumName}.${hit.subtitle}`);
    }
    return hit.subtitle ?? '';
  }
}
