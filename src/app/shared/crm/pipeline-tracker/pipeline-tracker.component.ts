import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserDirectory } from '../../../core/users/user-directory.service';
import { isOverdue } from '../../utils/format';
import { AlertComponent } from '../../ui/alert/alert.component';
import { BadgeComponent } from '../../ui/badge/badge.component';
import type { BadgeTone } from '../../ui/badge/badge-variants';
import { ButtonDirective } from '../../ui/button/button.directive';
import { CardContentDirective } from '../../ui/card/card-content.directive';
import { CardHeaderDirective } from '../../ui/card/card-header.directive';
import { CardTitleDirective } from '../../ui/card/card-title.directive';
import { CardDirective } from '../../ui/card/card.directive';
import { TextareaDirective } from '../../ui/form/textarea.directive';
import type { PipelineDefinition, StageDefinition } from './pipeline-definition.interface';
import { PipelinesApi } from './pipelines-api.service';
import type { RequirementResult, StageEntry, TransitionReport, WorkflowView } from './workflow-view.interface';

/** What a user asked for: the action, and the reason when the move needs one. */
export interface PipelineActionRequest {
  action: string;
  reason?: string;
}

/** Transition kinds that always carry a reason (exceptions, closures, reopenings, rework). */
const REASON_KINDS = new Set(['exception', 'close', 'reopen', 'rework']);

/**
 * The stage tracker of any controlled record (lead, customer, opportunity,
 * deal, handover, project): the current stage and where it sits in the
 * pipeline, its branches, who owns the next action and when it is due, who
 * approves, every transition with exactly what it still needs, open
 * blockers and the full stage history.
 *
 * Only the transitions the backend reports as `permitted` for this user get a
 * button, and a button is enabled only when every requirement is met — a
 * blocked move says why instead of failing. The backend re-checks everything.
 */
@Component({
  selector: 'app-pipeline-tracker',
  imports: [TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, CardDirective, CardHeaderDirective, CardTitleDirective, CardContentDirective, TextareaDirective],
  templateUrl: './pipeline-tracker.component.html',
})
export class PipelineTrackerComponent {
  private static nextId = 0;
  protected readonly i18n = inject(I18nService);
  protected readonly people = inject(UserDirectory);
  private readonly pipelines = inject(PipelinesApi);

  readonly view = input.required<WorkflowView>();
  readonly heading = input<string>();
  readonly busy = input(false);
  /** The server's refusal of the last action, already translated (see `pipelineErrorText`). */
  readonly error = input<string | null>(null);
  /** Actions performed elsewhere on the page (their own form); no button here. */
  readonly hidden = input<string[]>([]);
  /** Where an action is performed instead (action → i18n key), e.g. the proposals tab. */
  readonly via = input<Record<string, string>>({});
  /** Actions whose form the page owns: emitted without asking for a reason. */
  readonly formActions = input<string[]>([]);
  readonly historyOpen = input(false);
  readonly act = output<PipelineActionRequest>();

  protected readonly headingId = `pipeline-tracker-${PipelineTrackerComponent.nextId++}`;
  protected readonly pending = signal<TransitionReport | null>(null);
  protected readonly reason = signal('');
  protected readonly isOverdue = isOverdue;

  private readonly definitions = rxResource({ stream: () => this.pipelines.definitions() });
  private readonly definition = computed<PipelineDefinition | null>(() =>
    this.definitions.hasValue() ? (this.definitions.value().find((entry) => entry.code === this.view().pipeline) ?? null) : null,
  );
  protected readonly openStages = computed(() => this.definition()?.stages.filter((stage) => stage.kind === 'open') ?? []);
  protected readonly branchStages = computed(() => this.definition()?.stages.filter((stage) => stage.kind !== 'open') ?? []);
  protected readonly transitions = computed(() => this.view().transitions);
  protected readonly openBlockers = computed(() => this.view().blockers.filter((blocker) => !blocker.resolvedAt));
  protected readonly historyNewestFirst = computed<StageEntry[]>(() => [...this.view().history].reverse());
  protected readonly overdue = computed(() => isOverdue(this.view().control.dueAt));
  protected readonly escalationTone = computed<BadgeTone>(() => {
    switch (this.view().control.escalation) {
      case 'overdue':
      case 'escalated':
        return 'danger';
      case 'due_soon':
        return 'warning';
      default:
        return 'success';
    }
  });
  protected readonly missingControl = computed(() => this.view().control.missing.map((code) => this.i18n.t(`pipeline.control.items.${code}`)).join('، '));

  constructor() {
    this.people.load();
  }

  protected stageKey(code: string): string {
    return this.definition()?.stages.find((stage) => stage.code === code)?.key ?? '';
  }

  protected stageLabel(code: string): string {
    const key = `pipeline.stages.${this.view().pipeline}.${code}`;
    if (this.i18n.has(key)) return this.i18n.t(key);
    const shared = `pipeline.stages.common.${code}`;
    return this.i18n.has(shared) ? this.i18n.t(shared) : humanize(code);
  }

  protected stageTone(stage: StageDefinition): BadgeTone {
    const order = this.openStages().map((entry) => entry.code);
    const current = order.indexOf(this.view().stage);
    const index = order.indexOf(stage.code);
    if (stage.code === this.view().stage) return 'info';
    if (current >= 0 && index < current) return 'success';
    return 'outline';
  }

  protected actionLabel(action: string): string {
    const key = `pipeline.actions.${action}`;
    return this.i18n.has(key) ? this.i18n.t(key) : humanize(action);
  }

  protected requirementLabel(item: RequirementResult): string {
    const key = `pipeline.requirements.${item.code}`;
    const base = this.i18n.has(key) ? this.i18n.t(key, flatParams(item.params)) : humanize(item.code);
    const missing = Array.isArray(item.params?.['missing']) ? (item.params!['missing'] as string[]) : [];
    if (!missing.length || item.met) return base;
    return `${base}: ${missing.map((id) => (this.i18n.has(`completeness.items.${id}`) ? this.i18n.t(`completeness.items.${id}`) : humanize(id))).join('، ')}`;
  }

  protected roles(codes: string[]): string {
    return [...new Set(codes)].map((code) => (this.i18n.has(`enums.roleCode.${code}`) ? this.i18n.t(`enums.roleCode.${code}`) : humanize(code))).join('، ');
  }

  protected unmetOf(transition: TransitionReport): RequirementResult[] {
    return transition.requirements.filter((item) => !item.met);
  }

  protected metOf(transition: TransitionReport): RequirementResult[] {
    return transition.requirements.filter((item) => item.met);
  }

  protected isClosing(transition: TransitionReport): boolean {
    return this.kindOf(transition.action) === 'close';
  }

  protected start(transition: TransitionReport): void {
    if (this.formActions().includes(transition.action) || !REASON_KINDS.has(this.kindOf(transition.action) ?? '')) {
      this.act.emit({ action: transition.action });
      return;
    }
    this.reason.set('');
    this.pending.set(transition);
  }

  protected confirm(event: Event): void {
    event.preventDefault();
    const transition = this.pending();
    if (!transition || !this.reason().trim()) return;
    this.act.emit({ action: transition.action, reason: this.reason().trim() });
    this.pending.set(null);
  }

  private kindOf(action: string): string | undefined {
    return this.definition()?.transitions.find((transition) => transition.action === action)?.kind;
  }
}

function humanize(code: string): string {
  return code.replace(/[_.]/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function flatParams(params?: Record<string, unknown>): Record<string, string | number> {
  const flat: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {}))
    if (typeof value === 'string' || typeof value === 'number') flat[key] = value;
    else if (value != null && !Array.isArray(value)) flat[key] = String(value);
  return flat;
}
