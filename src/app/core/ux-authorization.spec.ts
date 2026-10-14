import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { signInAs } from '../../testing/as-role';
import type { RoleKey } from '../../testing/role-permissions';
import { routes } from '../app.routes';
import { CustomersListPage } from '../features/customers/list/customers-list.page';
import { ContractsListPage } from '../features/contracts/list/contracts-list.page';
import { TableColumns } from '../shared/crm/table-columns/table-columns';
import { AuthService } from './auth/auth.service';
import { PaletteCommands } from './command-palette/palette-commands.service';
import { DRAFT_PREFIX, DraftStore } from './forms/draft-store.service';
import { unsavedChangesGuard } from './forms/unsaved-changes';
import { CREATE_ACTIONS } from './navigation/create-actions';
import { NavigationService } from './navigation/navigation.service';
import { notificationAction, notificationTarget } from './notifications/notification-action';
import { RecentRecords } from './records/recent-records.service';
import { KeyboardShortcuts } from './shortcuts/keyboard-shortcuts.service';
import { ConfirmService } from '../shared/ui/confirm/confirm.service';

const ROLES: RoleKey[] = [
  'system_administrator',
  'ceo',
  'read_only_executive',
  'sales_manager',
  'sales_representative',
  'telesales',
  'marketing',
  'project_manager',
  'technical_lead',
  'technical_proposal_engineer',
  'financial_proposal_manager',
  'installation_crew',
];

function configure(): void {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

const key = (init: KeyboardEventInit & { key: string }, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('UX features never widen access', () => {
  beforeEach(configure);

  describe('command palette commands (derived from permissions, per role)', () => {
    for (const role of ROLES) {
      it(`${role}: every page command opens for the role; create commands match the create permission and route guard`, () => {
        signInAs(role);
        const commands = TestBed.inject(PaletteCommands);
        const navigation = TestBed.inject(NavigationService);
        const auth = TestBed.inject(AuthService);

        for (const page of commands.pages()) expect(navigation.canOpen(page.path!), `${role} page ${page.path}`).toBe(true);
        // Every nav item the sidebar shows is reachable from the palette, and nothing else from the navigation.
        const navPaths = navigation.sections().flatMap((section) => section.items.map((item) => item.path));
        const pagePaths = commands.pages().map((page) => page.path);
        for (const path of navPaths) expect(pagePaths).toContain(path);

        const createPaths = commands.creates().map((command) => command.path);
        for (const action of CREATE_ACTIONS) {
          const expected = auth.can(action.permission) && navigation.canOpen(action.path);
          expect(createPaths.includes(action.path), `${role} create ${action.path}`).toBe(expected);
        }

        // Actions are personal preferences only — nothing that changes business data.
        expect(commands.actions().map((action) => action.id).sort()).toEqual(['action:locale', 'action:shortcuts', 'action:sidebar', 'action:sign-out', 'action:theme']);
      });
    }

    it('roles without create rights get no create commands at all', () => {
      for (const role of ['read_only_executive', 'installation_crew', 'financial_proposal_manager'] as RoleKey[]) {
        signInAs(role);
        expect(TestBed.inject(PaletteCommands).creates(), role).toEqual([]);
      }
    });

    it('telesales may create leads, calls, meetings and tasks — never customers or opportunities', () => {
      signInAs('telesales');
      const paths = TestBed.inject(PaletteCommands).creates().map((command) => command.path);
      expect(paths).toEqual(expect.arrayContaining(['/leads/new', '/leads/quick-add', '/calls/new', '/meetings/new', '/tasks/new']));
      expect(paths).not.toContain('/customers/new');
      expect(paths).not.toContain('/opportunities/new');
    });

    it('the System Administrator (highest role) gets every page and every create command', () => {
      signInAs('system_administrator');
      const commands = TestBed.inject(PaletteCommands);
      const paths = commands.pages().map((page) => page.path);
      expect(paths).toEqual(expect.arrayContaining(['/admin/users', '/admin/roles', '/admin/audit', '/customers', '/leads', '/opportunities', '/projects', '/contracts']));
      expect(commands.creates().map((command) => command.path)).toEqual(expect.arrayContaining(['/customers/new', '/leads/new', '/calls/new']));
    });

    it('the CEO gets the business pages and creates, never roles & permissions or the audit trail', () => {
      signInAs('ceo');
      const commands = TestBed.inject(PaletteCommands);
      const paths = commands.pages().map((page) => page.path);
      expect(paths).toEqual(expect.arrayContaining(['/admin/users', '/admin/settings', '/customers', '/leads', '/approvals', '/reports']));
      for (const path of ['/admin/roles', '/admin/audit', '/admin/automation', '/admin/integrations']) expect(paths).not.toContain(path);
      expect(commands.creates().map((command) => command.path)).toEqual(expect.arrayContaining(['/customers/new', '/leads/new']));
    });

    it('signed out: nothing at all', () => {
      const commands = TestBed.inject(PaletteCommands);
      expect(commands.pages()).toEqual([]);
      expect(commands.creates()).toEqual([]);
    });
  });

  describe('canOpen judges create / edit pages by their own permission (not only the area)', () => {
    it('leads.view without leads.create cannot open /leads/new', () => {
      signInAs('sales_representative');
      const navigation = TestBed.inject(NavigationService);
      expect(navigation.canOpen('/leads/l1')).toBe(true);
      signInAs('read_only_executive');
      expect(navigation.canOpen('/customers/c1')).toBe(true);
      expect(navigation.canOpen('/customers/new')).toBe(false);
      expect(navigation.canOpen('/customers/c1/edit')).toBe(false);
    });

    it('a combined-proposal page needs combined_proposals.view, a technical one technical_proposals.view', () => {
      signInAs('technical_lead');
      const navigation = TestBed.inject(NavigationService);
      expect(navigation.canOpen('/proposals/combined/p1')).toBe(false);
      signInAs('sales_representative');
      expect(navigation.canOpen('/proposals/combined/p1')).toBe(true);
    });

    it('query strings are ignored, unknown paths fail closed', () => {
      signInAs('sales_manager');
      const navigation = TestBed.inject(NavigationService);
      expect(navigation.canOpen('/ownership-requests?box=all')).toBe(true);
      expect(navigation.canOpen('/customers/c1?tab=contacts')).toBe(true);
      expect(navigation.canOpen('/nowhere/at/all')).toBe(false);
      expect(navigation.canOpen('')).toBe(false);
    });
  });

  describe('table columns stay inside the permission boundary', () => {
    const defs = [
      { id: 'number', labelKey: 'x', locked: true },
      { id: 'value', labelKey: 'y', permission: 'financials.view' as const },
      { id: 'status', labelKey: 'z' },
    ];

    it('a column the role may not see is never offered, even if a stored preference says shown', () => {
      const user = signInAs('technical_proposal_engineer');
      localStorage.setItem(`ecotech.columns.${user.id}.contracts`, JSON.stringify({ hidden: [], shown: ['value'] }));
      const columns = TestBed.runInInjectionContext(() => new TableColumns('contracts', defs));
      expect(columns.allowed().map((def) => def.id)).toEqual(['number', 'status']);
      expect(columns.show('value')).toBe(false);
      columns.toggle('value');
      expect(columns.show('value')).toBe(false);
    });

    it('financial viewers may show / hide it; the identifying column cannot be hidden; preferences are per user', () => {
      signInAs('financial_proposal_manager');
      const columns = TestBed.runInInjectionContext(() => new TableColumns('contracts', defs));
      expect(columns.show('value')).toBe(true);
      columns.toggle('value');
      expect(columns.show('value')).toBe(false);
      columns.toggle('number');
      expect(columns.show('number')).toBe(true);
      signInAs('ceo');
      const other = TestBed.runInInjectionContext(() => new TableColumns('contracts', defs));
      expect(other.show('value')).toBe(true);
    });

    it('the contracts list offers the value column only to financial viewers', async () => {
      signInAs('technical_lead');
      const fixture = TestBed.createComponent(ContractsListPage);
      await settle(fixture);
      const columns = (fixture.componentInstance as unknown as { columns: TableColumns }).columns;
      expect(columns.allowed().some((def) => def.id === 'value')).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('contracts.columns.value');
    });
  });

  describe('notification links', () => {
    it('only link to pages the user can open, keeping the query string as params', () => {
      signInAs('installation_crew');
      const navigation = TestBed.inject(NavigationService);
      const canOpen = (path: string) => navigation.canOpen(path);
      expect(notificationTarget('/contracts/1', 'en', canOpen)).toBeNull();
      expect(notificationTarget('/projects/p1', 'en', canOpen)?.commands).toEqual(['/en/projects/p1']);
      signInAs('sales_manager');
      expect(notificationTarget('/ownership-requests?box=all', 'ar', canOpen)).toEqual({ commands: ['/ar/ownership-requests'], queryParams: { box: 'all' }, path: '/ownership-requests' });
      expect(notificationTarget('https://evil.example/x', 'en', canOpen)).toBeNull();
      expect(notificationTarget(undefined, 'en', canOpen)).toBeNull();
    });

    it('name the next step from the category', () => {
      expect(notificationAction({ category: 'approval.requested' })).toBe('review');
      expect(notificationAction({ category: 'task.overdue' })).toBe('openTask');
      expect(notificationAction({ category: 'project.created' })).toBe('open');
    });
  });

  describe('recently viewed', () => {
    it('keeps ids only, per user, and prunes what the server no longer resolves', () => {
      const user = signInAs('sales_representative');
      const recent = TestBed.inject(RecentRecords);
      recent.track({ type: 'customer', id: 'a'.repeat(24) });
      recent.track({ type: 'lead', id: 'b'.repeat(24) });
      const stored = localStorage.getItem(`ecotech.recent.${user.id}`) ?? '';
      expect(JSON.parse(stored).map((entry: { type: string }) => entry.type)).toEqual(['lead', 'customer']);
      expect(stored).not.toMatch(/title|name/);

      recent.retain(recent.refs(), [{ type: 'lead', id: 'b'.repeat(24), title: 'Kept', route: '/leads/x' }]);
      expect(recent.refs()).toEqual([{ type: 'lead', id: 'b'.repeat(24) }]);
      recent.forget({ type: 'lead', id: 'b'.repeat(24) });
      expect(recent.refs()).toEqual([]);

      recent.track({ type: 'customer', id: 'c'.repeat(24) });
      signInAs('telesales');
      expect(TestBed.inject(RecentRecords).refs()).toEqual([]);
    });
  });

  describe('drafts', () => {
    it('are keyed by user and removed at sign-out', async () => {
      const user = signInAs('sales_representative');
      const drafts = TestBed.inject(DraftStore);
      drafts.write('lead.new', { name: 'X' });
      expect(drafts.read<{ name: string }>('lead.new')?.value.name).toBe('X');
      signInAs('telesales');
      expect(drafts.read('lead.new')).toBeNull();
      expect(localStorage.getItem(`${DRAFT_PREFIX}${user.id}.lead.new`)).not.toBeNull();
      await TestBed.inject(AuthService).logout();
      expect(Object.keys(localStorage).some((name) => name.startsWith(DRAFT_PREFIX))).toBe(false);
    });
  });

  describe('keyboard shortcuts', () => {
    it('single-key shortcuts pause while typing; mod combos marked for inputs still work; sequences work', () => {
      const shortcuts = TestBed.inject(KeyboardShortcuts);
      const fired: string[] = [];
      const off = [
        shortcuts.register({ id: 'n', keys: 'n', group: 'page', label: () => 'n', run: () => fired.push('n') }),
        shortcuts.register({ id: 'save', keys: 'mod+s', group: 'page', label: () => 's', allowInInput: true, run: () => fired.push('save') }),
        shortcuts.register({ id: 'gc', keys: 'g c', group: 'navigation', label: () => 'gc', run: () => fired.push('gc') }),
      ];
      const input = document.createElement('input');
      document.body.appendChild(input);
      key({ key: 'n' }, input);
      expect(fired).toEqual([]);
      key({ key: 's', ctrlKey: true, metaKey: true }, input);
      expect(fired).toEqual(['save']);
      key({ key: 'n' });
      key({ key: 'g' });
      key({ key: 'c' });
      expect(fired).toEqual(['save', 'n', 'gc']);
      off.forEach((remove) => remove());
      key({ key: 'n' });
      expect(fired).toEqual(['save', 'n', 'gc']);
      input.remove();
    });

    it('the "n" shortcut exists only while the role sees the New button', async () => {
      signInAs('sales_representative');
      const shortcuts = TestBed.inject(KeyboardShortcuts);
      const allowed = TestBed.createComponent(CustomersListPage);
      await settle(allowed);
      expect(shortcuts.all().some((shortcut) => shortcut.keys === 'n')).toBe(true);
      allowed.destroy();
      expect(shortcuts.all().some((shortcut) => shortcut.keys === 'n')).toBe(false);

      signInAs('read_only_executive');
      const readOnly = TestBed.createComponent(CustomersListPage);
      await settle(readOnly);
      expect(shortcuts.all().some((shortcut) => shortcut.keys === 'n')).toBe(false);
      readOnly.destroy();
    });
  });

  describe('unsaved changes guard', () => {
    it('lets a clean page go, asks when dirty and honours the answer', async () => {
      const confirm = TestBed.inject(ConfirmService);
      const run = (component: object) => TestBed.runInInjectionContext(() => unsavedChangesGuard(component as never, null as never, null as never, null as never));
      expect(run({ hasUnsavedChanges: () => false })).toBe(true);
      expect(run({})).toBe(true);
      const stay = run({ hasUnsavedChanges: () => true }) as Promise<boolean>;
      expect(confirm.pending()).not.toBeNull();
      confirm.answer(false);
      expect(await stay).toBe(false);
      const leave = run({ hasUnsavedChanges: () => true }) as Promise<boolean>;
      confirm.answer(true);
      expect(await leave).toBe(true);
    });
  });

});
