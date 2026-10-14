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
import { ListSkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { TimelineApi } from './timeline-api.service';
import { TimelineTextService } from './timeline-text.service';
import type { TimelineEntityType } from './timeline-entity-type';
import type { TimelineEvent } from './timeline-event.interface';

/** Event-type prefixes the filter offers (the backend filters by prefix). */
const TYPE_GROUPS = ['contact', 'customer', 'lead', 'opportunity', 'deal', 'proposal', 'contract', 'handover', 'project', 'activity', 'site'] as const;


/**
 * Unified, human-readable business history (TIME-01..07) — reused on both
 * the customer and opportunity detail pages, visually and structurally
 * distinct from the technical audit log. Self-fetching (unlike the other
 * `shared/crm` panels) because it owns its own filter/pagination state,
 * which must not leak into the host page's route query params.
 */
@Component({
  selector: 'app-timeline',
  imports: [RouterLink, FormField, TranslatePipe, CardDirective, CardHeaderDirective, CardTitleDirective, CardContentDirective, SelectComponent, SelectDirective, ListSkeletonComponent],
  templateUrl: './timeline.component.html',
})
export class TimelineComponent {
  private readonly timelineApi = inject(TimelineApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  private readonly text = inject(TimelineTextService);

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

  /** The event as a sentence in the user's language (shared wording: {@link TimelineTextService}). */
  protected summarize(event: TimelineEvent): string {
    return this.text.describe(event);
  }

  protected actorName(event: TimelineEvent): string {
    return this.i18n.pick(event.actorNameAr, event.actorNameEn) || this.i18n.t('timeline.system');
  }

  /** A cross-link into the opportunity, shown only on the customer's own timeline. */
  protected opportunityLink(event: TimelineEvent): string[] | null {
    return this.entityType() === 'customer' && event.opportunityId ? ['/opportunities', event.opportunityId] : null;
  }
}
