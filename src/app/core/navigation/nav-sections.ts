import {
  ArrowRightLeft,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  ClipboardCheck,
  Copy,
  Database,
  FileBarChart,
  FileInput,
  FileSignature,
  FileText,
  FolderKanban,
  Gauge,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  ListTodo,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  SunMedium,
  Target,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Workflow,
} from 'lucide';

import type { NavSection } from './nav-section.interface';

/**
 * Application navigation, declared as data so the sidebar, the mobile drawer
 * and the command palette render ONE definition, and a permission gate cannot
 * be applied in one place and forgotten in another.
 *
 * An item is shown only when (1) its route is registered and (2) the user
 * holds one of its permissions — a menu entry that leads nowhere, or to a
 * page the role cannot open, is forbidden by the spec (§2).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    labelKey: 'overview',
    items: [
      { labelKey: 'dashboard', path: '/dashboard', icon: LayoutDashboard, permission: null },
      { labelKey: 'executiveDashboard', path: '/dashboard/executive', icon: Gauge, permission: 'dashboards.view_executive' },
      { labelKey: 'approvals', path: '/approvals', icon: CircleCheck, permission: 'approvals.view' },
      { labelKey: 'exceptions', path: '/exceptions', icon: ShieldAlert, permission: ['exceptions.view', 'data.view_quality'] },
    ],
  },
  {
    labelKey: 'sales',
    items: [
      { labelKey: 'leads', path: '/leads', icon: UserRound, permission: 'leads.view' },
      { labelKey: 'customers', path: '/customers', icon: Users, permission: 'customers.view' },
      { labelKey: 'opportunities', path: '/opportunities', icon: Target, permission: 'opportunities.view' },
      {
        labelKey: 'pipeline',
        path: '/pipeline',
        icon: KanbanSquare,
        permission: ['opportunities.change_stage', 'opportunities.approve_stage', 'dashboards.view_company', 'dashboards.view_executive'],
        requiresAll: ['opportunities.view'],
      },
      { labelKey: 'campaigns', path: '/campaigns', icon: Megaphone, permission: 'campaigns.view' },
    ],
  },
  {
    labelKey: 'operations',
    items: [
      { labelKey: 'tasks', path: '/tasks', icon: ListTodo, permission: 'tasks.view' },
      { labelKey: 'calls', path: '/calls', icon: Phone, permission: 'calls.view' },
      { labelKey: 'meetings', path: '/meetings', icon: CalendarClock, permission: 'meetings.view' },
      { labelKey: 'visits', path: '/visits', icon: MapPin, permission: 'visits.view' },
      { labelKey: 'activities', path: '/activities', icon: MessageSquare, permission: 'activities.view' },
    ],
  },
  {
    labelKey: 'solar',
    items: [
      { labelKey: 'handoffs', path: '/handoffs', icon: ArrowRightLeft, permission: 'handoffs.view' },
      { labelKey: 'assessments', path: '/assessments', icon: ClipboardCheck, permission: 'assessments.view' },
      { labelKey: 'proposals', path: '/proposals', icon: FileText, permission: 'combined_proposals.view' },
      { labelKey: 'contracts', path: '/contracts', icon: FileSignature, permission: 'contracts.view' },
      { labelKey: 'projects', path: '/projects', icon: FolderKanban, permission: 'projects.view' },
    ],
  },
  {
    labelKey: 'analytics',
    items: [
      { labelKey: 'reports', path: '/reports', icon: FileBarChart, permission: ['reports.view', 'reports.view_all'] },
      { labelKey: 'imports', path: '/imports', icon: FileInput, permission: 'data.import' },
      { labelKey: 'duplicates', path: '/duplicates', icon: Copy, permission: ['duplicates.review', 'customers.merge'] },
      { labelKey: 'ownership', path: '/ownership-requests', icon: UsersRound, permission: ['ownership.decide', 'ownership.request'] },
    ],
  },
  {
    labelKey: 'administration',
    items: [
      { labelKey: 'employees', path: '/employees', icon: UserCog, permission: ['administration.manage_users', 'users.view_performance'] },
      { labelKey: 'roles', path: '/admin/roles', icon: Shield, permission: 'security.manage_roles' },
      { labelKey: 'teams', path: '/admin/teams', icon: UsersRound, permission: 'administration.manage_teams' },
      { labelKey: 'referenceData', path: '/admin/reference-data', icon: Database, permission: 'settings.manage' },
      { labelKey: 'equipment', path: '/admin/equipment', icon: SunMedium, permission: ['catalog.manage', 'pricing.manage'] },
      { labelKey: 'rules', path: '/admin/rules', icon: ListChecks, permission: 'settings.view' },
      { labelKey: 'intakeForms', path: '/admin/intake-forms', icon: ClipboardList, permission: 'settings.manage' },
      { labelKey: 'settings', path: '/admin/settings', icon: Settings, permission: ['settings.view', 'settings.manage_policy'] },
      { labelKey: 'automation', path: '/admin/automation', icon: Workflow, permission: 'automation.manage' },
      { labelKey: 'integrations', path: '/admin/integrations', icon: Plug, permission: 'integrations.manage' },
      { labelKey: 'auditLog', path: '/admin/audit', icon: ScrollText, permission: ['audit.view', 'audit.view_security'] },
      { labelKey: 'supportTickets', path: '/admin/support-tickets', icon: Inbox, permission: 'support.manage' },
    ],
  },
  {
    labelKey: 'help',
    // Every signed-in employee can report a problem and follow their own tickets — except the
    // support desk, which answers them (Support tickets, above).
    items: [{ labelKey: 'support', path: '/support', icon: LifeBuoy, permission: null, hiddenWith: 'support.manage' }],
  },
];
