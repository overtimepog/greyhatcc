export const WEB_TOOLS = [
  // ── Session Management ───────────────────────────────────────────
  {
    name: 'web_session_create',
    description: 'Create a new isolated browser session (Playwright context). Each session has its own cookies, storage, and network state — like opening a fresh browser profile. Use multiple sessions to test cross-user interactions (attacker vs victim), compare authenticated vs unauthenticated views, or isolate scope during multi-target engagements. Equivalent to opening a new Burp project or browser profile.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Custom session identifier. Auto-generated if omitted. Use descriptive names like "attacker", "victim", "admin" for multi-session testing.' },
        headless: { type: 'boolean', description: 'Run browser in headless mode (default: true). Set false to watch interactions visually for debugging.' },
        user_agent: { type: 'string', description: 'Custom User-Agent string. Useful for fingerprint evasion, mobile app simulation, or testing UA-based access controls.' },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Viewport width in pixels' },
            height: { type: 'number', description: 'Viewport height in pixels' },
          },
          description: 'Browser viewport dimensions. Use mobile sizes (375x812) to test responsive endpoints or mobile-only features.',
        },
        extra_headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Headers injected into every request from this session. Useful for auth tokens (Authorization: Bearer ...), custom API keys, or X-Forwarded-For spoofing.',
        },
        proxy: {
          type: 'object',
          properties: {
            server: { type: 'string', description: 'Proxy URL (e.g. http://127.0.0.1:8080 for Burp, socks5://proxy:1080)' },
            username: { type: 'string', description: 'Proxy authentication username' },
            password: { type: 'string', description: 'Proxy authentication password' },
          },
          description: 'Route session traffic through a proxy. Chain with Burp Suite for manual inspection, or use residential proxies for IP rotation.',
        },
        scope: {
          type: 'array',
          items: { type: 'string' },
          description: 'URL patterns to restrict traffic capture to (e.g. ["*://target.com/*"]). Only matching requests are logged. Keeps traffic clean during testing.',
        },
        intercept: { type: 'boolean', description: 'Enable request interception from session start. Allows modifying requests/responses in-flight via web_intercept_modify rules.' },
        ignore_https_errors: { type: 'boolean', description: 'Ignore TLS certificate errors (self-signed, expired, mismatched). Essential for testing staging environments and internal targets.' },
      },
      required: [],
    },
  },
  {
    name: 'web_session_list',
    description: 'List all active browser sessions with their configuration, page count, and traffic statistics. Use to audit session state during complex multi-session testing scenarios or before cleanup.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'web_session_close',
    description: 'Close and destroy a browser session, releasing all resources. Pass "all" to tear down every session. Always clean up after testing to free memory and prevent stale state from contaminating subsequent tests.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to close. Use "all" to close every active session.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'web_session_cookies',
    description: 'Get or set cookies for a browser session. Retrieve all cookies to inspect authentication tokens, session IDs, CSRF tokens, and tracking cookies. Set cookies to inject stolen session tokens, test cookie-based access controls, or replay authenticated sessions without re-logging in. Equivalent to Burp\'s cookie jar management.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Target session. Uses default session if omitted.' },
        cookies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Cookie name' },
              value: { type: 'string', description: 'Cookie value' },
              domain: { type: 'string', description: 'Cookie domain scope' },
              path: { type: 'string', description: 'Cookie path scope' },
              httpOnly: { type: 'boolean', description: 'HttpOnly flag' },
              secure: { type: 'boolean', description: 'Secure flag' },
              sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'], description: 'SameSite attribute' },
              expires: { type: 'number', description: 'Expiry as Unix timestamp' },
            },
          },
          description: 'Cookies to set. Omit to retrieve current cookies instead.',
        },
        url: { type: 'string', description: 'URL context for getting cookies. Filters returned cookies to those matching the URL domain/path.' },
        clear: { type: 'boolean', description: 'Clear all cookies before setting new ones. Useful for testing unauthenticated behavior or resetting session state.' },
      },
      required: [],
    },
  },

  // ── Navigation & Interaction ─────────────────────────────────────
  {
    name: 'web_navigate',
    description: 'Navigate the browser to a URL. This is your primary tool for loading pages, following links, and testing endpoints. Supports full page lifecycle control — wait for DOM, network idle, or just the initial commit. Captures the final URL (after redirects), status code, and response headers. Use with web_snapshot or web_screenshot to inspect results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to navigate to. Supports http://, https://, and data: URIs.' },
        session_id: { type: 'string', description: 'Session to use. Uses default session if omitted.' },
        wait_until: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle', 'commit'], description: 'When to consider navigation complete. "networkidle" waits for no network activity for 500ms — best for SPAs. "commit" returns as soon as the server responds — fastest for recon.' },
        timeout: { type: 'number', description: 'Navigation timeout in milliseconds (default: 30000). Increase for slow targets or reduce for rapid scanning.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_screenshot',
    description: 'Capture a screenshot of the current page or a specific element. Returns a base64-encoded PNG image. Essential for visual verification of XSS payloads, UI redress attacks, documenting admin panel access, and creating PoC evidence for bug bounty reports. Use full_page for complete page capture or selector for targeted element screenshots.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to capture. Uses default session if omitted.' },
        full_page: { type: 'boolean', description: 'Capture the entire scrollable page, not just the viewport (default: false).' },
        selector: { type: 'string', description: 'CSS selector to screenshot a specific element instead of the full viewport.' },
        quality: { type: 'number', description: 'JPEG quality 0-100. Only applies if format is JPEG. Lower quality = smaller output for faster transfer.' },
      },
      required: [],
    },
  },
  {
    name: 'web_snapshot',
    description: 'Get the accessibility tree (AX tree) of the current page — a structured, text-based representation of all interactive elements, their roles, names, and states. Far more useful than raw HTML for understanding page structure, finding hidden form fields, identifying clickable elements behind overlays, and discovering elements invisible to visual inspection. This is the preferred way to understand page content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to snapshot. Uses default session if omitted.' },
        selector: { type: 'string', description: 'CSS selector to scope the snapshot to a subtree of the page.' },
        include_hidden: { type: 'boolean', description: 'Include hidden/aria-hidden elements in the tree. Useful for finding hidden inputs, debug panels, and admin-only UI.' },
      },
      required: [],
    },
  },
  {
    name: 'web_click',
    description: 'Click an element on the page by CSS selector. Supports left/right/middle click and double-click. Waits for the element to be actionable (visible, enabled, stable) before clicking. Use for navigating multi-step flows, submitting forms, triggering JavaScript event handlers, and interacting with SPAs. Right-click can reveal context menus with hidden options.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element to click.' },
        session_id: { type: 'string', description: 'Session to use. Uses default session if omitted.' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button to click (default: left).' },
        click_count: { type: 'number', description: 'Number of clicks (2 for double-click). Double-click can trigger different event handlers.' },
        timeout: { type: 'number', description: 'Timeout in milliseconds to wait for element to be clickable (default: 30000).' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'web_fill',
    description: 'Fill a form input field with a value. Clears existing content first, then types the new value triggering all input/change events. Use for login forms, search fields, registration flows, and injecting payloads into input fields. For testing XSS, SQLi, and other injection vectors through the actual browser DOM — triggers the same validation as real user input.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input/textarea element.' },
        value: { type: 'string', description: 'Value to fill into the field. Supports any string including XSS payloads, SQL injection strings, etc.' },
        session_id: { type: 'string', description: 'Session to use. Uses default session if omitted.' },
        timeout: { type: 'number', description: 'Timeout in milliseconds to wait for element (default: 30000).' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'web_evaluate',
    description: 'Execute arbitrary JavaScript in the page context and return the result. The most powerful interaction tool — access the DOM, call application functions, read JavaScript variables, modify client-side state, extract data from SPAs, bypass client-side validation, trigger hidden API calls, and test DOM-based XSS. Equivalent to the browser DevTools console. Expression result is serialized and returned.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        expression: { type: 'string', description: 'JavaScript expression or statement to evaluate in the page context. The return value of the last expression is captured.' },
        session_id: { type: 'string', description: 'Session to use. Uses default session if omitted.' },
      },
      required: ['expression'],
    },
  },
  {
    name: 'web_wait',
    description: 'Wait for a specific condition before proceeding — element visibility, element removal, or network idle. Essential for testing SPAs and JavaScript-heavy applications where content loads asynchronously. Use network_idle to wait for all AJAX/fetch calls to complete, or selector-based waits to synchronize with dynamic UI updates.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to use. Uses default session if omitted.' },
        selector: { type: 'string', description: 'CSS selector to wait for. Combine with state to control the expected condition.' },
        state: { type: 'string', enum: ['visible', 'hidden', 'attached', 'detached'], description: 'Expected element state: "visible" (rendered and not hidden), "hidden" (not visible), "attached" (in DOM), "detached" (removed from DOM).' },
        network_idle: { type: 'boolean', description: 'Wait until no network requests for 500ms. Best for waiting on SPA data loading.' },
        timeout: { type: 'number', description: 'Maximum wait time in milliseconds (default: 30000). Fails if condition not met within timeout.' },
      },
      required: [],
    },
  },

  // ── Request Interception / Burp Proxy ────────────────────────────
  {
    name: 'web_intercept_enable',
    description: 'Start capturing all HTTP/HTTPS traffic flowing through the browser session. Functions as a built-in Burp Suite Proxy — every request and response is logged with full headers, bodies, timing, and metadata. Use scope patterns to filter to target domains only. Once enabled, use web_traffic_search to find interesting requests, web_traffic_get to inspect details, and web_traffic_export to extract data for analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to enable interception on. Uses default session if omitted.' },
        scope: {
          type: 'array',
          items: { type: 'string' },
          description: 'URL patterns to capture (e.g. ["*://api.target.com/*", "*://target.com/api/*"]). Only matching requests are logged. Omit to capture everything.',
        },
        capture_body: { type: 'boolean', description: 'Capture request and response bodies (default: true). Disable for high-traffic targets to save memory.' },
        max_body_size: { type: 'number', description: 'Maximum body size in bytes to capture per request/response (default: 1MB). Prevents memory exhaustion from large file downloads.' },
      },
      required: [],
    },
  },
  {
    name: 'web_intercept_disable',
    description: 'Stop capturing traffic on a session. Existing captured traffic is preserved and remains searchable. Use when you have enough data or need to reduce overhead for performance-sensitive interactions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to disable interception on. Uses default session if omitted.' },
      },
      required: [],
    },
  },
  {
    name: 'web_traffic_search',
    description: 'Search captured HTTP traffic by pattern — the equivalent of Burp Suite\'s HTTP History search. Find API endpoints, tokens in headers, secrets in responses, sensitive data in request bodies, and interesting parameters. Search across URLs, headers, and bodies simultaneously or target specific locations. Supports both literal string and regex matching. Essential for post-navigation reconnaissance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to search. Uses default session if omitted.' },
        pattern: { type: 'string', description: 'Search pattern. Matches against the selected scope (url, headers, body, or all). Examples: "api/v1", "Bearer ", "password", "token", "SELECT.*FROM".' },
        regex: { type: 'boolean', description: 'Treat pattern as a regular expression (default: false). Enables complex matching like "api_key[=:]\\s*[a-zA-Z0-9]{32}".' },
        in: { type: 'string', enum: ['all', 'url', 'request_headers', 'request_body', 'response_headers', 'response_body'], description: 'Where to search (default: "all"). Narrow scope for faster, more precise results.' },
        method: { type: 'string', description: 'Filter by HTTP method (GET, POST, PUT, DELETE, etc.).' },
        status_code: { type: 'number', description: 'Filter by response status code (e.g. 200, 302, 403, 500).' },
        mime_type: { type: 'string', description: 'Filter by response MIME type (e.g. "application/json", "text/html").' },
        limit: { type: 'number', description: 'Maximum number of results to return (default: 50).' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'web_traffic_get',
    description: 'Get the full details of a specific captured traffic entry by its ID — complete request and response including headers, body, timing, and TLS info. Equivalent to clicking a request in Burp\'s HTTP History to view its full contents. Use after web_traffic_search to drill into interesting entries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session the entry belongs to. Uses default session if omitted.' },
        entry_id: { type: 'number', description: 'Traffic entry ID as returned by web_traffic_search.' },
      },
      required: ['entry_id'],
    },
  },
  {
    name: 'web_traffic_export',
    description: 'Export captured traffic in various formats for external analysis or documentation. JSON format for scripting and tool import, curl format for replaying requests from the command line, and markdown format for inclusion in pentest reports and bug bounty submissions. Equivalent to Burp\'s "Save Items" / "Copy as curl command" functionality.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to export from. Uses default session if omitted.' },
        format: { type: 'string', enum: ['json', 'curl', 'markdown'], description: 'Export format. "json" for programmatic use, "curl" for CLI replay, "markdown" for reports (default: "json").' },
        filter_url: { type: 'string', description: 'Filter exported entries by URL substring (e.g. "/api/" to export only API calls).' },
        filter_method: { type: 'string', description: 'Filter by HTTP method (e.g. "POST" to export only POST requests).' },
        limit: { type: 'number', description: 'Maximum entries to export (default: 100).' },
      },
      required: [],
    },
  },

  // ── Request Manipulation / Burp Repeater + Intruder ──────────────
  {
    name: 'web_request_send',
    description: 'Send a raw HTTP request outside the browser context — equivalent to Burp Suite Repeater. Craft requests with full control over method, headers, and body. No browser overhead, no JavaScript execution, no cookie jar — just a pure HTTP client. Ideal for testing API endpoints directly, sending malformed requests, testing HTTP method override, header injection, and verifying server-side behavior without client-side interference. Supports following redirects and TLS error bypass.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Target URL for the request.' },
        method: { type: 'string', description: 'HTTP method (default: "GET"). Use PUT, PATCH, DELETE, OPTIONS, TRACE, etc. to test method-based access controls.' },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Request headers as key-value pairs. Set Content-Type, Authorization, custom headers, etc.',
        },
        body: { type: 'string', description: 'Request body. Send JSON, XML, form-urlencoded, or raw data.' },
        timeout: { type: 'number', description: 'Request timeout in milliseconds (default: 30000).' },
        follow_redirects: { type: 'boolean', description: 'Follow HTTP redirects (default: true). Disable to inspect redirect responses and Location headers directly.' },
        max_redirects: { type: 'number', description: 'Maximum number of redirects to follow (default: 10). Prevent infinite redirect loops.' },
        ignore_tls: { type: 'boolean', description: 'Ignore TLS certificate errors (default: false). Required for self-signed certs, staging environments, and MITM testing.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_request_replay',
    description: 'Replay a previously captured request with optional modifications — the core Burp Repeater workflow. Grab a request from traffic history by entry_id, then override its URL, method, headers, or body to test variations. Use for parameter tampering, privilege escalation testing (swap auth tokens), IDOR testing (change IDs), and method-based bypass attempts. Remove headers with remove_headers to test for missing authentication or authorization.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session containing the original request. Uses default session if omitted.' },
        entry_id: { type: 'number', description: 'Traffic entry ID of the request to replay (from web_traffic_search).' },
        url: { type: 'string', description: 'Override the original URL. Useful for testing the same request against different endpoints or API versions.' },
        method: { type: 'string', description: 'Override the HTTP method. Test GET vs POST, PUT vs PATCH, or try OPTIONS/TRACE.' },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Headers to add or replace in the original request. Original headers not listed here are preserved.',
        },
        body: { type: 'string', description: 'Override the request body. Modify parameters, inject payloads, or change data formats.' },
        remove_headers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Header names to remove from the original request. Remove Authorization to test unauthenticated access, remove CSRF tokens, or strip rate-limit identifiers.',
        },
      },
      required: ['entry_id'],
    },
  },
  {
    name: 'web_request_fuzz',
    description: 'Fuzz a parameter with a wordlist — equivalent to Burp Suite Intruder\'s Sniper mode. Place a FUZZ placeholder in the URL, headers, or body, then supply a wordlist. Each word replaces the placeholder and fires a request. Results include status codes, response sizes, and timing for anomaly detection. Use for directory brute-forcing, parameter discovery, credential stuffing, payload injection testing, and IDOR enumeration. Match/filter by status code to isolate interesting responses.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session for context (cookies, headers). Uses default if omitted. Set to use session auth state.' },
        entry_id: { type: 'number', description: 'Base request from traffic history. If provided, url/method/headers/body override that request. If omitted, url is required.' },
        url: { type: 'string', description: 'Target URL. Place FUZZ where the wordlist should be substituted (e.g. "https://target.com/api/users/FUZZ/profile").' },
        method: { type: 'string', description: 'HTTP method (default: "GET").' },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Request headers. FUZZ placeholder can appear in header values too (e.g. {"Authorization": "Bearer FUZZ"}).',
        },
        body: { type: 'string', description: 'Request body. FUZZ placeholder can appear here for body parameter fuzzing (e.g. {"user_id": "FUZZ"}).' },
        wordlist: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of values to substitute for FUZZ. Maximum 500 entries per invocation. For larger lists, batch across multiple calls.',
        },
        placeholder: { type: 'string', description: 'Placeholder token to replace (default: "FUZZ"). Change if your payload naturally contains "FUZZ".' },
        delay: { type: 'number', description: 'Delay between requests in milliseconds (default: 0). Add delay to avoid rate limiting or reduce target load.' },
        timeout: { type: 'number', description: 'Per-request timeout in milliseconds (default: 10000).' },
        match_status: {
          type: 'array',
          items: { type: 'number' },
          description: 'Only include results matching these status codes (e.g. [200, 301, 403]). Filters noise from 404s.',
        },
        filter_status: {
          type: 'array',
          items: { type: 'number' },
          description: 'Exclude results with these status codes (e.g. [404, 429]). Inverse of match_status.',
        },
      },
      required: ['wordlist'],
    },
  },
  {
    name: 'web_intercept_modify',
    description: 'Set up automatic request/response modification rules — equivalent to Burp Suite\'s Match and Replace. Rules are applied in-flight to all matching traffic. Add headers (inject auth tokens, CORS headers), remove headers (strip security headers to test impact), rewrite request bodies (parameter tampering at scale), and modify responses (inject XSS payloads, remove CSP headers). Rules persist until removed or session closes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to apply rules to. Uses default session if omitted.' },
        action: { type: 'string', enum: ['add', 'list', 'remove', 'clear'], description: 'Rule management action. "add" creates a new rule, "list" shows active rules, "remove" deletes a rule by ID, "clear" removes all rules.' },
        rule_id: { type: 'string', description: 'Rule identifier. Required for "remove" action. Auto-generated on "add" if omitted.' },
        rule: {
          type: 'object',
          properties: {
            url_pattern: { type: 'string', description: 'URL pattern to match (glob syntax). Only requests matching this pattern are modified.' },
            modify_request_headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Headers to add/replace on matching requests.',
            },
            remove_request_headers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Header names to remove from matching requests.',
            },
            modify_request_body: { type: 'string', description: 'Replace the entire request body on matching requests.' },
            modify_response_headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Headers to add/replace on matching responses. Inject CORS headers, remove CSP, etc.',
            },
            remove_response_headers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Header names to remove from matching responses (e.g. ["Content-Security-Policy", "X-Frame-Options"] to enable clickjacking/XSS testing).',
            },
          },
          description: 'Modification rule definition. Required when action is "add".',
        },
      },
      required: ['action'],
    },
  },

  // ── Analysis ─────────────────────────────────────────────────────
  {
    name: 'web_forms_extract',
    description: 'Extract all HTML forms from the current page with their action URLs, methods, input fields (including hidden fields), and default values. Reveals CSRF tokens in hidden inputs, identifies file upload endpoints, maps multi-step form flows, and discovers API endpoints used by form submissions. Hidden inputs often contain user IDs (IDOR), internal paths, debug flags, and price/quantity values ripe for tampering.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to extract forms from. Uses default session if omitted.' },
      },
      required: [],
    },
  },
  {
    name: 'web_links_extract',
    description: 'Extract all links (anchor hrefs) from the current page. Discovers internal navigation paths, API endpoints linked in JavaScript, admin panel paths, external service integrations, and forgotten debug/staging links. Builds a site map for further crawling and attack surface analysis. Filter to internal-only or include external links to map third-party integrations and potential SSRF targets.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to extract links from. Uses default session if omitted.' },
        include_external: { type: 'boolean', description: 'Include links to external domains (default: false). Enable to discover third-party integrations, CDN endpoints, and potential SSRF targets.' },
      },
      required: [],
    },
  },
  {
    name: 'web_js_extract',
    description: 'Extract all JavaScript sources from the current page — both external script URLs and inline script contents. JavaScript analysis is one of the highest-value recon activities: scripts contain API endpoints, hardcoded secrets (API keys, tokens), internal service URLs, S3 bucket names, debug flags, WebSocket endpoints, and complete client-side business logic. Look for .map files (source maps) that reconstruct original source code. Inline scripts often contain user-specific data, CSRF tokens, and application configuration.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to extract scripts from. Uses default session if omitted.' },
        include_inline: { type: 'boolean', description: 'Include inline <script> tag contents (default: true). Inline scripts often contain embedded config, user data, and CSRF tokens.' },
        max_inline_length: { type: 'number', description: 'Maximum character length for captured inline scripts (default: 10000). Prevents huge inline bundles from flooding output.' },
      },
      required: [],
    },
  },
  {
    name: 'web_storage_dump',
    description: 'Dump all client-side storage: localStorage, sessionStorage, and cookies. Client-side storage frequently contains authentication tokens (JWTs in localStorage is a classic finding), user PII, cached API responses, application state, feature flags, and debug information. JWTs in localStorage are vulnerable to XSS-based theft — a common bug bounty finding.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'Session to dump storage from. Uses default session if omitted.' },
      },
      required: [],
    },
  },
];
