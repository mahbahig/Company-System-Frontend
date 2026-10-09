/** TECH-03 system design (shared by assessments and technical proposals). */
export interface SystemDesign {
  capacityKwp?: number;
  panels?: { manufacturer?: string; model?: string; wattage?: number; quantity?: number } | null;
  inverters?: Array<{ manufacturer?: string; model?: string; ratedKw?: number; quantity?: number }>;
  batteries?: Array<{ manufacturer?: string; model?: string; capacityKwh?: number; quantity?: number }>;
  mounting?: string;
  cablingProtection?: string;
  expectedAnnualGenerationKwh?: number;
  specificYield?: number;
  performanceRatio?: number;
  expectedSelfConsumptionPct?: number;
  technicalSpecifications?: string;
  installationRequirements?: string;
  scope?: string;
  assumptions?: string;
  exclusions?: string;
  technicalTerms?: string;
}

/** TECH-04 bill-of-materials line. */
export interface BomItem {
  category: string;
  equipmentId?: string | null;
  description: string;
  manufacturer?: string;
  model?: string;
  quantity: number;
  unit?: string;
  notes?: string;
}

/** §10 equipment catalog item (reference cost only for permitted roles). */
export interface EquipmentItem {
  id: string;
  code: string;
  category: string;
  manufacturer: string;
  model: string;
  descriptionAr?: string;
  descriptionEn?: string;
  rating?: number;
  ratingUnit?: string;
  unit: string;
  referenceCost?: number;
  currency: string;
  warrantyYears?: number;
  specs: Record<string, unknown>;
  isActive: boolean;
}

export const EQUIPMENT_CATEGORIES = ['panel', 'inverter', 'battery', 'mounting', 'cabling', 'protection', 'monitoring', 'pump', 'other'] as const;
