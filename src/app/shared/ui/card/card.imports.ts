import { CardContentDirective } from './card-content.directive';
import { CardDescriptionDirective } from './card-description.directive';
import { CardFooterDirective } from './card-footer.directive';
import { CardHeaderDirective } from './card-header.directive';
import { CardTitleDirective } from './card-title.directive';
import { CardDirective } from './card.directive';

/** Every card primitive, for a component's `imports` array. */
export const CARD_IMPORTS = [CardDirective, CardHeaderDirective, CardTitleDirective, CardDescriptionDirective, CardContentDirective, CardFooterDirective] as const;
