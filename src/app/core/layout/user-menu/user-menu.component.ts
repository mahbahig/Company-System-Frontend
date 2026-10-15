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
  templateUrl: './user-menu.component.html',
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
    // Straight to the sign-in page — the user knows they just signed out.
    await this.router.navigate(['/', this.i18n.locale(), 'login']);
  }
}
