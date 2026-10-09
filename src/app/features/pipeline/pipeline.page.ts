import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AlertTriangle } from 'lucide';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../shared/crm/list-toolbar/toggle-definition.interface';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ApiError } from '../../core/api/api-error';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import type { BoardColumn } from '../opportunities/models/board-column.interface';
import type { Opportunity } from '../opportunities/models/opportunity.interface';
import { OpportunitiesApi } from '../opportunities/opportunities-api.service';

const OPEN_STAGE_ORDER = [
  'opportunity',
  'meeting',
  'site_visit',
  'data_collection',
  'technical_preparation',
  'proposal',
  'proposal_presented',
  'negotiation',
  'approval',
  'contract',
];

/**
 * Pipeline Kanban board (OPP-04). Drag-and-drop attempts the stage change
 * optimistically and reverts the card when the server rejects it (a gate is
 * blocking, or a reason/value is required) — the record's detail page is
 * where that richer transition form lives.
 */
@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink, TranslatePipe, PageHeaderComponent, ListToolbarComponent, AlertComponent, BadgeComponent, IconComponent, CdkDropList, CdkDrag],
  templateUrl: './pipeline.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class PipelinePage {
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly q = input<string>();
  readonly solutionType = input<string>();
  readonly mine = input<string>();

  protected readonly warningIcon = AlertTriangle;
  protected readonly stages = OPEN_STAGE_ORDER;
  protected readonly canViewFinancials = computed(() => this.auth.can('financials.view'));

  protected readonly moveError = signal<string | null>(null);
  /** Client-side optimistic override so a rejected drop can be reverted without a full reload. */
  private readonly override = signal<Map<string, string>>(new Map());

  protected readonly board = rxResource({
    params: () => ({ q: this.q()?.trim() || undefined, solutionType: this.solutionType(), mine: this.mine() === '1' || undefined }),
    stream: ({ params }) => this.opportunitiesApi.board(params),
  });

  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'solutionType', label: this.i18n.t('crm.opportunities.fields.solutionTypeCode'), options: this.reference.options('solution_type'), value: this.solutionType() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [{ name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: this.mine() === '1' }]);

  protected readonly columns = computed<BoardColumn[]>(() => {
    const overrides = this.override();
    const source = this.board.value()?.columns ?? [];
    if (overrides.size === 0) return source;
    // Reflect an in-flight optimistic move: pull the card into its target column locally.
    const byStage = new Map(source.map((column) => [column.stage, { ...column, cards: [...column.cards] }]));
    for (const [opportunityId, toStage] of overrides) {
      for (const column of byStage.values()) {
        const index = column.cards.findIndex((card) => card.id === opportunityId);
        if (index === -1) continue;
        const [card] = column.cards.splice(index, 1);
        byStage.get(toStage)?.cards.unshift({ ...card, stage: toStage });
        break;
      }
    }
    return [...byStage.values()];
  });

  protected readonly totalCount = computed(() => this.columns().reduce((sum, column) => sum + column.count, 0));

  protected stageProbability(stage: string): number | null {
    const meta = this.reference.find('pipeline_stage', stage)?.meta;
    const value = meta?.['probability'];
    return typeof value === 'number' ? value : null;
  }

  protected customerName(ref: Opportunity['customerId']): string {
    return typeof ref === 'string' ? '' : this.i18n.pick(ref.nameAr, ref.nameEn) || ref.primaryContactName || '';
  }

  protected daysInStage(opportunity: Opportunity): number | null {
    if (!opportunity.stageEnteredAt) return null;
    return Math.floor((Date.now() - new Date(opportunity.stageEnteredAt).getTime()) / 86_400_000);
  }

  protected isAtRisk(opportunity: Opportunity): boolean {
    return opportunity.health?.status === 'at_risk' || opportunity.health?.status === 'critical';
  }

  protected async onDrop(event: CdkDragDrop<string>): Promise<void> {
    const opportunityId = event.item.data as string;
    const toStage = event.container.id;
    if (event.previousContainer === event.container) return;
    this.moveError.set(null);
    this.override.update((map) => new Map(map).set(opportunityId, toStage));
    try {
      await firstValueFrom(this.opportunitiesApi.changeStage(opportunityId, { toStage }));
      this.board.reload();
    } catch (error: unknown) {
      this.moveError.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'crm.opportunities.transitionNotAllowed');
    } finally {
      this.override.update((map) => {
        const next = new Map(map);
        next.delete(opportunityId);
        return next;
      });
    }
  }
}
