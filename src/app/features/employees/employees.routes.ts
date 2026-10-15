import type { Routes } from '@angular/router';

/**
 * `/:locale/employees/...` — the Employees page and each employee's
 * performance. Who appears, and whose page opens, is decided by the API
 * (a Sales Manager: only the Sales Representatives who report to them).
 */
export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    title: 'admin.users.title',
    loadComponent: () => import('./employees.page').then((m) => m.EmployeesPage),
  },
  {
    path: ':id',
    title: 'admin.users.title',
    loadComponent: () => import('./employee-detail.page').then((m) => m.EmployeeDetailPage),
  },
];
