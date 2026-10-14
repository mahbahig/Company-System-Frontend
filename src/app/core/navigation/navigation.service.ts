import { Service, computed, inject } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';
import type { PermissionCode } from '../auth/permission-code';
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
  private readonly shellRoutes = shellChildren(inject(Router).config);

  readonly sections = computed<NavSection[]>(() => {
    this.auth.user(); // re-filter when the profile (permissions) changes
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          this.routedPaths.has(item.path) &&
          (item.permission === null || (typeof item.permission === 'string' ? this.auth.can(item.permission) : this.auth.canAny(item.permission))) &&
          (item.requiresAll ?? []).every((permission) => this.auth.can(permission)),
      ),
    })).filter((section) => section.items.length > 0);
  });

  /** `/leads` → `/ar/leads` for the active language. */
  link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }

  /**
   * Whether the user may open an in-app path (without locale, with or
   * without a query string), judged level by level exactly like the route
   * guard: every matched route level's `data.permission` (any of) and
   * `data.requiresAll` (all of), inherited downwards, plus a feature's landing
   * page. Used for every link the UI builds from data it did not render
   * itself — notification actions, search results, favorites, recently
   * viewed, breadcrumbs, the command palette. Fails closed for unknown paths
   * and signed-out users. A UX check: the API still enforces record scope.
   */
  canOpen(path: string): boolean {
    if (!this.auth.user()) return false;
    const levels = guardLevels(this.shellRoutes, path);
    return !!levels && levels.every(({ any, all }) => all.every((permission) => this.auth.can(permission)) && (!any || this.allows(any)));
  }

  private allows(required: PermissionCode | readonly PermissionCode[]): boolean {
    return typeof required === 'string' ? this.auth.can(required) : this.auth.canAny(required);
  }
}

interface GuardLevel {
  any?: PermissionCode | readonly PermissionCode[];
  all: readonly PermissionCode[];
}

/**
 * The permission checks the guard runs for a path, one per matched route
 * level (static segments beat parameters, longer matches beat shorter, a
 * childless route must match to the end), or null when no route matches the
 * whole path.
 */
function guardLevels(shell: Routes, path: string): GuardLevel[] | null {
  const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!segments.length) return null;
  const levels: GuardLevel[] = [];
  let candidates = shell;
  let inherited: GuardLevel = { all: [] };
  let index = 0;
  const levelOf = (route: Route): GuardLevel => ({
    any: (route.data?.['permission'] as GuardLevel['any']) ?? inherited.any,
    all: (route.data?.['requiresAll'] as GuardLevel['all'] | undefined) ?? inherited.all,
  });
  while (index < segments.length) {
    const rest = segments.slice(index);
    const ranked = candidates
      .filter((route) => !route.redirectTo)
      .map((route) => {
        const parts = (route.path ?? '').split('/').filter(Boolean);
        // Like the router, a route without children must consume the rest of the URL (`users` is not `users/:id`).
        const leaf = !route.children && !route.loadChildren;
        const fits = leaf ? parts.length === rest.length : parts.length <= rest.length;
        const size = parts.length > 0 && fits && parts.every((part, i) => part.startsWith(':') || part === rest[i]) ? parts.length : 0;
        return { route, size, exact: parts.every((part) => !part.startsWith(':')) };
      })
      .filter((entry) => entry.size > 0)
      .sort((a, b) => Number(b.exact) - Number(a.exact) || b.size - a.size);
    const found = ranked[0];
    if (!found) return null;
    inherited = levelOf(found.route);
    levels.push(inherited);
    index += found.size;
    candidates = found.route.children ?? [];
    if (index === segments.length) {
      // A feature's own list page is its empty-path child.
      const landing = candidates.find((route) => route.path === '' && !route.redirectTo);
      if (landing) levels.push(levelOf(landing));
      else if (candidates.length && !found.route.loadComponent && !found.route.component) {
        // Only a redirect lives here (e.g. `/account` → `/account/password`): judge its target.
        const redirect = candidates.find((route) => route.path === '' && typeof route.redirectTo === 'string');
        const target = redirect ? candidates.find((route) => route.path === redirect.redirectTo) : undefined;
        if (!target) return null;
        levels.push(levelOf(target));
      }
    }
  }
  return levels;
}

/** The authenticated shell's child routes (`/:locale/<area>/...`). */
function shellChildren(routes: Routes): Routes {
  const locale = routes.find((route) => route.path === ':locale');
  const shell = locale?.children?.find((route) => route.path === '' && !!route.canActivate?.length && !!route.children?.length && !route.redirectTo);
  return shell?.children ?? [];
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
