import { TestBed } from '@angular/core/testing';

import { AuthService } from '../app/core/auth/auth.service';
import type { CurrentUser } from '../app/core/auth/models/current-user.interface';
import { ROLE_PERMISSIONS, type RoleKey } from './role-permissions';

/** A signed-in profile holding the given built-in roles (permissions merged widest-first, like the API). */
export function userWithRoles(...roles: RoleKey[]): CurrentUser {
  const rank = { own: 1, team: 2, all: 3 } as const;
  const permissions: CurrentUser['permissions'] = {};
  for (const role of roles)
    for (const [code, scope] of Object.entries(ROLE_PERMISSIONS[role]) as Array<[keyof CurrentUser['permissions'], 'own' | 'team' | 'all']>) {
      const current = permissions[code];
      if (!current || rank[scope] > rank[current]) permissions[code] = scope;
    }
  return {
    id: 'u-' + roles.join('-'),
    email: `${roles[0]}@ecotech.test`,
    fullNameAr: 'مستخدم',
    fullNameEn: 'User',
    roleCodes: roles,
    defaultLocale: 'en',
    mustChangePassword: false,
    roles: [],
    teams: [],
    managedTeamIds: [],
    manager: null,
    permissions,
    isAdmin: roles.includes('system_administrator'),
    isReadOnly: roles.every((role) => role === 'read_only_executive'),
  };
}

/** Signs the given roles in for the current TestBed. */
export function signInAs(...roles: RoleKey[]): CurrentUser {
  const user = userWithRoles(...roles);
  TestBed.inject(AuthService).user.set(user);
  return user;
}
