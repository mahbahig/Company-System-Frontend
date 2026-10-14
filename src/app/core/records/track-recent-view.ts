import { effect, inject, untracked } from '@angular/core';

import { RecentRecords } from './recent-records.service';
import type { RecordType } from './record-ref';

/**
 * Call in a record page's constructor: records the visit once the page has
 * loaded the record (i.e. the API let this user open it), and forgets it when
 * the API answers "not found" (no access, or deleted). Nothing else — no
 * label — is kept.
 */
export function trackRecentView(type: RecordType, id: () => string | null | undefined, state: () => 'loaded' | 'missing' | 'pending'): void {
  const recent = inject(RecentRecords);
  effect(() => {
    const recordId = id();
    const current = state();
    if (!recordId || current === 'pending') return;
    untracked(() => (current === 'loaded' ? recent.track({ type, id: recordId }) : recent.forget({ type, id: recordId })));
  });
}
