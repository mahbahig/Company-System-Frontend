/** Signal Forms model backing the create/edit task page. */
export interface TaskFormModel {
  title: string;
  description: string;
  priority: string;
  dueAt: string;
  reminderAt: string;
  assigneeId: string;
  customerId: string;
  leadId: string;
  opportunityId: string;
}
