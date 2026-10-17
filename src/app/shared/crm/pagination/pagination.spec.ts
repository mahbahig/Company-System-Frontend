import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { LocalPager, PagerState } from './local-pager';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, pageSizeAttribute } from './page-size';
import { PageSizeSelectComponent, PagerSizeComponent } from './page-size-select.component';
import { PaginationComponent } from './pagination.component';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function render(inputs: { page: number; pageCount: number; total: number; pageSize: number; loading?: boolean; mode?: 'url' | 'state' }) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PaginationComponent);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  const pageChange = vi.fn();
  fixture.componentInstance.pageChange.subscribe(pageChange);
  return { fixture, navigate, pageChange };
}

function renderSize(inputs: { pageSize: number; total?: number | null; loading?: boolean; mode?: 'url' | 'state' }) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PageSizeSelectComponent);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  const pageSizeChange = vi.fn();
  fixture.componentInstance.pageSizeChange.subscribe(pageSizeChange);
  return { fixture, navigate, pageSizeChange };
}
const testId = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

describe('Pagination footer', () => {
  it('page sizes: 10 / 20 / 50 / 100, default 20 — anything else in the address falls back', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(pageSizeAttribute('50')).toBe(50);
    expect(pageSizeAttribute('7')).toBe(20);
    expect(pageSizeAttribute(undefined)).toBe(20);
  });

  it('a middle page: "Showing 21–40 of 243", Previous and Next enabled, the current page marked (not by colour alone)', async () => {
    const { fixture } = render({ page: 2, pageCount: 13, total: 243, pageSize: 20 });
    const root = await settle(fixture);
    expect(testId(root, 'pagination-summary').textContent).toContain('crm.pagination.showing');
    expect(testId(root, 'pagination-previous').tagName).toBe('A');
    expect(testId(root, 'pagination-next').tagName).toBe('A');
    const current = root.querySelector('[aria-current="page"].tabular')!;
    expect(current.textContent!.trim()).toBe('2');
    expect(current.className).toContain('border-primary');
    expect(root.querySelector('nav')!.className).toContain('items-center');
  });

  it('the first page has no Previous; the last page has no Next', async () => {
    const first = render({ page: 1, pageCount: 3, total: 50, pageSize: 20 });
    let root = await settle(first.fixture);
    expect(testId(root, 'pagination-previous').getAttribute('aria-disabled')).toBe('true');
    expect(testId(root, 'pagination-next').tagName).toBe('A');
    TestBed.resetTestingModule();
    const last = render({ page: 3, pageCount: 3, total: 50, pageSize: 20 });
    root = await settle(last.fixture);
    expect(testId(root, 'pagination-next').getAttribute('aria-disabled')).toBe('true');
    expect(testId(root, 'pagination-previous').tagName).toBe('A');
  });

  it('while loading, nothing can be clicked twice: Previous / Next / pages are disabled', async () => {
    const { fixture } = render({ page: 2, pageCount: 5, total: 100, pageSize: 20, loading: true });
    const root = await settle(fixture);
    expect(testId(root, 'pagination-previous').getAttribute('aria-disabled')).toBe('true');
    expect(testId(root, 'pagination-next').getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelectorAll('nav a')).toHaveLength(0);
    expect(root.querySelector('nav')!.getAttribute('aria-busy')).toBe('true');
  });

  it('the footer has no "Items per page" any more: that control sits above the table', async () => {
    const { fixture } = render({ page: 2, pageCount: 13, total: 243, pageSize: 20 });
    const root = await settle(fixture);
    expect(root.querySelector('select')).toBeNull();
    expect(root.textContent).not.toContain('crm.pagination.perPage');
  });
});

describe('Items per page (above the table)', () => {
  it('10 / 20 / 50 / 100; changing it goes back to page 1 and keeps the other query params (url mode)', async () => {
    const { fixture, navigate, pageSizeChange } = renderSize({ pageSize: 20, total: 243 });
    const root = await settle(fixture);
    expect(root.textContent).toContain('crm.pagination.perPage');
    const select = testId(root, 'pagination-size') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['10', '20', '50', '100']);
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(pageSizeChange).toHaveBeenCalledWith(50);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { pageSize: 50, page: null }, queryParamsHandling: 'merge' }));
    // Back to the default size: a bare address.
    fixture.componentRef.setInput('pageSize', 50);
    await settle(fixture);
    select.value = '20';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { pageSize: null, page: null } }));
  });

  it('state mode emits the size instead of navigating; disabled while a page loads; hidden for an empty table', async () => {
    const { fixture, navigate, pageSizeChange } = renderSize({ pageSize: 20, total: 55, mode: 'state', loading: true });
    const root = await settle(fixture);
    const select = testId(root, 'pagination-size') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    fixture.componentRef.setInput('loading', false);
    await settle(fixture);
    select.value = '100';
    select.dispatchEvent(new Event('change'));
    expect(pageSizeChange).toHaveBeenCalledWith(100);
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentRef.setInput('total', 0);
    await settle(fixture);
    expect(root.style.display).toBe('none');
  });

  it('a LocalPager: <app-pager-size> sets its size and goes back to page 1', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const pager = new LocalPager(() => Array.from({ length: 45 }, (_, index) => index));
    pager.setPage(3);
    const fixture = TestBed.createComponent(PagerSizeComponent);
    fixture.componentRef.setInput('pager', pager);
    const root = await settle(fixture);
    const select = testId(root, 'pagination-size') as HTMLSelectElement;
    select.value = '10';
    select.dispatchEvent(new Event('change'));
    expect([pager.pageSize(), pager.currentPage(), pager.pageCount()]).toEqual([10, 1, 5]);
  });

  it('a page left empty (its last row deleted) moves to the last page that exists', async () => {
    const { fixture, navigate } = render({ page: 3, pageCount: 2, total: 40, pageSize: 20 });
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 2 }, replaceUrl: true }));
  });

  it('state mode emits the page and the size instead of navigating', async () => {
    const { fixture, navigate, pageChange } = render({ page: 1, pageCount: 3, total: 55, pageSize: 20, mode: 'state' });
    const root = await settle(fixture);
    (testId(root, 'pagination-next') as HTMLButtonElement).click();
    expect(pageChange).toHaveBeenCalledWith(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no rows: no footer at all (the table shows its empty state)', async () => {
    const { fixture } = render({ page: 1, pageCount: 1, total: 0, pageSize: 20 });
    expect((await settle(fixture)).querySelector('nav')).toBeNull();
  });
});

describe('LocalPager / PagerState', () => {
  it('pages an in-memory list; a new size starts from page 1; reset() too', () => {
    TestBed.runInInjectionContext(() => {
      const items = Array.from({ length: 45 }, (_, index) => index + 1);
      const pager = new LocalPager(() => items);
      expect([pager.total(), pager.pageCount(), pager.rows().length]).toEqual([45, 3, 20]);
      pager.setPage(3);
      expect(pager.rows()).toEqual([41, 42, 43, 44, 45]);
      pager.setPageSize(10);
      expect([pager.currentPage(), pager.pageCount(), pager.rows()[0]]).toEqual([1, 5, 1]);
      pager.setPage(4);
      pager.reset();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it('a page left empty by a deletion shows the last page that has rows', () => {
    const list = signal(Array.from({ length: 41 }, (_, index) => index));
    const pager = new LocalPager(() => list());
    pager.setPage(3);
    expect(pager.rows()).toEqual([40]);
    list.update((items) => items.slice(0, 40));
    expect(pager.currentPage()).toBe(2);
    expect(pager.rows()).toHaveLength(20);
  });

  it('PagerState: a new size or a reset goes back to page 1', () => {
    const state = new PagerState();
    state.setPage(5);
    state.setPageSize(50);
    expect([state.page(), state.pageSize()]).toEqual([1, 50]);
    state.setPage(3);
    state.reset();
    expect(state.page()).toBe(1);
  });
});
