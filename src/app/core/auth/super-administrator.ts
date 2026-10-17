/** The built-in role that makes someone a Super Administrator. */
export const SUPER_ADMINISTRATOR_ROLE = 'system_administrator';

/**
 * Whether an account is a Super Administrator's. Mirrors the API's
 * `AccountAdministrationPolicy` so the UI hides what the API refuses: nobody
 * else — another Super Administrator included — may see or end their
 * sessions, lock (deactivate) or reactivate them, reset their password or
 * change their roles. A UX hint only; the API enforces it.
 */
export function isSuperAdministrator(user: { roleCodes?: readonly string[] | null }): boolean {
  return !!user.roleCodes?.includes(SUPER_ADMINISTRATOR_ROLE);
}
