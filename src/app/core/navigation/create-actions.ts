import { CalendarPlus, ClipboardPlus, MapPinPlus, PhoneCall, Target, UserPlus, UsersRound, Zap, type IconNode } from 'lucide';

import type { PermissionCode } from '../auth/permission-code';

/** A "create a record" command (command palette, dashboard quick actions). */
export interface CreateAction {
  /** i18n key under `ux.create`. */
  labelKey: string;
  /** Path WITHOUT the locale prefix — must be a routed form page. */
  path: string;
  icon: IconNode;
  /** The create permission the page's own "New" button checks. */
  permission: PermissionCode;
}

/**
 * Every create command, declared as data next to the navigation so a
 * command can only exist for a real form page. Each one is offered only when
 * the user holds its create permission AND the route guard would open its
 * path (`NavigationService.canOpen`); the server still enforces both.
 * Destructive actions never appear here.
 */
export const CREATE_ACTIONS: readonly CreateAction[] = [
  { labelKey: 'lead', path: '/leads/new', icon: UserPlus, permission: 'leads.create' },
  { labelKey: 'quickLead', path: '/leads/quick-add', icon: Zap, permission: 'leads.create' },
  { labelKey: 'customer', path: '/customers/new', icon: UsersRound, permission: 'customers.create' },
  { labelKey: 'opportunity', path: '/opportunities/new', icon: Target, permission: 'opportunities.create' },
  { labelKey: 'task', path: '/tasks/new', icon: ClipboardPlus, permission: 'tasks.create' },
  { labelKey: 'call', path: '/calls/new', icon: PhoneCall, permission: 'calls.create' },
  { labelKey: 'meeting', path: '/meetings/new', icon: CalendarPlus, permission: 'meetings.create' },
  { labelKey: 'visit', path: '/visits/new', icon: MapPinPlus, permission: 'visits.create' },
];
