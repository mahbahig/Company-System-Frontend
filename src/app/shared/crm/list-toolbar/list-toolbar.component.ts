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
import type { FilterDefinition } from './filter-definition.interface';
import type { ToggleDefinition } from './toggle-definition.interface';

/**
 * Search + filters for list pages (same layout as the Next `ListToolbar`).
 * State lives in the URL: applying navigates with new query params (page
 * reset), so lists are shareable and the back button works. Selects and
 * checkboxes apply on change; the search applies on submit.
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
  readonly searchPlaceholder = input('');
  readonly filters = input<FilterDefinition[]>([]);
  readonly toggles = input<ToggleDefinition[]>([]);

  /** Set when the user arrived from an Exceptions Center card (`?exception=<code>`). */
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly exception = computed(() => this.params().get('exception'));

  protected readonly searchIcon = Search;
  protected readonly clearIcon = X;

  private readonly searchModel = linkedSignal(() => ({ q: this.searchValue() }));
  private readonly filterModel = linkedSignal(() => Object.fromEntries(this.filters().map((filter) => [filter.name, filter.value])));
  private readonly toggleModel = linkedSignal(() => Object.fromEntries(this.toggles().map((toggle) => [toggle.name, toggle.checked])));

  protected readonly searchForm = form(this.searchModel, (path) => maxLength(path.q, 120));
  protected readonly filterForm = form(this.filterModel);
  protected readonly toggleForm = form(this.toggleModel);

  protected readonly hasActiveFilter = computed(
    () =>
      !!this.exception() ||
      this.searchValue().length > 0 ||
      this.filters().some((filter) => filter.value.length > 0) ||
      this.toggles().some((toggle) => toggle.checked),
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.apply();
  }

  protected apply(): void {
    // Changing the filters leaves the exception's view, so its banner goes too.
    const queryParams: Record<string, string | null> = { q: this.searchModel().q.trim() || null, page: null, exception: null };
    for (const [name, value] of Object.entries(this.filterModel())) queryParams[name] = value || null;
    for (const [name, checked] of Object.entries(this.toggleModel())) queryParams[name] = checked ? '1' : null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  protected clear(): void {
    const queryParams: Record<string, null> = { q: null, page: null, exception: null };
    for (const filter of this.filters()) queryParams[filter.name] = null;
    for (const toggle of this.toggles()) queryParams[toggle.name] = null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
