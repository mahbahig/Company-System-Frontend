import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { Search, X } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { InputDirective } from '../../ui/form/input.directive';
import { LabelComponent } from '../../ui/form/label.component';
import { SelectDirective } from '../../ui/form/select.directive';
import { SelectComponent } from '../../ui/form/select.component';
import { IconComponent } from '../../ui/icon/icon.component';
import { applyWhenTypingStops } from '../../utils/live-search';
import type { FilterDefinition } from './filter-definition.interface';
import type { ToggleDefinition } from './toggle-definition.interface';

/** A page's tab (tasks `view`, approvals / ownership `box`): not a filter, so Clear keeps it. */
const TAB_PARAMS: ReadonlySet<string> = new Set(['view', 'box', 'tab']);

/**
 * Search + filters for list pages (same layout as the Next `ListToolbar`).
 * State lives in the URL: applying navigates with new query params (page
 * reset), so lists are shareable and the back button works. Selects and
 * checkboxes apply on change; the search applies as the user types (once
 * typing pauses) or at once on Enter.
 */
@Component({
  selector: 'app-list-toolbar',
  imports: [FormField, TranslatePipe, ButtonDirective, InputDirective, LabelComponent, SelectDirective, SelectComponent, IconComponent],
  templateUrl: './list-toolbar.component.html',
})
export class ListToolbarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly searchValue = input('');
  /** False on lists whose API has no text search: the box is left out rather than shown doing nothing. */
  readonly searchable = input(true);
  readonly searchPlaceholder = input('');
  readonly filters = input<FilterDefinition[]>([]);
  readonly toggles = input<ToggleDefinition[]>([]);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  /** Set when the user arrived from an Exceptions Center card (`?exception=<code>`). */
  protected readonly exception = computed(() => this.params().get('exception'));
  /** Set when the user arrived from a Data quality row (`?quality=<code>`). */
  protected readonly quality = computed(() => this.params().get('quality'));

  protected readonly searchIcon = Search;
  protected readonly clearIcon = X;

  /** Follows the URL, except that the URL catching up with a trimmed copy of the text keeps what is typed (`"Mohamed "` stays mid-word). */
  private readonly searchModel = linkedSignal<string, { q: string }>({
    source: this.searchValue,
    computation: (applied, previous) => (previous && previous.value.q.trim() === applied ? previous.value : { q: applied }),
  });
  private readonly filterModel = linkedSignal(() => Object.fromEntries(this.filters().map((filter) => [filter.name, filter.value])));
  private readonly toggleModel = linkedSignal(() => Object.fromEntries(this.toggles().map((toggle) => [toggle.name, toggle.checked])));

  protected readonly searchForm = form(this.searchModel, (path) => maxLength(path.q, 120));
  protected readonly filterForm = form(this.filterModel);
  protected readonly toggleForm = form(this.toggleModel);

  protected readonly hasActiveFilter = computed(
    () =>
      !!this.exception() ||
      !!this.quality() ||
      this.searchValue().length > 0 ||
      this.filters().some((filter) => filter.value.length > 0) ||
      this.toggles().some((toggle) => toggle.checked),
  );

  constructor() {
    // Refining a search replaces the history entry, so Back leaves the search instead of replaying each pause.
    applyWhenTypingStops(
      () => this.searchModel().q.trim(),
      () => this.searchValue(),
      () => this.search(!!this.searchValue()),
    );
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.search();
  }

  /** New search text narrows the current view: a drill-down from the Exceptions Center / Data quality keeps its filters and banner. */
  private search(replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: this.searchModel().q.trim() || null, page: null }, queryParamsHandling: 'merge', replaceUrl });
  }

  /**
   * A select or checkbox changed. That leaves a drill-down view: its banner goes, and so do the
   * filters it set that have no control here — the list is then filtered by exactly what is shown.
   */
  protected apply(): void {
    const queryParams: Record<string, string | null> = this.exception() || this.quality() ? this.uncontrolledParams() : {};
    queryParams['q'] = this.searchModel().q.trim() || null;
    queryParams['page'] = null;
    for (const [name, value] of Object.entries(this.filterModel())) queryParams[name] = value || null;
    for (const [name, checked] of Object.entries(this.toggleModel())) queryParams[name] = checked ? '1' : null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  /** Removes every filter, including ones a drill-down set without a control here; the page's tab stays. */
  protected clear(): void {
    const queryParams: Record<string, null> = { ...this.uncontrolledParams(), q: null, page: null };
    for (const filter of this.filters()) queryParams[filter.name] = null;
    for (const toggle of this.toggles()) queryParams[toggle.name] = null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  /** `null` for each query param no control here shows (drill-down filters, the banner code), except the page's tab. */
  private uncontrolledParams(): Record<string, null> {
    const shown = new Set(['q', ...this.filters().map((filter) => filter.name), ...this.toggles().map((toggle) => toggle.name)]);
    return Object.fromEntries(this.params().keys.filter((key) => !shown.has(key) && !TAB_PARAMS.has(key)).map((key) => [key, null]));
  }
}
