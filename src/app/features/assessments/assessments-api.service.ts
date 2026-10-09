import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { UserRef } from '../../core/auth/models/user-ref.interface';
import type { BomItem, SystemDesign } from '../solar/solar.models';

export interface AssessmentVersion {
  version: number;
  status: string;
  changeReason?: string | null;
  siteMeasurements: Record<string, unknown>;
  roof: Record<string, unknown>;
  electrical: Record<string, unknown>;
  consumption: { monthlyKwh?: number[]; averageMonthlyKwh?: number; annualKwh?: number; averageBillEgp?: number; tariffCategory?: string; dayLoadPct?: number; nightLoadPct?: number; peakDemandKw?: number; loadProfileNotes?: string };
  constraints?: string;
  equipmentRequirements?: string;
  engineeringCalculations?: string;
  recommendations?: string;
  design: SystemDesign;
  bom: BomItem[];
  createdAt: string;
  submittedAt?: string | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
}

export interface Assessment {
  id: string;
  assessmentNo: string;
  opportunityId: { id: string; opportunityNo: string; name: string } | string;
  customerId: { id: string; customerNo: string; nameAr?: string; nameEn?: string } | string;
  engineerId: UserRef | string;
  reviewerId?: UserRef | string | null;
  status: string;
  currentVersion: number;
  approvedVersion?: number | null;
  versions: AssessmentVersion[];
  createdAt: string;
}

export interface AssessmentDetail {
  assessment: Assessment;
  designFileCounts: Record<string, number>;
  canEdit: boolean;
  canReview: boolean;
}

export type AssessmentSave = Partial<Pick<AssessmentVersion, 'siteMeasurements' | 'roof' | 'electrical' | 'consumption' | 'constraints' | 'equipmentRequirements' | 'engineeringCalculations' | 'recommendations' | 'design' | 'bom'>>;

/** Typed client for solar assessments (TECH-01..05). */
@Service()
export class AssessmentsApi {
  private readonly api = inject(ApiService);

  list(query: { status?: string; mine?: boolean; q?: string; page?: number; opportunityId?: string }): Observable<Page<Assessment>> {
    return this.api.get('assessments', query);
  }

  get(id: string): Observable<AssessmentDetail> {
    return this.api.get(`assessments/${id}`);
  }

  forOpportunity(opportunityId: string): Observable<AssessmentDetail | { assessment: null; canStart: boolean }> {
    return this.api.get(`assessments/opportunity/${opportunityId}`);
  }

  start(opportunityId: string): Observable<Assessment> {
    return this.api.post(`assessments/opportunity/${opportunityId}`);
  }

  save(id: string, body: AssessmentSave): Observable<Assessment> {
    return this.api.patch(`assessments/${id}`, body);
  }

  submit(id: string): Observable<Assessment> {
    return this.api.post(`assessments/${id}/submit`);
  }

  decide(id: string, body: { decision: 'approve' | 'return'; reason?: string }): Observable<Assessment> {
    return this.api.post(`assessments/${id}/decide`, body);
  }

  newVersion(id: string, changeReason: string): Observable<Assessment> {
    return this.api.post(`assessments/${id}/versions`, { changeReason });
  }
}
