/** One §15 KPI as returned by the API. */
export interface KpiValue {
  code: string;
  value: number | null;
  numerator?: number;
  denominator?: number;
  unit: 'rate' | 'hours' | 'days' | 'money' | 'count' | 'number';
}

export type KpiMap = Record<string, KpiValue>;
