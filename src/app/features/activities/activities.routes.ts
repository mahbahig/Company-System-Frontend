import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';

/** `/:locale/calls/...` (E11). */
export const CALLS_ROUTES: Routes = [
  { path: '', title: 'act.calls.title', loadComponent: () => import('./calls/calls-list.page').then((m) => m.CallsListPage) },
  { path: 'new', title: 'act.calls.new', data: { permission: 'calls.create' }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./calls/call-form.page').then((m) => m.CallFormPage) },
  { path: ':id', title: 'act.calls.detail', loadComponent: () => import('./calls/call-detail.page').then((m) => m.CallDetailPage) },
];

/** `/:locale/meetings/...` (E12). */
export const MEETINGS_ROUTES: Routes = [
  { path: '', title: 'act.meetings.title', loadComponent: () => import('./meetings/meetings-list.page').then((m) => m.MeetingsListPage) },
  { path: 'new', title: 'act.meetings.new', data: { permission: 'meetings.create' }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./meetings/meeting-form.page').then((m) => m.MeetingFormPage) },
  { path: ':id', title: 'act.meetings.title', loadComponent: () => import('./meetings/meeting-detail.page').then((m) => m.MeetingDetailPage) },
];

/** `/:locale/visits/...` (E13). */
export const VISITS_ROUTES: Routes = [
  { path: '', title: 'act.visits.title', loadComponent: () => import('./visits/visits-list.page').then((m) => m.VisitsListPage) },
  { path: 'new', title: 'act.visits.new', data: { permission: 'visits.create' }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./visits/visit-form.page').then((m) => m.VisitFormPage) },
  { path: ':id', title: 'act.visits.title', loadComponent: () => import('./visits/visit-detail.page').then((m) => m.VisitDetailPage) },
];
