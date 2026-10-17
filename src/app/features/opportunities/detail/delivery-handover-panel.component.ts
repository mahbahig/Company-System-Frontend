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
  templateUrl: './delivery-handover-panel.component.html',
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
    if (projectId) void this.router.navigate(['/', 'projects', projectId]);
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
