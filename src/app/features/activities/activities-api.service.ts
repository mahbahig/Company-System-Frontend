import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { UserRef } from '../../core/auth/models/user-ref.interface';
import type { DeviceFix } from '../../core/geo/geolocation.service';
import type { GeoCapture } from '../../shared/crm/gps-capture/gps-capture.component';

type Ref = { id: string; customerNo?: string; leadNo?: string; opportunityNo?: string; nameAr?: string; nameEn?: string; name?: string; fullName?: string } | string | null | undefined;

export interface GeoReading {
  at: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  manualReason?: string;
  distanceM?: number;
  note?: string;
}

export interface Call {
  id: string;
  customerId?: Ref;
  leadId?: Ref;
  contactId?: Ref;
  opportunityId?: Ref;
  ownerId: UserRef | string;
  direction: string;
  occurredAt: string;
  durationSeconds?: number;
  phoneNumber?: string;
  purposeCode?: string;
  outcomeCode: string;
  summary?: string;
  notes?: string;
  followUpRequired: boolean;
  followUpAt?: string | null;
  followUpTaskId?: string | null;
}

export interface Meeting {
  id: string;
  subject: string;
  customerId: Ref;
  opportunityId?: Ref;
  siteId?: Ref;
  ownerId: UserRef | string;
  scheduledAt: string;
  endsAt?: string | null;
  mode: string;
  location?: string;
  onlineUrl?: string;
  purpose?: string;
  agenda?: string;
  attendees: Array<{ userId?: UserRef | string; contactId?: Ref; externalName?: string; externalRole?: string }>;
  status: string;
  outcome?: string;
  minutes?: string;
  decisions?: string;
  actionItems?: string;
  cancellationReason?: string;
  /** Start position (coordinates and accuracy only for `meetings.view_locations`). */
  arrival?: GeoReading | null;
  /** End position (same rule). */
  departure?: GeoReading | null;
  actualDurationMinutes?: number;
  /** Computed by the API when the meeting ends: end-to-start distance, the radius, the verdict. */
  locationDistanceM?: number | null;
  locationRadiusM?: number | null;
  locationVerificationStatus?: 'within_radius' | 'outside_radius' | 'location_unreliable' | null;
  followUpAt?: string | null;
}

export interface Visit {
  id: string;
  visitNo: string;
  customerId: Ref;
  opportunityId?: Ref;
  siteId?: Ref;
  contactId?: Ref;
  ownerId: UserRef | string;
  participantIds: Array<UserRef | string>;
  visitTypeCode?: string;
  purpose: string;
  status: string;
  scheduledAt: string;
  plannedLatitude?: number;
  plannedLongitude?: number;
  plannedAddress?: string;
  checkIn?: GeoReading | null;
  checkOut?: GeoReading | null;
  durationMinutes?: number;
  outcomeCode?: string;
  report?: string;
  notes?: string;
  nextAction?: string;
  followUpAt?: string | null;
  requiresTechnicalAssessment: boolean;
  cancellationReason?: string;
}

export interface Activity {
  id: string;
  channel: string;
  direction: string;
  customerId?: Ref;
  leadId?: Ref;
  opportunityId?: Ref;
  projectId?: Ref;
  ownerId: UserRef | string;
  occurredAt: string;
  subject?: string;
  body?: string;
  outcomeCode?: string;
  internalNotes?: string;
  meaningful: boolean;
  nextAction?: string;
  nextActionAt?: string | null;
}

type ListQuery = { q?: string; page?: number; ownerId?: string; customerId?: string; leadId?: string; opportunityId?: string; status?: string; direction?: string; mode?: string; purpose?: string; channel?: string };

/** Typed client for calls, meetings, site visits and the general activity log (ACT, MEET, VISIT). */
@Service()
export class ActivitiesApi {
  private readonly api = inject(ApiService);

  calls(query: ListQuery): Observable<Page<Call>> {
    return this.api.get('calls', query);
  }
  call(id: string): Observable<Call> {
    return this.api.get(`calls/${id}`);
  }
  createCall(body: Record<string, unknown>): Observable<Call> {
    return this.api.post('calls', body);
  }
  updateCall(id: string, body: Record<string, unknown>): Observable<Call> {
    return this.api.patch(`calls/${id}`, body);
  }

  meetings(query: ListQuery): Observable<Page<Meeting>> {
    return this.api.get('meetings', query);
  }
  meeting(id: string): Observable<Meeting> {
    return this.api.get(`meetings/${id}`);
  }
  createMeeting(body: Record<string, unknown>): Observable<Meeting> {
    return this.api.post('meetings', body);
  }
  updateMeeting(id: string, body: Record<string, unknown>): Observable<Meeting> {
    return this.api.patch(`meetings/${id}`, body);
  }
  cancelMeeting(id: string, reason: string): Observable<Meeting> {
    return this.api.post(`meetings/${id}/cancel`, { reason });
  }
  /** Starts the meeting at this position (only the coordinates and accuracy are sent; the API decides the rest). */
  arrive(id: string, position: DeviceFix): Observable<Meeting> {
    return this.api.post(`meetings/${id}/arrive`, { latitude: position.latitude, longitude: position.longitude, accuracyM: position.accuracyM });
  }
  /** Ends the meeting at this (fresh) position; the API measures it against the start. */
  depart(id: string, position: DeviceFix): Observable<Meeting> {
    return this.api.post(`meetings/${id}/depart`, { latitude: position.latitude, longitude: position.longitude, accuracyM: position.accuracyM });
  }

  visits(query: ListQuery): Observable<Page<Visit>> {
    return this.api.get('visits', query);
  }
  visit(id: string): Observable<Visit> {
    return this.api.get(`visits/${id}`);
  }
  createVisit(body: Record<string, unknown>): Observable<Visit> {
    return this.api.post('visits', body);
  }
  updateVisit(id: string, body: Record<string, unknown>): Observable<Visit> {
    return this.api.patch(`visits/${id}`, body);
  }
  cancelVisit(id: string, reason: string): Observable<Visit> {
    return this.api.post(`visits/${id}/cancel`, { reason });
  }
  checkIn(id: string, body: GeoCapture): Observable<Visit> {
    return this.api.post(`visits/${id}/check-in`, body);
  }
  checkOut(id: string, body: GeoCapture): Observable<Visit> {
    return this.api.post(`visits/${id}/check-out`, body);
  }

  activities(query: ListQuery & { from?: string; to?: string }): Observable<Page<Activity>> {
    return this.api.get('activities', query);
  }
  createActivity(body: Record<string, unknown>): Observable<Activity> {
    return this.api.post('activities', body);
  }
}

/** Display label for a populated reference (customer / lead / opportunity / contact). */
export function refLabel(pick: (ar?: string | null, en?: string | null) => string, value: Ref): string {
  if (!value || typeof value !== 'object') return '';
  return pick(value.nameAr, value.nameEn) || value.name || value.fullName || value.customerNo || value.leadNo || value.opportunityNo || '';
}

export function refId(value: Ref): string {
  return value && typeof value === 'object' ? value.id : (value ?? '');
}
