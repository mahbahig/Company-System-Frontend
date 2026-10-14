import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { hitSubtitle } from '../../../core/records/record-hit-text';
import { RECORD_GROUP_ORDER, RECORD_ICONS, type RecordHit } from '../../../core/records/record-ref';
import { RecordsApi } from '../../../core/records/records-api.service';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ListSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/**
 * Global search results, grouped by record type (customers, contacts, leads,
 * opportunities, proposals, contracts, projects). The API searches only inside
 * the caller's permission and record scope; each result is additionally
 * shown only when the route guard would open its page for this user.
 */
@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, ButtonDirective, IconComponent, InputDirective, PageHeaderComponent, ListSkeletonComponent],
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
    @if (results.isLoading()) {
      <div role="status" [attr.aria-label]="'common.labels.loading' | t" class="rounded-lg border border-border bg-card p-4"><app-list-skeleton [rows]="5" /></div>
    } @else if (q().trim().length >= 2 && results.hasValue()) {
      @if (groups().length) {
        <p class="text-sm text-muted-foreground" role="status">{{ 'ux.search.count' | t: { count: total(), query: q().trim() } }}</p>
        @for (group of groups(); track group.type) {
          <section class="flex flex-col gap-2" [attr.aria-labelledby]="'search-group-' + group.type">
            <h2 [id]="'search-group-' + group.type" class="flex items-center gap-2 text-sm font-semibold">
              <app-icon [icon]="icons[group.type]" svgClass="size-4 text-muted-foreground" />
              {{ 'ux.palette.groups.records.' + group.type | t }}
              <span class="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{{ group.hits.length }}</span>
            </h2>
            <ul class="divide-y divide-border rounded-lg border border-border bg-card">
              @for (hit of group.hits; track hit.type + hit.id) {
                <li>
                  <a [routerLink]="link(hit).commands" [queryParams]="link(hit).queryParams" class="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span class="min-w-0">
                      <span class="block truncate font-medium" dir="auto">{{ hit.title || hit.number }}</span>
                      @if (subtitle(hit); as text) {
                        <span class="block truncate text-sm text-muted-foreground" dir="auto">{{ text }}</span>
                      }
                    </span>
                    @if (hit.number) {
                      <span class="tabular shrink-0 text-sm text-muted-foreground" dir="ltr">{{ hit.number }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <p class="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{{ 'search.noResults' | t: { query: q() } }}</p>
      }
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class SearchPage {
  private readonly records = inject(RecordsApi);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);

  readonly q = input<string>('');
  protected readonly text = linkedSignal(() => this.q() ?? '');
  protected readonly icons = RECORD_ICONS;

  protected readonly results = rxResource({
    params: () => (this.q() && this.q().trim().length >= 2 ? this.q().trim() : undefined),
    stream: ({ params }) => (params ? this.records.search(params) : of([] as RecordHit[])),
  });

  /** Hits grouped by type, each re-checked against the route guard. */
  protected readonly groups = computed(() => {
    const hits = (this.results.value() ?? []).filter((hit) => this.navigation.canOpen(hit.route));
    return RECORD_GROUP_ORDER.map((type) => ({ type, hits: hits.filter((hit) => hit.type === type) })).filter((group) => group.hits.length);
  });
  protected readonly total = computed(() => this.groups().reduce((sum, group) => sum + group.hits.length, 0));

  constructor() {
    void this.reference.load();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.router.navigate([], { queryParams: { q: this.text().trim() || null } });
  }

  /** `/customers/<id>?tab=contacts` → router commands + query params (a `?` inside commands would be encoded). */
  protected link(hit: RecordHit): { commands: string[]; queryParams: Record<string, string> } {
    const [path, query = ''] = hit.route.split('?');
    return { commands: [`/${this.i18n.locale()}${path}`], queryParams: Object.fromEntries(new URLSearchParams(query)) };
  }

  protected subtitle(hit: RecordHit): string {
    return hitSubtitle(hit, this.i18n, this.reference);
  }
}
