import type { NavItem } from './nav-item.interface';

/** A titled group of sidebar links. */
export interface NavSection {
  /** i18n key under `navigation.sections`. */
  labelKey: string;
  items: NavItem[];
}
