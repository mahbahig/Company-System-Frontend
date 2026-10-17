/** What the screenshot field accepts on this deployment (`GET /support/tickets/attachment-policy`). */
export interface SupportAttachmentPolicy {
  /** False when the server has no storage configured: tickets go without screenshots. */
  available: boolean;
  maxAttachments: number;
  maxAttachmentBytes: number;
  acceptedTypes: string[];
  acceptedExtensions: string[];
}
