// session-manager.ts — Browser session lifecycle management for web-tools MCP server

import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import type {
  Session,
  SessionOptions,
  SessionInfo,
  InterceptOptions,
  WebToolsConfig,
} from './types.js';
import type { TrafficStore } from './traffic-store.js';
import { setupInterception, removeInterception } from './intercept-handler.js';

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── SessionManager ──────────────────────────────────────────────────

export class SessionManager {
  private browser: Browser | null = null;
  private sessions: Map<string, Session> = new Map();
  private trafficStore: TrafficStore;
  private config: WebToolsConfig;

  constructor(trafficStore: TrafficStore, config: WebToolsConfig) {
    this.trafficStore = trafficStore;
    this.config = config;
  }

  // ── Private: Lazy Browser Launch ──────────────────────────────────

  /**
   * Lazily launch the Chromium browser on first use.
   * Subsequent calls return the existing browser instance.
   */
  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    const { chromium } = await import('playwright-core');

    const launchOptions: Record<string, unknown> = {
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    };

    if (this.config.chromiumPath) {
      launchOptions.executablePath = this.config.chromiumPath;
    }

    this.browser = await chromium.launch(launchOptions);

    // Clean up sessions if browser disconnects unexpectedly
    this.browser.on('disconnected', () => {
      this.sessions.clear();
      this.browser = null;
    });

    return this.browser;
  }

  // ── Create Session ────────────────────────────────────────────────

  /**
   * Create a new isolated browser session (Playwright BrowserContext + Page).
   *
   * @param id - Optional custom session identifier. Auto-generated UUID if omitted.
   * @param options - Session configuration (user agent, viewport, proxy, etc.).
   * @returns The newly created Session.
   * @throws If session_id already exists or max sessions limit is reached.
   */
  async createSession(id?: string, options?: SessionOptions): Promise<Session> {
    const sessionId = id || randomUUID();

    if (this.sessions.has(sessionId)) {
      throw new Error(
        `Session "${sessionId}" already exists. Use a different ID or close the existing session first.`,
      );
    }

    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(
        `Maximum session limit reached (${this.config.maxSessions}). ` +
          `Close an existing session before creating a new one.`,
      );
    }

    const browser = await this.ensureBrowser();

    // Resolve user agent: explicit option > config default > hardcoded default
    const userAgent =
      options?.userAgent ??
      this.config.defaultUserAgent ??
      DEFAULT_USER_AGENT;

    // Resolve viewport: explicit option > config default > Playwright default
    const viewport =
      options?.viewport ??
      this.config.defaultViewport ??
      undefined;

    // Build context options
    const contextOptions: Record<string, unknown> = {
      userAgent,
      ignoreHTTPSErrors: options?.ignoreHttpsErrors ?? true,
    };

    if (viewport) {
      contextOptions.viewport = viewport;
    }

    if (options?.extraHeaders && Object.keys(options.extraHeaders).length > 0) {
      contextOptions.extraHTTPHeaders = options.extraHeaders;
    }

    if (options?.proxy) {
      contextOptions.proxy = {
        server: options.proxy.server,
        ...(options.proxy.username ? { username: options.proxy.username } : {}),
        ...(options.proxy.password ? { password: options.proxy.password } : {}),
      };
    }

    const context: BrowserContext = await browser.newContext(contextOptions);
    const page: Page = await context.newPage();

    const session: Session = {
      id: sessionId,
      context,
      page,
      createdAt: Date.now(),
      options: options ?? {},
      intercepting: false,
      scope: options?.scope ?? [...this.config.defaultScope],
      modifyRules: new Map(),
      routeHandler: null,
    };

    this.sessions.set(sessionId, session);

    // Auto-enable interception if requested
    if (options?.intercept) {
      await this.enableInterception(sessionId);
    }

    return session;
  }

  // ── Get or Create Session ─────────────────────────────────────────

  /**
   * Get an existing session by ID, or create a new one if it does not exist.
   * Defaults to the "default" session when no ID is provided.
   */
  async getOrCreateSession(id?: string): Promise<Session> {
    const sessionId = id || 'default';
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    return this.createSession(sessionId);
  }

  // ── Get Session (strict) ──────────────────────────────────────────

  /**
   * Get an existing session by ID. Throws if the session does not exist.
   * Defaults to the "default" session when no ID is provided.
   */
  getSession(id?: string): Session {
    const sessionId = id || 'default';
    const session = this.sessions.get(sessionId);
    if (!session) {
      const available = this.sessions.size > 0
        ? ` Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`
        : ' No active sessions.';
      throw new Error(
        `Session "${sessionId}" not found.${available} Create one with web_session_create.`,
      );
    }
    return session;
  }

  // ── Has Session ───────────────────────────────────────────────────

  /**
   * Check whether a session with the given ID exists.
   */
  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  // ── Close Session ─────────────────────────────────────────────────

  /**
   * Close and destroy a browser session, releasing all resources.
   * Pass "all" to tear down every session and the browser itself.
   */
  async closeSession(id: string): Promise<void> {
    if (id === 'all') {
      // Close every session, then close the browser
      const closePromises: Promise<void>[] = [];
      for (const sessionId of Array.from(this.sessions.keys())) {
        closePromises.push(this.closeSingleSession(sessionId));
      }
      await Promise.allSettled(closePromises);
      this.sessions.clear();

      if (this.browser) {
        try {
          await this.browser.close();
        } catch {
          // Browser may already be disconnected
        }
        this.browser = null;
      }
      return;
    }

    if (!this.sessions.has(id)) {
      throw new Error(`Session "${id}" not found. Cannot close a non-existent session.`);
    }

    await this.closeSingleSession(id);
    this.sessions.delete(id);
  }

  /**
   * Internal: close a single session's context and clean up its traffic.
   */
  private async closeSingleSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    // Remove interception handler if active
    if (session.intercepting && session.routeHandler) {
      try {
        await session.context.unroute('**/*', session.routeHandler);
      } catch {
        // Context may already be closed
      }
    }

    // Close the browser context (closes all pages within it)
    try {
      await session.context.close();
    } catch {
      // Context may already be closed
    }

    // Clear captured traffic for this session
    this.trafficStore.clearSession(id);
  }

  // ── List Sessions ─────────────────────────────────────────────────

  /**
   * List all active sessions as serializable SessionInfo objects.
   */
  async listSessions(): Promise<SessionInfo[]> {
    const infos: SessionInfo[] = [];

    for (const session of Array.from(this.sessions.values())) {
      let url = 'about:blank';
      let title = '';

      try {
        url = session.page.url();
      } catch {
        // Page may be closed or crashed
      }

      try {
        title = await session.page.title();
      } catch {
        // Page may be closed or crashed
      }

      const stats = this.trafficStore.getStats(session.id);

      infos.push({
        id: session.id,
        url,
        title,
        intercepting: session.intercepting,
        capturedRequests: stats.count,
        createdAt: session.createdAt,
        options: session.options,
      });
    }

    return infos;
  }

  // ── Interception ──────────────────────────────────────────────────

  /**
   * Enable traffic interception on a session.
   * All matching HTTP traffic will be captured and stored in the TrafficStore.
   */
  async enableInterception(sessionId: string, options?: InterceptOptions): Promise<void> {
    const session = this.getSession(sessionId);

    if (session.intercepting) {
      // Already intercepting — update scope if new options provided
      if (options?.scope) {
        session.scope = options.scope;
      }
      return;
    }

    // Update scope if provided in options
    if (options?.scope) {
      session.scope = options.scope;
    }

    await setupInterception(session, this.trafficStore, options);
  }

  /**
   * Disable traffic interception on a session.
   * Existing captured traffic is preserved.
   */
  async disableInterception(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);

    if (!session.intercepting) {
      return; // Nothing to disable
    }

    await removeInterception(session);
  }

  // ── Cookie Management ─────────────────────────────────────────────

  /**
   * Get all cookies for a session, optionally filtered by URL.
   */
  async getCookies(sessionId: string, url?: string): Promise<any[]> {
    const session = this.getSession(sessionId);

    if (url) {
      return session.context.cookies(url);
    }
    return session.context.cookies();
  }

  /**
   * Set cookies on a session's browser context.
   * Each cookie object should have at minimum { name, value, url } or { name, value, domain, path }.
   */
  async setCookies(sessionId: string, cookies: any[], url?: string): Promise<void> {
    const session = this.getSession(sessionId);

    // If a URL is provided but individual cookies lack url/domain, inject it
    const enriched = cookies.map((cookie) => {
      if (!cookie.url && !cookie.domain && url) {
        return { ...cookie, url };
      }
      return cookie;
    });

    await session.context.addCookies(enriched);
  }

  /**
   * Clear all cookies from a session's browser context.
   */
  async clearCookies(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    await session.context.clearCookies();
  }

  // ── Shutdown ──────────────────────────────────────────────────────

  /**
   * Shutdown all sessions and close the browser.
   * Call this during server teardown / process exit.
   */
  async shutdown(): Promise<void> {
    await this.closeSession('all');
  }
}
