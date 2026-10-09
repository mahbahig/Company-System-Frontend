import { InputDirective } from './input.directive';
import { LabelComponent } from './label.component';
import { SelectComponent } from './select.component';
import { SelectDirective } from './select.directive';
import { TextareaDirective } from './textarea.directive';

/** Every form-control primitive, for a component's `imports` array. */
export const FORM_IMPORTS = [LabelComponent, InputDirective, TextareaDirective, SelectComponent, SelectDirective] as const;
