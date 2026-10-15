import { Component } from '@angular/core';

/**
 * Positions the decorative chevron over a native `<select appSelect>`.
 * The native element is kept on purpose: it is fully accessible and uses the
 * platform picker on phones (field engineers).
 */
@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  host: { class: 'relative block' },
})
export class SelectComponent {}
