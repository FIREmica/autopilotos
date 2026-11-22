const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const allowedRoutes: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: 'GET', path: /^\/config$/ },
  { method: 'POST', path: /^\/$/ },
  { method: 'GET', path: /^\/admin$/ },
  { method: 'GET', path: /^\/admin\/intelligence-config$/ },
  { method: 'GET', path: new RegExp(`^/admin/${uuid}/(?:administrative-record|reply-status|draft)$`) },
  { method: 'POST', path: new RegExp(`^/admin/${uuid}/(?:read-state|case-status|intelligence)$`) },
  { method: 'GET', path: new RegExp(`^/admin/${uuid}/intelligence/operations$`) },
  { method: 'POST', path: new RegExp(`^/admin/${uuid}/intelligence/${uuid}/(?:review|event)$`) },
];

/**
 * The local professional demo mounts the production router for fidelity, but
 * admits only the exact synthetic intake/read/review/status routes it needs.
 * Everything else fails closed before a production-capable route can run.
 */
export function consultationSyntheticRouteAllowed(method: string, requestPath: string): boolean {
  let normalized: string;
  try {
    const pathname = new URL(requestPath, 'http://127.0.0.1').pathname;
    normalized = decodeURIComponent(pathname).replace(/\/{2,}/g, '/').replace(/\/+$/, '').toLowerCase() || '/';
  } catch {
    return false;
  }
  const verb = method.toUpperCase();
  return allowedRoutes.some(route => route.method === verb && route.path.test(normalized));
}
