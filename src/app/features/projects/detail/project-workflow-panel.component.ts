import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserDirectory } from '../../../core/users/user-directory.service';
import { pipelineErrorText } from '../../../shared/crm/pipeline-tracker/pipeline-error';
import { PipelineTrackerComponent, type PipelineActionRequest } from '../../../shared/crm/pipeline-tracker/pipeline-tracker.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { type ChangeRequest, type Project, ProjectsApi, type WorkOrder } from '../projects-api.service';

const GATES = ['design', 'materials', 'permits', 'safety', 'access', 'finance'] as const;

/**
 * The delivery pipeline of a project: the stage tracker (every move with what
 * it still needs), the six readiness gates decided by their authority (or a
 * controlled risk accepted with its reason), work orders — authorized only
 * once the gates allow execution, executed only by the assigned crew — and
 * the H2 change requests that are the only way the approved baseline moves.
 */
@Component({
  selector: 'app-project-workflow-panel',
  imports: [
    TranslatePipe,
    PipelineTrackerComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    InputDirective,
    TextareaDirective,
    UserSelectComponent,
  ],
  templateUrl: './project-workflow-panel.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ProjectWorkflowPanelComponent {
  private readonly api = inject(ProjectsApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly people = inject(UserDirectory);

  readonly project = input.required<Project>();
  readonly changed = output<void>();

  protected readonly gates = GATES;
  protected readonly textFields = ['reason', 'description', 'technicalImpact', 'safetyImpact', 'revisedScope'] as const;
  protected readonly numberFields = ['costImpact', 'marginImpact', 'scheduleImpactDays', 'revisedKwp', 'revisedContractValue'] as const;
  protected readonly workflow = rxResource({
    params: () => ({ id: this.project().id, at: (this.project() as unknown as { updatedAt?: string }).updatedAt, status: this.project().status }),
    stream: ({ params }) => this.api.workflow(params.id),
  });
  protected readonly changeRequests = rxResource({ params: () => this.project().id, stream: ({ params }) => this.api.changeRequests(params) });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly crError = signal<string | null>(null);
  protected readonly riskGate = signal<string | null>(null);
  protected readonly riskReason = signal('');
  protected readonly orderTitle = signal('');
  protected readonly orderCrew = signal('');
  protected readonly rejecting = signal<string | null>(null);
  protected readonly rejectNote = signal('');
  protected readonly change = signal<Record<string, string>>({});
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? '');
  protected readonly open = computed(() => !['closed', 'cancelled'].includes(this.project().status));
  protected readonly canManage = computed(() => this.auth.can('projects.manage'));
  protected readonly canRequestChange = computed(() => this.auth.canAny(['projects.manage', 'projects.technical_acceptance', 'opportunities.edit']));
  protected readonly changeReady = computed(() => ['reason', 'description', 'technicalImpact', 'safetyImpact'].every((field) => !!this.change()[field]?.trim()));

  constructor() {
    this.people.load();
  }

  protected gateStatus(gate: string): string {
    return this.project().readinessGates?.[gate]?.status ?? 'pending';
  }

  protected gateTone(gate: string): 'success' | 'warning' | 'danger' | 'neutral' {
    const status = this.gateStatus(gate);
    return status === 'passed' ? 'success' : status === 'risk_accepted' ? 'warning' : status === 'failed' ? 'danger' : 'neutral';
  }

  /** Mirrors the backend authority (the server re-checks role and record scope). */
  protected canDecideGate(gate: string): boolean {
    if (gate === 'design') return this.auth.can('projects.technical_acceptance');
    if (gate === 'safety') return this.auth.canAny(['projects.technical_acceptance', 'projects.manage']);
    if (gate === 'finance') return this.auth.can('financials.edit');
    return this.auth.can('projects.manage');
  }

  protected canDecideRole(role: string): boolean {
    if (role === 'technical') return this.auth.can('projects.technical_acceptance');
    if (role === 'pm') return this.auth.can('projects.manage');
    return this.auth.canAny(['financials.edit', 'opportunities.approve_stage']);
  }

  protected approvalRoles(request: ChangeRequest): string[] {
    return Object.entries(request.approvals).filter(([, slot]) => slot.required).map(([role]) => role);
  }

  protected isCrew(order: WorkOrder): boolean {
    return order.crewIds.map(String).includes(this.currentUserId()) || this.canManage();
  }

  protected crewNames(order: WorkOrder): string {
    return order.crewIds.map((id) => this.people.name(id)).join('، ');
  }

  protected onAction(request: PipelineActionRequest): void {
    void this.run(() => this.api.transition(this.project().id, { action: request.action, reason: request.reason }));
  }

  protected setGate(gate: string, status: string): void {
    void this.run(() => this.api.readiness(this.project().id, gate, { status }));
  }

  protected acceptRisk(event: Event, gate: string): void {
    event.preventDefault();
    void this.run(() => this.api.readiness(this.project().id, gate, { status: 'risk_accepted', riskAcceptedReason: this.riskReason().trim() }));
    this.riskGate.set(null);
    this.riskReason.set('');
  }

  protected createWorkOrder(event: Event): void {
    event.preventDefault();
    void this.run(() => this.api.createWorkOrder(this.project().id, { title: this.orderTitle().trim(), crewIds: [this.orderCrew()] }));
    this.orderTitle.set('');
  }

  protected authorize(order: WorkOrder): void {
    void this.run(() => this.api.authorizeWorkOrder(this.project().id, String(order.id ?? order._id)));
  }

  protected progress(order: WorkOrder, status: 'in_progress' | 'completed'): void {
    void this.run(() => this.api.updateWorkOrder(this.project().id, String(order.id ?? order._id), { status, safetyBriefingDone: true }));
  }

  protected setChange(field: string, value: string): void {
    this.change.set({ ...this.change(), [field]: value });
  }

  protected createChange(event: Event): void {
    event.preventDefault();
    const value = this.change();
    const number = (field: string) => (value[field] !== undefined && value[field] !== '' ? Number(value[field]) : undefined);
    void this.runChange(() =>
      this.api.createChangeRequest(this.project().id, {
        reason: value['reason'],
        description: value['description'],
        technicalImpact: value['technicalImpact'],
        safetyImpact: value['safetyImpact'],
        revisedScope: value['revisedScope'] || undefined,
        costImpact: number('costImpact') ?? 0,
        marginImpact: number('marginImpact') ?? 0,
        scheduleImpactDays: number('scheduleImpactDays') ?? 0,
        revisedKwp: number('revisedKwp'),
        revisedContractValue: number('revisedContractValue'),
      }),
    );
    this.change.set({});
  }

  protected submitChange(request: ChangeRequest): void {
    void this.runChange(() => this.api.submitChangeRequest(request.id));
  }

  protected decide(request: ChangeRequest, role: string, decision: 'approve' | 'reject', note?: string): void {
    void this.runChange(() => this.api.decideChangeRequest(request.id, { role: role as 'technical' | 'pm' | 'commercial', decision, note }));
  }

  protected reject(event: Event, request: ChangeRequest): void {
    event.preventDefault();
    const role = this.rejecting()?.split(':')[1] ?? '';
    this.decide(request, role, 'reject', this.rejectNote().trim());
    this.rejecting.set(null);
    this.rejectNote.set('');
  }

  private async run(call: () => Observable<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call());
      this.workflow.reload();
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }

  private async runChange(call: () => Observable<unknown>): Promise<void> {
    this.busy.set(true);
    this.crError.set(null);
    try {
      await firstValueFrom(call());
      this.changeRequests.reload();
      this.changed.emit();
    } catch (error: unknown) {
      this.crError.set(pipelineErrorText(this.i18n, error));
    } finally {
      this.busy.set(false);
    }
  }
}
