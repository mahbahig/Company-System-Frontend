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
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      @let a = d.approval;
      <app-page-header [eyebrow]="a.approvalNo" [heading]="a.subject" [subtitle]="(a.type | enum: 'approvalType')">
        <app-status-badge enum="approvalStatus" [value]="a.status" />
        @if (a.actionUrl) {
          <a appButton variant="outline" [routerLink]="'/' + i18n.locale() + a.actionUrl">{{ 'approvals.openRecord' | t }}</a>
        }
      </app-page-header>

      <div class="grid gap-6 lg:grid-cols-3">
        <section appCard class="lg:col-span-2" aria-labelledby="request-heading">
          <div appCardHeader><h2 appCardTitle id="request-heading">{{ 'approvals.request' | t }}</h2></div>
          <div appCardContent class="flex flex-col gap-5">
            <dl class="grid gap-4 sm:grid-cols-2">
              <div appDetailItem [label]="'approvals.columns.requester' | t">{{ name(a.requesterId) }}</div>
              <div appDetailItem [label]="'approvals.approverRole' | t">{{ a.approverRole | enum: 'roleCode' }}</div>
              <div appDetailItem [label]="'approvals.columns.due' | t"><span class="tabular">{{ i18n.formatDate(a.dueAt, true) }}</span></div>
              <div appDetailItem [label]="'crm.common.createdAt' | t"><span class="tabular">{{ i18n.formatDate(a.createdAt, true) }}</span></div>
            </dl>
            @if (a.reasons.length) {
              <div>
                <h3 class="text-sm font-semibold">{{ 'approvals.reasons' | t }}</h3>
                <ul class="mt-2 list-disc ps-5 text-sm">
                  @for (reason of a.reasons; track reason) {
                    <li>{{ reasonText(reason) }}</li>
                  }
                </ul>
              </div>
            }
            @if (figures(a.keyFigures).length) {
              <div>
                <h3 class="text-sm font-semibold">{{ 'approvals.keyFigures' | t }}</h3>
                <dl class="mt-2 grid gap-3 sm:grid-cols-3">
                  @for (figure of figures(a.keyFigures); track figure.key) {
                    <div appDetailItem [label]="fieldLabel(figure.key)"><span class="tabular" dir="ltr">{{ figure.value }}</span></div>
                  }
                </dl>
              </div>
            }
            @if (a.originalValue || a.requestedValue) {
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-md border border-border p-3">
                  <h3 class="text-xs font-medium uppercase text-muted-foreground">{{ 'approvals.original' | t }}</h3>
                  @for (figure of figures(a.originalValue ?? {}); track figure.key) {
                    <p class="mt-1 text-sm">{{ fieldLabel(figure.key) }}: <span class="tabular" dir="ltr">{{ figure.value }}</span></p>
                  }
                </div>
                <div class="rounded-md border border-primary/40 p-3">
                  <h3 class="text-xs font-medium uppercase text-muted-foreground">{{ 'approvals.requested' | t }}</h3>
                  @for (figure of figures(a.requestedValue ?? {}); track figure.key) {
                    <p class="mt-1 text-sm">{{ fieldLabel(figure.key) }}: <span class="tabular" dir="ltr">{{ figure.value }}</span></p>
                  }
                </div>
              </div>
            }
            @if (a.requestNote) {
              <p class="rounded-md bg-muted p-3 text-sm">{{ a.requestNote }}</p>
            }
            @if (a.decision) {
              <app-alert [variant]="a.decision.decision === 'approve' ? 'default' : 'destructive'">
                {{ 'approvals.decidedBy' | t: { decision: (a.decision.decision | enum: 'approvalDecision'), name: name(a.decision.by), date: i18n.formatDate(a.decision.at, true) } }}
                @if (a.decision.onBehalfOf) {
                  ({{ 'approvals.onBehalfOf' | t: { name: name(a.decision.onBehalfOf) } }})
                }
                @if (a.decision.reason) {
                  — {{ a.decision.reason }}
                }
              </app-alert>
            }
          </div>
        </section>

        <div class="flex flex-col gap-6">
          @if (d.canDecide) {
            <section appCard aria-labelledby="decide-heading">
              <div appCardHeader><h2 appCardTitle id="decide-heading">{{ 'approvals.decide' | t }}</h2></div>
              <form appCardContent class="flex flex-col gap-4" (submit)="decide($event)">
                @if (error(); as message) {
                  <app-alert variant="destructive">{{ message }}</app-alert>
                }
                <fieldset class="flex flex-col gap-2">
                  <legend class="text-sm font-medium">{{ 'approvals.decision' | t }}</legend>
                  @for (option of decisions; track option) {
                    <label class="flex items-center gap-2 text-sm">
                      <input type="radio" name="decision" [value]="option" [checked]="decision() === option" (change)="decision.set(option)" />
                      {{ option | enum: 'approvalDecision' }}
                    </label>
                  }
                </fieldset>
                <div>
                  <label appLabel for="decision-reason" [required]="decision() !== 'approve'">{{ 'approvals.reason' | t }}</label>
                  <textarea appTextarea id="decision-reason" rows="3" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
                </div>
                <button type="submit" appButton [variant]="decision() === 'approve' ? 'default' : 'destructive'" [disabled]="busy() || (decision() !== 'approve' && !reason().trim())">{{ 'approvals.submitDecision' | t }}</button>
              </form>
            </section>
          }

          <section appCard aria-labelledby="comments-heading">
            <div appCardHeader><h2 appCardTitle id="comments-heading">{{ 'approvals.comments' | t }}</h2></div>
            <div appCardContent class="flex flex-col gap-3">
              @for (comment of a.comments; track $index) {
                <div class="rounded-md bg-muted p-3 text-sm">
                  <p class="text-xs text-muted-foreground">{{ name(comment.by) }} · <span class="tabular">{{ i18n.formatDate(comment.at, true) }}</span></p>
                  <p class="mt-1 whitespace-pre-line">{{ comment.text }}</p>
                </div>
              } @empty {
                <p class="text-sm text-muted-foreground">{{ 'approvals.noComments' | t }}</p>
              }
              <form class="flex flex-col gap-2" (submit)="addComment($event)">
                <label appLabel for="new-comment" class="sr-only">{{ 'approvals.addComment' | t }}</label>
                <textarea appTextarea id="new-comment" rows="2" [placeholder]="'approvals.addComment' | t" [value]="comment()" (input)="comment.set($any($event.target).value)"></textarea>
                <button type="submit" appButton variant="outline" size="sm" [disabled]="busy() || !comment().trim()">{{ 'approvals.postComment' | t }}</button>
              </form>
            </div>
          </section>
        </div>
      </div>
    } @else if (data.isLoading()) {
      <app-detail-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
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
