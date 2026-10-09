import { Component } from '@angular/core';

import { StatusPageComponent } from './status-page.component';

/** Rendered inside the shell (the user is signed in but lacks the permission). */
@Component({
  selector: 'app-forbidden-page',
  imports: [StatusPageComponent],
  template: `<app-status-page [code]="403" titleKey="errors.forbidden.title" bodyKey="errors.forbidden.body" />`,
})
export class ForbiddenPage {}
