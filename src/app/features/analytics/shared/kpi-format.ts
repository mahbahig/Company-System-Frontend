import type { I18nService } from '../../../core/i18n/i18n.service';
import type { KpiValue } from '../models/kpi-value.interface';

/** Display text for a §15 KPI in its unit (rate → %, money → EGP, durations rounded). */
export function formatKpi(i18n: I18nService, kpi: KpiValue | undefined): string {
  if (!kpi || kpi.value === null || kpi.value === undefined) return '—';
  switch (kpi.unit) {
    case 'rate':
      return i18n.formatNumber(kpi.value, { style: 'percent', maximumFractionDigits: 1 });
    case 'money':
      return i18n.formatMoney(kpi.value);
    case 'hours':
      return `${i18n.formatNumber(kpi.value, { maximumFractionDigits: 1 })} ${i18n.t('kpi.units.hours')}`;
    case 'days':
      return `${i18n.formatNumber(kpi.value, { maximumFractionDigits: 1 })} ${i18n.t('kpi.units.days')}`;
    default:
      return i18n.formatNumber(kpi.value, { maximumFractionDigits: 2 });
  }
}

/** "n of d" hint for ratio KPIs. */
export function kpiHint(i18n: I18nService, kpi: KpiValue | undefined): string {
  if (!kpi) return '';
  const formula = i18n.t(`kpi.formula.${kpi.code}`);
  if (kpi.unit === 'rate' && kpi.denominator !== undefined) return `${i18n.formatNumber(kpi.numerator ?? 0)} / ${i18n.formatNumber(kpi.denominator)} · ${formula}`;
  return formula;
}

/** Percent text for a 0..1 ratio (or — when unknown). */
export function percent(i18n: I18nService, value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : i18n.formatNumber(value, { style: 'percent', maximumFractionDigits: 1 });
}
