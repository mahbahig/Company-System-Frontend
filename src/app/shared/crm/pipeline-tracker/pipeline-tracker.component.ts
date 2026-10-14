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
  template: `
    <section appCard [attr.aria-labelledby]="headingId">
      <div appCardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 appCardTitle [id]="headingId">{{ heading() || ('pipeline.titles.' + view().pipeline | t) }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <app-badge tone="info" data-testid="current-stage">{{ stageKey(view().stage) }} · {{ stageLabel(view().stage) }}</app-badge>
          <app-badge [tone]="escalationTone()">{{ 'pipeline.escalation.' + view().control.escalation | t }}</app-badge>
          @if (!view().control.controlled && view().control.missing.length) {
            <app-badge tone="warning">{{ 'pipeline.notControlled' | t }}</app-badge>
          }
        </div>
      </div>

      <div appCardContent class="flex flex-col gap-5">
        @if (error(); as text) {
          <app-alert variant="destructive" role="alert">{{ text }}</app-alert>
        }

        <!-- Where the record is in the pipeline, and its branches. -->
        @if (openStages().length) {
          <ol class="flex flex-wrap items-center gap-1.5" [attr.aria-label]="'pipeline.stagesLabel' | t">
            @for (stage of openStages(); track stage.code) {
              <li>
                <app-badge [tone]="stageTone(stage)" [attr.aria-current]="stage.code === view().stage ? 'step' : null">{{ stage.key }} {{ stageLabel(stage.code) }}</app-badge>
              </li>
            }
          </ol>
          @if (branchStages().length) {
            <p class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{{ 'pipeline.branches' | t }}:</span>
              @for (stage of branchStages(); track stage.code) {
                <app-badge [tone]="stage.code === view().stage ? 'warning' : 'outline'">{{ stage.key }} {{ stageLabel(stage.code) }}</app-badge>
              }
            </p>
          }
        }

        <!-- Operational control: owner, next action, due date, approvers. -->
        <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.owner' | t }}</dt>
            <dd>{{ people.name(view().control.ownerId) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.nextAction' | t }}</dt>
            <dd>{{ view().control.nextAction ? actionLabel(view().control.nextAction!) : ('crm.common.notSet' | t) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.nextActionOwner' | t }}</dt>
            <dd>{{ people.name(view().control.nextActionOwnerId) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.dueAt' | t }}</dt>
            <dd class="tabular" [class.text-destructive]="overdue()" [class.font-medium]="overdue()">{{ view().control.dueAt ? i18n.formatDate(view().control.dueAt, true) : ('crm.common.notSet' | t) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.since' | t }}</dt>
            <dd class="tabular">{{ i18n.formatDate(view().control.stageEnteredAt, true) || ('crm.common.notSet' | t) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ 'pipeline.control.approvers' | t }}</dt>
            <dd>{{ roles(view().control.nextApprovers) || ('crm.common.none' | t) }}</dd>
          </div>
        </dl>
        @if (view().control.missing.length) {
          <p class="text-xs text-warning-tint">{{ 'pipeline.control.missing' | t }}: {{ missingControl() }}</p>
        }

        <!-- Transitions: what each move still needs; buttons only for this user's permitted moves. -->
        @if (transitions().length) {
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.transitionsTitle' | t }}</h3>
            <ul class="flex flex-col gap-3">
              @for (transition of transitions(); track transition.action) {
                <li class="rounded-md border border-border p-3" [attr.data-action]="transition.action">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2 text-sm">
                      <span class="font-medium">{{ actionLabel(transition.action) }}</span>
                      <span class="text-muted-foreground">→ {{ stageLabel(transition.to) }}</span>
                      <app-badge [tone]="transition.ready ? 'success' : 'warning'">{{ (transition.ready ? 'pipeline.ready' : 'pipeline.blocked') | t }}</app-badge>
                    </div>
                    @if (transition.permitted && !hidden().includes(transition.action)) {
                      <button
                        type="button"
                        appButton
                        size="sm"
                        [variant]="isClosing(transition) ? 'outline' : 'default'"
                        [disabled]="busy() || !transition.ready"
                        [attr.aria-describedby]="transition.ready ? null : 'why-' + transition.action"
                        (click)="start(transition)"
                      >
                        {{ actionLabel(transition.action) }}
                      </button>
                    } @else if (via()[transition.action]) {
                      <span class="text-xs text-muted-foreground">{{ via()[transition.action] | t }}</span>
                    } @else if (!transition.permitted) {
                      <span class="text-xs text-muted-foreground">{{ 'pipeline.performedBy' | t: { roles: roles(transition.performedBy) } }}</span>
                    }
                  </div>
                  @if (transition.approvedBy.length) {
                    <p class="mt-1 text-xs text-muted-foreground">{{ 'pipeline.approvedBy' | t: { roles: roles(transition.approvedBy) } }}</p>
                  }
                  @if (unmetOf(transition).length) {
                    <div [id]="'why-' + transition.action" class="mt-2">
                      <p class="text-xs font-medium">{{ 'pipeline.whyBlocked' | t: { action: actionLabel(transition.action) } }}</p>
                      <ul class="mt-1 flex flex-col gap-0.5 text-xs" data-testid="unmet">
                        @for (item of unmetOf(transition); track item.code) {
                          <li class="flex gap-1.5"><span aria-hidden="true" class="text-destructive">✗</span>{{ requirementLabel(item) }}</li>
                        }
                      </ul>
                    </div>
                  }
                  @if (metOf(transition).length) {
                    <details class="mt-2 text-xs text-muted-foreground">
                      <summary class="cursor-pointer">{{ 'pipeline.metCount' | t: { count: metOf(transition).length } }}</summary>
                      <ul class="mt-1 flex flex-col gap-0.5">
                        @for (item of metOf(transition); track item.code) {
                          <li class="flex gap-1.5"><span aria-hidden="true" class="text-success-tint">✓</span>{{ requirementLabel(item) }}</li>
                        }
                      </ul>
                    </details>
                  }
                  @if (pending()?.action === transition.action) {
                    <form class="mt-3 flex flex-col gap-2" (submit)="confirm($event)">
                      <label [for]="'reason-' + transition.action" class="text-xs font-medium">{{ 'pipeline.reason' | t }}</label>
                      <textarea appTextarea [id]="'reason-' + transition.action" rows="2" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
                      <div class="flex gap-2">
                        <button type="submit" appButton size="sm" [disabled]="busy() || !reason().trim()">{{ 'pipeline.confirm' | t }}</button>
                        <button type="button" appButton size="sm" variant="outline" (click)="pending.set(null)">{{ 'common.actions.cancel' | t }}</button>
                      </div>
                    </form>
                  }
                </li>
              }
            </ul>
          </div>
        }

        <!-- Open blockers with their owner and due date. -->
        @if (openBlockers().length) {
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.blockersTitle' | t }}</h3>
            <ul class="flex flex-col gap-2 text-sm" data-testid="blockers">
              @for (blocker of openBlockers(); track blocker.code + blocker.dueAt) {
                <li class="flex flex-wrap items-center gap-2">
                  <app-badge [tone]="blocker.severity === 'warning' ? 'warning' : 'danger'">{{ 'pipeline.severity.' + blocker.severity | t }}</app-badge>
                  <span>{{ blocker.description }}</span>
                  <span class="text-xs text-muted-foreground">
                    {{ people.name(blocker.ownerId) }} · <span class="tabular" [class.text-destructive]="isOverdue(blocker.dueAt)">{{ i18n.formatDate(blocker.dueAt) }}</span>
                  </span>
                </li>
              }
            </ul>
          </div>
        }

        <!-- Stage history: never rewritten. -->
        <details [open]="historyOpen()">
          <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'pipeline.historyTitle' | t: { count: view().history.length } }}</summary>
          <ol class="mt-2 flex flex-col gap-2 text-sm">
            @for (entry of historyNewestFirst(); track $index) {
              <li class="border-s-2 border-border ps-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ entry.fromStage ? stageLabel(entry.fromStage) + ' → ' : '' }}{{ stageLabel(entry.toStage) }}</span>
                  @if (entry.action) {
                    <app-badge tone="outline">{{ actionLabel(entry.action) }}</app-badge>
                  }
                </div>
                <p class="text-xs text-muted-foreground">
                  <span class="tabular">{{ i18n.formatDate(entry.enteredAt, true) }}</span> · {{ entry.changedBy ? people.name(entry.changedBy) : ('pipeline.system' | t) }}
                  @if (entry.evidence?.length) {
                    · {{ 'pipeline.evidenceCount' | t: { count: entry.evidence!.length } }}
                  }
                  @if (entry.approvalIds?.length) {
                    · {{ 'pipeline.approvalCount' | t: { count: entry.approvalIds!.length } }}
                  }
                </p>
                @if (entry.reason) {
                  <p class="text-xs">{{ entry.reason }}</p>
                }
              </li>
            }
          </ol>
        </details>
      </div>
    </section>
  `,
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
