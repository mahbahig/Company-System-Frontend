import { Component } from '@angular/core';
import { Plus } from 'lucide';

import { IconComponent } from '../icon/icon.component';

/**
 * The one "create / add" icon: a `+` placed before the label of every action
 * that creates or adds something (`<a appButton …><app-create-icon />{{ 'crm.leads.new' | t }}</a>`
 * → "+ New Lead"). Same icon, size and spacing everywhere — the button's own
 * styles size it and set the gap; it is decorative, the label names the action.
 */
@Component({
  selector: 'app-create-icon',
  imports: [IconComponent],
  template: `<app-icon [icon]="plus" />`,
  host: { class: 'contents', 'data-create-icon': '' },
})
export class CreateIconComponent {
  protected readonly plus = Plus;
}
