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
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

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
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, ...CARD_IMPORTS, ...FORM_IMPORTS, CreateIconComponent],
  templateUrl: './opportunity-hub.component.html',
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
