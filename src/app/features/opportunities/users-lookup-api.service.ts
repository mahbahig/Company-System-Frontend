import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { UserLookup } from './models/user-lookup.interface';

/**
 * Typed client for `GET /users/lookup` (active users, for owner/team/collaborator
 * pickers). Feature-scoped for now; promote to `core/services` once a second
 * feature needs it (see fork report).
 */
@Service()
export class UsersLookupApi {
  private readonly api = inject(ApiService);

  lookup(query: { role?: string; q?: string } = {}): Observable<UserLookup[]> {
    return this.api.get<UserLookup[]>('users/lookup', query);
  }
}
