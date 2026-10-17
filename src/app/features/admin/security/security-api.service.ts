import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import type { AuditEntry } from '../audit/audit-entry.interface';
import type { SystemLockState } from '../admin-api.service';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityAlertStatus = 'new' | 'acknowledged' | 'resolved';
export type SystemMode = 'normal' | 'maintenance' | 'locked';
export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy';
export type SystemHealthStatus = 'healthy' | 'degraded' | 'critical';

export interface BilingualText {
  en: string;
  ar: string;
}

export interface SecurityPerson {
  id: string;
  name: string | null;
  nameAr: string | null;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: SecuritySeverity;
  status: SecurityAlertStatus;
  title: BilingualText;
  description: BilingualText;
  user: SecurityPerson | null;
  ip: string | null;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  relatedAuditEventId: string | null;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: SecuritySeverity;
  title: BilingualText;
  description: BilingualText;
  user: SecurityPerson | null;
  ip: string | null;
  device: { os: string | null; browser: string | null; deviceType: string | null } | null;
  sessionId: string | null;
  auditEventId: string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  occurredAt: string;
}

export interface SecurityOverview {
  generatedAt: string;
  authentication: {
    successfulLogins24h: number;
    successfulLogins7d: number;
    failedLoginsLastHour: number;
    failedLogins24h: number;
    failedLogins7d: number;
    activeSessions: number;
    revokedSessions7d: number;
    lockedAccounts: number;
    blockedIps: number;
    deactivatedAccounts: number;
  };
  security: {
    criticalEvents7d: number;
    highEvents7d: number;
    openAlerts: number;
    newAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    suspiciousAccounts: number;
    repeatedFailures: Array<{ userId: string; name: string | null; nameAr: string | null; failures: number; lastAt: string }>;
    mfa: { enabled: number; disabled: number; activeAccounts: number };
  };
  system: { mode: SystemMode; locked: boolean; maintenance: boolean; health: { status: SystemHealthStatus; checkedAt: string; components: Array<{ key: string; status: ComponentStatus }> } };
  recentAlerts: SecurityAlert[];
}

export interface ComponentHealth {
  key: 'api' | 'database' | 'redis' | 'queues' | 'storage' | 'email';
  status: ComponentStatus;
  core: boolean;
  latencyMs: number | null;
  reason: string | null;
  details: Record<string, string | number | boolean | null>;
  checkedAt: string;
}

export interface SystemHealthReport {
  status: SystemHealthStatus;
  checkedAt: string;
  components: ComponentHealth[];
}

export interface MaintenanceState {
  enabled: boolean;
  changedAt: string | null;
  changedBy: { id: string; fullNameEn: string; fullNameAr: string } | null;
}

export interface SystemState {
  mode: SystemMode;
  lock: SystemLockState;
  maintenance: MaintenanceState;
}

/**
 * The Security Center's API — Super Administrators only (the API refuses
 * everyone else on every route; the screens only mirror it).
 */
@Service()
export class SecurityApi {
  private readonly api = inject(ApiService);

  overview(): Observable<SecurityOverview> {
    return this.api.get('security-center/overview');
  }
  activity(limit = 15): Observable<AuditEntry[]> {
    return this.api.get('security-center/activity', { limit });
  }
  alerts(query: { status?: string; severity?: string; page?: number; pageSize?: number }): Observable<Page<SecurityAlert>> {
    return this.api.get('security-center/alerts', query);
  }
  alert(id: string): Observable<SecurityAlert & { events: SecurityEvent[] }> {
    return this.api.get(`security-center/alerts/${encodeURIComponent(id)}`);
  }
  acknowledge(id: string): Observable<SecurityAlert> {
    return this.api.post(`security-center/alerts/${encodeURIComponent(id)}/acknowledge`);
  }
  resolve(id: string, note?: string): Observable<SecurityAlert> {
    return this.api.post(`security-center/alerts/${encodeURIComponent(id)}/resolve`, note ? { note } : {});
  }
  health(fresh = false): Observable<SystemHealthReport> {
    return this.api.get('system-health', fresh ? { fresh: 'true' } : {});
  }
  systemState(): Observable<SystemState> {
    return this.api.get('settings/system-state');
  }
  enableMaintenance(): Observable<MaintenanceState> {
    return this.api.post('settings/maintenance/enable');
  }
  disableMaintenance(): Observable<MaintenanceState> {
    return this.api.post('settings/maintenance/disable');
  }
}
