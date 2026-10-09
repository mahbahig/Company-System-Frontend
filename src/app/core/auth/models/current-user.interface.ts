import type { Locale } from '../../i18n/locale';
import type { PermissionCode } from '../permission-code';
import type { Scope } from '../scope';
import type { RoleRef } from './role-ref.interface';
import type { TeamRef } from './team-ref.interface';
import type { UserRef } from './user-ref.interface';

/** The signed-in user, as returned by `GET /auth/me`. */
export interface CurrentUser {
  id: string;
  email: string;
  employeeNo?: string;
  fullNameAr: string;
  fullNameEn: string;
  jobTitleAr?: string;
  jobTitleEn?: string;
  mobile?: string;
  department?: string;
  roleCodes: string[];
  defaultLocale: Locale;
  mustChangePassword: boolean;
  mfaEnabled?: boolean;
  /** AUTH-06: the user's role requires two-factor sign-in (enrol before working). */
  mfaRequired?: boolean;
  lastLoginAt?: string;
  roles: RoleRef[];
  teams: TeamRef[];
  manager: UserRef | null;
  /** Widest scope per granted permission; absent = not granted. */
  permissions: Partial<Record<PermissionCode, Scope>>;
  isAdmin: boolean;
}
