/** Dashboard filters, mirrored in the URL query string. */
export interface AnalyticsFilter {
  from?: string;
  to?: string;
  ownerId?: string;
  sourceCode?: string;
  campaignCode?: string;
  governorateCode?: string;
  solutionTypeCode?: string;
}
