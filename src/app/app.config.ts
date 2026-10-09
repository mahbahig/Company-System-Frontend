import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { apiErrorInterceptor } from './core/api/api-error.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';

/**
 * Zoneless + OnPush are the Angular 22 defaults. Interceptor order matters:
 * the error normaliser is outermost so the auth interceptor still sees the
 * raw 401 and can refresh-and-retry before the error reaches the caller.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([apiErrorInterceptor, authInterceptor])),
    { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
  ],
};
