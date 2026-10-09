import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import type { Contact } from '../../customers/models/contact.interface';

const ROLES = ['decision_maker', 'technical_contact', 'finance_contact', 'site_contact', 'procurement', 'influencer', 'other'];

interface Linked {
  id: string;
  status: string;
  assessmentNo?: string;
  contractNo?: string;
  projectNo?: string;
  versionNo?: number;
}

interface ContactRole {
  contactId: string;
  role: string;
  note?: string;
}

/**
 * The opportunity as the hub of the solar workflow (§6): one place that links
 * to intake, handoff, assessments, proposals, contract and project, offers
 * the activity quick actions, and manages the deal's contact roles (CONT-02).
 */
@Component({
  selector: 'app-opportunity-hub',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <section appCard aria-labelledby="hub-heading">
      <div appCardHeader>
        <h2 appCardTitle id="hub-heading">{{ 'oppHub.title' | t }}</h2>
      </div>
      <div appCardContent class="flex flex-col gap-4">
        <nav class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" [attr.aria-label]="'oppHub.title' | t">
          @if (auth.can('intake.view')) {
            <a class="hub-link" [routerLink]="base().concat('intake')">
              <span class="font-medium">{{ 'oppHub.intake' | t }}</span>
              @if (intakeStatus()) {
                <app-status-badge enum="intakeStatus" [value]="intakeStatus()!" />
              }
            </a>
          }
          @if (auth.can('handoffs.view')) {
            <a class="hub-link" [routerLink]="base().concat('handoff')">
              <span class="font-medium">{{ 'oppHub.handoff' | t }}</span>
              @if (handoffStatus()) {
                <app-status-badge enum="handoffStatus" [value]="handoffStatus()!" />
              }
            </a>
          }
          @if (auth.can('assessments.view')) {
            @for (a of assessments.value() ?? []; track a.id) {
              <a class="hub-link" [routerLink]="['/', i18n.locale(), 'assessments', a.id]">
                <span class="font-medium">{{ 'oppHub.assessment' | t }} <span class="tabular text-xs" dir="ltr">{{ a.assessmentNo }}</span></span>
                <app-status-badge enum="assessmentStatus" [value]="a.status" />
              </a>
            } @empty {
              <span class="hub-link text-muted-foreground">
                <span>{{ 'oppHub.assessment' | t }} — {{ 'oppHub.notStarted' | t }}</span>
                @if (auth.can('assessments.create') && !assessments.isLoading()) {
                  <button type="button" appButton size="sm" [disabled]="!handoffAccepted() || assessmentAction.busy()" [attr.title]="handoffAccepted() ? null : ('oppHub.assessmentNeedsHandoff' | t)" (click)="startAssessment()">{{ 'oppHub.startAssessment' | t }}</button>
                }
              </span>
            }
          }
          @if (auth.canAny(['technical_proposals.view', 'financial_proposals.view', 'combined_proposals.view'])) {
            <a class="hub-link" [routerLink]="base().concat('proposals')">
              <span class="font-medium">{{ 'oppHub.proposals' | t }}</span>
              @if (proposalStatus()) {
                <app-status-badge enum="combinedProposalStatus" [value]="proposalStatus()!" />
              }
            </a>
          }
          @if (auth.can('contracts.view')) {
            @for (c of contracts.value() ?? []; track c.id) {
              <a class="hub-link" [routerLink]="['/', i18n.locale(), 'contracts', c.id]">
                <span class="font-medium">{{ 'oppHub.contract' | t }} <span class="tabular text-xs" dir="ltr">{{ c.contractNo }} v{{ c.versionNo }}</span></span>
                <app-status-badge enum="contractStatus" [value]="c.status" />
              </a>
            } @empty {
              <span class="hub-link text-muted-foreground">{{ 'oppHub.contract' | t }} — {{ 'oppHub.notStarted' | t }}</span>
            }
          }
          @if (auth.can('projects.view')) {
            @for (p of projects.value() ?? []; track p.id) {
              <a class="hub-link" [routerLink]="['/', i18n.locale(), 'projects', p.id]">
                <span class="font-medium">{{ 'oppHub.project' | t }} <span class="tabular text-xs" dir="ltr">{{ p.projectNo }}</span></span>
                <app-status-badge enum="projectStatus" [value]="p.status" />
              </a>
            }
          }
        </nav>

        @if (auth.can('assessments.create') && !handoffAccepted() && !(assessments.value() ?? []).length) {
          <p class="text-sm text-muted-foreground">{{ 'oppHub.assessmentNeedsHandoff' | t }}</p>
        }
        @if (assessmentAction.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }

        <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="'customer360.quickActions' | t">
          @if (auth.can('calls.create')) {
            <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'calls', 'new']" [queryParams]="activityParams()">{{ 'act.calls.new' | t }}</a>
          }
          @if (auth.can('meetings.create')) {
            <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'meetings', 'new']" [queryParams]="activityParams()">{{ 'act.meetings.new' | t }}</a>
          }
          @if (auth.can('visits.create')) {
            <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'visits', 'new']" [queryParams]="activityParams()">{{ 'act.visits.new' | t }}</a>
          }
          @if (auth.can('tasks.create')) {
            <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'tasks', 'new']" [queryParams]="{ opportunityId: opportunityId() }">{{ 'oppHub.newTask' | t }}</a>
          }
        </div>
      </div>
    </section>

    <section appCard aria-labelledby="roles-heading">
      <div appCardHeader>
        <h2 appCardTitle id="roles-heading">{{ 'oppHub.contactRoles' | t }}</h2>
        <p appCardDescription>{{ 'oppHub.contactRolesHint' | t }}</p>
      </div>
      <div appCardContent class="flex flex-col gap-3">
        @if (actions.message(); as text) {
          <app-alert>{{ text }}</app-alert>
        }
        @if (actions.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }
        @for (contact of contacts.value() ?? []; track contact.id) {
          <div class="grid items-center gap-2 sm:grid-cols-[1fr_12rem_auto]">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" [disabled]="!canEdit()" [checked]="!!roleOf(contact.id)" (change)="toggle(contact.id, $any($event.target).checked)" />
              <span class="font-medium">{{ contact.fullName }}</span>
              @if (contact.jobTitle) {
                <span class="text-xs text-muted-foreground">{{ contact.jobTitle }}</span>
              }
            </label>
            @if (roleOf(contact.id); as current) {
              <app-select>
                <select appSelect [attr.aria-label]="'oppHub.role' | t" [disabled]="!canEdit()" [value]="current.role" (change)="setRole(contact.id, $any($event.target).value)">
                  @for (role of roles; track role) {
                    <option [value]="role">{{ role | enum: 'contactRole' }}</option>
                  }
                </select>
              </app-select>
              <label class="flex items-center gap-1 text-xs">
                <input type="radio" name="primary-contact" [disabled]="!canEdit()" [checked]="primary() === contact.id" (change)="primary.set(contact.id)" />
                {{ 'oppHub.primary' | t }}
              </label>
            }
          </div>
        } @empty {
          <p class="text-sm text-muted-foreground">{{ 'oppHub.noContacts' | t }}</p>
        }
        @if (canEdit() && (contacts.value() ?? []).length) {
          <button type="button" appButton size="sm" class="self-start" [disabled]="actions.busy()" (click)="saveRoles()">{{ 'oppHub.saveRoles' | t }}</button>
        }
      </div>
    </section>
  `,
  styles: `
    .hub-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      border: 1px solid hsl(var(--border));
      border-radius: 0.5rem;
      padding: 0.625rem 0.75rem;
      font-size: 0.875rem;
    }
    a.hub-link:hover {
      border-color: hsl(var(--primary));
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class OpportunityHubComponent {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly assessmentAction = new ActionRunner(this.i18n);
  protected readonly roles = ROLES;

  readonly opportunityId = input.required<string>();
  readonly customerId = input.required<string>();
  readonly intakeStatus = input<string | undefined>();
  readonly handoffStatus = input<string | undefined>();
  readonly proposalStatus = input<string | undefined>();
  readonly contactRoles = input<ContactRole[]>([]);
  readonly primaryContactId = input<string | null | undefined>();
  readonly changed = output<void>();

  protected readonly base = computed(() => ['/', this.i18n.locale(), 'opportunities', this.opportunityId()]);
  protected readonly activityParams = computed(() => ({ customerId: this.customerId(), opportunityId: this.opportunityId() }));
  protected readonly canEdit = computed(() => this.auth.can('opportunities.edit'));
  protected readonly handoffAccepted = computed(() => this.handoffStatus() === 'accepted');

  protected readonly assessments = rxResource({
    params: () => (this.auth.can('assessments.view') ? this.opportunityId() : undefined),
    stream: ({ params }) => (params ? this.listOf('assessments', params) : of([])),
  });
  protected readonly contracts = rxResource({
    params: () => (this.auth.can('contracts.view') ? this.opportunityId() : undefined),
    stream: ({ params }) => (params ? this.listOf('contracts', params) : of([])),
  });
  protected readonly projects = rxResource({
    params: () => (this.auth.can('projects.view') ? this.opportunityId() : undefined),
    stream: ({ params }) => (params ? this.listOf('projects', params) : of([])),
  });
  protected readonly contacts = rxResource({
    params: () => (this.auth.can('contacts.view') ? this.customerId() : undefined),
    stream: ({ params }) => (params ? this.api.get<Contact[]>(`customers/${params}/contacts`) : of([] as Contact[])),
  });

  protected readonly draft = signal<ContactRole[]>([]);
  protected readonly primary = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.draft.set(this.contactRoles().map((row) => ({ ...row, contactId: typeof row.contactId === 'object' ? String((row.contactId as { id: string }).id) : String(row.contactId) })));
      this.primary.set(this.primaryContactId() ?? null);
    });
  }

  private listOf(path: string, opportunityId: string) {
    return this.api.get<Page<Linked>>(path, { opportunityId, pageSize: 10 }).pipe(map((page) => page.rows));
  }

  /** TECH-01/02: opens the site assessment (prefilled from the intake and the site) and goes straight to it. */
  protected startAssessment(): void {
    void this.assessmentAction.run(this.api.post<{ id: string }>(`assessments/opportunity/${this.opportunityId()}`), null, (assessment) => {
      this.assessments.reload();
      void this.router.navigate(['/', this.i18n.locale(), 'assessments', assessment.id]);
    });
  }

  protected roleOf(contactId: string): ContactRole | undefined {
    return this.draft().find((row) => row.contactId === contactId);
  }

  protected toggle(contactId: string, on: boolean): void {
    this.draft.update((rows) => (on ? [...rows, { contactId, role: 'other' }] : rows.filter((row) => row.contactId !== contactId)));
    if (!on && this.primary() === contactId) this.primary.set(null);
  }

  protected setRole(contactId: string, role: string): void {
    this.draft.update((rows) => rows.map((row) => (row.contactId === contactId ? { ...row, role } : row)));
  }

  protected saveRoles(): void {
    const primary = this.primary();
    void this.actions.run(
      this.api.put(`opportunities/${this.opportunityId()}/contacts`, {
        contacts: this.draft().map((row) => ({ contactId: row.contactId, role: row.role, note: row.note })),
        primaryContactId: primary && this.draft().some((row) => row.contactId === primary) ? primary : undefined,
      }),
      'oppHub.rolesSaved',
      () => this.changed.emit(),
    );
  }
}
