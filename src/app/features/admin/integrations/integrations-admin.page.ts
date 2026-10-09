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
  imports: [RouterLink, TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.integrations.title' | t" [subtitle]="'admin.integrations.subtitle' | t" class="!mb-0" />
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    @if (newKey(); as key) {
      <app-alert variant="destructive">
        <p>{{ 'admin.integrations.keyOnce' | t }}</p>
        <code class="mt-1 block break-all rounded bg-muted px-2 py-1 font-mono text-xs" dir="ltr">{{ key }}</code>
        <p class="mt-2 break-all font-mono text-xs" dir="ltr">{{ curl(key) }}</p>
      </app-alert>
    }

    @if (status.value(); as s) {
      <section class="grid gap-3 sm:grid-cols-4" [attr.aria-label]="'admin.integrations.status' | t">
        <div class="rounded-lg border border-border bg-card p-3">
          <p class="text-xs text-muted-foreground">{{ 'admin.integrations.activeKeys' | t }}</p>
          <p class="tabular text-xl font-semibold">{{ i18n.formatNumber(s.inbound.activeKeys) }}</p>
          <p class="text-xs text-muted-foreground">{{ 'admin.integrations.lastReceived' | t }}: {{ i18n.formatDate(s.inbound.lastReceivedAt, true) || '—' }}</p>
        </div>
        @for (channel of ['email', 'whatsapp', 'push']; track channel) {
          <div class="rounded-lg border border-border bg-card p-3">
            <p class="text-xs text-muted-foreground">{{ 'account.notifications.channels.' + channel | t }}</p>
            <app-badge [tone]="$any(s.outbound)[channel] ? 'success' : 'warning'">{{ ($any(s.outbound)[channel] ? 'admin.integrations.configured' : 'admin.integrations.notConfigured') | t }}</app-badge>
          </div>
        }
      </section>
    }

    <form appCard (submit)="create($event)" aria-labelledby="int-new">
      <div appCardHeader><h2 appCardTitle id="int-new">{{ 'admin.integrations.newKey' | t }}</h2></div>
      <div appCardContent class="grid gap-4 sm:grid-cols-4">
        <div>
          <label appLabel for="ik-name" required>{{ 'admin.integrations.name' | t }}</label>
          <input appInput id="ik-name" [value]="draft().name" (input)="set('name', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="ik-source" required>{{ 'crm.customers.fields.leadSourceCode' | t }}</label>
          <app-select>
            <select appSelect id="ik-source" [value]="draft().sourceCode" (change)="set('sourceCode', $any($event.target).value)">
              <option value="">—</option>
              @for (option of reference.options('lead_source'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="ik-campaign">{{ 'analytics.filters.campaign' | t }}</label>
          <app-select>
            <select appSelect id="ik-campaign" [value]="draft().campaignCode" (change)="set('campaignCode', $any($event.target).value)">
              <option value="">—</option>
              @for (option of reference.options('campaign'); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </app-select>
        </div>
        <div class="flex items-end">
          <button type="submit" appButton [disabled]="actions.busy() || !draft().name.trim() || !draft().sourceCode">{{ 'admin.integrations.generate' | t }}</button>
        </div>
      </div>
    </form>

    <app-table-wrapper [label]="'admin.integrations.keys' | t" [attr.aria-busy]="keys.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.integrations.name' | t }}</th>
            <th appTableHead>{{ 'admin.integrations.prefix' | t }}</th>
            <th appTableHead>{{ 'crm.customers.fields.leadSourceCode' | t }}</th>
            <th appTableHead class="text-end">{{ 'admin.integrations.received' | t }}</th>
            <th appTableHead>{{ 'admin.integrations.lastUsed' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (k of keys.value() ?? []; track k.id) {
            <tr appTableRow>
              <td appTableCell class="font-medium">{{ k.name }}</td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ k.keyPrefix }}…</td>
              <td appTableCell>
                {{ reference.label('lead_source', k.sourceCode) }}
                @if (k.campaignCode) {
                  <span class="block text-xs text-muted-foreground">{{ reference.label('campaign', k.campaignCode) }}</span>
                }
              </td>
              <td appTableCell class="tabular text-end">{{ i18n.formatNumber(k.receivedCount) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(k.lastUsedAt, true) || '—' }}</td>
              <td appTableCell><app-badge [tone]="k.isActive ? 'success' : 'neutral'">{{ (k.isActive ? 'admin.active' : 'admin.integrations.revoked') | t }}</app-badge></td>
              <td appTableCell>
                <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="toggleKey(k)">{{ (k.isActive ? 'admin.integrations.revoke' : 'admin.integrations.reactivate') | t }}</button>
              </td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="7">{{ (keys.isLoading() ? 'common.labels.loading' : 'admin.empty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <h2 class="text-lg font-semibold">{{ 'admin.integrations.inbound' | t }}</h2>
    <app-table-wrapper [label]="'admin.integrations.inbound' | t" [attr.aria-busy]="inbound.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.automation.when' | t }}</th>
            <th appTableHead>{{ 'admin.integrations.payload' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead>{{ 'admin.integrations.result' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of inboundRows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.createdAt, true) }}</td>
              <td appTableCell class="max-w-sm truncate text-xs" dir="ltr">{{ $any(row.payload)['name'] }} · {{ $any(row.payload)['phone'] }}</td>
              <td appTableCell><app-badge [tone]="row.status === 'created' ? 'success' : row.status === 'repeat' ? 'info' : 'danger'">{{ 'admin.integrations.statuses.' + row.status | t }}</app-badge></td>
              <td appTableCell class="text-xs">
                @if (row.leadId) {
                  <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'leads', row.leadId]">{{ 'admin.integrations.openLead' | t }}</a>
                }
                @for (issue of issues(row); track issue.field) {
                  <span class="block text-destructive">{{ issue.field }}: {{ i18n.t(issue.key) }}</span>
                }
              </td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="4">{{ (inbound.isLoading() ? 'common.labels.loading' : 'admin.empty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (inbound.hasValue()) {
      <app-pagination [page]="inbound.value().page" [pageCount]="inbound.value().pageCount" [total]="inbound.value().total" [pageSize]="inbound.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class IntegrationsAdminPage {
  private readonly api = inject(ApiService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly endpoint = this.api.url('public/leads');

  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly status = rxResource({ stream: () => this.api.get<Status>('integrations/status') });
  protected readonly keys = rxResource({ stream: () => this.api.get<IntegrationKey[]>('integrations/keys') });
  protected readonly inbound = rxResource({ params: () => ({ page: this.page() }), stream: ({ params }) => this.api.get<Page<Inbound>>('integrations/inbound', params) });
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
