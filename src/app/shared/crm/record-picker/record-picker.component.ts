import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable, of } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Record types the picker can search (list endpoints that accept `q`). */
export type PickerKind = 'customer' | 'lead' | 'opportunity' | 'contact' | 'site';

interface PickerRow {
  id: string;
  label: string;
  number?: string;
}

/**
 * Searchable record picker (combobox pattern): type to search the list
 * endpoint inside the user's own scope, pick one row. Works with
 * `[(value)]` (the record id). `parentId` scopes contacts / sites to a customer
 * and opportunities to a customer.
 */
@Component({
  selector: 'app-record-picker',
  imports: [TranslatePipe],
  templateUrl: './record-picker.component.html',
  host: { class: 'block' },
})
export class RecordPickerComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly kind = input.required<PickerKind>();
  readonly value = model('');
  readonly inputId = input('record-picker');
  readonly parentId = input<string>();
  /** Label to show for a preselected value (e.g. from the route). */
  readonly initialLabel = input<string>();

  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly selectedLabel = signal('');

  private readonly query = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly results = rxResource({
    params: () => ({ kind: this.kind(), q: this.query(), parentId: this.parentId() }),
    stream: ({ params }): Observable<unknown[] | Page<unknown>> => {
      const path = this.path(params.kind, params.parentId);
      if (!path) return of([] as unknown[]);
      if (params.kind === 'contact' || params.kind === 'site') return this.api.get<unknown[]>(path);
      return this.api.get<Page<unknown>>(path, { q: params.q || undefined, pageSize: 10, ...(params.kind === 'opportunity' && params.parentId ? { customerId: params.parentId } : {}) });
    },
  });

  protected readonly rows = computed<PickerRow[]>(() => {
    const raw = this.results.value();
    const list = (Array.isArray(raw) ? raw : ((raw as Page<unknown> | undefined)?.rows ?? [])) as Array<Record<string, unknown>>;
    const q = this.text().trim().toLowerCase();
    return list
      .map((row) => this.toRow(row))
      .filter((row) => !q || this.kind() === 'customer' || this.kind() === 'lead' || this.kind() === 'opportunity' || row.label.toLowerCase().includes(q))
      .slice(0, 10);
  });

  constructor() {
    effect(() => {
      const label = this.initialLabel();
      if (label && this.value()) this.selectedLabel.set(label);
    });
    effect(() => {
      // A value set from outside without a label: look it up in the loaded rows.
      const value = this.value();
      if (value && !this.selectedLabel()) {
        const row = this.rows().find((r) => r.id === value);
        if (row) this.selectedLabel.set(row.label);
      }
    });
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.open.set(true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.query.set(value.trim()), 250);
  }

  protected select(row: PickerRow): void {
    this.value.set(row.id);
    this.selectedLabel.set(row.label);
    this.open.set(false);
  }

  protected clear(): void {
    this.value.set('');
    this.selectedLabel.set('');
    this.text.set('');
  }

  private path(kind: PickerKind, parentId?: string): string | null {
    switch (kind) {
      case 'customer':
        return 'customers';
      case 'lead':
        return 'leads';
      case 'opportunity':
        return 'opportunities';
      case 'contact':
        return parentId ? `customers/${parentId}/contacts` : null;
      case 'site':
        return parentId ? `customers/${parentId}/sites` : null;
    }
  }

  private toRow(row: Record<string, unknown>): PickerRow {
    const id = String(row['id'] ?? row['_id'] ?? '');
    const str = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : '');
    switch (this.kind()) {
      case 'customer':
        return { id, label: this.i18n.pick(str('nameAr'), str('nameEn')) || str('primaryContactName'), number: str('customerNo') };
      case 'lead':
        return { id, label: str('name'), number: str('leadNo') };
      case 'opportunity':
        return { id, label: str('name'), number: str('opportunityNo') };
      case 'contact':
        return { id, label: str('fullName') || str('fullNameEn'), number: str('mobile') };
      case 'site':
        return { id, label: str('name') || str('addressLine') || str('siteNo'), number: str('siteNo') };
    }
  }
}
