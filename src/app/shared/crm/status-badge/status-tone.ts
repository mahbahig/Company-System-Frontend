import type { BadgeTone } from '../../ui/badge/badge-variants';

const SUCCESS = new Set(['approved', 'accepted', 'won', 'completed', 'done', 'paid', 'received', 'fully_executed', 'active', 'verified', 'complete', 'healthy', 'succeeded', 'imported', 'committed', 'met', 'on_track', 'fulfilled', 'converted', 'qualified', 'merged', 'available', 'released', 'signed_by_customer']);
const WARNING = new Set(['pending', 'pending_approval', 'submitted', 'under_review', 'finance_validation', 'due_soon', 'watch', 'on_hold', 'waiting', 'escalated', 'clarification_requested', 'revision_requested', 'resubmitted', 'review', 'review_later', 'duplicate', 'invoiced', 'sent_for_signature', 'under_negotiation', 'merge_requested', 'medium', 'nurture', 'in_progress', 'validating', 'committing', 'counter_offer', 'warning', 'leave', 'out_of_office']);
const DANGER = new Set(['rejected', 'returned', 'lost', 'expired', 'breached', 'failed', 'cancelled', 'terminated', 'at_risk', 'critical', 'overdue', 'delayed', 'invalid', 'no_show', 'blacklisted', 'withdrawn', 'high', 'urgent', 'rolled_back', 'closed']);
const INFO = new Set(['sent', 'presented', 'planned', 'confirmed', 'ordered', 'shipped', 'open', 'new', 'contacted', 'draft', 'uploaded', 'created', 'planning', 'procurement', 'installation', 'testing_commissioning', 'handover', 'running', 'info']);

/** One shared mapping from any workflow status code to a badge tone, so colours mean the same thing everywhere. */
export function statusTone(value: string | null | undefined): BadgeTone {
  if (!value) return 'neutral';
  if (SUCCESS.has(value)) return 'success';
  if (DANGER.has(value)) return 'danger';
  if (WARNING.has(value)) return 'warning';
  if (INFO.has(value)) return 'info';
  return 'neutral';
}
