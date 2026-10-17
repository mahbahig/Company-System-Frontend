import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type ActivatedRouteSnapshot, type Route, type Routes } from '@angular/router';
import { Location } from '@angular/common';

import { signInAs } from '../../../testing/as-role';
import { routes } from '../../app.routes';
import { NotFoundPage } from '../../features/errors/not-found.page';
import { PaletteCommands } from '../command-palette/palette-commands.service';
import { LocaleSwitcherComponent } from '../layout/locale-switcher/locale-switcher.component';
import { I18nService } from './i18n.service';

const KEY = 'ecotech.locale';
const tick = () => new Promise((resolve) => setTimeout(resolve));

@Component({ template: '' })
class Blank {}

/** Answers the catalogue request a language change makes (`i18n/<locale>.json`). */
async function answerCatalogue(): Promise<string> {
  await tick();
  const request = TestBed.inject(HttpTestingController).expectOne((r) => r.url.startsWith('i18n/'));
  request.flush({ common: { labels: { language: 'Language' } } });
  await tick();
  return request.request.url;
}

const html = () => document.documentElement;

describe('Language: kept in localStorage, never in the URL', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });

  async function start(): Promise<{ i18n: I18nService; url: string }> {
    const i18n = TestBed.inject(I18nService);
    const done = i18n.init();
    const url = await answerCatalogue();
    await done;
    return { i18n, url };
  }

  it('start-up with "en" stored: English, left-to-right', async () => {
    localStorage.setItem(KEY, 'en');
    const { i18n, url } = await start();
    expect(url).toBe('i18n/en.json');
    expect(i18n.locale()).toBe('en');
    expect([html().lang, html().dir]).toEqual(['en', 'ltr']);
    expect(localStorage.getItem(KEY)).toBe('en');
  });

  it('start-up with "ar" stored: Arabic, right-to-left', async () => {
    localStorage.setItem(KEY, 'ar');
    const { i18n } = await start();
    expect(i18n.locale()).toBe('ar');
    expect([html().lang, html().dir]).toEqual(['ar', 'rtl']);
  });

  for (const stored of [null, 'fr', 'EN', '']) {
    it(`start-up with ${stored === null ? 'nothing' : `"${stored}"`} stored: the default language, and it is stored`, async () => {
      if (stored !== null) localStorage.setItem(KEY, stored);
      const { i18n } = await start();
      expect(i18n.locale()).toBe('ar');
      expect(localStorage.getItem(KEY)).toBe('ar');
    });
  }

  it('one key, in localStorage only — nothing in sessionStorage or cookies', async () => {
    const { i18n } = await start();
    const switched = i18n.use('en');
    await answerCatalogue();
    await switched;
    const keys = Object.keys(localStorage).filter((key) => /lang|locale/i.test(key));
    expect(keys).toEqual([KEY]);
    expect(localStorage.getItem(KEY)).toBe('en');
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toMatch(/lang|locale/i);
  });
});

describe('Switching the language keeps the page and its URL', () => {
  beforeEach(() => {
    localStorage.setItem(KEY, 'en');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'employees', component: Blank }])],
    });
  });

  it('English → Arabic → English at /employees: text, lang and dir change; the URL, the history and the route stay', async () => {
    const i18n = TestBed.inject(I18nService);
    const started = i18n.init();
    await answerCatalogue();
    await started;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/employees');
    const navigate = vi.spyOn(router, 'navigate');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
    const pushState = vi.spyOn(history, 'pushState');
    const replaceState = vi.spyOn(history, 'replaceState');
    const fixture = TestBed.createComponent(LocaleSwitcherComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click();
    await answerCatalogue();
    expect(i18n.locale()).toBe('ar');
    expect([html().lang, html().dir]).toEqual(['ar', 'rtl']);
    expect(localStorage.getItem(KEY)).toBe('ar');
    expect(router.url).toBe('/employees');
    expect(TestBed.inject(Location).path()).toBe('/employees');

    button.click();
    await tick();
    expect(i18n.locale()).toBe('en');
    expect([html().lang, html().dir]).toEqual(['en', 'ltr']);
    expect(localStorage.getItem(KEY)).toBe('en');
    expect(router.url).toBe('/employees');

    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('the command palette’s language action switches in place too', async () => {
    signInAs('sales_representative');
    const i18n = TestBed.inject(I18nService);
    const started = i18n.init();
    await answerCatalogue();
    await started;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/employees');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
    const action = TestBed.inject(PaletteCommands)
      .actions()
      .find((command) => command.id === 'action:locale')!;
    action.run!();
    await answerCatalogue();
    expect(i18n.locale()).toBe('ar');
    expect(router.url).toBe('/employees');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});

describe('Routes carry no language', () => {
  const all = (table: Routes): Route[] => table.flatMap((route) => [route, ...all(route.children ?? [])]);

  it('no route, at any depth, has a language segment or parameter', () => {
    const offending = all(routes)
      .map((route) => route.path ?? '')
      .filter((path) => /(^|\/)(:locale|:lang|en|ar)(\/|$)/.test(path));
    expect(offending).toEqual([]);
  });

  describe('real navigations through the app’s routes and guards', () => {
    beforeEach(() => {
      localStorage.setItem(KEY, 'ar');
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)] });
    });

    /** The page a URL ends on: the router's URL and the deepest route's component. */
    async function open(url: string): Promise<{ url: string; component: unknown }> {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);
      let snapshot: ActivatedRouteSnapshot = router.routerState.snapshot.root;
      while (snapshot.firstChild) snapshot = snapshot.firstChild;
      return { url: router.url, component: snapshot.component };
    }

    it('deep links open as typed — /dashboard, /employees, /tasks, /profile pages, /admin/settings — in the stored language', async () => {
      signInAs('system_administrator');
      const i18n = TestBed.inject(I18nService);
      const started = i18n.init();
      await answerCatalogue();
      await started;
      for (const url of ['/dashboard', '/employees', '/tasks', '/account/profile', '/admin/settings', '/admin/security']) {
        const page = await open(url);
        expect(page.url, url).toBe(url);
        expect(page.component, url).not.toBe(NotFoundPage);
      }
      expect(i18n.locale()).toBe('ar');
      expect(html().dir).toBe('rtl');
    });

    it('/ opens the dashboard; a page the role may not open goes to /forbidden — never a language prefix', async () => {
      signInAs('sales_representative');
      expect((await open('/')).url).toBe('/dashboard');
      expect((await open('/admin/settings')).url).toBe('/forbidden');
    });

    it('signed out: a deep link goes to /login?returnTo=… (no prefix)', async () => {
      const page = open('/employees');
      // The shell's guard tries the session cookie, then the sign-in page's guard asks once more: no session either time.
      for (let attempt = 0; attempt < 2; attempt++) {
        await tick();
        TestBed.inject(HttpTestingController)
          .expectOne((r) => r.url.endsWith('/auth/refresh'))
          .flush({ message: 'auth.errors.invalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });
      }
      expect((await page).url).toBe('/login?returnTo=%2Femployees');
    });

    it('an old /en/… or /ar/… address is not a route any more (the not-found page)', async () => {
      signInAs('system_administrator');
      for (const url of ['/en/employees', '/ar/dashboard']) expect((await open(url)).component, url).toBe(NotFoundPage);
    });
  });
});
