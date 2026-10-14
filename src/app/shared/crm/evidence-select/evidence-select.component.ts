import { Component, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { SelectComponent } from '../../ui/form/select.component';
import { SelectDirective } from '../../ui/form/select.directive';

interface EvidenceDocument {
  id: string;
  fileName: string;
  category: string;
  version: number;
  isCurrent: boolean;
}

/**
 * Picks the evidence for a pipeline action among the documents already
 * attached to the record (optionally limited to categories): the backend
 * accepts only a document on that record, so the picker never offers others.
 * Upload the file in the record's Documents panel first.
 */
@Component({
  selector: 'app-evidence-select',
  imports: [SelectComponent, SelectDirective],
  template: `
    <app-select>
      <select appSelect [id]="inputId()" [value]="value()" (change)="value.set($any($event.target).value)">
        <option value="">{{ documents().length ? i18n.t('crm.common.selectPlaceholder') : i18n.t('pipeline.noEvidence') }}</option>
        @for (document of documents(); track document.id) {
          <option [value]="document.id">{{ reference.label('document_category', document.category) }} — {{ document.fileName }} (v{{ document.version }})</option>
        }
      </select>
    </app-select>
  `,
  host: { class: 'block' },
})
export class EvidenceSelectComponent {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  /** Accepted categories (any when empty). */
  readonly categories = input<string[]>([]);
  readonly inputId = input<string>();
  /** Reloads the list when it changes (e.g. after an upload). */
  readonly version = input<unknown>();
  readonly value = model('');

  private readonly list = rxResource({
    params: () => ({ entityType: this.entityType(), entityId: this.entityId(), pageSize: 100, at: this.version() }),
    stream: ({ params }) => this.api.get<Page<EvidenceDocument>>('documents', { entityType: params.entityType, entityId: params.entityId, pageSize: params.pageSize }),
  });
  protected readonly documents = computed(() => {
    const rows = this.list.hasValue() ? this.list.value().rows : [];
    const allowed = this.categories();
    return rows.filter((row) => row.isCurrent && (!allowed.length || allowed.includes(row.category)));
  });

  constructor() {
    void this.reference.load();
  }
}
