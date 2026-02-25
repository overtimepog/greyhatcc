# Test Module -- Hunt Loop Vulnerability Testing

You are executing a `type: "test"` work item within the hunt loop. Your job is to probe a specific target for a specific vulnerability class, confirm or deny the vulnerability, and emit findings, signals, and gadgets.

## Output Contract

Every test work item MUST return a `WorkItemResult`:

```json
{
  "success": true,
  "summary": "One-line summary of test result",
  "new_surfaces": [],
  "signals": [],
  "findings": [],
  "gadgets": [],
  "new_work_items": [],
  "raw_output": "",
  "tokens_used": 0,
  "duration_ms": 0
}
```

- `findings` -- only for confirmed or high-confidence vulnerabilities. Include PoC in `proof_of_concept`, set `confidence` accurately.
- `gadgets` -- for any reusable exploit primitive, even if the finding alone is low/informational. A self-XSS alone is not reportable, but as a gadget it chains with CSRF for ATO.
- `signals` -- for anomalous behavior that needs deeper investigation or correlation.
- `new_work_items` -- for deeper testing, chain exploitation, or WAF evasion retries.

## Default Tier

Test items default to **sonnet**. Exceptions:
- **haiku**: owasp-quick, cors-test, open-redirect (deterministic checks, low reasoning)
- **opus**: business-logic, cache-poisoning, auth-test on complex OAuth/SAML flows (high reasoning)

## WAF Evasion Protocol

If ANY test receives a WAF block (403 with WAF signature, challenge page, CAPTCHA), do NOT immediately give up:

1. Emit signal `{ type: "waf-blocked", target, confidence: 0.9, description: "WAF product: {product}, blocked on: {payload}" }`.
2. Spawn a new work item with escalated evasion: `{ type: "test", subtype: "<same>", target, context: { evasion_level: current + 1 }, priority: current_priority - 5 }`.
3. Evasion ladder (from work item context `evasion_level`):
   - 0: Normal requests (default)
   - 1: Header rotation (X-Forwarded-For, X-Client-IP, True-Client-IP)
   - 2: Encoding tricks (double URL encode, Unicode fullwidth, mixed case + SQL comments)
   - 3: Content-type switching (JSON <-> multipart/form-data <-> XML)
   - 4: Playwright browser automation (real browser fingerprint)
   - 5: HTTP Parameter Pollution (duplicate params)
   - 6: Body padding past inspection limit (8KB+ padding before payload)
   - 7: HTTP/2 techniques (if supported)
   - 8: STOP -- emit `"waf-hardened"` signal, mark target as WAF-blocked in tested tracker
4. Do NOT escalate beyond level 8. Mark the target in tested.json with `result: "waf_blocked"`.

---

## Subtype: owasp-quick

**Purpose**: Fast sweep of OWASP Top 10 basics against a single target. This is the "first pass" test.

**Tools**: `web_request_send`, `header_analysis`, `cors_check`, `redirect_chain`, `WebFetch`

**What to Test**:
1. **Injection probes**: Send benign probe payloads in all discovered parameters:
   - SQLi canaries: `'`, `"`, `' OR 1=1--`, `1; SELECT 1`, `{{7*7}}` (SSTI), `${7*7}` (template)
   - Check response for: SQL errors, template evaluation (49), stack traces, changed behavior
2. **Broken auth**: Check for session tokens in URL, predictable session IDs, missing auth on admin paths
3. **Sensitive data exposure**: Check for `robots.txt`, `sitemap.xml`, `.env`, `.git/HEAD`, `/.well-known/`, `/server-status`, `/server-info`
4. **Security misconfig**: Missing security headers (via `header_analysis`), directory listing, default error pages with version info
5. **XSS reflection**: Send `"><script>` and `javascript:` in parameters, check if reflected unescaped
6. **CORS** (via `cors_check`): Check if arbitrary origins are reflected with credentials
7. **Redirects** (via `redirect_chain`): Check for open redirects in `redirect`, `url`, `next`, `return`, `goto`, `dest` parameters

**Output Mapping**:
- Confirmed injection -> `finding` with severity based on injection type (SQLi=critical, SSTI=critical, XSS=medium-high)
- Reflected input without execution -> `signal` ("reflected-input") + `gadget` with `provides: ["input_reflection"]`
- Exposed file (.env, .git) -> `finding` (severity depends on content)
- Missing headers -> `signal` only (not reportable standalone on most programs)
- CORS misconfiguration -> `finding` if credentials reflected, `signal` if no credentials
- Open redirect -> `gadget` with `provides: ["redirect"]`, finding only if chainable

**Tier**: haiku.

---

## Subtype: ssrf-test

**Purpose**: Test for Server-Side Request Forgery in parameters that accept URLs, file paths, or hostnames.

**Tools**: `web_request_send`, `web_request_fuzz`, `WebFetch`, Playwright

**What to Test**:
1. Identify parameters that accept URL-like input: `url`, `uri`, `path`, `src`, `href`, `redirect`, `callback`, `webhook`, `proxy`, `fetch`, `load`, `import`, `image`, `file`, `resource`, `dest`, `target`, `link`
2. Test each with SSRF payloads:
   - Internal IPs: `http://127.0.0.1`, `http://localhost`, `http://[::1]`, `http://0.0.0.0`
   - Cloud metadata: `http://169.254.169.254/latest/meta-data/`, `http://metadata.google.internal/computeMetadata/v1/`
   - Internal services: `http://127.0.0.1:8080`, `http://127.0.0.1:6379`, `http://127.0.0.1:9200`
   - DNS rebinding: use a DNS rebinding service that alternates between external and internal IPs
   - Protocol smuggling: `gopher://`, `file:///etc/passwd`, `dict://`
3. Bypass techniques (if basic payloads blocked):
   - Decimal IP: `http://2130706433` (127.0.0.1)
   - Hex IP: `http://0x7f000001`
   - Octal IP: `http://0177.0.0.1`
   - URL encoding: `http://127.0.0.1%2523@evil.com`
   - Redirect chain: redirect from your server to internal IP
   - IPv6 representation: `http://[0:0:0:0:0:ffff:127.0.0.1]`
4. Detect blind SSRF: look for timing differences between internal (fast) and external (slow) targets. Look for DNS resolution differences.

**Output**:
- SSRF confirmed with response data -> `finding` (critical if cloud metadata, high otherwise)
- SSRF confirmed blind (timing only) -> `finding` (medium) + `gadget` with `provides: ["ssrf", "internal_network"]`
- Metadata endpoint accessible -> `finding` (critical) + immediate `new_work_item`: `{ type: "exploit", subtype: "cloud-metadata-escalation", priority: 95 }`
- Partial SSRF (port scan only) -> `gadget` with `provides: ["internal_port_scan"]`

**Tier**: sonnet. Opus if bypass techniques are needed.

---

## Subtype: idor-test

**Purpose**: Test for Insecure Direct Object References -- accessing other users' data by manipulating IDs.

**Tools**: `web_request_send`, `web_request_fuzz`, Playwright

**What to Test**:
1. Identify all endpoints with user-specific resource identifiers: numeric IDs, UUIDs, usernames, email addresses in URL path or parameters.
2. Capture a request with your authenticated session.
3. Change the identifier to:
   - Adjacent values (ID + 1, ID - 1)
   - Known other user IDs (if available from recon)
   - Zero, negative values, very large values
   - Different format (numeric to UUID or vice versa)
4. Compare responses:
   - Same status code + different data = CONFIRMED IDOR
   - Same status code + same data = likely your own data aliased (false positive)
   - 403/401 = proper authorization check
   - 200 with empty/null data = check if data is actually different user's data
5. Test both GET (read) and PUT/PATCH/DELETE (write/modify/delete) operations.
6. Test with:
   - No auth token (completely unauthenticated access)
   - Low-privilege token (horizontal privilege escalation)
   - Different user's token (cross-account)

**Output**:
- Read IDOR on PII -> `finding` (high, `CWE-639`)
- Read IDOR on non-sensitive data -> `finding` (medium)
- Write/Delete IDOR -> `finding` (high-critical depending on impact)
- IDOR with user enumeration -> `gadget` with `provides: ["user_enumeration"]`
- Sequential IDs detected but no IDOR -> `signal` ("sequential-ids") for potential mass enumeration if IDOR found elsewhere

**Tier**: sonnet.

---

## Subtype: xss-test

**Purpose**: Test for Cross-Site Scripting -- reflected, stored, and DOM-based.

**Tools**: `web_request_send`, `web_request_fuzz`, Playwright (`browser_navigate`, `browser_fill`, `browser_evaluate`), `web_fill`

**What to Test**:
1. **Reflected XSS**: For every parameter that reflects in the response body:
   - Send context-appropriate payloads:
     - HTML context: `<img src=x onerror=alert(1)>`, `<svg/onload=alert(1)>`, `"><img src=x onerror=alert(1)>`
     - Attribute context: `" onfocus=alert(1) autofocus="`, `' onfocus=alert(1) autofocus='`
     - JS context: `';alert(1)//`, `\';alert(1)//`, `</script><script>alert(1)</script>`
     - URL context: `javascript:alert(1)`, `data:text/html,<script>alert(1)</script>`
   - Verify execution in Playwright: navigate to the crafted URL, check for alert dialog or run `document.domain` after injection
2. **Stored XSS**: For input fields that persist (profiles, comments, messages, file names):
   - Submit XSS payload via form (`web_fill` or `browser_fill_form`)
   - Navigate to the page where content is rendered
   - Check if payload executes via `browser_evaluate`
3. **DOM XSS**: Check for dangerous DOM sinks in client-side JavaScript:
   - Sinks: DOM write methods, innerHTML/outerHTML property assignments, setTimeout with string args, location.href set from user input, and Function constructor invocations
   - Sources: `location.hash`, `location.search`, `document.referrer`, `window.name`, `postMessage` data
   - Use `browser_evaluate` to trace data flow from source to sink
4. WAF bypass payloads (if standard payloads blocked):
   - `<img src=x onerror=alert` `` 1 `` `>` (backticks)
   - `<details open ontoggle=alert(1)>`
   - `<svg><animate onbegin=alert(1) attributeName=x>`
   - `<math><mtext><table><mglyph><svg><mtext><textarea><img src=x onerror=alert(1)>`
   - Case variation: `<ScRiPt>alert(1)</sCrIpT>`
   - Encoding: `&#x3C;script&#x3E;`

**Output**:
- Reflected XSS with execution proof -> `finding` (medium, or high if on auth domain)
- Stored XSS with execution proof -> `finding` (high, or critical if affects all users)
- DOM XSS -> `finding` (medium-high depending on source controllability)
- Self-XSS only -> `gadget` with `provides: ["js_exec_self"]` (NOT a finding -- chain with CSRF)
- Reflection without execution -> `signal` ("reflected-input") + `gadget` with `provides: ["input_reflection"]`
- Filtered/encoded reflection -> `signal` ("partial-reflection") with details on what was filtered

**Tier**: sonnet. Haiku for simple reflection checks.

---

## Subtype: sqli-test

**Purpose**: Test for SQL Injection -- error-based, blind, time-based, and out-of-band.

**Tools**: `web_request_send`, `web_request_fuzz`

**What to Test**:
1. **Error-based**: Send `'`, `"`, `\`, `)`, `'))` in every parameter. Look for SQL error strings in response:
   - MySQL: `You have an error in your SQL syntax`, `mysql_fetch`
   - PostgreSQL: `ERROR: syntax error at or near`, `pg_query`
   - MSSQL: `Unclosed quotation mark`, `Microsoft OLE DB`
   - SQLite: `SQLITE_ERROR`, `near ": syntax error`
   - Oracle: `ORA-`, `quoted string not properly terminated`
2. **Boolean-based blind**: Send pairs of always-true and always-false conditions:
   - `AND 1=1` vs `AND 1=2` -- compare response length/content
   - `' AND 'a'='a` vs `' AND 'a'='b`
   - `OR 1=1` vs `OR 1=2`
3. **Time-based blind**:
   - MySQL: `AND SLEEP(5)`, `AND BENCHMARK(10000000,SHA1('test'))`
   - PostgreSQL: `; SELECT pg_sleep(5)--`
   - MSSQL: `; WAITFOR DELAY '00:00:05'--`
   - Measure response time -- >5s delay = confirmed
4. **UNION-based** (if error-based confirms injection):
   - Determine column count: `ORDER BY 1`, `ORDER BY 2`, ... until error
   - `UNION SELECT NULL,NULL,...` matching column count
   - Extract: `UNION SELECT version(),user(),database()`
5. **Second-order**: If input is stored and used in a different query later (e.g., registration name used in profile query).

**Output**:
- Any confirmed SQLi -> `finding` (critical, `CWE-89`)
- Error-based disclosure without injection -> `signal` ("sql-error-disclosure") + `gadget` with `provides: ["debug_info"]`
- Time-based blind confirmed -> `finding` (critical) + PoC with timing measurements
- Always include the exact injection point, payload, and response excerpt in PoC

**Tier**: sonnet. Opus for second-order or complex filter bypass.

---

## Subtype: auth-test

**Purpose**: Deep authentication and authorization testing -- OAuth, JWT, session management, privilege escalation.

**Tools**: `web_request_send`, Playwright, `cors_check`, `redirect_chain`

**What to Test**:
1. **JWT Analysis** (if JWT tokens are used):
   - Decode token (header + payload + signature)
   - Algorithm confusion: change `alg` to `none`, `HS256` (if RS256), check if accepted
   - `kid` injection: `kid: "../../dev/null"` or `kid: "key' UNION SELECT 'secret'--"`
   - Claim tampering: change `role`, `admin`, `is_admin`, `user_id`, `sub` claims
   - Expired token reuse: submit expired JWT, check if still accepted
   - `jku`/`x5u` abuse: point to attacker-controlled key server
2. **OAuth/OIDC** (if OAuth flow detected):
   - `redirect_uri` manipulation: change to attacker domain, subdirectory, URL-encoded variations
   - State parameter: remove state, reuse state, predictable state
   - PKCE bypass: remove `code_verifier`, use `S256` with `plain` challenge
   - Scope escalation: request higher scopes than authorized
   - Token leakage: check if token appears in URL, Referer header, logs
3. **Session Management**:
   - Session fixation: can you set session ID before auth?
   - Session ID entropy: are session tokens predictable?
   - Concurrent sessions: does logout invalidate other sessions?
   - Cookie flags: HttpOnly, Secure, SameSite
4. **Privilege Escalation**:
   - Horizontal: access another user's resources with your token
   - Vertical: access admin resources with user token
   - Method tampering: change GET to POST/PUT/DELETE, or vice versa
   - Path traversal in auth context: `GET /api/users/me` vs `GET /api/users/admin`
5. **Password Reset**:
   - Token predictability, token reuse, host header injection in reset email
   - Rate limiting on reset requests
   - Reset token leakage in Referer header

**Output**:
- JWT algorithm confusion -> `finding` (critical, `CWE-347`)
- OAuth redirect manipulation -> `finding` (high) + `gadget` with `provides: ["redirect", "token_theft"]`
- IDOR via auth bypass -> `finding` (high, `CWE-639`)
- Privilege escalation -> `finding` (high-critical depending on scope)
- Weak session management -> `signal` or `gadget` depending on exploitability
- Missing CSRF protection -> `gadget` with `provides: ["csrf"]` (chain with self-XSS)

**Tier**: opus (complex auth logic requires deep reasoning).

---

## Subtype: api-test

**Purpose**: REST/GraphQL/gRPC API security testing -- BOLA, mass assignment, injection, rate limiting, version differences.

**Tools**: `web_request_send`, `web_request_fuzz`, `WebFetch`, Playwright

**What to Test**:
1. **BOLA/IDOR**: Change resource IDs in every API endpoint (see idor-test, but focused on API)
2. **Mass Assignment**: Add extra fields to POST/PUT requests:
   - `"role": "admin"`, `"is_admin": true`, `"verified": true`, `"balance": 99999`
   - `"email": "attacker@evil.com"` (account takeover via email change)
   - Check if response reflects the added fields
3. **Injection**: Test all parameters for SQLi, NoSQLi, command injection, SSTI
4. **Rate Limiting**: Test brute-force protection on auth endpoints:
   - Send 100+ requests rapidly -- does rate limiting kick in?
   - If GraphQL: use alias batching to bypass (100 ops in 1 request)
5. **API Version Differences**: If `/api/v1/` and `/api/v2/` both exist:
   - Compare auth requirements (v1 often lacks controls added in v2)
   - Compare response fields (v1 may return fields removed in v2 for privacy)
   - Test v1 endpoints with v2 auth tokens and vice versa
6. **Schema Validation**: Send malformed data types:
   - String where int expected, array where string expected
   - Extremely long strings (buffer overflow), negative numbers where positive expected
   - Null bytes, Unicode, control characters

**Output**:
- BOLA confirmed -> `finding` (high-critical, `CWE-639`)
- Mass assignment -> `finding` (high if privilege escalation, medium otherwise, `CWE-915`)
- API version bypass -> `finding` (severity varies) + `gadget` with `provides: ["auth_bypass"]`
- Rate limit bypass -> `gadget` with `provides: ["rate_limit_bypass"]` (chain with brute force)
- Missing auth on endpoint -> `finding` (high, `CWE-306`)

**Tier**: sonnet. Opus for complex API logic.

---

## Subtype: business-logic

**Purpose**: Test application-specific business logic flaws that automated scanners miss.

**Tools**: Playwright (full browser interaction), `web_request_send`, `web_request_replay`

**What to Test**:
1. **Workflow bypass**: Map multi-step processes (checkout, registration, onboarding). Skip steps, reorder steps, repeat steps.
2. **Price manipulation**: Change prices, quantities, discounts in requests. Negative quantities. Zero-price items.
3. **Race conditions**: Use HTTP/2 single-packet technique to submit concurrent requests:
   - Double-spend on balance/credits
   - Multiple redemptions of single-use codes
   - Parallel account creation with same email
   - Concurrent vote/like manipulation
4. **State manipulation**: Modify client-side state (localStorage, sessionStorage, cookies) that influences server behavior.
5. **Feature abuse**: Use features in unintended ways:
   - File upload as web shell, SVG with XSS, PDF with SSRF
   - Email functionality for spam relay
   - Export features for data exfiltration beyond authorization
   - Import features for injection
6. **Numerical edge cases**: Integer overflow, floating point precision, currency rounding exploitation.

**Output**:
- Logic flaw with financial impact -> `finding` (high-critical)
- Race condition confirmed -> `finding` (medium-high) + detailed timing PoC
- Workflow bypass -> `finding` (severity depends on what's bypassed)
- Feature abuse -> `finding` or `gadget` depending on standalone impact

**Tier**: opus (requires creative reasoning about application logic).

---

## Subtype: file-upload

**Purpose**: Test file upload functionality for code execution, XSS, and path traversal.

**Tools**: `web_request_send`, Playwright, `WebFetch`

**What to Test**:
1. **Extension bypass**: Upload files with double extensions (`.php.jpg`), null byte (`.php%00.jpg`), case variation (`.pHp`), alternate extensions (`.php5`, `.phtml`, `.shtml`)
2. **Content-Type bypass**: Upload with `image/jpeg` Content-Type but PHP/JSP/ASP content
3. **Magic byte injection**: Prepend valid image magic bytes (GIF89a, PNG header) before code
4. **SVG XSS**: Upload SVG with `<script>alert(1)</script>` or `onload` handler
5. **Path traversal**: Use `../` in filename to write outside upload directory
6. **File size**: Extremely large files (DoS), zero-byte files, files with special characters in name
7. **Polyglot files**: Files that are valid images AND valid code

**Output**:
- Code execution via upload -> `finding` (critical, `CWE-434`)
- XSS via uploaded file -> `finding` (medium-high, `CWE-79`)
- Path traversal in upload -> `finding` (high, `CWE-22`)
- Upload accepted but no execution -> `gadget` with `provides: ["file_write"]`

**Tier**: sonnet.

---

## Subtype: open-redirect

**Purpose**: Find open redirects for chaining with OAuth flows.

**Tools**: `redirect_chain`, `web_request_send`, `WebFetch`

**What to Test**:
1. Check all parameters that influence redirects: `redirect`, `url`, `next`, `return`, `returnUrl`, `goto`, `dest`, `continue`, `target`, `rurl`, `redirect_uri`, `callback`
2. Payloads: `https://evil.com`, `//evil.com`, `/\evil.com`, `https://target.com@evil.com`, `https://evil.com%23.target.com`, `https://target.com.evil.com`
3. Check login/logout flows -- do they redirect after auth?
4. Check OAuth `redirect_uri` -- does it validate strictly or allow subdirectories/subdomains?

**Output**:
- Open redirect standalone is usually NOT reportable. Create `gadget` with `provides: ["redirect"]`.
- If OAuth flow uses the redirect -> `finding` (high) via chain: redirect + OAuth = token theft
- Always spawn: `{ type: "test", subtype: "auth-test", context: { open_redirect: "<url>" }, priority: 75 }` to check for OAuth chain

**Tier**: haiku.

---

## Subtype: cors-test

**Purpose**: Test CORS configuration for credential-inclusive cross-origin access.

**Tools**: `cors_check`, `web_request_send`

**What to Test**:
1. Send requests with various `Origin` headers:
   - `https://evil.com` -- arbitrary origin
   - `https://target.com.evil.com` -- prefix match bypass
   - `https://evil-target.com` -- suffix match bypass
   - `https://sub.target.com` -- subdomain (may be allowed)
   - `null` -- null origin (sandboxed iframe)
2. Check response headers:
   - `Access-Control-Allow-Origin`: does it reflect the evil origin?
   - `Access-Control-Allow-Credentials: true` -- THIS is what makes it exploitable
   - `Access-Control-Allow-Methods` -- what methods are allowed?
   - `Access-Control-Expose-Headers` -- what data is accessible?
3. Build a PoC HTML page that demonstrates cross-origin data read if both reflection + credentials are present.

**Output**:
- Origin reflection + credentials -> `finding` (medium-high depending on data) + PoC HTML
- Origin reflection without credentials -> `signal` ("cors-reflection-no-creds")
- Subdomain reflection + credentials -> `gadget` with `provides: ["cross_origin_read"]`, `requires: ["trusted_origin"]` (chain with subdomain takeover)
- Null origin allowed + credentials -> `finding` (medium, sandbox iframe bypass)

**Tier**: haiku.

---

## Subtype: header-injection

**Purpose**: Test for HTTP header injection and response splitting.

**Tools**: `web_request_send`, `WebFetch`

**What to Test**:
1. Inject CRLF sequences (`%0d%0a`, `%0a`, `\r\n`) in parameters that appear in response headers (Set-Cookie, Location, custom headers).
2. Check for header injection in: `Host` header manipulation, `X-Forwarded-Host`, `X-Forwarded-For`.
3. Test Host header injection on password reset flows (attacker-controlled reset link domain).
4. Response splitting: inject `\r\n\r\n<html>` to split response and inject content.

**Output**:
- Header injection confirmed -> `finding` (medium-high, `CWE-113`)
- Host header injection on password reset -> `finding` (high -- password reset poisoning)
- CRLF filtered but Host header reflected -> `signal` ("host-reflection")

**Tier**: sonnet.

---

## Subtype: graphql-introspection

**Purpose**: Test GraphQL endpoints for introspection, batching attacks, and field-level authorization gaps.

**Tools**: `web_request_send`, `WebFetch`

**What to Test**:
1. **Introspection**: Send introspection query `{ __schema { types { name fields { name type { name } } } } }`. If enabled, dump the complete schema.
2. **Field-level authorization**: For each type in the schema, query fields and check if sensitive data is returned without authorization (or with low-privilege auth).
3. **Batching attacks**: Send array of operations `[{query: "..."}, {query: "..."}, ...]` or use aliases `{ a1: login(pass:"pass1") a2: login(pass:"pass2") ... }` to bypass rate limiting.
4. **Nested query DoS**: Create deeply nested queries to test for query depth limits: `{ user { friends { friends { friends ... } } } }`.
5. **Suggestions/field enumeration**: If introspection is disabled, send queries with typos and check for "Did you mean..." suggestions to enumerate fields.

**Output**:
- Introspection enabled -> `signal` ("graphql-introspection-enabled") + `new_surfaces` for all discovered types/fields
- Auth gap on sensitive field -> `finding` (high, `CWE-862`)
- Rate limit bypass via batching -> `gadget` with `provides: ["rate_limit_bypass"]`
- Schema discovered -> `new_work_items`: `{ type: "test", subtype: "idor-test" }` per user-specific type, `{ type: "test", subtype: "api-test" }` per mutation

**Tier**: sonnet.

---

## Subtype: wordpress-vulns

**Purpose**: Test WordPress installations for known vulnerabilities.

**Tools**: `web_request_send`, `WebFetch`, `cve_search`, `exploit_db_search`

**What to Test**:
1. **Version detection**: Check `/wp-admin/`, `<meta name="generator">`, `/readme.html`, `/license.txt`
2. **User enumeration**: `/?author=1`, `/?author=2`, etc. or `/wp-json/wp/v2/users/`
3. **XML-RPC abuse**: Check `/xmlrpc.php` -- test `system.multicall` for brute force amplification
4. **Plugin enumeration**: Check common plugin paths (`/wp-content/plugins/{name}/readme.txt`). Focus on plugins with known CVEs.
5. **CVE checks**: Run `cve_search("wordpress {version}")` and `cve_search` for each detected plugin.
6. **Default credentials**: Test `admin:admin`, `admin:password`, `admin:wordpress`
7. **File exposure**: `/wp-config.php.bak`, `/wp-config.old`, `/.wp-config.php.swp`, `/wp-includes/version.php`

**Output**:
- Known CVE exploitable -> `finding` with CVE reference
- User enumeration confirmed -> `gadget` with `provides: ["user_enumeration"]`
- XML-RPC enabled -> `signal` ("xmlrpc-enabled") + brute force potential
- Config backup found -> `finding` (critical if contains DB credentials)

**Tier**: sonnet.

---

## Subtype: cache-poisoning

**Purpose**: Test for web cache poisoning and cache deception attacks.

**Tools**: `web_request_send`, `WebFetch`

**What to Test**:
1. **Cache poisoning**: Identify cached responses (check `Age`, `X-Cache`, `CF-Cache-Status` headers). Send requests with unkeyed headers (`X-Forwarded-Host`, `X-Original-URL`, `X-Rewrite-URL`) containing attacker-controlled values. If response reflects the unkeyed header AND is cached, subsequent users receive the poisoned response.
2. **Cache deception**: Request authenticated pages with cacheable extensions: `/account/settings.css`, `/api/user/profile.js`. If the cache serves the authenticated response to unauthenticated users, this is cache deception.
3. **HTTP Request Smuggling for cache poisoning**: Use CL.TE or TE.CL discrepancies to smuggle a request that poisons the cache for the next user.
4. **Parameter cloaking**: Use semicolons, percent-encoded delimiters to include cache-unkeyed parameters that are processed by the backend.

**Output**:
- Cache poisoning with XSS -> `finding` (critical -- mass user compromise via single poisoned request)
- Cache deception -> `finding` (high -- authenticated data theft)
- Smuggling-based cache poisoning -> `finding` (critical)
- Unkeyed header reflected but not cached -> `signal` ("unkeyed-header-reflection")

**Tier**: opus (requires understanding of caching layers and HTTP parsing discrepancies).

---

## General Test Rules

1. **Always capture raw HTTP request/response.** Every finding needs copy-pasteable reproduction steps. Store the exact `curl` command or HTTP request that demonstrates the vulnerability.

2. **Test with and without authentication.** A vulnerability that requires no auth is higher severity than one requiring a user account.

3. **Emit gadgets aggressively.** Even a "failed" test that reveals a partial primitive (reflection, redirect, CSRF token missing) is valuable as a gadget. The intel module will find chains.

4. **Respect the exclusion list.** If the program excludes a vuln type (e.g., "open redirect without chain"), do NOT create a finding. Create a gadget instead. The intel module handles chain discovery.

5. **One test, one subtype.** Do not expand scope beyond your assigned subtype. If you discover something outside your subtype during testing (e.g., find SQLi while testing for XSS), emit a signal and spawn a new work item for the other subtype.

6. **Three strikes rule.** If the same test fails 3 times (tool error, timeout, unexpected response), stop and report blockers in the result summary. Do not loop infinitely.

7. **Context is king.** Always check `work_item.context` for information from upstream recon or intel: known tech stack, WAF product, evasion level, discovered parameters, authentication tokens. Use this context to tailor your approach.
