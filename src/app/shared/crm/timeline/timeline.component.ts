import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { CardContentDirective } from '../../ui/card/card-content.directive';
import { CardHeaderDirective } from '../../ui/card/card-header.directive';
import { CardTitleDirective } from '../../ui/card/card-title.directive';
import { CardDirective } from '../../ui/card/card.directive';
import { SelectComponent } from '../../ui/form/select.component';
import { SelectDirective } from '../../ui/form/select.directive';
import { TimelineApi } from './timeline-api.service';
import type { TimelineEntityType } from './timeline-entity-type';
import type { TimelineEvent } from './timeline-event.interface';

/** Event-type groups the filter offers (the closed set the backend currently emits). */
const TYPE_GROUPS = ['contact', 'customer', 'lead', 'opportunity', 'site'] as const;

/**
 * Unified, human-readable business history (TIME-01..07) — reused on both
 * the customer and opportunity detail pages, visually and structurally
 * distinct from the technical audit log. Self-fetching (unlike the other
 * `shared/crm` panels) because it owns its own filter/pagination state,
 * which must not leak into the host page's route query params.
 */
@Component({
  selector: 'app-timeline',
  imports: [RouterLink, FormField, TranslatePipe, CardDirective, CardHeaderDirective, CardTitleDirective, CardContentDirective, SelectComponent, SelectDirective],
  templateUrl: './timeline.component.html',
})
export class TimelineComponent {
  private readonly timelineApi = inject(TimelineApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly entityType = input.required<TimelineEntityType>();
  readonly entityId = input.required<string>();

  protected readonly typeGroups = TYPE_GROUPS;
  protected readonly filterModel = linkedSignal(() => ({ type: '' }));
  protected readonly filterForm = form(this.filterModel);

  protected readonly result = rxResource({
    params: () => ({ entityType: this.entityType(), entityId: this.entityId(), type: this.filterModel().type || undefined }),
    stream: ({ params }) => this.timelineApi.list(params.entityType, params.entityId, { type: params.type }),
  });

  protected readonly events = computed(() => (this.result.hasValue() ? this.result.value() : []));

  protected summarize(event: TimelineEvent): string {
    const d = event.data ?? {};
    const text = (key: string) => (d[key] === undefined || d[key] === null ? '' : String(d[key]));
    switch (event.type) {
      case 'contact.added':
        return this.i18n.t('timeline.types.contactAdded', { name: text('name'), role: this.reference.label('contact_role', text('role')) });
      case 'customer.created':
        return this.i18n.t('timeline.types.customerCreated', { customerNo: text('customerNo') });
      case 'customer.owner_changed':
        return this.i18n.t('timeline.types.customerOwnerChanged');
      case 'customer.status_changed':
        return this.i18n.t('timeline.types.customerStatusChanged', {
          from: this.reference.label('customer_status', text('from')),
          to: this.reference.label('customer_status', text('to')),
        });
      case 'customer.enrichment_completed':
        return this.i18n.t('timeline.types.enrichmentCompleted', { score: text('score') });
      case 'lead.created':
        return this.i18n.t('timeline.types.leadCreated', { leadNo: text('leadNo'), source: this.reference.label('lead_source', text('source')) });
      case 'lead.contacted':
        return this.i18n.t('timeline.types.leadContacted');
      case 'lead.contact_attempted':
        return this.i18n.t('timeline.types.leadContactAttempted');
      case 'lead.qualified':
        return this.i18n.t('timeline.types.leadQualified');
      case 'lead.nurture':
        return this.i18n.t('timeline.types.leadNurture', { reason: this.reference.label('lead_closure_reason', text('reason')) });
      case 'lead.closed':
        return this.i18n.t('timeline.types.leadClosed', { reason: this.reference.label('lead_closure_reason', text('reason')) });
      case 'lead.reopened':
        return this.i18n.t('timeline.types.leadReopened', { reason: text('reason') });
      case 'lead.assigned':
        return this.i18n.t('timeline.types.leadAssigned');
      case 'lead.converted':
        return this.i18n.t('timeline.types.leadConverted', { leadNo: text('leadNo') });
      case 'opportunity.created':
        return this.i18n.t('timeline.types.opportunityCreated', { name: text('name'), solutionType: this.reference.label('solution_type', text('solutionType')) });
      case 'opportunity.stage_changed':
        return this.i18n.t('timeline.types.opportunityStageChanged', {
          from: this.reference.label('pipeline_stage', text('from')),
          to: this.reference.label('pipeline_stage', text('to')),
        });
      case 'opportunity.outcome_changed':
        return this.i18n.t('timeline.types.opportunityOutcomeChanged', { outcome: text('outcome') });
      case 'opportunity.won':
        return this.i18n.t('timeline.types.opportunityWon', { value: this.i18n.formatMoney(Number(text('contractValue')) || null) });
      case 'opportunity.owner_changed':
        return this.i18n.t('timeline.types.opportunityOwnerChanged');
      case 'opportunity.collaborator_added':
        return this.i18n.t('timeline.types.collaboratorAdded');
      case 'opportunity.collaborator_removed':
        return this.i18n.t('timeline.types.collaboratorRemoved');
      case 'opportunity.team_changed':
        return this.i18n.t('timeline.types.teamChanged');
      case 'site.added':
        return this.i18n.t('timeline.types.siteAdded', { name: text('name') });
      default:
        return this.humanize(event.type);
    }
  }

  /** Best-effort fallback for a type with no template yet — never the raw dotted code. */
  private humanize(type: string): string {
    return type
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  protected actorName(event: TimelineEvent): string {
    return this.i18n.pick(event.actorNameAr, event.actorNameEn) || this.i18n.t('timeline.system');
  }

  /** A cross-link into the opportunity, shown only on the customer's own timeline. */
  protected opportunityLink(event: TimelineEvent): string[] | null {
    return this.entityType() === 'customer' && event.opportunityId ? ['/opportunities', event.opportunityId] : null;
  }
}
