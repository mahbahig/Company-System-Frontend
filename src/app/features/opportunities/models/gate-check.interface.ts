/** One evaluated stage-gate condition (§7.6). i18n key suffix: `opportunities.gates.<code>`. */
export interface GateCheck {
  code: string;
  severity: 'hard' | 'soft';
  passed: boolean;
  /** Completeness items behind a failed completeness gate (CPL-06). */
  missing?: string[];
}
