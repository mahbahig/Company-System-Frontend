import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';

export interface AdminUser {
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
  teamIds: Array<string | { id: string; nameAr: string; nameEn: string }>;
  managerId?: string | { id: string; fullNameAr: string; fullNameEn: string } | null;
  territories: string[];
  specializations: string[];
  leadCapacity: number;
  availability?: { status: string; from?: string | null; to?: string | null };
  defaultLocale: string;
  isActive: boolean;
  deactivationReason?: string;
  mustChangePassword: boolean;
  mfaEnabled?: boolean;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
}

/** `GET /users/:id/performance`. */
export interface EmployeePerformance {
  user: { id: string; fullNameAr: string; fullNameEn: string; email: string; roleCodes: string[]; isActive: boolean; lastLoginAt: string | null };
  period: { from: string | null; to: string | null };
  leads: { owned: number; open: number; created: number; converted: number; closed: number; contactAttempts: number; reachedAttempts: number };
  calls: { total: number; outbound: number; inbound: number; durationSeconds: number; byOutcome: Array<{ outcomeCode: string; count: number }> };
  meetings: { total: number; completed: number; upcoming: number };
  visits: { total: number; completed: number };
  tasks: { open: number; overdue: number; completed: number };
  /** `wonValue` is absent for roles without financial visibility. */
  opportunities: { open: number; won: number; lost: number; wonValue?: number };
  recentActivity: Array<{ id: string; type: string; occurredAt: string; data: Record<string, unknown>; customerId: string | null; opportunityId: string | null; leadId: string | null }>;
}

export interface RoleGrant {
  code: string;
  scope: 'own' | 'team' | 'all';
}

export interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: RoleGrant[];
}

export interface Team {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  managerId?: string | { id: string; fullNameAr: string; fullNameEn: string } | null;
  memberIds: Array<string | { id: string; fullNameAr: string; fullNameEn: string }>;
  region?: string;
  isActive: boolean;
}

/** Administration endpoints: users, roles, teams (USER-01..05, RBAC-01..03). */
@Service()
export class AdminApi {
  private readonly api = inject(ApiService);

  users(query: { q?: string; role?: string; teamId?: string; active?: string; page?: number }): Observable<Page<AdminUser>> {
    return this.api.get('users', query);
  }
  user(id: string): Observable<AdminUser> {
    return this.api.get(`users/${id}`);
  }
  openWork(id: string): Observable<Array<{ module: string; count: number }>> {
    return this.api.get(`users/${id}/open-work`);
  }
  createUser(body: Record<string, unknown>): Observable<AdminUser & { temporaryPassword?: string }> {
    return this.api.post('users', body);
  }
  updateUser(id: string, body: Record<string, unknown>): Observable<AdminUser> {
    return this.api.patch(`users/${id}`, body);
  }
  /** The reason is optional; it is recorded on the account and in the audit trail when given. */
  deactivate(id: string, reason: string, reassignToId?: string): Observable<unknown> {
    return this.api.post(`users/${id}/deactivate`, { reason: reason || undefined, reassignToId: reassignToId || undefined });
  }
  /** One employee's activity and results (`users.view_performance`). */
  performance(id: string, period: { from?: string; to?: string } = {}): Observable<EmployeePerformance> {
    return this.api.get(`users/${id}/performance`, period);
  }
  activate(id: string): Observable<unknown> {
    return this.api.post(`users/${id}/activate`);
  }
  resetPassword(id: string): Observable<{ temporaryPassword: string }> {
    return this.api.post(`users/${id}/reset-password`);
  }
  forceLogout(id: string): Observable<void> {
    return this.api.post(`auth/${id}/logout`);
  }

  roles(): Observable<Role[]> {
    return this.api.get('roles');
  }
  permissionCatalogue(): Observable<Array<{ code: string; module: string; action: string }>> {
    return this.api.get('roles/permissions');
  }
  createRole(body: Record<string, unknown>): Observable<Role> {
    return this.api.post('roles', body);
  }
  updateRole(code: string, body: Record<string, unknown>): Observable<Role> {
    return this.api.patch(`roles/${code}`, body);
  }

  teams(): Observable<Team[]> {
    return this.api.get('teams');
  }
  createTeam(body: Record<string, unknown>): Observable<Team> {
    return this.api.post('teams', body);
  }
  updateTeam(id: string, body: Record<string, unknown>): Observable<Team> {
    return this.api.patch(`teams/${id}`, body);
  }
}
