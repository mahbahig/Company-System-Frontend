import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { signInAs } from '../../testing/as-role';
import type { RoleKey } from '../../testing/role-permissions';
import { routes } from '../app.routes';
import { SidebarNavComponent } from '../core/layout/sidebar-nav/sidebar-nav.component';
import { LeadsListPage } from './leads/list/leads-list.page';
import { ProjectDetailPage } from './projects/detail/project-detail.page';
import { ProjectsApi, type ProjectDetail } from './projects/projects-api.service';
import { PipelinesApi } from '../shared/crm/pipeline-tracker/pipelines-api.service';

function configure(providers: unknown[] = []): void {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting(), ...(providers as never[])],
  });
}

/** Renders, lets synchronous resources resolve, renders again (stubbed HTTP stays pending on purpose). */
async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

const text = (fixture: ComponentFixture<unknown>) => (fixture.nativeElement as HTMLElement).textContent ?? '';
const hrefs = (fixture: ComponentFixture<unknown>) =>
  [...(fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? '');

describe('role-aware UI actions (no unauthorized navigation or buttons)', () => {
  describe('sidebar navigation', () => {
    async function navFor(role: RoleKey): Promise<string[]> {
      configure();
      signInAs(role);
      const fixture = TestBed.createComponent(SidebarNavComponent);
      await settle(fixture);
      return hrefs(fixture).map((href) => href.replace(/^\/(ar|en)/, ''));
    }

    it('installation crew sees only its field work', async () => {
      const links = await navFor('installation_crew');
      expect(links).toEqual(expect.arrayContaining(['/dashboard', '/tasks', '/projects']));
      for (const hidden of ['/customers', '/leads', '/reports', '/approvals', '/contracts', '/employees'])
        expect(links).not.toContain(hidden);
    });

    it('the System Administrator sees administration, security and every business area', async () => {
      const links = await navFor('system_administrator');
      expect(links).toEqual(expect.arrayContaining(['/employees', '/admin/roles', '/admin/audit', '/customers', '/leads', '/opportunities', '/projects', '/reports', '/approvals', '/admin/equipment']));
    });

    it('the CEO sees users, settings and the business areas — not roles & permissions or the audit trail', async () => {
      const links = await navFor('ceo');
      expect(links).toEqual(expect.arrayContaining(['/employees', '/admin/settings', '/customers', '/leads', '/approvals', '/reports']));
      for (const hidden of ['/admin/roles', '/admin/audit', '/admin/automation', '/admin/integrations']) expect(links).not.toContain(hidden);
    });

    it('a technical engineer sees no financial or commercial areas', async () => {
      const links = await navFor('technical_proposal_engineer');
      expect(links).toEqual(expect.arrayContaining(['/assessments', '/projects', '/tasks']));
      // Customers stays (own scope: the customers of assigned deals, for site information).
      for (const hidden of ['/contracts', '/proposals', '/reports', '/approvals', '/pipeline', '/leads']) expect(links).not.toContain(hidden);
    });
  });

  describe('lead bank actions', () => {
    async function headerFor(role: RoleKey): Promise<string[]> {
      configure();
      signInAs(role);
      const fixture = TestBed.createComponent(LeadsListPage);
      await settle(fixture);
      return hrefs(fixture);
    }

    it('telesales may create leads but never distribute them', async () => {
      const links = await headerFor('telesales');
      expect(links.some((href) => href.endsWith('/quick-add'))).toBe(true);
      expect(links.some((href) => href.endsWith('/distribute'))).toBe(false);
    });

    it('the sales manager distributes', async () => {
      const links = await headerFor('sales_manager');
      expect(links.some((href) => href.endsWith('/distribute'))).toBe(true);
    });
  });

  describe('project detail actions follow the server-computed, scope-aware flags', () => {
    const detail = (permissions: ProjectDetail['permissions'], financial: boolean): ProjectDetail =>
      ({
        project: {
          id: 'p1',
          projectNo: 'PRJ-1',
          name: 'Plant',
          status: 'testing_commissioning',
          milestones: [],
          procurement: [],
          delays: [],
          customerUpdates: [],
          phases: [],
          inherited: {},
          proposalTeam: {},
          ...(financial ? { contractValue: 1_000_000, payments: [] } : {}),
        },
        completeness: { score: 100, items: [], missing: [], sections: [] },
        permissions,
        nextStatuses: permissions.canManage ? ['handover'] : [],
      }) as unknown as ProjectDetail;

    /** The delivery tracker as the server computes it: the move is permitted only for the PM. */
    const workflow = (permitted: boolean) => ({
      pipeline: 'project',
      stage: 'testing_commissioning',
      history: [],
      blockers: [],
      control: { controlled: true, missing: [], stage: 'testing_commissioning', stageEnteredAt: null, ownerId: null, nextAction: null, nextActionOwnerId: null, dueAt: null, escalation: 'on_track', nextApprovers: [] },
      transitions: [
        {
          pipeline: 'project',
          action: 'technical_sign_off',
          from: 'testing_commissioning',
          to: 'customer_acceptance',
          permitted,
          ready: false,
          requirements: [{ code: 'technical_lead_sign_off', kind: 'approval', met: false }],
          performedBy: ['project_manager'],
          approvedBy: ['technical_lead'],
        },
      ],
    });

    async function render(role: RoleKey, tab: string, value: ProjectDetail) {
      TestBed.resetTestingModule();
      configure([
        {
          provide: ProjectsApi,
          useValue: { get: () => of(value), workflow: () => of(workflow(value.permissions.canManage)), changeRequests: () => of([]) },
        },
        { provide: PipelinesApi, useValue: { definitions: () => of([]) } },
      ]);
      signInAs(role);
      const fixture = TestBed.createComponent(ProjectDetailPage);
      fixture.componentRef.setInput('id', 'p1');
      fixture.componentRef.setInput('tab', tab);
      await settle(fixture);
      return fixture;
    }

    it('the Technical Lead records technical acceptance; the PM does not see that action', async () => {
      const lead = await render('technical_lead', 'commissioning', detail({ canManage: false, canExecute: true, canAcceptTechnically: true, canUpdatePayments: false }, false));
      expect(text(lead)).toContain('projects.recordTechnicalAcceptance');
      const pm = await render('project_manager', 'commissioning', detail({ canManage: true, canExecute: true, canAcceptTechnically: false, canUpdatePayments: false }, true));
      expect(text(pm)).not.toContain('projects.recordTechnicalAcceptance');
    });

    it('the installation crew gets no payments tab and no stage move — only who performs it', async () => {
      const crew = await render('installation_crew', 'delivery', detail({ canManage: false, canExecute: true, canAcceptTechnically: false, canUpdatePayments: false }, false));
      expect(text(crew)).not.toContain('projects.tabs.payments');
      expect(crew.nativeElement.querySelector('[data-action="technical_sign_off"] button')).toBeNull();
      expect(text(crew)).toContain('pipeline.performedBy');
    });

    it('the PM sees the move with exactly why it is blocked; financial viewers get the payments tab', async () => {
      const pm = await render('project_manager', 'delivery', detail({ canManage: true, canExecute: true, canAcceptTechnically: false, canUpdatePayments: false }, true));
      expect(text(pm)).toContain('projects.tabs.payments');
      const button = pm.nativeElement.querySelector('[data-action="technical_sign_off"] button') as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button!.disabled).toBe(true);
      // Why it is blocked, listed next to the move (humanized when no catalogue is loaded).
      expect(pm.nativeElement.querySelector('[data-action="technical_sign_off"] [data-testid="unmet"]')?.textContent).toContain('Technical lead sign off');
    });
  });
});
