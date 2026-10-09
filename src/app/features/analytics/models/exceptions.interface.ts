export interface ExceptionSummary {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  route: string;
}

export interface ExceptionDetail extends ExceptionSummary {
  rows: Array<Record<string, unknown> & { id?: string; _id?: string }>;
}

export interface DataQualityItem {
  code: string;
  count: number;
  route: string;
  of?: number;
  rate?: number | null;
}

export interface DataQualityDashboard {
  scope: string;
  items: DataQualityItem[];
  largestDuplicateCluster: number;
  customerCompleteness: Array<{ band: number | string; count: number }>;
}

export interface SearchHit {
  type: 'customer' | 'contact' | 'lead' | 'opportunity' | 'proposal' | 'contract' | 'project';
  id: string;
  number?: string;
  title: string;
  subtitle?: string;
  route: string;
}
