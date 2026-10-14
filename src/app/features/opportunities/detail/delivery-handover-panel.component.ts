import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserDirectory } from '../../../core/users/user-directory.service';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { EvidenceSelectComponent } from '../../../shared/crm/evidence-select/evidence-select.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { OpportunitiesApi } from '../opportunities-api.service';

const PACK_FIELDS = [
  'promiseSold',
  'accessNotes',
  'communicationPlan',
  'kickoffExpectations',
  'performanceAssumptions',
  'customerResponsibilities',
  'deliveryTimeline',
  'permits',
  'gridApprovals',
  'procurementNeeds',
  'risks',
  'dependencies',
  'openQuestions',
] as const;

/**
 * H0 → H1: the Sales → Delivery handover as a real business event — the pack
 * Sales prepares, the live checklist of what is still missing, the domain
 * confirmations (design baseline, financial readiness, evidence-backed Won)
 * and the named PM's accept (creating the project) or return with the
 * specific missing items. Each control appears only for the role the server
 * says may use it.
 */
@Component({
  selector: 'app-delivery-handover-panel',
  imports: [
    TranslatePipe,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    InputDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
    UserSelectComponent,
    EvidenceSelectComponent,
  ],
  template: `
    <section appCard aria-labelledby="handover-heading">
      <div appCardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 appCardTitle id="handover-heading">{{ 'pipeline.handover.title' | t }}</h2>
        @if (view.value()?.handover; as handover) {
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground" dir="ltr">{{ handover.handoverNo }}</span>
            <app-badge [tone]="handover.status === 'accepted' ? 'success' : handover.status === 'returned' ? 'danger' : 'info'">{{ 'pipeline.stages.handover.' + handover.status | t }}</app-badge>
          </div>
        }
      </div>
      <div appCardContent class="flex flex-col gap-4">
        @if (error(); as text) {
          <app-alert variant="destructive" role="alert">{{ text }}</app-alert>
        }
        @if (view.value(); as value) {
          @if (!value.handover) {
            <p class="text-sm text-muted-foreground">{{ 'pipeline.handover.noCase' | t }}</p>
          } @else {
            @if (value.handover.status === 'returned' && value.handover.returnReason) {
              <app-alert variant="destructive">{{ 'pipeline.handover.returned' | t: { reason: value.handover.returnReason } }} ({{ value.handover.returnItems.join(', ') }})</app-alert>
            }
            <dl class="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-xs text-muted-foreground">{{ 'pipeline.handover.receiver' | t }}</dt>
                <dd>{{ people.name(value.handover.toUserId ?? $any(value.handover.pack['projectManagerId']) ?? null) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.dueAt' | t }}</dt>
                <dd class="tabular">{{ i18n.formatDate(value.handover.slaDueAt, true) || ('crm.common.notSet' | t) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">{{ 'pipeline.handover.confirmations' | t }}</dt>
                <dd>
                  @for (confirmation of value.handover.confirmations; track confirmation.kind) {
                    <app-badge tone="success" class="me-1">{{ 'pipeline.requirements.' + confirmationCode(confirmation.kind) | t }}</app-badge>
                  } @empty {
                    {{ 'crm.common.none' | t }}
                  }
                </dd>
              </div>
            </dl>

            <!-- Live checklist: exactly what is still missing. -->
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.handover.checklist' | t }}</h3>
              <ul class="grid gap-1 text-xs sm:grid-cols-2" data-testid="handover-checklist">
                @for (item of value.requirements; track item.code) {
                  <li class="flex gap-1.5">
                    <span aria-hidden="true" [class]="item.met ? 'text-success-tint' : 'text-destructive'">{{ item.met ? '✓' : '✗' }}</span>
                    {{ requirementLabel(item.code, item.params) }}
                  </li>
                }
              </ul>
            </div>

            @if (value.permissions.canEditPack) {
              <form class="flex flex-col gap-3 border-t border-border pt-4" (submit)="savePack($event)">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.handover.pack' | t }}</h3>
                <div class="grid gap-3 sm:grid-cols-2">
                  @for (field of packFields; track field) {
                    <div>
                      <label appLabel [for]="'pack-' + field" class="mb-1.5 block text-xs">{{ 'pipeline.handover.fields.' + field | t }}</label>
                      <textarea appTextarea [id]="'pack-' + field" rows="2" [value]="pack()[field] ?? ''" (input)="setPack(field, $any($event.target).value)"></textarea>
                    </div>
                  }
                  <div>
                    <label appLabel for="pack-pm" class="mb-1.5 block text-xs">{{ 'pipeline.handover.fields.projectManagerId' | t }}</label>
                    <app-user-select inputId="pack-pm" roles="project_manager" [value]="pack()['projectManagerId'] ?? ''" (valueChange)="setPack('projectManagerId', $event)" />
                  </div>
                  <div>
                    <label appLabel for="pack-meeting" class="mb-1.5 block text-xs">{{ 'pipeline.handover.fields.handoverMeetingAt' | t }}</label>
                    <input appInput id="pack-meeting" type="datetime-local" [value]="pack()['handoverMeetingAt'] ?? ''" (input)="setPack('handoverMeetingAt', $any($event.target).value)" />
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="submit" appButton size="sm" variant="outline" [disabled]="busy()">{{ 'common.actions.save' | t }}</button>
                  @if (value.permissions.canSubmit) {
                    <button type="button" appButton size="sm" [disabled]="busy()" (click)="submit()">{{ 'pipeline.handover.submit' | t }}</button>
                  }
                </div>
              </form>
            }

            @if (value.permissions.canConfirmDesign || value.permissions.canConfirmFinance || value.permissions.canVerifyWon) {
              <div class="flex flex-col gap-3 border-t border-border pt-4">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.handover.confirmations' | t }}</h3>
                <div class="flex flex-wrap items-end gap-2">
                  @if (value.permissions.canConfirmDesign) {
                    <button type="button" appButton size="sm" variant="outline" [disabled]="busy()" (click)="confirm('design_baseline')">{{ 'pipeline.handover.confirmDesign' | t }}</button>
                  }
                  @if (value.permissions.canVerifyWon) {
                    <button type="button" appButton size="sm" variant="outline" [disabled]="busy()" (click)="confirm('won_evidence')">{{ 'pipeline.handover.verifyWon' | t }}</button>
                  }
                </div>
                @if (value.permissions.canConfirmFinance) {
                  <form class="flex flex-wrap items-end gap-2" (submit)="confirmFinance($event)">
                    <div>
                      <label appLabel for="deposit-status" class="mb-1.5 block text-xs">{{ 'pipeline.handover.depositStatus' | t }}</label>
                      <app-select>
                        <select appSelect id="deposit-status" [value]="depositStatus()" (change)="depositStatus.set($any($event.target).value)">
                          @for (status of ['received', 'pending', 'waived', 'not_required']; track status) {
                            <option [value]="status">{{ 'pipeline.handover.deposit.' + status | t }}</option>
                          }
                        </select>
                      </app-select>
                    </div>
                    <div>
                      <label appLabel for="deposit-evidence" class="mb-1.5 block text-xs">{{ 'pipeline.handover.evidenceDocument' | t }}</label>
                      <app-evidence-select inputId="deposit-evidence" entityType="opportunity" [entityId]="opportunityId()" [categories]="['down_payment_proof', 'financial_doc']" [value]="depositEvidence()" (valueChange)="depositEvidence.set($event)" />
                    </div>
                    <div class="min-w-48 flex-1">
                      <label appLabel for="deposit-note" class="mb-1.5 block text-xs">{{ 'pipeline.reason' | t }}</label>
                      <input appInput id="deposit-note" [value]="depositNote()" (input)="depositNote.set($any($event.target).value)" />
                    </div>
                    <button type="submit" appButton size="sm" variant="outline" [disabled]="busy() || (depositStatus() === 'received' && !depositEvidence().trim()) || (depositStatus() === 'waived' && !depositNote().trim())">
                      {{ 'pipeline.handover.confirmFinance' | t }}
                    </button>
                  </form>
                }
              </div>
            }

            @if (value.permissions.canDecide) {
              <div class="flex flex-col gap-3 border-t border-border pt-4">
                <div class="flex flex-wrap gap-2">
                  <button type="button" appButton size="sm" [disabled]="busy() || !value.ready" (click)="accept()">{{ 'pipeline.handover.accept' | t }}</button>
                </div>
                @if (!value.ready) {
                  <p class="text-xs text-muted-foreground">{{ 'pipeline.whyBlocked' | t: { action: ('pipeline.actions.accept_delivery_handover' | t) } }} {{ missingText() }}</p>
                }
                <form class="flex flex-col gap-2" (submit)="returnHandover($event)">
                  <label appLabel for="return-reason" class="text-xs">{{ 'pipeline.handover.returnReason' | t }}</label>
                  <textarea appTextarea id="return-reason" rows="2" [value]="returnReason()" (input)="returnReason.set($any($event.target).value)"></textarea>
                  <label appLabel for="return-items" class="text-xs">{{ 'pipeline.handover.returnItems' | t }}</label>
                  <input appInput id="return-items" dir="ltr" [value]="returnItems()" (input)="returnItems.set($any($event.target).value)" />
                  <div>
                    <button type="submit" appButton size="sm" variant="outline" [disabled]="busy() || !returnReason().trim() || !returnItems().trim()">{{ 'pipeline.handover.return' | t }}</button>
                  </div>
                </form>
              </div>
            }
          }
        }
      </div>
    </section>
  `,
})
export class DeliveryHandoverPanelComponent {
  private readonly api = inject(OpportunitiesApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly people = inject(UserDirectory);

  readonly opportunityId = input.required<string>();
  /** Reloads the case when the opportunity changes. */
  readonly version = input<string | undefined>();
  readonly changed = output<void>();

  protected readonly packFields = PACK_FIELDS;
  protected readonly view = rxResource({
    params: () => ({ id: this.opportunityId(), at: this.version() }),
    stream: ({ params }) => this.api.deliveryHandover(params.id),
  });
  protected readonly pack = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly depositStatus = signal('received');
  protected readonly depositEvidence = signal('');
  protected readonly depositNote = signal('');
  protected readonly returnReason = signal('');
  protected readonly returnItems = signal('');
  protected readonly missingText = computed(() =>
    (this.view.value()?.requirements ?? [])
      .filter((item) => !item.met)
      .map((item) => this.requirementLabel(item.code, item.params))
      .join(this.i18n.locale() === 'ar' ? '، ' : '; '),
  );

  constructor() {
    this.people.load();
    effect(() => {
      const pack = this.view.value()?.handover?.pack ?? {};
      this.pack.set(Object.fromEntries(Object.entries(pack).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])));
    });
  }

  protected setPack(field: string, value: string): void {
    this.pack.set({ ...this.pack(), [field]: value });
  }

  protected confirmationCode(kind: string): string {
    return kind === 'design_baseline' ? 'design_baseline_confirmed' : kind === 'financial_readiness' ? 'financial_readiness_confirmed' : 'won_evidence_verified';
  }

  protected requirementLabel(code: string, params?: Record<string, unknown>): string {
    const key = `pipeline.requirements.${code}`;
    const values = Object.fromEntries(Object.entries(params ?? {}).filter(([, value]) => typeof value === 'string' || typeof value === 'number')) as Record<string, string | number>;
    return this.i18n.has(key) ? this.i18n.t(key, values) : code.replace(/_/g, ' ');
  }

  protected savePack(event: Event): void {
    event.preventDefault();
    const pack: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.pack())) if (value.trim()) pack[key] = key === 'handoverMeetingAt' ? new Date(value).toISOString() : value.trim();
    void this.run(() => this.api.updateHandoverPack(this.opportunityId(), pack));
  }

  protected submit(): void {
    void this.run(() => this.api.submitHandover(this.opportunityId()));
  }

  protected confirm(kind: 'design_baseline' | 'won_evidence'): void {
    void this.run(() => this.api.confirmHandover(this.opportunityId(), { kind }));
  }

  protected confirmFinance(event: Event): void {
    event.preventDefault();
    void this.run(() =>
      this.api.confirmHandover(this.opportunityId(), {
        kind: 'financial_readiness',
        depositStatus: this.depositStatus(),
        evidenceDocumentId: this.depositEvidence().trim() || undefined,
        note: this.depositNote().trim() || undefined,
      }),
    );
  }

  protected async accept(): Promise<void> {
    const result = await this.run(() => this.api.acceptHandover(this.opportunityId()));
    const projectId = (result as { project?: { id?: string } } | undefined)?.project?.id;
    if (projectId) void this.router.navigate([this.i18n.locale(), 'projects', projectId]);
  }

  protected returnHandover(event: Event): void {
    event.preventDefault();
    const items = this.returnItems().split(',').map((item) => item.trim()).filter(Boolean);
    void this.run(() => this.api.returnHandover(this.opportunityId(), { reason: this.returnReason().trim(), items }));
  }

  private async run<T>(call: () => Observable<T>): Promise<T | undefined> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(call());
      this.view.reload();
      this.changed.emit();
      return result;
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
