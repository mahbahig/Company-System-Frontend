import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { TIMELINE_ENTITY_PATH, type TimelineEntityType } from './timeline-entity-type';
import type { TimelineEvent } from './timeline-event.interface';
import type { TimelineQuery } from './timeline-query.interface';

/** Typed client for the timeline endpoints nested under customers/opportunities/leads/projects. */
@Service()
export class TimelineApi {
  private readonly api = inject(ApiService);

  list(entityType: TimelineEntityType, entityId: string, query: TimelineQuery = {}): Observable<TimelineEvent[]> {
    return this.api.get<TimelineEvent[]>(`${TIMELINE_ENTITY_PATH[entityType]}/${entityId}/timeline`, { ...query });
  }
}
