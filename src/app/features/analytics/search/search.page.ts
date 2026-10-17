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
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ListSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { applyWhenTypingStops } from '../../../shared/utils/live-search';

/**
 * Global search results, grouped by record type (customers, contacts, leads,
 * opportunities, proposals, contracts, projects). The API searches only inside
 * the caller's permission and record scope; each result is additionally
 * shown only when the route guard would open its page for this user.
 */
@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, IconComponent, InputDirective, PageHeaderComponent, ListSkeletonComponent],
  templateUrl: './search.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SearchPage {
  private readonly records = inject(RecordsApi);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);

  readonly q = input<string>('');
  /** Follows the URL, except that the URL catching up with a trimmed copy keeps what is typed (a trailing space mid-phrase). */
  protected readonly text = linkedSignal<string, string>({
    source: () => this.q() ?? '',
    computation: (applied, previous) => (previous && previous.value.trim() === applied ? previous.value : applied),
  });
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
    applyWhenTypingStops(
      () => this.text().trim(),
      () => this.q() ?? '',
      () => this.search(),
    );
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.search();
  }

  /** Results follow the text as it is typed; refining replaces the history entry so Back leaves the search. */
  private search(): void {
    void this.router.navigate([], { queryParams: { q: this.text().trim() || null }, replaceUrl: !!this.q() });
  }

  /** `/customers/<id>?tab=contacts` → router commands + query params (a `?` inside commands would be encoded). */
  protected link(hit: RecordHit): { commands: string[]; queryParams: Record<string, string> } {
    const [path, query = ''] = hit.route.split('?');
    return { commands: [path], queryParams: Object.fromEntries(new URLSearchParams(query)) };
  }

  protected subtitle(hit: RecordHit): string {
    return hitSubtitle(hit, this.i18n, this.reference);
  }
}
