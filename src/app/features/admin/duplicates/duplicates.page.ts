import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface CustomerSide {
  id: string;
  customerNo: string;
  nameAr?: string;
  nameEn?: string;
  primaryContactName?: string;
  ownerId?: { fullNameAr: string; fullNameEn: string } | string | null;
}

interface Suggestion {
  id: string;
  customerAId: CustomerSide;
  customerBId: CustomerSide;
  score: number;
  fieldScores: Record<string, number>;
  source: string;
  status: string;
  note?: string | null;
  createdAt: string;
}

interface Comparison {
  a: { id: string; customerNo: string; name: string; openOpportunityCount: number; completenessScore?: number; createdAt: string };
  b: { id: string; customerNo: string; name: string; openOpportunityCount: number; completenessScore?: number; createdAt: string };
  score: number;
  fieldScores: Record<string, number>;
  fields: Array<{ field: string; master: unknown; merged: unknown; same: boolean }>;
  canMerge: boolean;
  canRequestMerge: boolean;
}

/**
 * DUP-04..07/11 duplicate review queue: compare two customers side by side,
 * keep them separate, link as a branch, review later, or merge choosing the
 * surviving value of each field (a merge request for those who cannot merge).
 */
@Component({
  selector: 'app-duplicates-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './duplicates.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class DuplicatesPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly data = rxResource({
    params: () => (this.auth.canAny(['duplicates.review', 'customers.merge']) ? { status: this.status(), page: this.page() } : undefined),
    stream: ({ params }) => (params ? this.api.get<Page<Suggestion>>('duplicates', params) : of({ rows: [], page: 1, pageCount: 0, total: 0, pageSize: 20 } as Page<Suggestion>)),
  });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('admin.users.status'), options: ['open', 'review_later', 'merge_requested', 'merged', 'kept_separate', 'linked'].map((value) => ({ value, label: this.i18n.t(`enums.duplicateSuggestionStatus.${value}`) })), value: this.status() ?? '' },
  ]);

  protected readonly selected = signal<Suggestion | null>(null);
  protected readonly comparison = rxResource({
    params: () => this.selected() ?? undefined,
    stream: ({ params }) => this.api.get<Comparison>(`duplicates/compare/${params.customerAId.id}/${params.customerBId.id}`),
  });
  protected readonly masterIsA = signal(true);
  protected readonly choices = signal<Record<string, 'a' | 'b'>>({});
  protected readonly reason = signal('');

  protected name(c: CustomerSide): string {
    return this.i18n.pick(c.nameAr, c.nameEn) || c.primaryContactName || c.customerNo;
  }

  protected owner(c: CustomerSide): string {
    return userName((ar, en) => this.i18n.pick(ar, en), c.ownerId as Parameters<typeof userName>[1]);
  }

  protected open(s: Suggestion): void {
    this.selected.set(s);
    this.masterIsA.set(true);
    this.choices.set({});
    this.reason.set('');
  }

  protected pick(field: string): 'a' | 'b' {
    return this.choices()[field] ?? (this.masterIsA() ? 'a' : 'b');
  }

  protected choose(field: string, side: string): void {
    this.choices.update((c) => ({ ...c, [field]: side as 'a' | 'b' }));
  }

  protected show(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  protected merge(asRequest: boolean): void {
    const c = this.comparison.value();
    if (!c) return;
    const masterSide = this.masterIsA() ? 'a' : 'b';
    const masterId = masterSide === 'a' ? c.a.id : c.b.id;
    const mergedId = masterSide === 'a' ? c.b.id : c.a.id;
    const fieldChoices = Object.fromEntries(c.fields.filter((f) => !f.same).map((f) => [f.field, this.pick(f.field) === masterSide ? 'master' : 'merged']));
    void this.actions.run(this.api.post(asRequest ? 'duplicates/merge-requests' : 'duplicates/merge', { masterId, mergedId, fieldChoices, reason: this.reason().trim() }), asRequest ? 'admin.duplicates.requested' : 'admin.duplicates.merged', () => this.done());
  }

  protected decide(decision: 'keep_separate' | 'link_as_branch' | 'review_later'): void {
    const s = this.selected();
    if (!s) return;
    void this.actions.run(this.api.post(`duplicates/${s.id}/decide`, { decision, note: this.reason().trim() || undefined }), 'admin.saved', () => this.done());
  }

  private done(): void {
    this.selected.set(null);
    this.data.reload();
  }
}
