/** OPP-14 Sales Readiness Checklist item. i18n key suffix: `opportunities.readiness.<id>`. */
export interface ReadinessItem {
  id: string;
  stage: string;
  done: boolean;
  /** `auto` = derived from data; `manual` = ticked by a user. */
  source: 'auto' | 'manual';
  /** Whether a user may tick it by hand. */
  manual: boolean;
}
