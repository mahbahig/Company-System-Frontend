import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet, type Routes, withComponentInputBinding } from '@angular/router';
import { of } from 'rxjs';

import { userWithRoles } from '../../../../testing/as-role';
import type { RoleKey } from '../../../../testing/role-permissions';
import { routes } from '../../../app.routes';
import { AuthService } from '../../../core/auth/auth.service';
import { permissionGuard } from '../../../core/auth/permission.guard';
import type { TaskListQuery } from '../models/task-list-query.interface';
import { TasksApi } from '../tasks-api.service';
import { TASKS_ROUTES } from '../tasks.routes';
import { TasksListPage } from './tasks-list.page';

const EMPTY_PAGE = { rows: [], total: 0, page: 1, pageSize: 20, pageCount: 0 };

/** Lets effects and synchronous resources run (reference data and saved views stay pending on purpose). */
const tick = () => new Promise((resolve) => setTimeout(resolve));

/** A root outlet for real navigations: the tasks routes as the app mounts them, without the shell around them. */
@Component({ template: '<router-outlet />', imports: [RouterOutlet] })
class RootOutlet {}
const TASKS_AS_MOUNTED: Routes = [
  { path: ':locale', canActivateChild: [permissionGuard], children: [{ path: 'tasks', data: { permission: 'tasks.view' }, children: TASKS_ROUTES }] },
];

describe('Tasks page: My Tasks by default, Team Tasks only for team managers', () => {
  let list: ReturnType<typeof vi.fn>;

  /** Signs in a role; `managedTeamIds` is what the API's team records report (GET /auth/me). */
  function configure(role: RoleKey, managedTeamIds: string[] = [], routeTable: Routes = routes): void {
    list = vi.fn((_query: TaskListQuery) => of(EMPTY_PAGE));
    TestBed.configureTestingModule({
      providers: [provideRouter(routeTable, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), { provide: TasksApi, useValue: { list } }],
    });
    TestBed.inject(AuthService).user.set({ ...userWithRoles(role), managedTeamIds });
  }

  async function render(view?: string) {
    const fixture = TestBed.createComponent(TasksListPage);
    if (view !== undefined) fixture.componentRef.setInput('view', view);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tabs = [...root.querySelectorAll<HTMLAnchorElement>('nav a')];
    /** Each tab by the view its link opens (`mine` is the plain /tasks). */
    const viewOf = (a: HTMLAnchorElement) => new URLSearchParams((a.getAttribute('href') ?? '').split('?')[1] ?? '').get('view') ?? 'mine';
    return {
      tabs: tabs.map(viewOf),
      active: tabs.filter((a) => a.getAttribute('aria-current') === 'page').map(viewOf),
      requested: () => list.mock.calls.map(([query]) => (query as TaskListQuery).view),
    };
  }

  describe('who sees the Team Tasks tab — from the team records, for any team', () => {
    it('a Sales Representative (team member): My Tasks, no Team Tasks', async () => {
      configure('sales_representative');
      const page = await render();
      expect(page.tabs).toEqual(['mine', 'overdue', 'today', 'upcoming', 'all']);
    });

    it('a Sales Manager who manages a team: My Tasks and Team Tasks', async () => {
      configure('sales_manager', ['sales-team']);
      expect((await render()).tabs).toEqual(['mine', 'team', 'overdue', 'today', 'upcoming', 'all']);
    });

    it('another team: the Technical Lead managing the Technical team sees it, the engineer in it does not', async () => {
      configure('technical_lead', ['technical-team']);
      expect((await render()).tabs).toContain('team');
      TestBed.resetTestingModule();
      configure('technical_proposal_engineer');
      expect((await render()).tabs).not.toContain('team');
    });

    it('the role name alone never shows it: a Sales Manager who manages no team does not see it', async () => {
      configure('sales_manager', []);
      expect((await render()).tabs).not.toContain('team');
    });

    it('people in no team do not see it, whatever their scope (the CEO has All)', async () => {
      configure('ceo');
      const page = await render();
      expect(page.tabs).not.toContain('team');
      expect(page.tabs).toContain('all');
    });

    it('managing a team does not widen a task scope that covers only one’s own tasks', async () => {
      configure('technical_proposal_engineer', ['field-team']);
      expect((await render()).tabs).not.toContain('team');
    });
  });

  describe('which tab opens', () => {
    it('no view in the URL: My Tasks is selected and loaded, for a member and for a manager alike', async () => {
      configure('sales_representative');
      let page = await render();
      expect(page.active).toEqual(['mine']);
      expect(page.requested()).toEqual(['mine']);
      TestBed.resetTestingModule();
      configure('sales_manager', ['sales-team']);
      page = await render();
      expect(page.active).toEqual(['mine']);
      expect(page.requested()).toEqual(['mine']);
    });

    it('a manager choosing Team Tasks gets their team’s list', async () => {
      configure('sales_manager', ['sales-team']);
      const page = await render('team');
      expect(page.active).toEqual(['team']);
      expect(page.requested()).toEqual(['team']);
    });

    it('a member asking for Team Tasks gets My Tasks instead — the team list is never requested', async () => {
      configure('sales_representative');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const page = await render('team');
      expect(page.active).toEqual(['mine']);
      expect(page.requested()).toEqual(['mine']);
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { view: null }, replaceUrl: true }));
    });

    it('an unknown view falls back to My Tasks as well', async () => {
      configure('sales_manager', ['sales-team']);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const page = await render('everything');
      expect(page.active).toEqual(['mine']);
      expect(page.requested()).toEqual(['mine']);
    });
  });

  describe('through the router (typed URL, refresh, a link from elsewhere)', () => {
    async function open(url: string) {
      const fixture = TestBed.createComponent(RootOutlet);
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);
      // Render the page, let it settle (a fallback re-navigates), render again.
      for (let round = 0; round < 3; round++) {
        fixture.detectChanges();
        await tick();
      }
      return { url: router.url, page: fixture.debugElement.query(By.directive(TasksListPage)) };
    }

    it('/tasks opens My Tasks', async () => {
      configure('sales_manager', ['sales-team'], TASKS_AS_MOUNTED);
      const { url, page } = await open('/en/tasks');
      expect(page).not.toBeNull();
      expect(url).toBe('/en/tasks');
      expect(list.mock.calls.map(([query]) => (query as TaskListQuery).view)).toEqual(['mine']);
    });

    it('a member typing /tasks?view=team lands on My Tasks and the URL drops the view', async () => {
      configure('sales_representative', [], TASKS_AS_MOUNTED);
      const { url } = await open('/en/tasks?view=team');
      expect(url).toBe('/en/tasks');
      expect(list.mock.calls.every(([query]) => (query as TaskListQuery).view === 'mine')).toBe(true);
    });

    it('a manager opening /tasks?view=team (a refresh of the tab) stays on Team Tasks', async () => {
      configure('technical_lead', ['technical-team'], TASKS_AS_MOUNTED);
      const { url } = await open('/en/tasks?view=team');
      expect(url).toBe('/en/tasks?view=team');
      expect(list.mock.calls.map(([query]) => (query as TaskListQuery).view)).toEqual(['team']);
    });
  });
});
