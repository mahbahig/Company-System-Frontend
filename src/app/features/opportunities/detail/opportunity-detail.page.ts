import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { TimelineComponent } from '../../../shared/crm/timeline/timeline.component';
import { OpportunityHubComponent } from './opportunity-hub.component';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TableBodyDirective } from '../../../shared/ui/table/table-body.directive';
import { TableCellDirective } from '../../../shared/ui/table/table-cell.directive';
import { TableEmptyComponent } from '../../../shared/ui/table/table-empty.component';
import { TableHeadDirective } from '../../../shared/ui/table/table-head.directive';
import { TableHeaderDirective } from '../../../shared/ui/table/table-header.directive';
import { TableRowDirective } from '../../../shared/ui/table/table-row.directive';
import { TableWrapperComponent } from '../../../shared/ui/table/table-wrapper.component';
import { TableDirective } from '../../../shared/ui/table/table.directive';
import type { UserRef } from '../../../core/auth/models/user-ref.interface';
import { asUserRef } from '../../../shared/utils/display-name';
import { formatPhone, isOverdue } from '../../../shared/utils/format';
import { StatusPageComponent } from '../../errors/status-page.component';
import type { GateEvaluation } from '../models/gate-evaluation.interface';
import type { Opportunity } from '../models/opportunity.interface';
import type { UpdateTeamPayload } from '../models/update-team-payload.interface';
import { OpportunitiesApi } from '../opportunities-api.service';
import { UsersLookupApi } from '../users-lookup-api.service';

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
 * Opportunity detail (OPP): workflow summary, stage transition + history, team,
 * collaborators, readiness checklist, journey tracker, completeness and deal health.
 */
@Component({
  selector: 'app-opportunity-detail-page',
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    DetailItemComponent,
    CompletenessPanelComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    StatusPageComponent,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
    InputDirective,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent,
    OpportunityHubComponent,
    DocumentsPanelComponent,
    TimelineComponent,
  ],
  templateUrl: './opportunity-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OpportunityDetailPage {
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  private readonly usersApi = inject(UsersLookupApi);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly id = input.required<string>();

  protected readonly formatPhone = formatPhone;
  protected readonly openStages = OPEN_STAGE_ORDER;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.opportunitiesApi.get(params) });
  protected readonly opportunity = computed(() => (this.detail.hasValue() ? this.detail.value().opportunity : null));
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });

  protected readonly canEdit = computed(() => this.auth.can('opportunities.edit'));
  protected readonly canChangeStage = computed(() => this.auth.can('opportunities.change_stage') || this.auth.can('opportunities.close'));
  protected readonly canClose = computed(() => this.auth.can('opportunities.close'));
  protected readonly canAssign = computed(() => this.auth.can('opportunities.assign'));
  protected readonly canManageCollaborators = computed(() => this.auth.can('opportunities.manage_collaborators'));
  /** Hard gates need `gates.override`; soft gates may also be overridden by the owner or a stage-approving manager. */
  protected readonly canOverrideGates = computed(() => {
    if (this.auth.can('gates.override')) return true;
    const evaluation = this.gates.hasValue() ? this.gates.value() : null;
    if (!evaluation || evaluation.blockingHard.length) return false;
    const opportunity = this.opportunity();
    const ownerId = opportunity && typeof opportunity.ownerId === 'object' ? opportunity.ownerId?.id : opportunity?.ownerId;
    return ownerId === this.auth.user()?.id || this.auth.can('opportunities.approve_stage');
  });
  /** Reopening a lost / cancelled deal is a manager decision with a reason. */
  protected readonly canReopen = computed(() => this.auth.can('opportunities.approve_stage'));
  protected readonly isReopen = computed(() => ['lost', 'cancelled'].includes(this.opportunity()?.outcome ?? ''));

  protected readonly owners = rxResource({
    params: () => (this.canAssign() || this.canManageCollaborators() ? '' : undefined),
    stream: () => this.usersApi.lookup(),
  });

  // ---------------------------------------------------------------------------
  // Stage transition
  // ---------------------------------------------------------------------------

  protected readonly targetStage = signal('');
  protected readonly transitionReason = signal('');
  protected readonly lostReasonCode = signal('');
  protected readonly lostCompetitorCode = signal('');
  protected readonly lostCompetitorName = signal('');
  protected readonly lostComment = signal('');
  protected readonly overrideReason = signal('');
  protected readonly transitionSubmitting = signal(false);
  protected readonly transitionError = signal<string | null>(null);

  protected readonly gates = rxResource({
    params: () => (this.targetStage() ? { id: this.id(), toStage: this.targetStage() } : undefined),
    stream: ({ params }) => this.opportunitiesApi.gates(params.id, params.toStage),
  });

  protected readonly availableStages = computed(() => {
    const current = this.opportunity()?.stage;
    // A closed deal can only be reopened into an open stage.
    if (this.isReopen()) return [...OPEN_STAGE_ORDER];
    return [...OPEN_STAGE_ORDER, 'won', 'lost'].filter((stage) => stage !== current);
  });
  protected readonly isBackwardMove = computed(() => {
    const current = this.opportunity()?.stage;
    if (!current) return false;
    const from = OPEN_STAGE_ORDER.indexOf(current);
    const to = OPEN_STAGE_ORDER.indexOf(this.targetStage());
    return from >= 0 && to >= 0 && to < from;
  });

  // ---------------------------------------------------------------------------
  // Outcome (on hold / cancel / resume)
  // ---------------------------------------------------------------------------

  protected readonly outcomeAction = signal<'on_hold' | 'cancelled' | 'open' | null>(null);
  protected readonly outcomeReason = signal('');
  protected readonly outcomeSubmitting = signal(false);

  // ---------------------------------------------------------------------------
  // Team
  // ---------------------------------------------------------------------------

  protected readonly teamSubmitting = signal(false);
  protected readonly teamModel = signal<UpdateTeamPayload>({});

  // ---------------------------------------------------------------------------
  // Collaborators
  // ---------------------------------------------------------------------------

  protected readonly collaboratorUserId = signal('');
  protected readonly collaboratorRole = signal('other');
  protected readonly collaboratorIsPoc = signal(false);
  protected readonly collaboratorSubmitting = signal(false);

  constructor() {
    void this.reference.load();
    effect(() => {
      const opportunity = this.opportunity();
      if (opportunity) this.title.setTitle(`${opportunity.name} · ${opportunity.opportunityNo} · ${this.i18n.t('app.name')}`);
    });
    // Reset the transition panel whenever the record reloads (a submitted change moves the current stage).
    effect(() => {
      this.opportunity();
      this.targetStage.set('');
      this.transitionReason.set('');
      this.lostReasonCode.set('');
      this.lostCompetitorCode.set('');
      this.lostCompetitorName.set('');
      this.lostComment.set('');
      this.overrideReason.set('');
      this.transitionError.set(null);
    });
  }

  protected ref(value: UserRef | string | null | undefined): string {
    const user = asUserRef(value);
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  protected customerIdOf(opportunity: Opportunity): string {
    const customer = opportunity.customerId;
    return typeof customer === 'string' ? customer : customer.id;
  }

  protected contactIdOf(opportunity: Opportunity): string | null {
    const contact = opportunity.primaryContactId;
    return !contact ? null : typeof contact === 'string' ? contact : contact.id;
  }

  protected customerLabel(opportunity: Opportunity): string {
    const customer = opportunity.customerId;
    return typeof customer === 'string' ? '' : this.i18n.pick(customer.nameAr, customer.nameEn) || customer.primaryContactName || customer.customerNo;
  }

  protected contactLabel(opportunity: Opportunity): string {
    const contact = opportunity.primaryContactId;
    if (!contact || typeof contact === 'string') return this.i18n.t('crm.common.notSet');
    return contact.fullName;
  }

  protected siteLabel(opportunity: Opportunity): string {
    const site = opportunity.siteId;
    if (!site || typeof site === 'string') return this.i18n.t('crm.common.notSet');
    return `${site.siteNo}${site.name ? ' — ' + site.name : ''}`;
  }

  protected overdueNextAction(opportunity: Opportunity): boolean {
    return opportunity.outcome === 'open' && isOverdue(opportunity.nextActionAt);
  }

  protected stageDuration(enteredAt: string, exitedAt: string | null | undefined): string {
    const end = exitedAt ? new Date(exitedAt) : new Date();
    const start = new Date(enteredAt);
    const hours = Math.max(0, Math.round((end.getTime() - start.getTime()) / 3_600_000));
    return this.i18n.t('crm.opportunities.detail.historyDuration', { hours });
  }

  protected gateLabel(check: GateEvaluation['checks'][number]): string {
    return this.i18n.t(`crm.opportunities.gates.${check.code}`);
  }

  protected async submitTransition(event: Event): Promise<void> {
    event.preventDefault();
    const id = this.id();
    this.transitionError.set(null);
    this.transitionSubmitting.set(true);
    try {
      await firstValueFrom(
        this.opportunitiesApi.changeStage(id, {
          toStage: this.targetStage(),
          reason: this.transitionReason().trim() || undefined,
          lostReason:
            this.targetStage() === 'lost'
              ? { code: this.lostReasonCode(), competitorCode: this.lostCompetitorCode() || undefined, competitorName: this.lostCompetitorName().trim() || undefined, comment: this.lostComment().trim() || undefined }
              : undefined,
          override: this.overrideReason().trim() ? { reason: this.overrideReason().trim() } : undefined,
        }),
      );
      this.detail.reload();
    } catch (error: unknown) {
      this.transitionError.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.unexpected');
    } finally {
      this.transitionSubmitting.set(false);
    }
  }

  protected startOutcome(action: 'on_hold' | 'cancelled' | 'open'): void {
    this.outcomeAction.set(action);
    this.outcomeReason.set('');
  }

  protected async submitOutcome(event: Event): Promise<void> {
    event.preventDefault();
    const action = this.outcomeAction();
    if (!action) return;
    this.outcomeSubmitting.set(true);
    try {
      await firstValueFrom(this.opportunitiesApi.changeOutcome(this.id(), { outcome: action, reason: this.outcomeReason().trim() }));
      this.outcomeAction.set(null);
      this.detail.reload();
    } finally {
      this.outcomeSubmitting.set(false);
    }
  }

  protected async submitTeam(event: Event): Promise<void> {
    event.preventDefault();
    this.teamSubmitting.set(true);
    try {
      await firstValueFrom(this.opportunitiesApi.updateTeam(this.id(), this.teamModel()));
      this.teamModel.set({});
      this.detail.reload();
    } finally {
      this.teamSubmitting.set(false);
    }
  }

  protected async addCollaborator(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.collaboratorUserId()) return;
    this.collaboratorSubmitting.set(true);
    try {
      await firstValueFrom(
        this.opportunitiesApi.addCollaborator(this.id(), { userId: this.collaboratorUserId(), role: this.collaboratorRole(), isTechnicalPoc: this.collaboratorIsPoc() }),
      );
      this.collaboratorUserId.set('');
      this.collaboratorIsPoc.set(false);
      this.detail.reload();
    } finally {
      this.collaboratorSubmitting.set(false);
    }
  }

  protected idOf(value: { id: string } | string): string {
    return typeof value === 'string' ? value : value.id;
  }

  protected async removeCollaborator(userId: string): Promise<void> {
    await firstValueFrom(this.opportunitiesApi.removeCollaborator(this.id(), userId));
    this.detail.reload();
  }

  protected async toggleReadiness(itemId: string, done: boolean): Promise<void> {
    await firstValueFrom(this.opportunitiesApi.markReadiness(this.id(), itemId, done));
    this.detail.reload();
  }
}
