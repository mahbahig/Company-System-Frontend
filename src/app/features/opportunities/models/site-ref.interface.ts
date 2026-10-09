/** Site as embedded (populated) in an opportunity detail. */
export interface SiteRef {
  id: string;
  siteNo: string;
  name?: string;
  governorateCode?: string;
  latitude?: number;
  longitude?: number;
}
