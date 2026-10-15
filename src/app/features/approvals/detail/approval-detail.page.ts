import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { userName } from '../../../shared/utils/display-name';
import { ApprovalsApi } from '../approvals-api.service';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

const MONEY_HINT = /(price|value|cost|amount|total|discountAmount|margin(?!Pct))/i;

/** APPR-01/02: one approval request — the figures behind it, the comment thread and the decision (reason mandatory to reject or return). */
@Component({
  selector: 'app-approval-detail-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, DetailItemComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './approval-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ApprovalDetailPage {
  private readonly api = inject(ApprovalsApi);
  protected readonly i18n = inject(I18nService);

  readonly id = input.required<string>();

  protected readonly decisions = ['approve', 'return', 'reject'] as const;
  protected readonly decision = signal<'approve' | 'return' | 'reject'>('approve');
  protected readonly reason = signal('');
  protected readonly comment = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly approval = computed(() => this.data.value()?.approval);

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected figures(record: Record<string, unknown>): Array<{ key: string; value: string }> {
    const entries = record ?? {};
    return Object.entries(entries)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      // Raw ids are noise next to their display name (`ownerId` + `ownerName`).
      .filter(([key, value]) => !(key.endsWith('Id') && /^[a-f0-9]{24}$/.test(String(value))))
      .map(([key, value]) => ({ key, value: typeof value === 'number' ? (MONEY_HINT.test(key) ? this.i18n.formatMoney(value) : this.i18n.formatNumber(value)) : this.valueLabel(key, String(value)) }));
  }

  private valueLabel(key: string, value: string): string {
    const enumKey = key === 'type' ? `enums.ownershipRequestType.${value}` : `approvals.values.${key}.${value}`;
    return this.i18n.has(enumKey) ? this.i18n.t(enumKey) : value;
  }

  protected fieldLabel(key: string): string {
    const k = `approvals.fields.${key}`;
    return this.i18n.has(k) ? this.i18n.t(k) : key;
  }

  protected reasonText(code: string): string {
    const k = `approvals.reasonCodes.${code}`;
    return this.i18n.has(k) ? this.i18n.t(k) : code;
  }

  protected async decide(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.decide(this.id(), { decision: this.decision(), reason: this.reason().trim() || undefined }));
      this.reason.set('');
      this.data.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async addComment(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.comment(this.id(), this.comment().trim()));
      this.comment.set('');
      this.data.reload();
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}
