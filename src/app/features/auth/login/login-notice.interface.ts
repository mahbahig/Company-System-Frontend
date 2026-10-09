import type { AlertVariant } from '../../../shared/ui/alert/alert-variants';

/** A notice shown above the login card for `?reason=…`. */
export interface LoginNotice {
  key: string;
  variant: AlertVariant;
}
