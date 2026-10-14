import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { signInAs } from '../../../../testing/as-role';
import { routes } from '../../../app.routes';
import { AnalyticsApi } from '../analytics-api.service';
import type { ExceptionSummary } from '../models/exceptions.interface';
import { ExceptionsPage } from './exceptions.page';

const ITEMS: ExceptionSummary[] = [
  { code: 'leads_unassigned', severity: 'high', count: 3, route: '/leads?unassigned=1' },
  { code: 'opportunities_next_action_overdue', severity: 'medium', count: 0, route: '/opportunities?nextActionOverdue=1' },
  // A destination this role cannot open (System Settings for a sales representative).
  { code: 'settings_review', severity: 'low', count: 2, route: '/admin/settings' },
];

describe('Exceptions Center cards', () => {
  let exceptions: ReturnType<typeof vi.fn>;
  let detail: ReturnType<typeof vi.fn>;

  async function render(): Promise<HTMLElement> {
    exceptions = vi.fn(() => of({ scope: 'own', items: ITEMS, total: 5 }));
    detail = vi.fn();
    TestBed.configureTestingModule({
      imports: [ExceptionsPage],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting(), { provide: AnalyticsApi, useValue: { exceptions, exception: detail, dataQuality: vi.fn() } }],
    });
    signInAs('sales_representative');
    const fixture = TestBed.createComponent(ExceptionsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('each card links to the existing page with its filter and the exception code', async () => {
    const root = await render();
    // Locale prefix stripped: the links are `/<locale>/…` in either language.
    const links = [...root.querySelectorAll<HTMLAnchorElement>('ul a[href]')].map((a) => decodeURIComponent(a.getAttribute('href') ?? '').replace(/^\/(ar|en)/, ''));
    expect(links).toContain('/leads?unassigned=1&exception=leads_unassigned');
    expect(links).toContain('/opportunities?nextActionOverdue=1&exception=opportunities_next_action_overdue');
  });

  it('never shows the underlying records inside the Exceptions Center', async () => {
    const root = await render();
    expect(root.querySelector('table')).toBeNull();
    expect(detail).not.toHaveBeenCalled();
  });

  it('a card whose page the role cannot open is shown, but not as a link', async () => {
    const root = await render();
    const hrefs = [...root.querySelectorAll('ul a[href]')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.includes('/admin/settings'))).toBe(false);
    expect(root.querySelectorAll('ul > li').length).toBe(3);
  });

  it('hover is a smooth scale and elevation — no colour change', async () => {
    const root = await render();
    const card = root.querySelector('ul a[href]') as HTMLElement;
    expect(card.className).toContain('hover:scale-[1.03]');
    expect(card.className).toContain('transition-[transform,box-shadow]');
    expect(card.className).not.toMatch(/hover:(bg|border|text)-/);
  });
});
