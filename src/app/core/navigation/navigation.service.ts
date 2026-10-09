import { Service, computed, inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';
import { NAV_SECTIONS } from './nav-sections';
import type { NavSection } from './nav-section.interface';

/**
 * The navigation tree filtered by (1) the user's permissions and (2) the
 * routes that actually exist — an item appears automatically once its page
 * is registered, and never before (a menu entry that leads nowhere is
 * forbidden by the spec). Empty sections are dropped.
 */
@Service()
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly routedPaths = collectPaths(inject(Router).config);

  readonly sections = computed<NavSection[]>(() => {
    this.auth.user(); // re-filter when the profile (permissions) changes
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => this.routedPaths.has(item.path) && (item.permission === null || (typeof item.permission === 'string' ? this.auth.can(item.permission) : this.auth.canAny(item.permission))),
      ),
    })).filter((section) => section.items.length > 0);
  });

  /** `/leads` → `/ar/leads` for the active language. */
  link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}

/** Every static path under `/:locale`, e.g. `/leads`, `/dashboard/executive`. */
function collectPaths(routes: Routes, prefix = ''): Set<string> {
  const paths = new Set<string>();
  for (const route of routes) {
    const path = route.path ?? '';
    const segment = path === ':locale' ? '' : path;
    if (segment.includes(':') || segment === '**') continue;
    const full = segment ? `${prefix}/${segment}` : prefix;
    if (segment) paths.add(full);
    for (const child of collectPaths(route.children ?? [], full)) paths.add(child);
  }
  return paths;
}
