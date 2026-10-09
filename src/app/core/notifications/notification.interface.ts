/** An in-app notification (backend `notifications` collection). */
export interface AppNotification {
  id: string;
  category: string;
  isCritical: boolean;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  /** Path without locale, e.g. `/leads/<id>`. */
  actionUrl?: string;
  readAt: string | null;
  createdAt: string;
}
