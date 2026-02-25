# WAF Evasion Escalation Ladder

When a test gets blocked by a WAF, do not give up. Escalate through these evasion levels progressively. Try ONE level up per attempt — do not burn through all levels at once.

## Evasion Levels

### Level 0: Default (No Evasion)

Standard requests with normal formatting. This is the baseline — start here for every test.

If blocked at Level 0, the WAF is active. Proceed to Level 1.

### Level 1: Encoding Tricks

**Techniques:**
- URL encoding: `%27` instead of `'`, `%3Cscript%3E` instead of `<script>`
- Double URL encoding: `%2527` instead of `'` (WAF decodes once, app decodes twice)
- Unicode fullwidth characters: `＜script＞` (U+FF1C, U+FF1E)
- Mixed case: `SeLeCt`, `UnIoN`, `<ScRiPt>`
- Null bytes: `%00` between keywords (`SEL%00ECT`)
- HTML entities: `&#x3c;script&#x3e;`
- Backslash escaping: `\' OR 1=1--`

**Most effective against:** Basic WAF rules, regex-based filters
**Detection:** Compare response to Level 0 — different status code or body = bypass working

### Level 2: HTTP Parameter Pollution

**Techniques:**
- Duplicate parameters: `?id=1&id=UNION+SELECT` — WAF checks first, app uses second (or concatenates)
- Array parameters: `?id[]=1&id[]=UNION+SELECT`
- Parameter name variations: `?id=1` vs `?ID=1` vs `?Id=1`
- ASP.NET comma concatenation: `?id=1,UNION+SELECT` (auto-concatenated from dupes)
- PHP bracket arrays: `?search[]=<script>alert(1)</script>`

**Most effective against:** WAFs that inspect first parameter only (70%+ bypass rate per WAFFLED 2024 research)
**Detection:** Compare behavior with single vs duplicate parameters

### Level 3: Content-Type Switching

**Techniques:**
- Switch from JSON to form-urlencoded: `Content-Type: application/x-www-form-urlencoded`
- Switch to multipart/form-data: different parsing path in WAF vs backend
- Switch to XML: `Content-Type: application/xml` with same data structure
- Use uncommon content types: `text/plain`, `application/x-amf`
- Charset tricks: `Content-Type: application/json; charset=utf-7`

**Most effective against:** WAFs with format-specific rules (JSON-only inspection)
**Detection:** If backend accepts multiple content types, try each

### Level 4: Oversized Requests

**Techniques:**
- Pad request body past WAF inspection limit:
  - AWS WAF: 8KB body inspection limit
  - Azure WAF: 128KB default
  - Cloudflare: varies by plan
- Place payload AFTER padding (beyond inspection boundary)
- Use long parameter names or values as padding
- Add large multipart/form-data sections before the payload

**Example:**
```
POST /api/search HTTP/1.1
Content-Type: application/x-www-form-urlencoded

padding=AAAA...(8KB of A's)...AAAA&query=UNION+SELECT+1,2,3--
```

**Most effective against:** AWS WAF (reliable), other WAFs with fixed inspection limits
**Detection:** Compare response with and without padding

### Level 5: Request Smuggling

**Techniques:**
- CL.TE: `Content-Length` header disagrees with `Transfer-Encoding: chunked`
- TE.CL: `Transfer-Encoding: chunked` processed by frontend, `Content-Length` by backend
- H2.CL: HTTP/2 downgrade to HTTP/1.1 with smuggled Content-Length
- CRLF injection in HTTP/2 headers smuggled to HTTP/1.1 backend

**WARNING:** Request smuggling can affect other users. Use with caution.
**Tools:** Burp HTTP Request Smuggler extension concepts, manual crafting
**Most effective against:** Reverse proxy + backend desync (primary vector 2024-2025)
**Detection:** Delayed responses, response desynchronization

### Level 6: Browser Automation (Playwright)

**Techniques:**
- Full Playwright browser with real Chrome rendering
- Execute payloads via browser JavaScript (bypasses all server-side WAF inspection for DOM-based tests)
- Use web_navigate, web_evaluate, web_fill tools
- Browser executes JavaScript naturally — no WAF signature to match
- Useful for: DOM XSS, client-side testing, JavaScript-heavy applications

**Most effective against:** All WAF products (browser traffic is legitimate)
**Detection:** Always works for client-side tests; server-side payload still needs to bypass

### Level 7: Origin IP Discovery

**Techniques:**
- Shodan SSL cert search: `ssl.cert.subject.CN:target.com`
- Historical DNS via SecurityTrails, ViewDNS
- SPF record leakage: `dig TXT target.com` → find IP ranges in SPF
- MX record leakage: mail servers may be on origin IP
- Favicon hash matching via Shodan
- CrimeFlare database lookup
- Check if apex domain is DNS-only while www is proxied

**Purpose:** Find the origin IP behind the CDN/WAF and send requests directly
**Most effective against:** Cloudflare, Akamai, any CDN-proxied WAF
**Detection:** Direct IP access returns same content without WAF headers

## CDN/WAF-Specific Bypass Notes

### Cloudflare
- Origin discovery is the primary bypass strategy
- Bot detection: use curl_cffi with Chrome impersonation, or Playwright
- Check if non-www or API subdomains bypass the proxy
- Historical DNS is the best source for origin IPs
- Rate limiting: different CF-Connecting-IP values create separate buckets

### Akamai
- Cipher stunting: randomize TLS ClientHello per connection
- Full Playwright automation for sensor data
- Session rotation before bot score accumulates
- Never reuse TLS session tickets
- Akamai's bot detection is the strongest — Playwright is often the only option

### AWS WAF
- Body inspection limit bypass (8KB) is the most reliable technique
- Content-type switching (WAF may only inspect JSON, not form-urlencoded)
- DOM event handler variants for XSS rules
- AWS WAF regex rules have specific timeouts — very long payloads can timeout the inspection

### Azure WAF
- Still on OWASP CRS 3.2 (outdated rule set)
- Escaped backslash bypass techniques still effective
- Many Azure WAF deployments use default rules without customization

## Rate Limiting Evasion

| Technique | How It Works | When to Use |
|-----------|-------------|-------------|
| Header rotation | Cycle `X-Forwarded-For`, `X-Client-IP`, `True-Client-IP`, `CF-Connecting-IP` | When rate limited by IP |
| HTTP/2 last-frame sync | Send all requests in a single HTTP/2 connection burst | Race conditions (OTP, coupons) |
| GraphQL alias batching | 100+ operations in one HTTP request (counted as 1) | When testing GraphQL |
| IP rotation | Residential proxies, cloud function rotation | When IP-banned |
| Session rotation | New session/cookies per request | When session-rate-limited |
| Timing jitter | Random 1-3s delay between requests | When consistent timing triggers detection |

## TLS Fingerprint Evasion

- JA3 is effectively dead: Chrome 110+ randomizes TLS extension order
- JA4 sorts fields before hashing (harder to spoof but most WAFs don't use it yet)
- **curl_cffi** (Python): Chrome/Firefox TLS impersonation
- **CycleTLS** (Go/JS): Custom TLS fingerprint per request
- **Playwright** (full browser): Most reliable — genuine browser TLS stack

## Integration with Hunt Loop

When a test work item is blocked:

1. The test worker emits signal: `{ type: "waf-blocked", target: "...", description: "..." }`
2. The test worker creates a new work item:
   - Same type and subtype
   - Same target
   - context.evasion_level = current_level + 1
   - priority = current_priority - 5
3. The original work item is marked as "failed" with reason "waf-blocked"
4. The intel module tracks WAF blocks and may recommend Level 7 (origin discovery) if multiple endpoints are blocked

Maximum evasion level before giving up: Level 7. If Level 7 fails, mark the target as "hardened" and move on.
