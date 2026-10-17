import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { PageSizeSelectComponent, PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

interface IntegrationKey {
  id: string;
  name: string;
  sourceCode: string;
  campaignCode?: string | null;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  receivedCount: number;
  createdAt: string;
}

interface Inbound {
  id: string;
  integrationId: string;
  externalId?: string | null;
  payload: Record<string, unknown>;
  status: 'created' | 'repeat' | 'rejected';
  leadId?: string | null;
  issues?: Record<string, string> | null;
  createdAt: string;
}

interface Status {
  inbound: { activeKeys: number; lastReceivedAt: string | null };
  outbound: { email: boolean; whatsapp: boolean; push: boolean };
}

/**
 * LEAD-01 / INT integrations: API keys for website forms and ad connectors
 * (`POST /public/leads` with `X-Api-Key`), the inbound lead log with
 * rejections, and the state of e-mail / WhatsApp / push delivery.
 */
@Component({
  selector: 'app-integrations-admin-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PagerComponent, PageSizeSelectComponent, PagerSizeComponent],
  templateUrl: './integrations-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class IntegrationsAdminPage {
  private readonly api = inject(ApiService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly endpoint = this.api.url('public/leads');

  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly status = rxResource({ stream: () => this.api.get<Status>('integrations/status') });
  protected readonly keys = rxResource({ stream: () => this.api.get<IntegrationKey[]>('integrations/keys') });
  /** API keys: a short list, paged in memory. */
  protected readonly keysPager = new LocalPager(() => this.keys.value());
  protected readonly inbound = rxResource({ params: () => ({ page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.get<Page<Inbound>>('integrations/inbound', params) });
  protected readonly inboundRows = computed(() => (this.inbound.hasValue() ? this.inbound.value().rows : []));
  protected readonly draft = signal({ name: '', sourceCode: '', campaignCode: '' });
  protected readonly newKey = signal<string | null>(null);

  constructor() {
    void this.reference.load();
  }

  protected set(key: 'name' | 'sourceCode' | 'campaignCode', value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected create(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    void this.actions.run(this.api.post<{ key: string }>('integrations/keys', { name: d.name.trim(), sourceCode: d.sourceCode, campaignCode: d.campaignCode || undefined }), 'admin.integrations.created', (result) => {
      this.newKey.set(result.key);
      this.draft.set({ name: '', sourceCode: '', campaignCode: '' });
      this.keys.reload();
      this.status.reload();
    });
  }

  protected toggleKey(key: IntegrationKey): void {
    void this.actions.run(this.api.patch(`integrations/keys/${key.id}`, { isActive: !key.isActive }), 'admin.saved', () => {
      this.keys.reload();
      this.status.reload();
    });
  }

  protected curl(key: string): string {
    return `curl -X POST ${this.endpoint} -H "X-Api-Key: ${key}" -H "Content-Type: application/json" -d '{"name":"…","phone":"01…"}'`;
  }

  protected issues(row: Inbound): Array<{ field: string; key: string }> {
    return Object.entries(row.issues ?? {}).map(([field, key]) => ({ field, key }));
  }
}
