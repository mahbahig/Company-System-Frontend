import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, type Routes } from '@angular/router';

import { signInAs } from '../../../testing/as-role';
import type { RoleKey } from '../../../testing/role-permissions';
import { routes } from '../../app.routes';
import { ACCOUNT_ROUTES } from '../../features/account/account.routes';
import { CALLS_ROUTES, MEETINGS_ROUTES, VISITS_ROUTES } from '../../features/activities/activities.routes';
import { APPROVALS_ROUTES } from '../../features/approvals/approvals.routes';
import { ASSESSMENTS_ROUTES } from '../../features/assessments/assessments.routes';
import { CONTRACTS_ROUTES } from '../../features/contracts/contracts.routes';
import { CUSTOMERS_ROUTES } from '../../features/customers/customers.routes';
import { HANDOFFS_ROUTES } from '../../features/handoffs/handoffs.routes';
import { IMPORTS_ROUTES } from '../../features/imports/imports.routes';
import { LEADS_ROUTES } from '../../features/leads/leads.routes';
import { NOTIFICATIONS_ROUTES } from '../../features/notifications/notifications.routes';
import { OPPORTUNITIES_ROUTES } from '../../features/opportunities/opportunities.routes';
import { PIPELINE_ROUTES } from '../../features/pipeline/pipeline.routes';
import { PROJECTS_ROUTES } from '../../features/projects/projects.routes';
import { PROPOSALS_ROUTES } from '../../features/proposals/proposals.routes';
import { REPORTS_ROUTES } from '../../features/reports/reports.routes';
import { TASKS_ROUTES } from '../../features/tasks/tasks.routes';
import { AuthService } from '../auth/auth.service';
import type { PermissionCode } from '../auth/permission-code';
import { NavigationService } from './navigation.service';

/** Lazily loaded feature children, keyed by the shell path that loads them. */
const LAZY: Record<string, Routes> = {
  leads: LEADS_ROUTES,
  customers: CUSTOMERS_ROUTES,
  opportunities: OPPORTUNITIES_ROUTES,
  tasks: TASKS_ROUTES,
  calls: CALLS_ROUTES,
  meetings: MEETINGS_ROUTES,
  visits: VISITS_ROUTES,
  approvals: APPROVALS_ROUTES,
  proposals: PROPOSALS_ROUTES,
  projects: PROJECTS_ROUTES,
  contracts: CONTRACTS_ROUTES,
  assessments: ASSESSMENTS_ROUTES,
  handoffs: HANDOFFS_ROUTES,
  imports: IMPORTS_ROUTES,
  reports: REPORTS_ROUTES,
  notifications: NOTIFICATIONS_ROUTES,
  account: ACCOUNT_ROUTES,
  pipeline: PIPELINE_ROUTES,
};

interface Required {
  any?: PermissionCode | PermissionCode[];
  all: PermissionCode[];
}

function shell(): Routes {
  return routes.find((route) => route.path === '' && !!route.canActivate?.length)?.children ?? [];
}

/** Every route level the guard checks for a URL, each with its effective (inherited) permission; null = no route. */
function levels(url: string): Required[] | null {
  const segments = url.split('/').filter(Boolean);
  const result: Required[] = [];
  let candidates: Routes = shell();
  let inherited: Required | undefined;
  let index = 0;
  while (index < segments.length) {
    const rest = segments.slice(index);
    const match = (route: Route) => {
      const parts = (route.path ?? '').split('/').filter(Boolean);
      // A route without children must consume the rest of the URL, as in the router.
      const leaf = !route.children && !LAZY[route.path ?? ''] && !route.loadChildren;
      const fits = leaf ? parts.length === rest.length : parts.length <= rest.length;
      return parts.length > 0 && fits && parts.every((part, i) => part.startsWith(':') || part === rest[i]) ? parts.length : 0;
    };
    const ranked = candidates
      .map((route) => ({ route, size: match(route), exact: (route.path ?? '').split('/').every((part) => !part.startsWith(':')) }))
      .filter((entry) => entry.size > 0)
      .sort((a, b) => Number(b.exact) - Number(a.exact) || b.size - a.size);
    const found = ranked[0];
    if (!found) return null;
    inherited = {
      any: (found.route.data?.['permission'] as Required['any']) ?? inherited?.any,
      all: (found.route.data?.['requiresAll'] as PermissionCode[] | undefined) ?? inherited?.all ?? [],
    };
    result.push(inherited);
    index += found.size;
    candidates = found.route.children ?? LAZY[found.route.path ?? ''] ?? [];
    // A feature's own list page is its empty-path child.
    if (index === segments.length) {
      const landing = candidates.find((route) => route.path === '' && !route.redirectTo);
      if (landing)
        result.push({
          any: (landing.data?.['permission'] as Required['any']) ?? inherited?.any,
          all: (landing.data?.['requiresAll'] as PermissionCode[] | undefined) ?? inherited?.all ?? [],
        });
    }
  }
  return result;
}

describe('role-based page access (routes + navigation)', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
  });

  /** The guard's verdict for a URL (path without locale): every level must pass. */
  function opens(url: string): boolean {
    const chain = levels(url);
    if (!chain) return false;
    return chain.every(
      ({ any, all }) => all.every((permission) => auth.can(permission)) && (!any || (typeof any === 'string' ? auth.can(any) : auth.canAny(any))),
    );
  }

  const MATRIX: Record<RoleKey, { allowed: string[]; denied: string[] }> = {
    // The highest role: every page — business areas as well as administration, security and audit.
    system_administrator: {
      allowed: [
        '/dashboard', '/dashboard/executive', '/customers', '/customers/new', '/leads', '/leads/distribute', '/opportunities', '/pipeline', '/projects',
        '/approvals', '/approvals/limits', '/approvals/delegations', '/reports', '/contracts', '/exceptions', '/calls/new', '/tasks/new',
        '/employees', '/employees/u1', '/admin/roles', '/admin/teams', '/admin/settings', '/admin/audit', '/admin/automation', '/admin/integrations', '/admin/reference-data', '/admin/equipment',
      ],
      // Nothing is refused for its permissions; an unknown URL still fails closed.
      denied: ['/no-such-page'],
    },
    read_only_executive: {
      allowed: ['/dashboard', '/dashboard/executive', '/customers', '/customers/c1', '/opportunities', '/pipeline', '/projects', '/contracts', '/reports', '/exceptions'],
      denied: ['/customers/new', '/customers/c1/edit', '/leads', '/approvals', '/tasks', '/admin/audit', '/employees', '/admin/settings', '/proposals'],
    },
    telesales: {
      allowed: ['/leads', '/leads/new', '/leads/quick-add', '/leads/l1', '/leads/l1/edit', '/calls', '/calls/new', '/meetings/new', '/tasks'],
      denied: ['/leads/distribute', '/leads/l1/convert', '/customers', '/opportunities', '/pipeline', '/proposals', '/reports', '/approvals', '/visits'],
    },
    sales_representative: {
      allowed: ['/pipeline', '/customers', '/customers/new', '/customers/c1/contacts/new', '/opportunities/new', '/opportunities/o1/handoff', '/leads/l1/convert', '/proposals', '/contracts', '/reports'],
      // No site visits at all: not the list, a visit, or scheduling one (the API refuses them too).
      denied: ['/leads/distribute', '/approvals/delegations', '/approvals/limits', '/duplicates', '/employees', '/employees/u1', '/admin/settings', '/admin/audit', '/admin/roles', '/visits', '/visits/new', '/visits/v1'],
    },
    // The Employees page opens (team scope: the API lists only the Sales Representatives who report to them).
    sales_manager: {
      allowed: ['/leads/distribute', '/approvals', '/approvals/delegations', '/duplicates', '/ownership-requests', '/reports', '/exceptions', '/employees', '/employees/u1'],
      denied: ['/admin/settings', '/admin/audit', '/admin/roles', '/approvals/limits', '/admin/equipment', '/dashboard/executive', '/imports'],
    },
    // Second-highest: every business page (incl. the employee directory with performance, settings and
    // approval limits) — never roles & permissions, the audit trail or platform administration.
    ceo: {
      allowed: [
        '/dashboard/executive', '/approvals', '/approvals/limits', '/admin/settings', '/employees', '/employees/u1', '/contracts', '/projects', '/duplicates', '/reports',
        '/leads', '/tasks/new', '/customers/new', '/calls/new', '/exceptions',
      ],
      denied: ['/admin/audit', '/admin/roles', '/admin/automation', '/admin/integrations', '/admin/teams'],
    },
    financial_proposal_manager: {
      allowed: ['/admin/settings', '/admin/equipment', '/contracts', '/proposals', '/proposals/financial/f1', '/projects', '/approvals'],
      denied: ['/employees', '/admin/audit', '/assessments', '/leads', '/handoffs'],
    },
    project_manager: {
      allowed: ['/projects', '/projects/p1', '/handoffs', '/proposals', '/tasks/new', '/opportunities/o1/proposals', '/reports'],
      denied: ['/approvals/delegations', '/admin/equipment', '/leads', '/customers/new', '/admin/settings', '/pipeline'],
    },
    technical_lead: {
      // Contracts in the team's scope: the Technical Lead confirms the contract scope against the approved baseline (D4).
      allowed: ['/assessments', '/assessments/a1', '/admin/equipment', '/projects', '/handoffs', '/opportunities/o1/proposals', '/visits/new', '/contracts'],
      denied: ['/proposals', '/approvals', '/reports', '/admin/settings', '/pipeline'],
    },
    technical_proposal_engineer: {
      allowed: ['/assessments', '/projects', '/tasks', '/visits/new', '/opportunities/o1/intake'],
      denied: ['/contracts', '/proposals', '/approvals', '/admin/equipment', '/reports', '/customers/new', '/pipeline'],
    },
    installation_crew: {
      allowed: ['/dashboard', '/projects', '/projects/p1', '/tasks', '/tasks/t1', '/notifications', '/account/password'],
      denied: ['/tasks/new', '/customers', '/leads', '/assessments', '/visits', '/reports', '/contracts', '/approvals', '/employees', '/opportunities'],
    },
    marketing: {
      allowed: ['/campaigns', '/leads/new', '/imports', '/reports'],
      denied: ['/customers', '/opportunities', '/approvals', '/employees', '/leads/distribute'],
    },
  };

  for (const [role, { allowed, denied }] of Object.entries(MATRIX) as Array<[RoleKey, { allowed: string[]; denied: string[] }]>) {
    describe(role, () => {
      beforeEach(() => signInAs(role));

      it.each(allowed)('opens %s', (url) => {
        expect(opens(url)).toBe(true);
      });

      it.each(denied)('is refused %s (typed URL / deep link)', (url) => {
        expect(opens(url)).toBe(false);
      });

      it('NavigationService.canOpen() gives the same verdict as the guard for every listed URL (links built from data use it)', () => {
        const navigation = TestBed.inject(NavigationService);
        for (const url of allowed) expect(navigation.canOpen(url), `${role} canOpen ${url}`).toBe(true);
        for (const url of denied) expect(navigation.canOpen(url), `${role} canOpen ${url}`).toBe(false);
      });

      it('sees in the navigation only pages it can open', () => {
        const navigation = TestBed.inject(NavigationService);
        const paths = navigation.sections().flatMap((section) => section.items.map((item) => item.path));
        expect(paths).toContain('/dashboard');
        for (const path of paths) expect(opens(path), `${role} nav item ${path}`).toBe(true);
        for (const path of denied.filter((url) => url.split('/').length === 2)) expect(paths).not.toContain(path);
      });
    });
  }

  it('canOpen() fails closed for unknown paths and signed-out users', () => {
    const navigation = TestBed.inject(NavigationService);
    expect(navigation.canOpen('/customers')).toBe(false);
    signInAs('sales_representative');
    expect(navigation.canOpen('/customers')).toBe(true);
    expect(navigation.canOpen('/no-such-area')).toBe(false);
  });
});
