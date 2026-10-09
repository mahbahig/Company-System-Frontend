import { Component } from '@angular/core';

import { StatusPageComponent } from './status-page.component';

@Component({
  selector: 'app-not-found-page',
  imports: [StatusPageComponent],
  template: `<main id="main-content"><app-status-page [code]="404" titleKey="errors.notFound.title" bodyKey="errors.notFound.body" /></main>`,
})
export class NotFoundPage {}
