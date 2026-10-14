import { Service, inject } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { PipelineDefinition } from './pipeline-definition.interface';

/** The pipeline definitions (stages, branches, transitions, roles) — configuration, fetched once. */
@Service()
export class PipelinesApi {
  private readonly api = inject(ApiService);
  private definitions$?: Observable<PipelineDefinition[]>;

  definitions(): Observable<PipelineDefinition[]> {
    this.definitions$ ??= this.api.get<PipelineDefinition[]>('pipelines').pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.definitions$;
  }
}
