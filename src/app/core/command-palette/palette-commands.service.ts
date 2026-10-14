import { Service, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Bell, KeyRound, Keyboard, Languages, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, Sun, type IconNode } from 'lucide';

import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';
import { LOCALES, LOCALE_NAMES } from '../i18n/locale';
import { SidebarState } from '../layout/sidebar-state.service';
import { CREATE_ACTIONS } from '../navigation/create-actions';
import { NavigationService } from '../navigation/navigation.service';
import { KeyboardShortcuts } from '../shortcuts/keyboard-shortcuts.service';
import { ThemeService } from '../theme/theme.service';

export type CommandKind = 'page' | 'create' | 'action';

/** One palette command. `path` commands navigate; the others run `run`. */
export interface PaletteCommand {
  id: string;
  kind: CommandKind;
  label: string;
  hint?: string;
  icon: IconNode;
  /** Extra text the filter matches (section name, English / Arabic synonyms). */
  keywords: string;
  /** In-app path without locale, for navigation commands. */
  path?: string;
  run?: () => void;
  /** Keyboard shortcut shown next to the command. */
  keys?: string;
}

/** Pages every signed-in user has outside the sidebar (personal area). */
const PERSONAL_PAGES: ReadonlyArray<{ id: string; labelKey: string; path: string; icon: IconNode }> = [
  { id: 'notifications', labelKey: 'notifications.title', path: '/notifications', icon: Bell },
  { id: 'search', labelKey: 'search.title', path: '/search', icon: Search },
  { id: 'password', labelKey: 'account.password.title', path: '/account/password', icon: KeyRound },
  { id: 'security', labelKey: 'account.mfa.title', path: '/account/security', icon: ShieldCheck },
  { id: 'notification-preferences', labelKey: 'account.notifications.title', path: '/account/notifications', icon: Bell },
];

/** `g <letter>` jumps for the most-used areas (shown in the palette and the shortcuts help). */
export const NAV_SHORTCUT_KEYS: Readonly<Record<string, string>> = {
  dashboard: 'g d',
  leads: 'g l',
  customers: 'g c',
  opportunities: 'g o',
  pipeline: 'g b',
  tasks: 'g t',
  approvals: 'g a',
  proposals: 'g q',
  contracts: 'g k',
  projects: 'g p',
  reports: 'g r',
};

/**
 * The palette's non-record commands, derived from the same sources the rest
 * of the UI uses — never a separate list of role names:
 * - pages: the permission-filtered navigation + personal pages, each re-checked
 *   with the route-guard logic (`canOpen`);
 * - create: `CREATE_ACTIONS` the user holds the create permission for and
 *   whose form route the guard would open;
 * - actions: personal preferences (theme, language, sidebar, shortcuts, sign
 *   out) — nothing that changes business data, nothing destructive.
 */
@Service()
export class PaletteCommands {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly sidebar = inject(SidebarState);
  private readonly shortcuts = inject(KeyboardShortcuts);

  readonly pages = computed<PaletteCommand[]>(() => {
    this.i18n.locale();
    const fromNav = this.navigation.sections().flatMap((section) =>
      section.items.map((item) => ({
        id: `page:${item.path}`,
        kind: 'page' as const,
        label: this.i18n.t(`navigation.items.${item.labelKey}`),
        hint: this.description(item.labelKey) || this.i18n.t(`navigation.sections.${section.labelKey}`),
        icon: item.icon,
        keywords: `${this.i18n.t(`navigation.sections.${section.labelKey}`)} ${item.labelKey}`,
        path: item.path,
        keys: NAV_SHORTCUT_KEYS[item.labelKey],
      })),
    );
    const personal = PERSONAL_PAGES.map((page) => ({
      id: `page:${page.path}`,
      kind: 'page' as const,
      label: this.i18n.t(page.labelKey),
      icon: page.icon,
      keywords: page.id,
      path: page.path,
      keys: page.id === 'notifications' ? 'g n' : undefined,
    }));
    return [...fromNav, ...personal].filter((command) => this.navigation.canOpen(command.path));
  });

  readonly creates = computed<PaletteCommand[]>(() => {
    this.i18n.locale();
    return CREATE_ACTIONS.filter((action) => this.auth.can(action.permission) && this.navigation.canOpen(action.path)).map((action) => ({
      id: `create:${action.path}`,
      kind: 'create' as const,
      label: this.i18n.t(`ux.create.${action.labelKey}`),
      icon: action.icon,
      keywords: `${this.i18n.t('ux.palette.groups.create')} new ${action.labelKey}`,
      path: action.path,
    }));
  });

  readonly actions = computed<PaletteCommand[]>(() => {
    this.i18n.locale();
    const dark = this.theme.resolved() === 'dark';
    const target = LOCALES.find((locale) => locale !== this.i18n.locale()) ?? this.i18n.locale();
    const collapsed = this.sidebar.collapsed();
    return [
      {
        id: 'action:theme',
        kind: 'action' as const,
        label: this.i18n.t(dark ? 'ux.palette.actions.lightTheme' : 'ux.palette.actions.darkTheme'),
        icon: dark ? Sun : Moon,
        keywords: 'theme dark light mode',
        run: () => this.theme.choose(dark ? 'light' : 'dark'),
      },
      {
        id: 'action:locale',
        kind: 'action' as const,
        label: this.i18n.t('ux.palette.actions.language', { language: LOCALE_NAMES[target] }),
        icon: Languages,
        keywords: 'language arabic english عربي',
        run: () => void this.router.navigateByUrl(this.router.url.replace(/^\/(ar|en)(?=\/|\?|$)/, `/${target}`)),
      },
      {
        id: 'action:sidebar',
        kind: 'action' as const,
        label: this.i18n.t(collapsed ? 'ux.sidebar.expand' : 'ux.sidebar.collapse'),
        icon: collapsed ? PanelLeftOpen : PanelLeftClose,
        keywords: 'sidebar menu navigation',
        run: () => this.sidebar.toggle(),
        keys: '[',
      },
      {
        id: 'action:shortcuts',
        kind: 'action' as const,
        label: this.i18n.t('ux.shortcuts.title'),
        icon: Keyboard,
        keywords: 'keyboard shortcuts keys help',
        run: () => this.shortcuts.helpOpen.set(true),
        keys: '?',
      },
      {
        id: 'action:sign-out',
        kind: 'action' as const,
        label: this.i18n.t('common.actions.signOut'),
        icon: LogOut,
        keywords: 'logout sign out exit',
        run: () => void this.signOut(),
      },
    ];
  });

  private description(labelKey: string): string {
    const key = `navigation.descriptions.${labelKey}`;
    return this.i18n.has(key) ? this.i18n.t(key) : '';
  }

  private async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/', this.i18n.locale(), 'login']);
  }
}
