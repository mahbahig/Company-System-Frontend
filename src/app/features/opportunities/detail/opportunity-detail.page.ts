import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { trackRecentView } from '../../../core/records/track-recent-view';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { FavoriteToggleComponent } from '../../../shared/crm/favorite-toggle/favorite-toggle.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { TimelineComponent } from '../../../shared/crm/timeline/timeline.component';
import { OpportunityHubComponent } from './opportunity-hub.component';
import { DeliveryHandoverPanelComponent } from './delivery-handover-panel.component';
import { OpportunityDiscoveryPanelComponent } from './opportunity-discovery-panel.component';
import { OpportunityWorkflowPanelComponent } from './opportunity-workflow-panel.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
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
import type { Opportunity } from '../models/opportunity.interface';
import type { UpdateTeamPayload } from '../models/update-team-payload.interface';
import { OpportunitiesApi } from '../opportunities-api.service';
import { UsersLookupApi } from '../users-lookup-api.service';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';

/**
 * Opportunity detail: the O0–O8 and D0–D7 trackers (stage, history,
 * requirements, blockers, owner, next action, due date), discovery facts and
 * risks, the Sales → Delivery handover, team, collaborators, readiness,
 * journey, completeness and deal health. Stages move only through their
 * business actions — there is no free stage picker and no gate override.
 */
@Component({
  selector: 'app-opportunity-detail-page',
  imports: [
    BreadcrumbsComponent,
    FavoriteToggleComponent,
    DetailSkeletonComponent,
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
    OpportunityWorkflowPanelComponent,
    OpportunityDiscoveryPanelComponent,
    DeliveryHandoverPanelComponent,
    UserSelectComponent, PagerComponent],
  templateUrl: './opportunity-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OpportunityDetailPage {
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  private readonly usersApi = inject(UsersLookupApi);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  protected readonly i18n = inject(I18nService);
  private readonly confirm = inject(ConfirmService);
  protected readonly reference = inject(ReferenceDataService);

  readonly id = input.required<string>();

  protected readonly formatPhone = formatPhone;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.opportunitiesApi.get(params) });
  protected readonly opportunity = computed(() => (this.detail.hasValue() ? this.detail.value().opportunity : null));
  /** The opportunity's collaborators, paged in memory. */
  protected readonly collaboratorsPager = new LocalPager(() => this.opportunity()?.collaborators);
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });

  protected readonly canEdit = computed(() => this.auth.can('opportunities.edit'));
  protected readonly canClose = computed(() => this.auth.can('opportunities.close'));
  protected readonly canAssign = computed(() => this.auth.can('opportunities.assign'));
  protected readonly canManageCollaborators = computed(() => this.auth.can('opportunities.manage_collaborators'));
  /** The delivery handover appears once the deal is won (or the case exists for the user's role). */
  protected readonly showHandover = computed(() => this.opportunity()?.outcome === 'won' && (this.auth.can('delivery_handovers.view')));

  protected readonly owners = rxResource({
    params: () => (this.canAssign() || this.canManageCollaborators() ? '' : undefined),
    stream: () => this.usersApi.lookup(),
  });

  // ---------------------------------------------------------------------------
  // Outcome (on hold / cancel / resume)
  // ---------------------------------------------------------------------------

  protected readonly outcomeAction = signal<'on_hold' | 'nurture' | 'cancelled' | 'open' | null>(null);
  protected readonly outcomeReason = signal('');
  /** Hold: the blocker, its owner and a review date; nurture: a buying window and a follow-up date. */
  protected readonly holdBlocker = signal('');
  protected readonly holdOwnerId = signal('');
  protected readonly holdReviewAt = signal('');
  protected readonly nurtureWindow = signal('');
  protected readonly nurtureFollowUpAt = signal('');
  protected readonly outcomeSubmitting = signal(false);
  protected readonly outcomeError = signal<string | null>(null);
  protected readonly outcomeReady = computed(() => {
    if (!this.outcomeReason().trim()) return false;
    if (this.outcomeAction() === 'on_hold') return !!this.holdBlocker().trim() && !!this.holdOwnerId() && !!this.holdReviewAt();
    if (this.outcomeAction() === 'nurture') return !!this.nurtureWindow().trim() && !!this.nurtureFollowUpAt();
    return true;
  });

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

  /** Opportunities / <customer> / <opportunity> — the customer is context, not a link (its own scope may differ). */
  protected readonly crumbs = computed(() => {
    const opportunity = this.opportunity();
    return [
      { label: this.i18n.t('navigation.items.opportunities'), path: '/opportunities' },
      { label: opportunity ? this.customerLabel(opportunity) : '' },
      { label: opportunity?.name ?? '' },
    ];
  });

  constructor() {
    void this.reference.load();
    trackRecentView('opportunity', () => this.id(), () => (this.opportunity() ? 'loaded' : this.notFound() ? 'missing' : 'pending'));
    effect(() => {
      const opportunity = this.opportunity();
      if (opportunity) this.title.setTitle(`${opportunity.name} · ${opportunity.opportunityNo} · ${this.i18n.t('app.name')}`);
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

  protected startOutcome(action: 'on_hold' | 'nurture' | 'cancelled' | 'open'): void {
    this.outcomeAction.set(action);
    this.outcomeReason.set('');
    this.outcomeError.set(null);
  }

  protected async submitOutcome(event: Event): Promise<void> {
    event.preventDefault();
    const action = this.outcomeAction();
    if (!action) return;
    this.outcomeSubmitting.set(true);
    this.outcomeError.set(null);
    try {
      await firstValueFrom(
        this.opportunitiesApi.changeOutcome(this.id(), {
          outcome: action,
          reason: this.outcomeReason().trim(),
          ...(action === 'on_hold'
            ? { blocker: this.holdBlocker().trim(), holdOwnerId: this.holdOwnerId(), reviewAt: new Date(this.holdReviewAt()).toISOString() }
            : {}),
          ...(action === 'nurture' ? { buyingWindow: this.nurtureWindow().trim(), followUpAt: new Date(this.nurtureFollowUpAt()).toISOString() } : {}),
        }),
      );
      this.outcomeAction.set(null);
      this.detail.reload();
    } catch (error: unknown) {
      this.outcomeError.set(this.i18n.errorText(error));
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

  /** Asks first, naming the person; the dialog stays busy until the API removed them. */
  protected async removeCollaborator(userId: string, name: string): Promise<void> {
    const removed = await this.confirm.confirm({
      heading: this.i18n.t('crm.opportunities.removeCollaboratorTitle', { name }),
      message: this.i18n.t('crm.opportunities.removeCollaboratorBody', { name }),
      confirmLabel: this.i18n.t('crm.opportunities.removeCollaboratorAction'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'warning',
      action: () => this.opportunitiesApi.removeCollaborator(this.id(), userId),
    });
    if (removed) this.detail.reload();
  }

  protected async toggleReadiness(itemId: string, done: boolean): Promise<void> {
    await firstValueFrom(this.opportunitiesApi.markReadiness(this.id(), itemId, done));
    this.detail.reload();
  }
}
