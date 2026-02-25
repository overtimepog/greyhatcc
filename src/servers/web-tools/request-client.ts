import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import type { TrafficEntry, FuzzResult } from './types.js';

// ── Constants ────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 1048576; // 1MB
const MAX_WORDLIST = 500;
const DEFAULT_PLACEHOLDER = 'FUZZ';
const DEFAULT_DELAY = 100;
const DEFAULT_TIMEOUT = 10000;

// ── Interfaces ───────────────────────────────────────────────────────

export interface SendRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  ignoreTls?: boolean;
}

export interface SendRequestResult {
  url: string;
  method: string;
  status: number;
  statusText: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  contentLength: number;
  durationMs: number;
  redirectChain: Array<{ url: string; status: number }>;
}

// ── HTTP Status Text Map ─────────────────────────────────────────────

const STATUS_TEXTS: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created',
  202: 'Accepted', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently',
  302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect',
  308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict',
  410: 'Gone', 413: 'Payload Too Large', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout',
};

function statusText(code: number): string {
  return STATUS_TEXTS[code] ?? 'Unknown';
}

// ── Core Raw Request ─────────────────────────────────────────────────

function rawRequest(
  url: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeout: number;
    ignoreTls: boolean;
  },
): Promise<{ status: number; responseHeaders: Record<string, string>; rawBody: Buffer; bodyTruncated: boolean }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      reject(new Error(`Unsupported protocol: ${parsed.protocol} — only http/https allowed`));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const mod: typeof http | typeof https = isHttps ? https : http;

    const bodyBuf = opts.body ? Buffer.from(opts.body, 'utf-8') : null;

    // Build final headers — merge caller headers, set Content-Length if body present
    const finalHeaders: Record<string, string> = { ...opts.headers };
    if (bodyBuf && bodyBuf.length > 0 && !finalHeaders['content-length']) {
      finalHeaders['content-length'] = String(bodyBuf.length);
    }

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port
        ? Number(parsed.port)
        : isHttps ? 443 : 80,
      path: parsed.pathname + parsed.search,
      method: opts.method,
      headers: finalHeaders,
      timeout: opts.timeout,
      ...(isHttps
        ? {
            rejectUnauthorized: !opts.ignoreTls,
            agent: new https.Agent({ rejectUnauthorized: !opts.ignoreTls }),
          }
        : {}),
    };

    const req = mod.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      let truncated = false;

      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize <= MAX_BODY_BYTES) {
          chunks.push(chunk);
        } else {
          // Mark truncated; don't push further data but keep draining
          truncated = true;
        }
      });

      res.on('end', () => {
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
        }
        resolve({
          status: res.statusCode ?? 0,
          responseHeaders,
          rawBody: Buffer.concat(chunks),
          bodyTruncated: truncated,
        });
      });

      res.on('error', (err) => {
        reject(new Error(`Response stream error for ${url}: ${err.message}`));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${opts.timeout}ms: ${url}`));
    });

    req.on('error', (err: Error) => {
      reject(new Error(`Connection failed to ${url}: ${err.message}`));
    });

    if (bodyBuf && bodyBuf.length > 0) {
      req.write(bodyBuf);
    }
    req.end();
  });
}

// ── sendRequest ──────────────────────────────────────────────────────

export async function sendRequest(opts: SendRequestOptions): Promise<SendRequestResult> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    followRedirects = true,
    maxRedirects = 10,
    ignoreTls = false,
  } = opts;

  const startMs = Date.now();
  const redirectChain: Array<{ url: string; status: number }> = [];
  const requestHeaders = { ...headers };

  let currentUrl = url;
  let redirectsLeft = followRedirects ? maxRedirects : 0;

  // Validate URL upfront
  try {
    new URL(currentUrl);
  } catch {
    throw new Error(`Invalid URL: ${currentUrl}`);
  }

  let lastResult: Awaited<ReturnType<typeof rawRequest>> | null = null;
  let finalUrl = currentUrl;

  while (true) {
    lastResult = await rawRequest(currentUrl, {
      method,
      headers: requestHeaders,
      body,
      timeout,
      ignoreTls,
    });

    const { status, responseHeaders } = lastResult;
    const isRedirect = status >= 300 && status < 400 && responseHeaders['location'];

    if (!isRedirect || redirectsLeft <= 0) {
      finalUrl = currentUrl;
      break;
    }

    // Record this hop before following
    redirectChain.push({ url: currentUrl, status });

    // Resolve possibly-relative Location header
    let nextUrl: string;
    try {
      nextUrl = new URL(responseHeaders['location'], currentUrl).toString();
    } catch {
      nextUrl = responseHeaders['location'];
    }

    currentUrl = nextUrl;
    redirectsLeft--;
  }

  const durationMs = Date.now() - startMs;
  const bodyStr = lastResult.rawBody.toString('utf-8');

  return {
    url: finalUrl,
    method: method.toUpperCase(),
    status: lastResult.status,
    statusText: statusText(lastResult.status),
    requestHeaders,
    responseHeaders: lastResult.responseHeaders,
    body: bodyStr,
    bodyTruncated: lastResult.bodyTruncated,
    contentLength: lastResult.rawBody.length,
    durationMs,
    redirectChain,
  };
}

// ── replayRequest ─────────────────────────────────────────────────────

export async function replayRequest(
  entry: TrafficEntry,
  overrides?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    removeHeaders?: string[];
  },
): Promise<SendRequestResult> {
  // Copy entry request headers into a mutable map
  const baseHeaders: Record<string, string> = { ...entry.requestHeaders };

  // Apply header removals first
  if (overrides?.removeHeaders) {
    for (const h of overrides.removeHeaders) {
      const lower = h.toLowerCase();
      for (const key of Object.keys(baseHeaders)) {
        if (key.toLowerCase() === lower) {
          delete baseHeaders[key];
        }
      }
    }
  }

  // Merge override headers on top
  const finalHeaders: Record<string, string> = {
    ...baseHeaders,
    ...(overrides?.headers ?? {}),
  };

  return sendRequest({
    url: overrides?.url ?? entry.url,
    method: overrides?.method ?? entry.method,
    headers: finalHeaders,
    body: overrides?.body ?? entry.requestBody ?? undefined,
  });
}

// ── fuzzRequest ───────────────────────────────────────────────────────

export async function fuzzRequest(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  entry?: TrafficEntry;
  wordlist: string[];
  placeholder?: string;
  delay?: number;
  timeout?: number;
  matchStatus?: number[];
  filterStatus?: number[];
}): Promise<FuzzResult[]> {
  const {
    wordlist,
    placeholder = DEFAULT_PLACEHOLDER,
    delay = DEFAULT_DELAY,
    timeout = DEFAULT_TIMEOUT,
    matchStatus,
    filterStatus,
  } = opts;

  if (wordlist.length > MAX_WORDLIST) {
    throw new Error(
      `Wordlist too large: ${wordlist.length} entries (max ${MAX_WORDLIST}). ` +
      `Trim the wordlist to ${MAX_WORDLIST} entries or fewer.`,
    );
  }

  // Resolve base request from entry or explicit opts
  let baseUrl = opts.url ?? '';
  let baseMethod = opts.method ?? 'GET';
  let baseHeaders: Record<string, string> = { ...(opts.headers ?? {}) };
  let baseBody = opts.body;

  if (opts.entry) {
    const e = opts.entry;
    baseUrl = opts.url ?? e.url;
    baseMethod = opts.method ?? e.method;
    baseHeaders = { ...e.requestHeaders, ...(opts.headers ?? {}) };
    baseBody = opts.body ?? e.requestBody ?? undefined;
  }

  if (!baseUrl) {
    throw new Error('fuzzRequest requires either opts.url or opts.entry with a URL');
  }

  // Replace ALL occurrences of placeholder in a string
  const inject = (template: string, payload: string): string =>
    template.split(placeholder).join(payload);

  const results: FuzzResult[] = [];

  for (let i = 0; i < wordlist.length; i++) {
    const payload = wordlist[i];
    const timestamp = new Date().toISOString();

    // Inject payload into url, header values, and body
    const fuzzedUrl = inject(baseUrl, payload);
    const fuzzedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(baseHeaders)) {
      fuzzedHeaders[k] = inject(v, payload);
    }
    const fuzzedBody = baseBody ? inject(baseBody, payload) : undefined;

    const startMs = Date.now();
    let statusCode = 0;
    let responseLength = 0;
    let interesting = false;
    let reason: string | undefined;
    let matches = false;

    try {
      const res = await sendRequest({
        url: fuzzedUrl,
        method: baseMethod,
        headers: fuzzedHeaders,
        body: fuzzedBody,
        timeout,
        followRedirects: false,
      });

      statusCode = res.status;
      responseLength = res.contentLength;

      // Determine match
      if (matchStatus && matchStatus.length > 0) {
        matches = matchStatus.includes(statusCode);
      } else if (filterStatus && filterStatus.length > 0) {
        matches = !filterStatus.includes(statusCode);
      } else {
        matches = true;
      }

      // Flag interesting responses (do NOT set reason — keep error field for actual errors only)
    } catch (err: any) {
      statusCode = 0;
      responseLength = 0;
      matches = false;
      interesting = false;
      reason = `Error: ${err.message}`;
    }

    const timing = Date.now() - startMs;

    const entry: FuzzResult = {
      index: i,
      payload,
      status: statusCode,
      contentLength: responseLength,
      durationMs: timing,
      ...(reason ? { error: reason } : {}),
    };

    // Apply status filters before pushing
    if (filterStatus && filterStatus.length > 0 && filterStatus.includes(statusCode)) {
      // Skip filtered statuses — don't push to results
    } else if (matchStatus && matchStatus.length > 0 && !matchStatus.includes(statusCode) && statusCode !== 0) {
      // Skip non-matched statuses (but keep errors with statusCode 0 for visibility)
    } else {
      results.push(entry);
    }

    // Inter-request delay (skip after last entry)
    if (i < wordlist.length - 1 && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}
