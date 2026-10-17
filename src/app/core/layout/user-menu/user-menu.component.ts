import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Bell, ChevronDown, LogOut, UserRound } from 'lucide';

import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthService } from '../../auth/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { END_ALIGNED_BELOW } from '../menu-positions';

/**
 * The signed-in user's picture (or initial), name and job title; the menu
 * shows the e-mail (LTR), the profile (where the password and two-factor
 * sign-in are managed), notification preferences and Sign out.
 */
@Component({
  selector: 'app-user-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, AvatarComponent, IconComponent, TranslatePipe],
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
    { path: 'profile', label: 'account.profile.title', icon: UserRound },
    { path: 'notifications', label: 'account.notifications.title', icon: Bell },
  ];

  protected go(path: string): void {
    void this.router.navigate(['/', 'account', path]);
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
  protected readonly user = this.auth.user;

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    // Straight to the sign-in page — the user knows they just signed out.
    await this.router.navigate(['/', 'login']);
  }
}
