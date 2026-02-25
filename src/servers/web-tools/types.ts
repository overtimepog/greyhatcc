// ── Web Tools MCP Server Types ────────────────────────────────────────

import type { BrowserContext, Page, Route, Request } from 'playwright-core';

// ── Session Options ───────────────────────────────────────────────────

/** Options passed to web_session_create when spawning a new browser session. */
export interface SessionOptions {
  /** Run browser in headless mode (default: true). */
  headless?: boolean;
  /** Override the browser's User-Agent string. */
  userAgent?: string;
  /** Set the browser viewport dimensions. */
  viewport?: { width: number; height: number };
  /** Extra HTTP headers sent with every request in this session. */
  extraHeaders?: Record<string, string>;
  /** HTTP/SOCKS proxy configuration for the session. */
  proxy?: { server: string; username?: string; password?: string };
  /** URL patterns (glob/regex) that define the interception scope. */
  scope?: string[];
  /** Enable traffic interception and capture on session start. */
  intercept?: boolean;
  /** Ignore TLS/SSL certificate errors (useful against self-signed certs). */
  ignoreHttpsErrors?: boolean;
}

// ── Internal Session State ────────────────────────────────────────────

/**
 * Internal representation of an active browser session.
 * Not serialized directly — use SessionInfo for MCP responses.
 */
export interface Session {
  /** Unique session identifier (UUID). */
  id: string;
  /** Playwright browser context backing this session. */
  context: BrowserContext;
  /** Active page within the context. */
  page: Page;
  /** Unix timestamp (ms) when the session was created. */
  createdAt: number;
  /** Original options the session was created with. */
  options: SessionOptions;
  /** Whether traffic interception is currently active. */
  intercepting: boolean;
  /** URL patterns currently in scope for interception. */
  scope: string[];
  /** Named modification rules keyed by rule ID. */
  modifyRules: Map<string, ModifyRule>;
  /** Active Playwright route handler, or null when interception is off. */
  routeHandler: ((route: Route, request: Request) => Promise<void>) | null;
}

// ── Session Info (serializable) ───────────────────────────────────────

/**
 * Serializable session summary returned to MCP clients.
 * Strips non-serializable Playwright objects from Session.
 */
export interface SessionInfo {
  /** Unique session identifier (UUID). */
  id: string;
  /** Current URL of the active page. */
  url: string;
  /** Current page title. */
  title: string;
  /** Whether traffic interception is currently active. */
  intercepting: boolean;
  /** Number of traffic entries captured so far in this session. */
  capturedRequests: number;
  /** Unix timestamp (ms) when the session was created. */
  createdAt: number;
  /** Options the session was created with. */
  options: SessionOptions;
}

// ── Traffic Entry ─────────────────────────────────────────────────────

/**
 * A single captured HTTP request/response pair recorded during interception.
 * Stored in the in-memory traffic log and queryable via web_traffic_* tools.
 */
export interface TrafficEntry {
  /** Auto-incrementing entry ID within the session. */
  id: number;
  /** ID of the session that captured this entry. */
  sessionId: string;
  /** Unix timestamp (ms) when the request was initiated. */
  timestamp: number;

  // ── Request ────────────────────────────────────────────────────────

  /** Full request URL. */
  url: string;
  /** HTTP method (GET, POST, PUT, etc.). */
  method: string;
  /** Request headers as a flat key-value map. */
  requestHeaders: Record<string, string>;
  /** Raw request body, or null if the request had no body. */
  requestBody: string | null;
  /** Playwright resource type (document, xhr, fetch, script, etc.). */
  resourceType: string;

  // ── Response ───────────────────────────────────────────────────────

  /** HTTP response status code. */
  status: number;
  /** Response headers as a flat key-value map. */
  responseHeaders: Record<string, string>;
  /** Raw response body (text/base64), or null if unavailable. */
  responseBody: string | null;
  /** True when the response body exceeded maxBodySize and was truncated. */
  responseBodyTruncated: boolean;
  /** MIME type of the response (e.g. application/json, text/html). */
  mimeType: string;

  // ── Timing ─────────────────────────────────────────────────────────

  /** Total round-trip time in milliseconds. */
  durationMs: number;

  // ── Metadata ───────────────────────────────────────────────────────

  /** What initiated the request (script URL, "parser", etc.), or null. */
  initiator: string | null;
  /** URL this request was redirected from, or null. */
  redirectedFrom: string | null;
}

// ── Traffic Search Query ──────────────────────────────────────────────

/**
 * Parameters for web_traffic_search — full-text or regex search
 * across captured traffic entries.
 */
export interface TrafficSearchQuery {
  /** Search term or regex pattern. */
  pattern: string;
  /** Treat pattern as a regular expression (default: false). */
  regex?: boolean;
  /** Which part of the traffic entry to search (default: 'all'). */
  searchIn?: 'all' | 'url' | 'request_headers' | 'request_body' | 'response_headers' | 'response_body';
  /** Filter results to a specific HTTP method (e.g. POST). */
  method?: string;
  /** Filter results to a specific HTTP status code. */
  statusCode?: number;
  /** Filter results to a specific MIME type substring. */
  mimeType?: string;
  /** Maximum number of matching entries to return (default: 100). */
  limit?: number;
}

// ── Traffic Filter ────────────────────────────────────────────────────

/**
 * Lightweight filter for web_traffic_list — list recent traffic entries
 * with optional URL pattern and method constraints.
 */
export interface TrafficFilter {
  /** Glob or substring pattern to match against entry URLs. */
  urlPattern?: string;
  /** Filter to a specific HTTP method. */
  method?: string;
  /** Maximum number of entries to return. */
  limit?: number;
}

// ── Modify Rule ───────────────────────────────────────────────────────

/**
 * A named rule used by web_intercept_modify to rewrite requests or
 * responses on-the-fly before they reach the page or the server.
 */
export interface ModifyRule {
  /** Unique rule identifier. */
  id: string;
  /** Glob or regex URL pattern that triggers this rule. */
  urlPattern: string;
  /** Headers to add or overwrite on the outgoing request. */
  modifyRequestHeaders?: Record<string, string>;
  /** Header names to strip from the outgoing request. */
  removeRequestHeaders?: string[];
  /** Replace the entire request body with this string. */
  modifyRequestBody?: string;
  /** Headers to add or overwrite on the incoming response. */
  modifyResponseHeaders?: Record<string, string>;
  /** Header names to strip from the incoming response. */
  removeResponseHeaders?: string[];
}

// ── Intercept Options ─────────────────────────────────────────────────

/**
 * Options controlling how traffic interception behaves when activated
 * via web_intercept_start.
 */
export interface InterceptOptions {
  /** URL patterns to restrict interception to (overrides session scope). */
  scope?: string[];
  /** Whether to capture request/response bodies (default: true). */
  captureBody?: boolean;
  /** Maximum body size in bytes to store per entry (default: 65536). */
  maxBodySize?: number;
}

// ── Fuzz Result ───────────────────────────────────────────────────────

/**
 * A single result entry produced by web_fuzz for one payload iteration.
 */
export interface FuzzResult {
  /** Zero-based index of this payload in the wordlist. */
  index: number;
  /** The payload string that was injected. */
  payload: string;
  /** HTTP status code of the response. */
  status: number;
  /** Content-Length of the response body in bytes. */
  contentLength: number;
  /** Round-trip duration in milliseconds. */
  durationMs: number;
  /** Error message if the request failed outright (network error, timeout). */
  error?: string;
}

// ── Web Tools Config ──────────────────────────────────────────────────

/**
 * Web-tools-specific configuration block, typically nested under the
 * top-level GreyhatConfig (src/shared/types.ts).
 */
export interface WebToolsConfig {
  /** Launch browsers in headless mode by default. */
  headless: boolean;
  /** Maximum number of concurrent browser sessions allowed. */
  maxSessions: number;
  /** Maximum number of traffic entries retained per session. */
  maxTrafficEntries: number;
  /** Default maximum body capture size in bytes. */
  maxBodySize: number;
  /** Default URL scope patterns applied to new sessions. */
  defaultScope: string[];
  /** Absolute path to a custom Chromium binary, if not using the bundled one. */
  chromiumPath?: string;
  /** Default User-Agent string applied to new sessions. */
  defaultUserAgent?: string;
  /** Default viewport dimensions applied to new sessions. */
  defaultViewport?: { width: number; height: number };
}
