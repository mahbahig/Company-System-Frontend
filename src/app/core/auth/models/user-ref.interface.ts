/** Minimal bilingual reference to another user (manager, owner, assignee …). */
export interface UserRef {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
  /** Profile picture version where the API includes it (null = no picture). */
  avatarVersion?: string | null;
}
