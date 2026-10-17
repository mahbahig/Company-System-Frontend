import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../ui/button/button.directive';
import { ConfirmService } from '../../ui/confirm/confirm.service';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string | number | boolean | string[] | null>;
  visibility: 'private' | 'team' | 'all';
  isDefault?: boolean;
  ownerId?: string | { id: string };
}

/**
 * LIST-03 saved views: store the current filters of a list under a name
 * (private, team or company-wide), re-apply them in one click, and — with
 * `exportReport` — export the filtered list (RPT-03, audited).
 *
 * A view stores filters only, never data or access: applying one (even a view
 * a manager shared) re-runs the list request under the viewer's own
 * permissions and record scope, so a view cannot reveal more than the list
 * itself would. Sharing options mirror what the API accepts for this user.
 */
@Component({
  selector: 'app-saved-views-bar',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, TranslatePipe, ButtonDirective, TooltipDirective],
  templateUrl: './saved-views-bar.component.html',
})
export class SavedViewsBarComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly confirmService = inject(ConfirmService);

  /** Backend list code (`lead_bank`, `leads`, `customers`, …). */
  readonly list = input.required<string>();
  /** Report code to export the filtered list with, e.g. `leads`. */
  readonly exportReport = input<string>();

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly views = rxResource({ params: () => this.list(), stream: ({ params }) => this.api.get<SavedView[]>('saved-views', { list: params }) });
  protected readonly saving = signal(false);
  protected readonly name = signal('');
  protected readonly visibility = signal<'private' | 'team' | 'all'>('private');
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  /** The API's own rule (SavedViewsService.assertVisibility): team views need a team-level role, company-wide views need settings rights. */
  protected readonly canShareTeam = computed(() => this.auth.canAny(['dashboards.view_team', 'settings.manage']));
  protected readonly canShareAll = computed(() => this.auth.can('settings.manage'));
  /** The saved view whose filters are exactly the list's current filters. */
  protected readonly activeView = computed(() => {
    const current = this.currentFilters();
    const keys = Object.keys(current).filter((key) => current[key] !== '');
    return (
      (this.views.value() ?? []).find((view) => {
        const entries = Object.entries(view.filters ?? {}).filter(([, value]) => value !== null && value !== '');
        return entries.length === keys.length && entries.every(([key, value]) => String(Array.isArray(value) ? value.join(',') : value) === current[key]);
      }) ?? null
    );
  });

  private currentFilters(): Record<string, string> {
    const map = this.params();
    const filters: Record<string, string> = {};
    for (const key of map.keys) if (key !== 'page') filters[key] = map.get(key) ?? '';
    return filters;
  }

  protected mine(view: SavedView): boolean {
    const owner = typeof view.ownerId === 'object' ? view.ownerId?.id : view.ownerId;
    return !owner || owner === this.auth.user()?.id;
  }

  protected apply(view: SavedView): void {
    const queryParams: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(view.filters ?? {})) {
      if (value === null || value === '') continue;
      queryParams[key] = Array.isArray(value) ? value : String(value);
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.post('saved-views', { list: this.list(), name: this.name().trim(), filters: this.currentFilters(), visibility: this.visibility() }));
      this.saving.set(false);
      this.name.set('');
      this.message.set(this.i18n.t('savedViews.saved'));
      this.views.reload();
    } catch (error) {
      this.message.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(view: SavedView): Promise<void> {
    const deleted = await this.confirmService.confirm({
      heading: this.i18n.t('ux.savedViews.deleteTitle'),
      message: this.i18n.t('ux.savedViews.deleteMessage', { name: view.name }),
      irreversible: true,
      confirmLabel: this.i18n.t('ux.savedViews.deleteAction'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'danger',
      action: () => this.api.delete(`saved-views/${view.id}`),
    });
    if (deleted) this.views.reload();
  }

  protected async export(format: 'xlsx' | 'csv'): Promise<void> {
    const report = this.exportReport();
    if (!report) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      await firstValueFrom(this.api.download(`reports/${report}/export`, { ...reportFilters(this.currentFilters()), format, locale: this.i18n.locale() }, `${report}.${format}`));
    } catch (error) {
      this.message.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}

/** List filter names → report filter names, so an export matches the list on screen. */
const REPORT_FILTER_NAMES: Record<string, string> = { governorate: 'governorateCode', source: 'sourceCode', campaign: 'campaignCode', solutionType: 'solutionTypeCode', owner: 'ownerId', team: 'teamId', stage: 'status' };

function reportFilters(filters: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [REPORT_FILTER_NAMES[key] ?? key, value]));
}
