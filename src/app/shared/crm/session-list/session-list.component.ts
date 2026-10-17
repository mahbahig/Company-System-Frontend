import { Component, inject, input, output } from '@angular/core';
import { CircleHelp, LogOut, Monitor, Smartphone, Tablet, type IconNode } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../ui/badge/badge.component';
import { ButtonDirective } from '../../ui/button/button.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import type { UserSession } from './user-session.interface';

const DEVICE_ICONS: Record<UserSession['deviceType'], IconNode> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: CircleHelp };
/** Activity this recent reads "Active now". */
const ACTIVE_NOW_MS = 5 * 60_000;

/**
 * A list of signed-in sessions: device, operating system and browser, when it
 * was last active and when it signed in (relative, with the exact time on
 * hover), and a Log out button on every session that may be ended. The order
 * comes from the API (the current session first); which sessions may be
 * ended is the parent's call — and the API's, which enforces it.
 */
@Component({
  selector: 'app-session-list',
  imports: [TranslatePipe, BadgeComponent, ButtonDirective, IconComponent],
  templateUrl: './session-list.component.html',
})
export class SessionListComponent {
  protected readonly i18n = inject(I18nService);

  readonly sessions = input.required<readonly UserSession[]>();
  /** Shows Log out on every session except the current one. */
  readonly canRevoke = input(false);
  /** The session being ended (its button shows progress; the others wait). */
  readonly busyId = input<string | null>(null);
  readonly revoke = output<UserSession>();

  protected readonly logOutIcon = LogOut;

  protected icon(session: UserSession): IconNode {
    return DEVICE_ICONS[session.deviceType] ?? CircleHelp;
  }

  /** `Windows 11 · Chrome 141`, with words for whatever could not be recognised. */
  protected title(session: UserSession): string {
    const os = session.os ?? this.i18n.t('sessions.unknownOs');
    const browser = session.browser ? [session.browser, session.browserVersion].filter(Boolean).join(' ') : this.i18n.t('sessions.unknownBrowser');
    return `${os} · ${browser}`;
  }

  protected activeNow(session: UserSession): boolean {
    return Date.now() - new Date(session.lastActiveAt).getTime() < ACTIVE_NOW_MS;
  }

  /** "Just now" under a minute, then "5 minutes ago", "yesterday" … */
  protected relative(value: string): string {
    return Date.now() - new Date(value).getTime() < 60_000 ? this.i18n.t('sessions.justNow') : this.i18n.formatRelative(value);
  }
}
