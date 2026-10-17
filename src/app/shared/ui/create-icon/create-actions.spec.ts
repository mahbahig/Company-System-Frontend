import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { of } from 'rxjs';

import { signInAs } from '../../../../testing/as-role';
import type { RoleKey } from '../../../../testing/role-permissions';
import { routes } from '../../../app.routes';
import { AdminApi } from '../../../features/admin/admin-api.service';
import { EmployeesPage } from '../../../features/employees/employees.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  return fixture.nativeElement as HTMLElement;
}

describe('"+ New X": one create pattern everywhere', () => {
  it('the Employees page: "+ New Employee" in the header and in the empty state — only for who may create employees', async () => {
    const render = async (role: RoleKey) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes, withComponentInputBinding()),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: AdminApi, useValue: { users: () => of({ rows: [], total: 0, page: 1, pageSize: 20, pageCount: 1 }), roles: () => of([]), teams: () => of([]), openWork: () => of([]) } },
        ],
      });
      signInAs(role);
      return settle(TestBed.createComponent(EmployeesPage));
    };
    const admin = await render('system_administrator');
    const creates = [...admin.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'admin.users.new');
    expect(creates).toHaveLength(2);
    for (const button of creates) {
      const icon = button.querySelector('app-create-icon');
      expect(icon).not.toBeNull();
      // The icon comes before the label.
      expect(button.firstElementChild?.tagName.toLowerCase()).toBe('app-create-icon');
      expect(button.className).toContain('gap-2');
    }
    const ceo = await render('ceo');
    expect([...ceo.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'admin.users.new')).toBe(false);
  });
});
