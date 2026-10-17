/**
 * Build-time settings. `apiBaseUrl` is relative: `ng serve` proxies `/api`
 * to the NestJS backend (proxy.conf.json); in production the same origin
 * (or a reverse proxy) serves both.
 */
export const environment = {
  apiBaseUrl: '/api/v1',
};
