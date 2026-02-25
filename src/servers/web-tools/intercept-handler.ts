// intercept-handler.ts — Playwright route interception for per-session traffic capture

import type { Route, Request } from 'playwright-core';
import type { Session, ModifyRule, InterceptOptions } from './types.js';
import type { TrafficStore } from './traffic-store.js';

// ── Glob Matching ─────────────────────────────────────────────────────────────

/**
 * Convert a glob pattern to a RegExp.
 * Rules:
 *   - `**`  matches anything including `/`
 *   - `*`   matches any characters except `/`
 *   - `*://` is treated as matching any protocol scheme
 * All other regex special characters are escaped.
 */
function globToRegex(pattern: string): RegExp {
  // Escape regex metacharacters except * which we handle ourselves
  let re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Replace ** before replacing single * so ordering is preserved
  // Use a placeholder to avoid double-processing
  re = re.replace(/\*\*/g, '\x00DOUBLESTAR\x00');
  re = re.replace(/\*/g, '[^/]*');
  re = re.replace(/\x00DOUBLESTAR\x00/g, '.*');

  return new RegExp(`^${re}$`, 'i');
}

/**
 * Match a URL against an array of glob-style scope patterns.
 * Returns true if the URL matches at least one pattern.
 * An empty patterns array matches nothing.
 */
export function matchesScope(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  for (const pattern of patterns) {
    try {
      if (globToRegex(pattern).test(url)) return true;
    } catch {
      // Malformed pattern — fall back to substring match
      if (url.toLowerCase().includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

// ── Request Modification ──────────────────────────────────────────────────────

/**
 * Apply request modification rules that match the given URL.
 * Returns a copy of headers (with additions/removals applied) and an
 * optional overridden postData string.
 */
export function applyRequestModifyRules(
  rules: Map<string, ModifyRule>,
  url: string,
  method: string,
  headers: Record<string, string>,
  postData: string | null,
): { headers: Record<string, string>; postData?: string } {
  let modifiedHeaders: Record<string, string> = { ...headers };
  let modifiedBody: string | undefined = postData ?? undefined;

  for (const rule of rules.values()) {
    if (!matchesScope(url, [rule.urlPattern])) continue;

    // Add / overwrite request headers
    if (rule.modifyRequestHeaders) {
      for (const [key, value] of Object.entries(rule.modifyRequestHeaders)) {
        modifiedHeaders[key.toLowerCase()] = value;
      }
    }

    // Remove request headers
    if (rule.removeRequestHeaders) {
      for (const key of rule.removeRequestHeaders) {
        delete modifiedHeaders[key.toLowerCase()];
      }
    }

    // Replace request body
    if (rule.modifyRequestBody !== undefined) {
      modifiedBody = rule.modifyRequestBody;
    }
  }

  const result: { headers: Record<string, string>; postData?: string } = {
    headers: modifiedHeaders,
  };
  if (modifiedBody !== undefined) {
    result.postData = modifiedBody;
  }
  return result;
}

// ── Response Modification ─────────────────────────────────────────────────────

/**
 * Apply response modification rules that match the given URL.
 * Returns a copy of headers with additions/removals applied.
 */
export function applyResponseModifyRules(
  rules: Map<string, ModifyRule>,
  url: string,
  headers: Record<string, string>,
): Record<string, string> {
  let modifiedHeaders: Record<string, string> = { ...headers };

  for (const rule of rules.values()) {
    if (!matchesScope(url, [rule.urlPattern])) continue;

    // Add / overwrite response headers
    if (rule.modifyResponseHeaders) {
      for (const [key, value] of Object.entries(rule.modifyResponseHeaders)) {
        modifiedHeaders[key.toLowerCase()] = value;
      }
    }

    // Remove response headers
    if (rule.removeResponseHeaders) {
      for (const key of rule.removeResponseHeaders) {
        delete modifiedHeaders[key.toLowerCase()];
      }
    }
  }

  return modifiedHeaders;
}

// ── Interception Setup ────────────────────────────────────────────────────────

/**
 * Activate traffic interception on a session's page via page.route().
 *
 * For every request whose URL matches the effective scope:
 *   1. Capture request metadata
 *   2. Apply request modification rules
 *   3. Forward via route.fetch() to obtain a real response
 *   4. Apply response modification rules
 *   5. Store the complete request/response pair in TrafficStore
 *   6. Fulfill the route with the (possibly modified) response
 *
 * On network errors the partial entry is stored with status 0 and the
 * route is aborted so the page receives a proper failure.
 */
export async function setupInterception(
  session: Session,
  trafficStore: TrafficStore,
  options?: InterceptOptions,
): Promise<void> {
  // Determine effective scope — options override session scope
  const scope = (options?.scope && options.scope.length > 0)
    ? options.scope
    : session.scope;

  const captureBody = options?.captureBody !== false; // default true
  const maxBodySize = options?.maxBodySize ?? trafficStore.getMaxBodySize();

  // Build the route handler closure
  const handler = async (route: Route, request: Request): Promise<void> => {
    const startTime = Date.now();
    const url = request.url();
    const method = request.method();
    const requestHeaders = request.headers();
    const postData = request.postData();
    const resourceType = request.resourceType();

    // Determine initiator and redirect chain
    const redirectedFrom = request.redirectedFrom()?.url() ?? null;
    // Playwright doesn't expose initiator directly; derive from headers or leave null
    const initiator: string | null = requestHeaders['referer'] ?? null;

    // Apply request modification rules
    const { headers: modifiedRequestHeaders, postData: modifiedBody } =
      applyRequestModifyRules(
        session.modifyRules,
        url,
        method,
        requestHeaders,
        postData,
      );

    try {
      // Forward the (possibly modified) request to the server
      const fetchOptions: Parameters<typeof route.fetch>[0] = {
        headers: modifiedRequestHeaders,
      };
      if (modifiedBody !== undefined) {
        fetchOptions.postData = modifiedBody;
      }

      const response = await route.fetch(fetchOptions);

      const status = response.status();
      const responseHeaders = response.headers();
      const mimeType = responseHeaders['content-type']?.split(';')[0].trim() ?? '';

      // Apply response modification rules
      const modifiedResponseHeaders = applyResponseModifyRules(
        session.modifyRules,
        url,
        responseHeaders,
      );

      // Capture response body (text), respecting captureBody and maxBodySize
      let responseBody: string | null = null;
      let responseBodyTruncated = false;
      let responseBuffer: Buffer | null = null;

      try {
        responseBuffer = await response.body();
        if (captureBody && responseBuffer) {
          const text = responseBuffer.toString('utf8');
          if (text.length > maxBodySize) {
            responseBody = text.slice(0, maxBodySize);
            responseBodyTruncated = true;
          } else {
            responseBody = text;
          }
        }
      } catch {
        // Body unavailable (e.g. binary / empty) — leave null
      }

      const durationMs = Date.now() - startTime;

      // Store the captured entry
      trafficStore.addEntry(session.id, {
        sessionId: session.id,
        timestamp: startTime,
        url,
        method,
        requestHeaders,
        requestBody: captureBody ? (postData ?? null) : null,
        resourceType,
        status,
        responseHeaders: modifiedResponseHeaders,
        responseBody,
        responseBodyTruncated,
        mimeType,
        durationMs,
        initiator,
        redirectedFrom,
      });

      // Fulfill the route with the real (possibly modified) response
      await route.fulfill({
        status,
        headers: modifiedResponseHeaders,
        body: responseBuffer ?? undefined,
      });
    } catch (err) {
      // Network error — store partial entry and abort the route
      const durationMs = Date.now() - startTime;

      trafficStore.addEntry(session.id, {
        sessionId: session.id,
        timestamp: startTime,
        url,
        method,
        requestHeaders,
        requestBody: captureBody ? (postData ?? null) : null,
        resourceType,
        status: 0,
        responseHeaders: {},
        responseBody: null,
        responseBodyTruncated: false,
        mimeType: '',
        durationMs,
        initiator,
        redirectedFrom,
      });

      await route.abort();
    }
  };

  // Register the handler: predicate matches URLs within scope
  await session.page.route(
    (url) => matchesScope(url.toString(), scope),
    handler,
  );

  session.routeHandler = handler;
  session.intercepting = true;
}

// ── Interception Teardown ─────────────────────────────────────────────────────

/**
 * Remove the active route handler from a session's page and reset
 * interception state.
 */
export async function removeInterception(session: Session): Promise<void> {
  if (session.routeHandler) {
    await session.page.unroute('**/*', session.routeHandler);
    session.routeHandler = null;
  }
  session.intercepting = false;
}
