// ── Web Tools MCP Server ──────────────────────────────────────────────
// Playwright-based browser automation, traffic interception, and HTTP
// manipulation server — the Burp Suite equivalent for MCP clients.

import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';

import { WEB_TOOLS } from './tools.js';
import { TrafficStore } from './traffic-store.js';
import {
  setupInterception,
  removeInterception,
  matchesScope,
} from './intercept-handler.js';
import { sendRequest, replayRequest, fuzzRequest } from './request-client.js';
import {
  guardOutputSize,
  formatSessionList,
  formatTrafficEntry,
  formatTrafficSearch,
  formatTrafficExport,
  formatFuzzResults,
  formatFormData,
  formatLinks,
} from './formatter.js';
import { loadConfig } from '../../shared/config.js';
import type {
  Session,
  SessionInfo,
  SessionOptions,
  InterceptOptions,
  ModifyRule,
  WebToolsConfig,
} from './types.js';

// ── Configuration ─────────────────────────────────────────────────────

const config = loadConfig();

const WEB_CONFIG: WebToolsConfig = {
  headless: true,
  maxSessions: 10,
  maxTrafficEntries: 1000,
  maxBodySize: 1024 * 1024, // 1 MB
  defaultScope: ['**'],
  ...((config as any).webTools ?? {}),
};

// ── Shared State ──────────────────────────────────────────────────────

const trafficStore = new TrafficStore({
  maxEntriesPerSession: WEB_CONFIG.maxTrafficEntries,
  maxBodySize: WEB_CONFIG.maxBodySize,
});

const sessions = new Map<string, Session>();
let browser: Browser | null = null;
const DEFAULT_SESSION_ID = 'default';

// ── Browser Lifecycle ─────────────────────────────────────────────────

async function ensureBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: WEB_CONFIG.headless,
    ...(WEB_CONFIG.chromiumPath ? { executablePath: WEB_CONFIG.chromiumPath } : {}),
  });
  return browser;
}

// ── Session Helpers ───────────────────────────────────────────────────

function resolveSessionId(raw?: string): string {
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_SESSION_ID;
}

function getSession(sessionId: string): Session {
  const s = sessions.get(sessionId);
  if (!s) throw new Error(`Session "${sessionId}" not found. Create it first with web_session_create.`);
  return s;
}

async function createSession(
  sessionId: string,
  opts: SessionOptions = {},
): Promise<Session> {
  if (sessions.size >= WEB_CONFIG.maxSessions) {
    throw new Error(
      `Maximum session limit (${WEB_CONFIG.maxSessions}) reached. Close a session first.`,
    );
  }
  if (sessions.has(sessionId)) {
    throw new Error(`Session "${sessionId}" already exists.`);
  }

  const b = await ensureBrowser();

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    ignoreHTTPSErrors: opts.ignoreHttpsErrors ?? false,
  };
  if (opts.userAgent || WEB_CONFIG.defaultUserAgent) {
    contextOptions.userAgent = opts.userAgent ?? WEB_CONFIG.defaultUserAgent;
  }
  if (opts.viewport || WEB_CONFIG.defaultViewport) {
    contextOptions.viewport = opts.viewport ?? WEB_CONFIG.defaultViewport ?? null;
  }
  if (opts.extraHeaders) {
    contextOptions.extraHTTPHeaders = opts.extraHeaders;
  }
  if (opts.proxy) {
    // Proxy must be set at browser level in Chromium; we create a new browser
    // context proxy via the browser launch args. For simplicity we set it on
    // the context (supported in Playwright).
    (contextOptions as any).proxy = {
      server: opts.proxy.server,
      ...(opts.proxy.username ? { username: opts.proxy.username } : {}),
      ...(opts.proxy.password ? { password: opts.proxy.password } : {}),
    };
  }

  const context: BrowserContext = await b.newContext(contextOptions);
  const page: Page = await context.newPage();

  const session: Session = {
    id: sessionId,
    context,
    page,
    createdAt: Date.now(),
    options: opts,
    intercepting: false,
    scope: opts.scope ?? WEB_CONFIG.defaultScope,
    modifyRules: new Map(),
    routeHandler: null,
  };

  sessions.set(sessionId, session);

  // Auto-enable interception if requested
  if (opts.intercept) {
    await setupInterception(session, trafficStore);
  }

  return session;
}

async function getOrCreateSession(rawId?: string): Promise<Session> {
  const id = resolveSessionId(rawId);
  if (sessions.has(id)) return sessions.get(id)!;
  return createSession(id);
}

async function closeSession(sessionId: string): Promise<string[]> {
  const closed: string[] = [];
  if (sessionId === 'all') {
    for (const [id, session] of sessions) {
      try {
        await session.context.close();
      } catch { /* ignore */ }
      trafficStore.clearSession(id);
      closed.push(id);
    }
    sessions.clear();
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
      browser = null;
    }
  } else {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found.`);
    try {
      await session.context.close();
    } catch { /* ignore */ }
    trafficStore.clearSession(sessionId);
    sessions.delete(sessionId);
    closed.push(sessionId);
  }
  return closed;
}

function sessionInfo(session: Session): SessionInfo {
  const stats = trafficStore.getStats(session.id);
  return {
    id: session.id,
    url: session.page.url(),
    title: '', // filled asynchronously below
    intercepting: session.intercepting,
    capturedRequests: stats.count,
    createdAt: session.createdAt,
    options: session.options,
  };
}

async function sessionInfoAsync(session: Session): Promise<SessionInfo> {
  const info = sessionInfo(session);
  try {
    info.title = await session.page.title();
  } catch {
    info.title = '';
  }
  return info;
}

// ── Shutdown ──────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  for (const [id, session] of sessions) {
    try { await session.context.close(); } catch { /* */ }
    trafficStore.clearSession(id);
  }
  sessions.clear();
  if (browser) {
    try { await browser.close(); } catch { /* */ }
    browser = null;
  }
}

// ── MCP Server ────────────────────────────────────────────────────────

const server = new Server(
  { name: 'greyhatcc-web-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: WEB_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // ────────────────────────────────────────────────────────────────
      // Session Management
      // ────────────────────────────────────────────────────────────────

      case 'web_session_create': {
        const sessionId = (args.session_id as string) || randomUUID().slice(0, 8);
        const opts: SessionOptions = {};
        if (args.headless !== undefined) opts.headless = args.headless as boolean;
        if (args.user_agent) opts.userAgent = args.user_agent as string;
        if (args.viewport) opts.viewport = args.viewport as { width: number; height: number };
        if (args.extra_headers) opts.extraHeaders = args.extra_headers as Record<string, string>;
        if (args.proxy) opts.proxy = args.proxy as { server: string; username?: string; password?: string };
        if (args.scope) opts.scope = args.scope as string[];
        if (args.intercept !== undefined) opts.intercept = args.intercept as boolean;
        if (args.ignore_https_errors !== undefined) opts.ignoreHttpsErrors = args.ignore_https_errors as boolean;

        // Override global headless with session-level preference
        if (opts.headless !== undefined) {
          // Need to launch a fresh browser if headless mode differs from current
          // For simplicity, we respect the global config; per-session headless
          // would require per-session browser instances.
        }

        const session = await createSession(sessionId, opts);
        const info = await sessionInfoAsync(session);
        const result = guardOutputSize(JSON.stringify(info, null, 2));
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_session_list': {
        const infos: SessionInfo[] = [];
        for (const session of sessions.values()) {
          infos.push(await sessionInfoAsync(session));
        }
        const result = formatSessionList(infos);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_session_close': {
        const closed = await closeSession(args.session_id as string);
        const result = guardOutputSize(
          JSON.stringify({ closed, remaining: sessions.size }, null, 2),
        );
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_session_cookies': {
        const sid = resolveSessionId(args.session_id as string);
        const session = getSession(sid);

        // Clear cookies if requested
        if (args.clear) {
          await session.context.clearCookies();
        }

        // Set cookies if provided
        if (args.cookies && Array.isArray(args.cookies)) {
          const cookiesToSet = (args.cookies as any[]).map((c) => ({
            name: c.name as string,
            value: c.value as string,
            domain: c.domain as string | undefined,
            path: (c.path as string) ?? '/',
            httpOnly: c.httpOnly as boolean | undefined,
            secure: c.secure as boolean | undefined,
            sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
            expires: c.expires as number | undefined,
            url: c.domain ? undefined : session.page.url(),
          }));
          await session.context.addCookies(cookiesToSet);
          const result = guardOutputSize(
            JSON.stringify({ set: cookiesToSet.length, session_id: sid }, null, 2),
          );
          return { content: [{ type: 'text', text: result }] };
        }

        // Get cookies
        const url = args.url as string | undefined;
        const cookies = url
          ? await session.context.cookies(url)
          : await session.context.cookies();
        const result = guardOutputSize(JSON.stringify(cookies, null, 2));
        return { content: [{ type: 'text', text: result }] };
      }

      // ────────────────────────────────────────────────────────────────
      // Navigation & Interaction
      // ────────────────────────────────────────────────────────────────

      case 'web_navigate': {
        const session = await getOrCreateSession(args.session_id as string);
        const url = args.url as string;
        const waitUntil = (args.wait_until as 'load' | 'domcontentloaded' | 'networkidle' | 'commit') ?? 'load';
        const timeout = (args.timeout as number) ?? 30000;

        const response = await session.page.goto(url, { waitUntil, timeout });

        const result = {
          session_id: session.id,
          url: session.page.url(),
          title: await session.page.title(),
          status: response?.status() ?? 0,
          headers: response?.headers() ?? {},
        };
        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(result, null, 2)) }],
        };
      }

      case 'web_screenshot': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const fullPage = (args.full_page as boolean) ?? false;
        const selector = args.selector as string | undefined;
        const quality = args.quality as number | undefined;

        let screenshotBuffer: Buffer;

        if (selector) {
          const element = await session.page.locator(selector).first();
          screenshotBuffer = await element.screenshot({
            type: quality !== undefined ? 'jpeg' : 'png',
            ...(quality !== undefined ? { quality } : {}),
          });
        } else {
          screenshotBuffer = await session.page.screenshot({
            fullPage,
            type: quality !== undefined ? 'jpeg' : 'png',
            ...(quality !== undefined ? { quality } : {}),
          });
        }

        const base64 = screenshotBuffer.toString('base64');
        const mimeType = quality !== undefined ? 'image/jpeg' : 'image/png';

        return {
          content: [{ type: 'image', data: base64, mimeType }],
        };
      }

      case 'web_snapshot': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const selector = args.selector as string | undefined;
        const includeHidden = (args.include_hidden as boolean) ?? false;

        let root: any;
        if (selector) {
          const element = await session.page.locator(selector).first();
          root = await element.evaluate(`(el) => {
            function walk(node) {
              var role = node.getAttribute('role') || node.tagName.toLowerCase();
              var name =
                node.getAttribute('aria-label') ||
                node.getAttribute('alt') ||
                node.getAttribute('title') ||
                node.placeholder ||
                (node.textContent || '').trim().slice(0, 100) ||
                '';
              var children = [];
              for (var i = 0; i < node.children.length; i++) {
                children.push(walk(node.children[i]));
              }
              var result = { role: role, name: name.slice(0, 100) };
              if (children.length > 0) result.children = children;
              return result;
            }
            return walk(el);
          }`);
        } else {
          // Use Playwright's accessibility snapshot
          root = await session.page.evaluate(`(() => {
            function walk(el) {
              const role = el.getAttribute('role') || el.tagName.toLowerCase();
              const name = el.getAttribute('aria-label') || el.innerText?.slice(0, 80) || '';
              const children = Array.from(el.children).map(walk).filter(Boolean);
              const result = { role, name: name.trim() };
              if (children.length > 0) result.children = children;
              return result;
            }
            return walk(document.body);
          })()`);
        }

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(root, null, 2)) }],
        };
      }

      case 'web_click': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const selector = args.selector as string;
        const button = (args.button as 'left' | 'right' | 'middle') ?? 'left';
        const clickCount = (args.click_count as number) ?? 1;
        const timeout = (args.timeout as number) ?? 30000;

        await session.page.click(selector, { button, clickCount, timeout });

        const result = {
          clicked: selector,
          button,
          clickCount,
          url: session.page.url(),
          title: await session.page.title(),
        };
        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(result, null, 2)) }],
        };
      }

      case 'web_fill': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const selector = args.selector as string;
        const value = args.value as string;
        const timeout = (args.timeout as number) ?? 30000;

        await session.page.fill(selector, value, { timeout });

        const result = {
          filled: selector,
          value_length: value.length,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'web_evaluate': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const expression = args.expression as string;

        const evalResult = await session.page.evaluate(expression);

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(evalResult, null, 2)) }],
        };
      }

      case 'web_wait': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const selector = args.selector as string | undefined;
        const state = args.state as 'visible' | 'hidden' | 'attached' | 'detached' | undefined;
        const networkIdle = args.network_idle as boolean | undefined;
        const timeout = (args.timeout as number) ?? 30000;

        if (networkIdle) {
          await session.page.waitForLoadState('networkidle', { timeout });
        } else if (selector) {
          await session.page.waitForSelector(selector, {
            state: state ?? 'visible',
            timeout,
          });
        } else {
          throw new Error('Provide either a selector or network_idle=true.');
        }

        const result = {
          waited: networkIdle ? 'network_idle' : `selector "${selector}" state=${state ?? 'visible'}`,
          url: session.page.url(),
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      // ────────────────────────────────────────────────────────────────
      // Interception
      // ────────────────────────────────────────────────────────────────

      case 'web_intercept_enable': {
        const sid = resolveSessionId(args.session_id as string);
        const session = getSession(sid);

        if (session.intercepting) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ already_intercepting: true, session_id: sid }, null, 2) }],
          };
        }

        const interceptOpts: InterceptOptions = {};
        if (args.scope) interceptOpts.scope = args.scope as string[];
        if (args.capture_body !== undefined) interceptOpts.captureBody = args.capture_body as boolean;
        if (args.max_body_size !== undefined) interceptOpts.maxBodySize = args.max_body_size as number;

        await setupInterception(session, trafficStore, interceptOpts);

        const result = {
          session_id: sid,
          intercepting: true,
          scope: interceptOpts.scope ?? session.scope,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'web_intercept_disable': {
        const sid = resolveSessionId(args.session_id as string);
        const session = getSession(sid);

        await removeInterception(session);

        const stats = trafficStore.getStats(sid);
        const result = {
          session_id: sid,
          intercepting: false,
          captured_entries: stats.count,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'web_traffic_search': {
        const sid = resolveSessionId(args.session_id as string);
        const pattern = args.pattern as string;

        const entries = trafficStore.search(sid, {
          pattern,
          regex: args.regex as boolean | undefined,
          searchIn: args.in as 'all' | 'url' | 'request_headers' | 'request_body' | 'response_headers' | 'response_body' | undefined,
          method: args.method as string | undefined,
          statusCode: args.status_code as number | undefined,
          mimeType: args.mime_type as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

        const result = formatTrafficSearch(entries, pattern);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_traffic_get': {
        const sid = resolveSessionId(args.session_id as string);
        const entryId = args.entry_id as number;

        const entry = trafficStore.getEntry(sid, entryId);
        if (!entry) {
          throw new Error(`Traffic entry #${entryId} not found in session "${sid}".`);
        }

        const result = formatTrafficEntry(entry);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_traffic_export': {
        const sid = resolveSessionId(args.session_id as string);
        const format = (args.format as 'json' | 'curl' | 'markdown') ?? 'json';
        const filterUrl = args.filter_url as string | undefined;
        const filterMethod = args.filter_method as string | undefined;
        const limit = (args.limit as number) ?? 100;

        const entries = trafficStore.getSessionEntries(sid, {
          urlPattern: filterUrl,
          method: filterMethod,
          limit,
        });

        const result = formatTrafficExport(entries, format);
        return { content: [{ type: 'text', text: result }] };
      }

      // ────────────────────────────────────────────────────────────────
      // Manipulation
      // ────────────────────────────────────────────────────────────────

      case 'web_request_send': {
        const result = await sendRequest({
          url: args.url as string,
          method: args.method as string | undefined,
          headers: args.headers as Record<string, string> | undefined,
          body: args.body as string | undefined,
          timeout: args.timeout as number | undefined,
          followRedirects: args.follow_redirects as boolean | undefined,
          maxRedirects: args.max_redirects as number | undefined,
          ignoreTls: args.ignore_tls as boolean | undefined,
        });

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(result, null, 2)) }],
        };
      }

      case 'web_request_replay': {
        const sid = resolveSessionId(args.session_id as string);
        const entryId = args.entry_id as number;

        const entry = trafficStore.getEntry(sid, entryId);
        if (!entry) {
          throw new Error(`Traffic entry #${entryId} not found in session "${sid}".`);
        }

        const result = await replayRequest(entry, {
          url: args.url as string | undefined,
          method: args.method as string | undefined,
          headers: args.headers as Record<string, string> | undefined,
          body: args.body as string | undefined,
          removeHeaders: args.remove_headers as string[] | undefined,
        });

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(result, null, 2)) }],
        };
      }

      case 'web_request_fuzz': {
        const wordlist = args.wordlist as string[];
        if (!wordlist || wordlist.length === 0) {
          throw new Error('wordlist is required and must not be empty.');
        }

        // Resolve base entry if entry_id is provided
        let baseEntry = undefined;
        if (args.entry_id !== undefined) {
          const sid = resolveSessionId(args.session_id as string);
          baseEntry = trafficStore.getEntry(sid, args.entry_id as number);
          if (!baseEntry) {
            throw new Error(`Traffic entry #${args.entry_id} not found in session "${sid}".`);
          }
        }

        const results = await fuzzRequest({
          url: args.url as string | undefined,
          method: args.method as string | undefined,
          headers: args.headers as Record<string, string> | undefined,
          body: args.body as string | undefined,
          entry: baseEntry,
          wordlist,
          placeholder: args.placeholder as string | undefined,
          delay: args.delay as number | undefined,
          timeout: args.timeout as number | undefined,
          matchStatus: args.match_status as number[] | undefined,
          filterStatus: args.filter_status as number[] | undefined,
        });

        const result = formatFuzzResults(results);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_intercept_modify': {
        const sid = resolveSessionId(args.session_id as string);
        const session = getSession(sid);
        const action = args.action as 'add' | 'list' | 'remove' | 'clear';

        switch (action) {
          case 'add': {
            const ruleInput = args.rule as any;
            if (!ruleInput || !ruleInput.url_pattern) {
              throw new Error('rule with url_pattern is required for "add" action.');
            }

            const ruleId = (args.rule_id as string) || `rule-${randomUUID().slice(0, 6)}`;
            const rule: ModifyRule = {
              id: ruleId,
              urlPattern: ruleInput.url_pattern as string,
              modifyRequestHeaders: ruleInput.modify_request_headers as Record<string, string> | undefined,
              removeRequestHeaders: ruleInput.remove_request_headers as string[] | undefined,
              modifyRequestBody: ruleInput.modify_request_body as string | undefined,
              modifyResponseHeaders: ruleInput.modify_response_headers as Record<string, string> | undefined,
              removeResponseHeaders: ruleInput.remove_response_headers as string[] | undefined,
            };
            session.modifyRules.set(ruleId, rule);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ action: 'added', rule_id: ruleId, rule }, null, 2),
              }],
            };
          }

          case 'list': {
            const rules: ModifyRule[] = [];
            for (const rule of session.modifyRules.values()) {
              rules.push(rule);
            }
            return {
              content: [{
                type: 'text',
                text: guardOutputSize(JSON.stringify({ session_id: sid, rules, count: rules.length }, null, 2)),
              }],
            };
          }

          case 'remove': {
            const ruleId = args.rule_id as string;
            if (!ruleId) throw new Error('rule_id is required for "remove" action.');
            const existed = session.modifyRules.delete(ruleId);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ action: 'removed', rule_id: ruleId, existed }, null, 2),
              }],
            };
          }

          case 'clear': {
            const count = session.modifyRules.size;
            session.modifyRules.clear();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ action: 'cleared', removed: count, session_id: sid }, null, 2),
              }],
            };
          }

          default:
            throw new Error(`Unknown intercept_modify action: "${action}". Use add, list, remove, or clear.`);
        }
      }

      // ────────────────────────────────────────────────────────────────
      // Analysis
      // ────────────────────────────────────────────────────────────────

      case 'web_forms_extract': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);

        const forms: any[] = await session.page.evaluate(`(() => {
          var formElements = document.querySelectorAll('form');
          var results = [];
          formElements.forEach(function(form, formIndex) {
            var fields = [];
            var inputs = form.querySelectorAll('input, select, textarea, button');
            inputs.forEach(function(el) {
              var fieldInfo = {
                tag: el.tagName.toLowerCase(),
                name: el.getAttribute('name') || '',
                type: el.getAttribute('type') || (el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : 'text'),
                value: el.value || el.getAttribute('value') || '',
                required: el.hasAttribute('required'),
                disabled: el.hasAttribute('disabled'),
              };
              if (el.getAttribute('id')) fieldInfo.id = el.getAttribute('id');
              if (el.getAttribute('placeholder')) fieldInfo.placeholder = el.getAttribute('placeholder');
              if (el.getAttribute('pattern')) fieldInfo.pattern = el.getAttribute('pattern');
              if (el.getAttribute('maxlength')) fieldInfo.maxlength = el.getAttribute('maxlength');
              if (el.getAttribute('autocomplete')) fieldInfo.autocomplete = el.getAttribute('autocomplete');
              if (fieldInfo.type === 'hidden') fieldInfo._hidden = true;
              if (el.tagName === 'SELECT') {
                var options = [];
                el.querySelectorAll('option').forEach(function(opt) {
                  options.push(opt.value + '=' + (opt.textContent || '').trim());
                });
                fieldInfo.options = options;
              }
              fields.push(fieldInfo);
            });
            results.push({
              index: formIndex,
              id: form.getAttribute('id') || null,
              name: form.getAttribute('name') || null,
              action: form.getAttribute('action') || null,
              method: (form.getAttribute('method') || 'GET').toUpperCase(),
              enctype: form.getAttribute('enctype') || 'application/x-www-form-urlencoded',
              target: form.getAttribute('target') || null,
              novalidate: form.hasAttribute('novalidate'),
              fields: fields,
              hiddenFieldCount: fields.filter(function(f) { return f._hidden; }).length,
              totalFields: fields.length,
            });
          });
          return results;
        })()`);

        const result = formatFormData(forms);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_links_extract': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const includeExternal = (args.include_external as boolean) ?? false;

        const linksScript = `((includeExt) => {
          var pageHost = new URL(window.location.href).hostname;
          function isExternal(href) {
            try { return new URL(href, window.location.href).hostname !== pageHost; }
            catch(e) { return false; }
          }
          function resolveHref(href) {
            try { return new URL(href, window.location.href).href; }
            catch(e) { return href; }
          }
          var anchors = [];
          document.querySelectorAll('a[href]').forEach(function(el) {
            var href = el.getAttribute('href') || '';
            if (href.startsWith('javascript:') || href === '#' || href === '') return;
            var resolved = resolveHref(href);
            var external = isExternal(href);
            if (!includeExt && external) return;
            anchors.push({ href: resolved, text: (el.textContent || '').trim().slice(0, 100), external: external });
          });
          var formActions = [];
          document.querySelectorAll('form[action]').forEach(function(el) {
            var action = el.getAttribute('action') || '';
            if (!action) return;
            formActions.push({ href: resolveHref(action), method: (el.getAttribute('method') || 'GET').toUpperCase() });
          });
          var scriptSrcs = [];
          document.querySelectorAll('script[src]').forEach(function(el) {
            var src = el.getAttribute('src');
            if (src) scriptSrcs.push(resolveHref(src));
          });
          var stylesheets = [];
          document.querySelectorAll('link[href]').forEach(function(el) {
            var href = el.getAttribute('href');
            if (href) stylesheets.push(resolveHref(href));
          });
          var iframes = [];
          document.querySelectorAll('iframe[src]').forEach(function(el) {
            var src = el.getAttribute('src');
            if (src) iframes.push(resolveHref(src));
          });
          return {
            anchors: anchors, form_actions: formActions, script_sources: scriptSrcs,
            stylesheets: stylesheets, iframes: iframes,
            summary: {
              total_anchors: anchors.length,
              internal: anchors.filter(function(a) { return !a.external; }).length,
              external: anchors.filter(function(a) { return a.external; }).length,
              forms: formActions.length, scripts: scriptSrcs.length,
              stylesheets: stylesheets.length, iframes: iframes.length,
            },
          };
        })(${JSON.stringify(includeExternal)})`;

        const links: any = await session.page.evaluate(linksScript);

        const result = formatLinks(links);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'web_js_extract': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);
        const includeInline = (args.include_inline as boolean) ?? true;
        const maxInlineLength = (args.max_inline_length as number) ?? 10000;

        const jsScript = `((opts) => {
          var externalScripts = [];
          var inlineScripts = [];
          document.querySelectorAll('script').forEach(function(el, index) {
            var src = el.getAttribute('src');
            if (src) {
              var resolvedSrc;
              try { resolvedSrc = new URL(src, window.location.href).href; }
              catch(e) { resolvedSrc = src; }
              var info = {
                index: index, src: resolvedSrc,
                type: el.getAttribute('type') || 'text/javascript',
                async: el.hasAttribute('async'), defer: el.hasAttribute('defer'),
                crossorigin: el.getAttribute('crossorigin') || null,
                integrity: el.getAttribute('integrity') || null,
              };
              if (resolvedSrc.endsWith('.js')) info.potential_sourcemap = resolvedSrc + '.map';
              externalScripts.push(info);
            } else if (opts.includeInline) {
              var content = el.textContent || '';
              if (content.trim().length === 0) return;
              var truncated = content.length > opts.maxInlineLength;
              inlineScripts.push({
                index: index,
                type: el.getAttribute('type') || 'text/javascript',
                length: content.length,
                content: truncated ? content.slice(0, opts.maxInlineLength) : content,
                truncated: truncated,
                hints: {
                  has_api_key: /api[_\\-]?key|apikey|api_secret/i.test(content),
                  has_token: /token|bearer|jwt|auth/i.test(content),
                  has_url: /https?:\\/\\/[^\\s"']+/i.test(content),
                  has_endpoint: /\\/api\\/|\\/v[0-9]+\\//i.test(content),
                  has_s3: /s3[.\\-]|\\.amazonaws\\.com/i.test(content),
                  has_config: /__config__|window\\.\\w+\\s*=\\s*\\{/i.test(content),
                },
              });
            }
          });
          return {
            external: externalScripts, inline: inlineScripts,
            summary: {
              external_count: externalScripts.length,
              inline_count: inlineScripts.length,
              total_inline_bytes: inlineScripts.reduce(function(sum, s) { return sum + s.length; }, 0),
            },
          };
        })(${JSON.stringify({ includeInline, maxInlineLength })})`;

        const scripts: any = await session.page.evaluate(jsScript);

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(scripts, null, 2)) }],
        };
      }

      case 'web_storage_dump': {
        const sid = resolveSessionId(args.session_id as string);
        const session = await getOrCreateSession(sid);

        const storage: any = await session.page.evaluate(`(() => {
          var localStorageData = {};
          try {
            for (var i = 0; i < localStorage.length; i++) {
              var key = localStorage.key(i);
              if (key) localStorageData[key] = localStorage.getItem(key) || '';
            }
          } catch(e) {}
          var sessionStorageData = {};
          try {
            for (var i = 0; i < sessionStorage.length; i++) {
              var key = sessionStorage.key(i);
              if (key) sessionStorageData[key] = sessionStorage.getItem(key) || '';
            }
          } catch(e) {}
          var cookies = document.cookie;
          var cookieParsed = {};
          if (cookies) {
            cookies.split(';').forEach(function(pair) {
              var parts = pair.trim().split('=');
              var name = parts.shift();
              if (name) cookieParsed[name.trim()] = parts.join('=');
            });
          }
          function analyzeValue(value) {
            var flags = [];
            if (/^eyJ[A-Za-z0-9_-]+\\.eyJ/.test(value)) flags.push('JWT');
            if (/^[0-9a-f]{32,}$/i.test(value)) flags.push('hex_token');
            if (/bearer\\s+/i.test(value)) flags.push('bearer_token');
            if (/"password"|"passwd"|"secret"/i.test(value)) flags.push('possible_credential');
            try {
              var trimmed = value.trim();
              if (/^\\{.*\\}$/.test(trimmed) || /^\\[.*\\]$/.test(trimmed)) flags.push('json_data');
            } catch(e) {}
            return flags;
          }
          var analysis = {};
          var entries, k, v, fl;
          entries = Object.entries(localStorageData);
          for (var i = 0; i < entries.length; i++) {
            k = entries[i][0]; v = entries[i][1]; fl = analyzeValue(v);
            if (fl.length > 0) analysis['localStorage.' + k] = fl;
          }
          entries = Object.entries(sessionStorageData);
          for (var i = 0; i < entries.length; i++) {
            k = entries[i][0]; v = entries[i][1]; fl = analyzeValue(v);
            if (fl.length > 0) analysis['sessionStorage.' + k] = fl;
          }
          entries = Object.entries(cookieParsed);
          for (var i = 0; i < entries.length; i++) {
            k = entries[i][0]; v = entries[i][1]; fl = analyzeValue(v);
            if (fl.length > 0) analysis['cookie.' + k] = fl;
          }
          return {
            localStorage: { entries: localStorageData, count: Object.keys(localStorageData).length },
            sessionStorage: { entries: sessionStorageData, count: Object.keys(sessionStorageData).length },
            cookies: { raw: cookies, parsed: cookieParsed, count: Object.keys(cookieParsed).length },
            analysis: Object.keys(analysis).length > 0 ? analysis : null,
            summary: {
              localStorage_keys: Object.keys(localStorageData).length,
              sessionStorage_keys: Object.keys(sessionStorageData).length,
              cookie_count: Object.keys(cookieParsed).length,
              interesting_findings: Object.keys(analysis).length,
            },
          };
        })()`);

        return {
          content: [{ type: 'text', text: guardOutputSize(JSON.stringify(storage, null, 2)) }],
        };
      }

      // ────────────────────────────────────────────────────────────────
      // Unknown tool
      // ────────────────────────────────────────────────────────────────

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Process Cleanup ───────────────────────────────────────────────────

process.on('SIGTERM', () => {
  shutdown().catch(() => {});
});

process.on('SIGINT', () => {
  shutdown().catch(() => {});
});

process.on('exit', () => {
  // Best-effort synchronous cleanup — close contexts if possible
  for (const session of sessions.values()) {
    try {
      session.context.close();
    } catch { /* sync context — may not work */ }
  }
});

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
