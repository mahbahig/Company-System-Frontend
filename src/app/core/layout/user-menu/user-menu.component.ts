import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Bell, ChevronDown, KeyRound, LogOut, ShieldCheck } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthService } from '../../auth/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { END_ALIGNED_BELOW } from '../menu-positions';

/** Avatar initial, name and job title; the menu shows the e-mail (LTR) and Sign out. */
@Component({
  selector: 'app-user-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, IconComponent, TranslatePipe],
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="menu"
      [cdkMenuPosition]="positions"
      [attr.aria-label]="'common.labels.account' | t"
      class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      >
        {{ initial() }}
      </span>
      <span class="hidden text-start sm:block">
        <span class="block max-w-40 truncate font-medium leading-tight">{{ name() }}</span>
        @if (jobTitle()) {
          <span class="block max-w-40 truncate text-xs leading-tight text-muted-foreground">{{ jobTitle() }}</span>
        }
      </span>
      <app-icon [icon]="chevron" svgClass="size-4 text-muted-foreground" />
    </button>

    <ng-template #menu>
      <div cdkMenu class="z-50 min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
        <div class="px-3 py-2">
          <p class="truncate text-sm font-medium">{{ name() }}</p>
          <p dir="ltr" class="truncate text-start text-xs text-muted-foreground">{{ email() }}</p>
        </div>
        <div role="separator" class="my-1 h-px bg-border"></div>
        @for (link of accountLinks; track link.path) {
          <button
            type="button"
            cdkMenuItem
            (cdkMenuItemTriggered)="go(link.path)"
            class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-secondary focus:bg-secondary"
          >
            <app-icon [icon]="link.icon" />
            {{ link.label | t }}
          </button>
        }
        <div role="separator" class="my-1 h-px bg-border"></div>
        <button
          type="button"
          cdkMenuItem
          (cdkMenuItemTriggered)="signOut()"
          class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
        >
          <app-icon [icon]="logOut" />
          {{ 'common.actions.signOut' | t }}
        </button>
      </div>
    </ng-template>
  `,
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly chevron = ChevronDown;
  protected readonly logOut = LogOut;
  protected readonly positions = END_ALIGNED_BELOW;
  protected readonly accountLinks = [
    { path: 'password', label: 'account.password.title', icon: KeyRound },
    { path: 'security', label: 'account.mfa.title', icon: ShieldCheck },
    { path: 'notifications', label: 'account.notifications.title', icon: Bell },
  ];

  protected go(path: string): void {
    void this.router.navigate(['/', this.i18n.locale(), 'account', path]);
  }

  protected readonly name = computed(() => {
    const user = this.auth.user();
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '';
  });
  protected readonly jobTitle = computed(() => {
    const user = this.auth.user();
    return user ? this.i18n.pick(user.jobTitleAr, user.jobTitleEn) : '';
  });
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly initial = computed(() => Array.from(this.name().trim())[0]?.toUpperCase() ?? '?');

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/', this.i18n.locale(), 'login'], { queryParams: { reason: 'signed_out' } });
  }
}
