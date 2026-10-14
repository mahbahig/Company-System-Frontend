import type { WorkflowView } from '../../../shared/crm/pipeline-tracker/workflow-view.interface';

/** `GET /opportunities/:id/workflow`: the O-stage tracker and, once opened, the commercial deal tracker. */
export interface OpportunityWorkflow {
  opportunity: WorkflowView;
  deal: WorkflowView | null;
}
