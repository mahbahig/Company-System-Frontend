import type { IconNode } from 'lucide';

import type { PermissionCode } from '../auth/permission-code';

/** One sidebar link. */
export interface NavItem {
  /** i18n key under `navigation.items`. */
  labelKey: string;
  /** Path WITHOUT the locale prefix, e.g. `/leads`. */
  path: string;
  icon: IconNode;
  /** Required permission (any of a list), or null when every signed-in user may see it. */
  permission: PermissionCode | readonly PermissionCode[] | null;
  /** Additional permissions that must all be held (mirrors the route data `requiresAll`). */
  requiresAll?: readonly PermissionCode[];
}
