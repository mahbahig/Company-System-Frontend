import { Component } from '@angular/core';

import { StatusPageComponent } from './status-page.component';

/** Rendered inside the shell (the user is signed in but lacks the permission). */
@Component({
  selector: 'app-forbidden-page',
  imports: [StatusPageComponent],
  templateUrl: './forbidden.page.html',
})
export class ForbiddenPage {}
