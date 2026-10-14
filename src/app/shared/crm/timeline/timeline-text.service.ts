import { Service, inject } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { TimelineEvent } from './timeline-event.interface';

/** Which pipeline's stage names a `from` / `to` pair of an event uses. */
const STAGE_PIPELINE: ReadonlyArray<[prefix: string, pipeline: string]> = [
  ['lead.', 'lead'],
  ['deal.', 'deal'],
  ['handover.', 'handover'],
  ['project.', 'project'],
  ['customer.lifecycle', 'customer'],
];

/**
 * Wording of business-history events (TIME-01..07), shared by every place that
 * shows them — record timelines and an employee's recent activity — so one
 * event reads the same everywhere, in Arabic and English.
 */
@Service()
export class TimelineTextService {
  private readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);

  /** One business event as a sentence, in the active language — never a raw code. */
  describe(event: Pick<TimelineEvent, 'type' | 'data'>): string {
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
        return this.generic(event, text);
    }
  }

  /**
   * Every other event type has a sentence under `timeline.events.<type>` (dots
   * → underscores), filled with the stage names it moved between; an unknown
   * future type reads "Record updated" in the user's language, never a code.
   */
  private generic(event: Pick<TimelineEvent, 'type' | 'data'>, text: (key: string) => string): string {
    const key = `timeline.events.${event.type.replace(/\./g, '_')}`;
    if (!this.i18n.has(key)) return this.i18n.t('timeline.events.generic');
    return this.i18n.t(key, {
      from: this.stageLabel(event.type, text('from')),
      to: this.stageLabel(event.type, text('to')),
      name: text('name'),
      version: text('versionNo') || text('version'),
      reason: text('reason'),
    });
  }

  private stageLabel(type: string, value: string): string {
    if (!value) return '';
    if (type.startsWith('contract.')) return this.label(`enums.contractStatus.${value}`, value);
    if (type.startsWith('opportunity.')) return this.reference.label('pipeline_stage', value);
    const pipeline = STAGE_PIPELINE.find(([prefix]) => type.startsWith(prefix))?.[1];
    return pipeline ? this.label(`pipeline.stages.${pipeline}.${value}`, value) : value;
  }

  private label(key: string, fallback: string): string {
    return this.i18n.has(key) ? this.i18n.t(key) : fallback;
  }
}
