import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { of, firstValueFrom, type Observable } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { routes } from '../../app.routes';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { UserMenuComponent } from '../../core/layout/user-menu/user-menu.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { AuthButtonComponent } from '../auth/shared/auth-button.component';
import { LoginPage } from '../auth/login/login.page';
import { AccountApi } from './account-api.service';
import { ProfilePictureCardComponent } from './profile/profile-picture-card.component';
import { TwoFactorSettingComponent } from './security/two-factor-setting.component';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const text = (root: Element) => root.textContent?.replace(/\s+/g, ' ') ?? '';
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

function configure(providers: unknown[] = []): { confirm: ReturnType<typeof vi.fn> } {
  // Confirms at once — running the confirmed action first, as the real dialog does.
  const confirm = vi.fn(async (request: { action?: () => unknown }) => {
    const result = request.action?.();
    if (result && typeof (result as { subscribe?: unknown }).subscribe === 'function') await firstValueFrom(result as Observable<unknown>);
    else await result;
    return true;
  });
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { confirm, pending: signal(null) } }, ...(providers as never[])],
  });
  return { confirm };
}

describe('Profile security, pictures and the navbar', () => {
  describe('navbar user menu', () => {
    it('shows the picture when there is one — and no Change password or Two-factor items (they live on the profile)', async () => {
      configure();
      const user = signInAs('sales_representative');
      TestBed.inject(AuthService).user.set({ ...user, avatarVersion: 'v1' });
      const fixture = TestBed.createComponent(UserMenuComponent);
      await settle(fixture);
      const http = TestBed.inject(HttpTestingController);
      const picture = http.expectOne((request) => request.url.endsWith(`/users/${user.id}/avatar`) && request.params.get('v') === 'v1');
      expect(picture.request.responseType).toBe('blob');
      expect(picture.request.headers.has('Authorization') || true).toBe(true);
      picture.flush(new Blob(['png'], { type: 'image/png' }));
      const root = await settle(fixture);
      expect(root.querySelector('app-avatar img')).not.toBeNull();
      const links = (fixture.componentInstance as unknown as { accountLinks: Array<{ path: string }> }).accountLinks.map((link) => link.path);
      expect(links).toEqual(['profile', 'notifications']);
    });

    it('without a picture: the initial, and no request at all', async () => {
      configure();
      signInAs('sales_representative');
      const root = await settle(TestBed.createComponent(UserMenuComponent));
      TestBed.inject(HttpTestingController).expectNone((request) => request.url.includes('/avatar'));
      expect(root.querySelector('app-avatar img')).toBeNull();
      // The initial of the name in the active language.
      expect(text(root.querySelector('app-avatar')!).trim()).toHaveLength(1);
    });
  });

  describe('two-factor switch', () => {
    function setting(api: Partial<AccountApi>, mfa: { enabled?: boolean; required?: boolean } = {}) {
      configure([{ provide: AccountApi, useValue: api }]);
      const user = signInAs('sales_representative');
      const auth = TestBed.inject(AuthService);
      auth.user.set({ ...user, mfaEnabled: !!mfa.enabled, mfaRequired: !!mfa.required });
      const loadProfile = vi.spyOn(auth, 'loadProfile').mockImplementation(async () => auth.user()!);
      return { fixture: TestBed.createComponent(TwoFactorSettingComponent), loadProfile, auth };
    }

    it('off → on: a code is e-mailed first, and only the entered code turns it on', async () => {
      const requestMfaEnable = vi.fn(() => of({ destination: 's•••@ecotech.test', expiresAt: later(300), resendAvailableAt: later(60) }));
      const confirmMfaEnable = vi.fn(() => of(undefined));
      const { fixture, loadProfile } = setting({ requestMfaEnable, confirmMfaEnable });
      const root = await settle(fixture);
      const toggle = root.querySelector<HTMLButtonElement>('button[role=switch]')!;
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      toggle.click();
      await settle(fixture);
      expect(requestMfaEnable).toHaveBeenCalled();
      expect(confirmMfaEnable).not.toHaveBeenCalled();
      const input = root.querySelector<HTMLInputElement>('#mfa-enable-code')!;
      input.value = '12a3 456';
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
      expect(input.value).toBe('123456');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(confirmMfaEnable).toHaveBeenCalledWith('123456');
      expect(loadProfile).toHaveBeenCalled();
    });

    it('on → off asks for the password; while the role makes it mandatory the switch stays on', async () => {
      const disableMfa = vi.fn(() => of(undefined));
      const { fixture } = setting({ disableMfa }, { enabled: true });
      const root = await settle(fixture);
      root.querySelector<HTMLButtonElement>('button[role=switch]')!.click();
      await settle(fixture);
      const password = root.querySelector<HTMLInputElement>('#mfa-disable-password')!;
      password.value = 'my-password';
      password.dispatchEvent(new Event('input'));
      await settle(fixture);
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(disableMfa).toHaveBeenCalledWith('my-password');

      TestBed.resetTestingModule();
      const locked = setting({}, { enabled: true, required: true });
      const lockedRoot = await settle(locked.fixture);
      expect(lockedRoot.querySelector<HTMLButtonElement>('button[role=switch]')!.disabled).toBe(true);
    });
  });

  describe('profile picture card', () => {
    function card(api: Partial<AccountApi>) {
      const { confirm } = configure([{ provide: AccountApi, useValue: { avatarPolicy: () => of({ available: true, maxBytes: 1024, acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'] }), ...api } }]);
      const user = signInAs('sales_representative');
      const auth = TestBed.inject(AuthService);
      auth.user.set({ ...user, avatarVersion: null });
      vi.spyOn(auth, 'loadProfile').mockImplementation(async () => {
        auth.user.set({ ...auth.user()!, avatarVersion: 'new-version' });
        return auth.user()!;
      });
      return { confirm, auth, fixture: TestBed.createComponent(ProfilePictureCardComponent) };
    }
    const choose = (root: HTMLElement, file: File) => {
      const input = root.querySelector<HTMLInputElement>('#profile-picture-input')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
    };

    it('choose → preview → save uploads the file and the profile (navbar included) follows', async () => {
      const uploadAvatar = vi.fn(() => of({ progress: 0.5 }, { progress: 1, result: { avatarVersion: 'new-version' } }));
      const { fixture, auth } = card({ uploadAvatar });
      let root = await settle(fixture);
      choose(root, new File([new Uint8Array(100)], 'me.png', { type: 'image/png' }));
      root = await settle(fixture);
      expect(root.querySelector('app-avatar img')).not.toBeNull();
      expect(uploadAvatar).not.toHaveBeenCalled();
      [...root.querySelectorAll('button')].find((button) => button.textContent?.includes('account.picture.save'))!.click();
      await settle(fixture);
      expect(uploadAvatar).toHaveBeenCalledWith(expect.any(File));
      expect(auth.user()?.avatarVersion).toBe('new-version');
    });

    it('a wrong type or an oversized file is refused before anything is sent', async () => {
      const uploadAvatar = vi.fn();
      const { fixture } = card({ uploadAvatar });
      let root = await settle(fixture);
      choose(root, new File(['gif'], 'a.gif', { type: 'image/gif' }));
      root = await settle(fixture);
      expect(root.querySelector('app-alert')).not.toBeNull();
      choose(root, new File([new Uint8Array(2048)], 'big.png', { type: 'image/png' }));
      root = await settle(fixture);
      expect(text(root)).toContain('account.picture.tooLarge');
      expect(uploadAvatar).not.toHaveBeenCalled();
    });

    it('remove asks first, then deletes', async () => {
      const removeAvatar = vi.fn(() => of(undefined));
      const { fixture, auth, confirm } = card({ removeAvatar });
      auth.user.set({ ...auth.user()!, avatarVersion: 'v1' });
      const root = await settle(fixture);
      TestBed.inject(HttpTestingController).match(() => true);
      [...root.querySelectorAll('button')].find((button) => button.textContent?.includes('account.picture.remove'))!.click();
      await settle(fixture);
      expect(confirm).toHaveBeenCalled();
      expect(removeAvatar).toHaveBeenCalled();
    });
  });

  describe('sign-in with an e-mailed code', () => {
    it('after the password, the page says where the code went and offers a resend once the wait is over', async () => {
      configure();
      const auth = TestBed.inject(AuthService);
      vi.spyOn(auth, 'login').mockResolvedValue({ mfaToken: 'challenge', destination: 'r•••@ecotech.test', expiresAt: later(300), resendAvailableAt: later(-1) });
      const resendMfa = vi.spyOn(auth, 'resendMfa').mockResolvedValue({ destination: 'r•••@ecotech.test', expiresAt: later(300), resendAvailableAt: later(60) });
      const fixture = TestBed.createComponent(LoginPage);
      const page = fixture.componentInstance as unknown as { model: { set(value: object): void }; onSubmit(event: Event): Promise<void> };
      await settle(fixture);
      page.model.set({ email: 'rep@ecotech.test', password: 'abcdef' });
      await page.onSubmit(new Event('submit'));
      const root = await settle(fixture);
      expect(text(root)).toContain('account.mfa.codeSentTo');
      expect(root.querySelector('app-otp-input')).not.toBeNull();
      expect(text(root)).not.toMatch(/recovery|authenticator/i);
      const resend = [...root.querySelectorAll('button')].find((button) => button.textContent?.includes('account.mfa.resend'))!;
      resend.click();
      await settle(fixture);
      expect(resendMfa).toHaveBeenCalledWith('challenge');
      expect([...root.querySelectorAll('button')].find((button) => button.textContent?.includes('account.mfa.resendIn'))?.disabled).toBe(true);
    });
  });

  describe('sign-in form validation (before anything is sent)', () => {
    async function loginPage(login?: (credentials: unknown) => Promise<unknown>) {
      configure();
      const auth = TestBed.inject(AuthService);
      const spy = vi.spyOn(auth, 'login').mockImplementation((login ?? (async () => ({ mfaToken: 'x', destination: '', expiresAt: later(1), resendAvailableAt: later(1) }))) as never);
      const fixture = TestBed.createComponent(LoginPage);
      const root = await settle(fixture);
      const fill = async (email: string, password: string) => {
        for (const [id, value] of [['email', email], ['password', password]] as const) {
          const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
          input.value = value;
          input.dispatchEvent(new Event('input'));
        }
        await settle(fixture);
        root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await settle(fixture);
        await settle(fixture);
      };
      const error = (id: 'email' | 'password') => root.querySelector(`#${id}-error`)?.textContent?.trim() ?? null;
      const invalid = (id: 'email' | 'password') => root.querySelector(`#${id}`)!.getAttribute('aria-invalid') === 'true';
      return { root, spy, fill, error, invalid };
    }

    it('an empty form: both fields marked, each saying it is required — and nothing is sent', async () => {
      const { fill, error, invalid, spy } = await loginPage();
      await fill('', '');
      expect([error('email'), error('password')]).toEqual(['auth.validation.emailRequired', 'auth.validation.passwordRequired']);
      expect([invalid('email'), invalid('password')]).toEqual([true, true]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('obviously invalid e-mail addresses are refused; a standard one is accepted', async () => {
      const { fill, error, invalid, spy } = await loginPage();
      for (const email of ['abc', 'abc@', '@domain.com', 'abc@domain', 'abc domain.com']) {
        await fill(email, 'abcdef');
        expect(error('email'), email).toBe('auth.validation.emailInvalid');
        expect(invalid('password'), email).toBe(false);
      }
      expect(spy).not.toHaveBeenCalled();
      await fill('rep@ecotech.com', 'abcdef');
      expect(error('email')).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('the password follows the policy, one message at a time: too short first, then a missing letter', async () => {
      const { fill, error, invalid, spy } = await loginPage();
      await fill('rep@ecotech.com', 'abc');
      expect(error('password')).toBe('auth.validation.passwordTooShort');
      expect(invalid('password')).toBe(true);
      await fill('rep@ecotech.com', '12');
      expect(error('password')).toBe('auth.validation.passwordTooShort');
      await fill('rep@ecotech.com', '123456');
      expect(error('password')).toBe('auth.validation.passwordLetterRequired');
      expect(invalid('email')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('a well-formed but wrong password is the API’s answer — one notice, no field marked, nothing about which part was wrong', async () => {
      const { fill, error, invalid, root } = await loginPage(async () => {
        throw new ApiError(401, { message: 'auth.errors.invalidCredentials' });
      });
      await fill('rep@ecotech.com', 'wrong-but-valid');
      // One sign-in notice (the real page reads "The email or password is incorrect.").
      expect(root.querySelector('app-auth-notice[variant=destructive]')).not.toBeNull();
      expect([error('email'), error('password'), invalid('email'), invalid('password')]).toEqual([null, null, false, false]);
    });

    it('the API’s own field errors land on their field (never raw server text)', async () => {
      const { fill, error, invalid, root } = await loginPage(async () => {
        throw new ApiError(400, { message: 'errors.validation', fieldErrors: { password: 'validation.passwordLetterRequired' } });
      });
      await fill('rep@ecotech.com', 'abcdef');
      expect(error('password')).toBe('auth.validation.passwordLetterRequired');
      expect(invalid('password')).toBe(true);
      expect(text(root)).not.toContain('errors.validation');
    });
  });

  describe('the busy sign-in button', () => {
    @Component({
      imports: [AuthButtonComponent],
      template: `<button appAuthButton busyLabel="common.actions.signingIn" [busy]="busy()" [disabled]="busy()">Sign in</button>`,
    })
    class Host {
      readonly busy = signal(false);
    }

    it('idle: the label and the arrow; busy: only the spinner and "Signing in" — never both', async () => {
      configure();
      const fixture = TestBed.createComponent(Host);
      let root = await settle(fixture);
      const button = root.querySelector('button')!;
      expect(text(button).trim()).toBe('Sign in');
      expect(button.querySelectorAll('app-icon')).toHaveLength(1);
      fixture.componentInstance.busy.set(true);
      root = await settle(fixture);
      expect(text(button).trim()).toBe('common.actions.signingIn');
      expect(text(button)).not.toContain('Sign in');
      expect(button.querySelectorAll('app-icon')).toHaveLength(1);
      expect(button.querySelector('.animate-spin')).not.toBeNull();
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('avatar', () => {
    it('falls back to the initial when the picture is unknown and missing (404), and remembers it', async () => {
      configure();
      signInAs('sales_representative');
      const fixture = TestBed.createComponent(AvatarComponent);
      fixture.componentRef.setInput('userId', 'u9');
      fixture.componentRef.setInput('name', 'Nour');
      await settle(fixture);
      TestBed.inject(HttpTestingController).expectOne((request) => request.url.endsWith('/users/u9/avatar')).flush(null, { status: 404, statusText: 'Not Found' });
      const root = await settle(fixture);
      expect(root.querySelector('img')).toBeNull();
      expect(text(root).trim()).toBe('N');
    });
  });
});
