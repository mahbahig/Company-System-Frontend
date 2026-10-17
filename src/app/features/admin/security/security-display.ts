import type { BadgeTone } from '../../../shared/ui/badge/badge-variants';
import type { ComponentStatus, SecurityAlertStatus, SecuritySeverity, SystemHealthStatus } from './security-api.service';

/** Severity colours (the words always come with them): critical red, high orange, medium amber-blue, low neutral. */
export const SEVERITY_TONE: Readonly<Record<SecuritySeverity, BadgeTone>> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export const ALERT_STATUS_TONE: Readonly<Record<SecurityAlertStatus, BadgeTone>> = {
  new: 'danger',
  acknowledged: 'warning',
  resolved: 'success',
};

export const COMPONENT_TONE: Readonly<Record<ComponentStatus, { dot: string; badge: BadgeTone }>> = {
  healthy: { dot: 'bg-success', badge: 'success' },
  degraded: { dot: 'bg-warning', badge: 'warning' },
  unhealthy: { dot: 'bg-destructive', badge: 'danger' },
};

export const OVERALL_TONE: Readonly<Record<SystemHealthStatus, { dot: string; badge: BadgeTone }>> = {
  healthy: { dot: 'bg-success', badge: 'success' },
  degraded: { dot: 'bg-warning', badge: 'warning' },
  critical: { dot: 'bg-destructive', badge: 'danger' },
};
