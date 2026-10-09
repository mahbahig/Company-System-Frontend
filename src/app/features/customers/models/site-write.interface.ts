/** `POST /customers/:customerId/sites` and `PATCH /sites/:id` body (`CreateSiteDto`/`UpdateSiteDto`). */
export interface SiteWrite {
  name: string;
  governorateCode: string;
  cityCode?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  siteTypeCode?: string;
  availableAreaM2?: number;
  roofTypeCode?: string;
  roofCondition?: string;
  roofAgeYears?: number;
  orientation?: string;
  shading?: string;
  utilityProviderCode?: string;
  meterNumber?: string;
  meterType?: 'single_phase' | 'three_phase';
  voltageLevel?: 'lv' | 'mv';
  contractedLoadKw?: number;
  transformerKva?: number;
  tariffCategory?: string;
  avgMonthlyConsumptionKwh?: number;
  avgMonthlyBillEgp?: number;
  infrastructureNotes?: string;
  notes?: string;
}
