import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { CompletenessResult } from '../../shared/crm/completeness-panel/completeness-result.interface';

export interface IntakeFieldDef {
  id: string;
  section: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  labelAr: string;
  labelEn: string;
  required: boolean;
  options?: string[];
  custom?: boolean;
}

export interface IntakeFieldValue {
  value: unknown;
  origin: 'customer' | 'sales_observed' | 'engineer_verified';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  history: Array<{ value: unknown; origin: string; changedBy: string | { fullNameAr: string; fullNameEn: string }; changedAt: string; note?: string }>;
}

export interface IntakeView {
  opportunityId: string;
  solutionTypeCode: string;
  status: string;
  sections: Record<string, Record<string, IntakeFieldValue>>;
  schema: IntakeFieldDef[];
  sectionsApplicable: string[];
  completeness: CompletenessResult;
  locked: string[];
}

export interface IntakeFormDefinition {
  solutionTypeCode: string;
  sections: string[];
  fields: IntakeFieldDef[];
  hiddenFields?: string[];
}

/** Typed client for the technical intake (TIN-01..07). */
@Service()
export class IntakeApi {
  private readonly api = inject(ApiService);

  get(opportunityId: string): Observable<IntakeView> {
    return this.api.get(`technical-intakes/opportunity/${opportunityId}`);
  }

  save(opportunityId: string, sections: Record<string, Record<string, { value: unknown; origin?: string }>>): Observable<IntakeView> {
    return this.api.patch(`technical-intakes/opportunity/${opportunityId}`, { sections });
  }

  verify(opportunityId: string, body: { section: string; fieldId: string; value: unknown; note?: string }): Observable<IntakeView> {
    return this.api.post(`technical-intakes/opportunity/${opportunityId}/verify`, body);
  }

  forms(): Observable<unknown> {
    return this.api.get('technical-intakes/forms');
  }

  form(solutionTypeCode: string): Observable<unknown> {
    return this.api.get(`technical-intakes/forms/${solutionTypeCode}`);
  }

  updateForm(solutionTypeCode: string, body: unknown): Observable<unknown> {
    return this.api.put(`technical-intakes/forms/${solutionTypeCode}`, body);
  }
}
