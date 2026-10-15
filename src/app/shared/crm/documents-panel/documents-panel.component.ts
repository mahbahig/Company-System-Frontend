import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../ui/alert/alert.component';
import { ButtonDirective } from '../../ui/button/button.directive';
import { InputDirective } from '../../ui/form/input.directive';
import { LabelComponent } from '../../ui/form/label.component';
import { SelectComponent } from '../../ui/form/select.component';
import { SelectDirective } from '../../ui/form/select.directive';
import { EnumLabelPipe } from '../status-badge/enum-label.pipe';

interface DocumentRow {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: string;
  entityType?: string;
  parentLabel?: string;
  classification: string;
  version: number;
  isCurrent: boolean;
  generated?: boolean;
  immutable?: boolean;
  uploadedAt?: string;
  createdAt?: string;
}

/**
 * DOC-01..07 documents of any record: upload with a mandatory category and
 * classification, version chains, and download only through a short-lived
 * signed link (never a storage URL). `<app-documents-panel entityType="opportunity" [entityId]="id" />`
 */
@Component({
  selector: 'app-documents-panel',
  imports: [TranslatePipe, EnumLabelPipe, AlertComponent, ButtonDirective, InputDirective, LabelComponent, SelectComponent, SelectDirective],
  templateUrl: './documents-panel.component.html',
  host: { class: 'block' },
})
export class DocumentsPanelComponent {
  private static nextId = 0;
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  /** Customer 360 roll-up: every document of the customer and its records. */
  readonly customerScope = input(false);
  /** Opportunity roll-up: also lists the documents of its visits, meetings, proposals… (uploads still go to `entityId`). */
  readonly opportunityScope = input(false);

  protected readonly headingId = `documents-${DocumentsPanelComponent.nextId++}`;
  protected readonly classifications = ['internal', 'confidential', 'restricted'];
  protected readonly showUpload = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly category = signal('');
  protected readonly classification = signal('internal');
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canUpload = computed(() => this.auth.can('files.upload'));
  protected readonly canDownload = computed(() => this.auth.can('files.download'));

  protected readonly documents = rxResource({
    params: () =>
      this.customerScope()
        ? { customerId: this.entityId(), pageSize: 100 }
        : this.opportunityScope()
          ? { opportunityId: this.entityId(), pageSize: 100 }
          : { entityType: this.entityType(), entityId: this.entityId(), pageSize: 100 },
    stream: ({ params }) => this.api.get<Page<DocumentRow>>('documents', params),
  });
  protected readonly rows = computed(() => (this.documents.hasValue() ? this.documents.value().rows : []));

  constructor() {
    void this.reference.load();
  }

  protected pick(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async upload(event: Event): Promise<void> {
    event.preventDefault();
    const file = this.file();
    if (!file || !this.category()) return;
    this.uploading.set(true);
    this.error.set(null);
    const body = new FormData();
    body.set('entityType', this.entityType());
    body.set('entityId', this.entityId());
    body.set('category', this.category());
    body.set('classification', this.classification());
    body.set('file', file, file.name);
    try {
      await firstValueFrom(this.api.upload('documents', body));
      this.showUpload.set(false);
      this.file.set(null);
      this.documents.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async download(doc: DocumentRow): Promise<void> {
    try {
      const signed = await firstValueFrom(this.api.get<{ expiresAt: number; signature: string }>(`documents/${doc.id}/download-url`));
      const url = `${this.api.url(`documents/${doc.id}/raw`)}?expiresAt=${signed.expiresAt}&signature=${encodeURIComponent(signed.signature)}`;
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    }
  }

  /** Roll-up rows that live on another record (a visit, meeting…) are labelled with their source. */
  protected fromOtherRecord(doc: DocumentRow): boolean {
    return (this.customerScope() || this.opportunityScope()) && !!doc.entityType && doc.entityType !== this.entityType();
  }

  protected size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
