---
name: waf-detect
description: Detect WAF/CDN protection on targets and suggest bypass techniques based on detected technology
---

# WAF Detection and Bypass

## Usage
Part of the recon workflow, or standalone for specific targets.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions (WAF type, bypass techniques that worked)

## Detection
Use MCP tool `greyhatcc_sec__waf_detect` to identify WAF/CDN.

Also check:
- Response headers: `Server`, `X-CDN`, `X-Cache`, `CF-RAY` (Cloudflare), `X-Akamai-*`, `X-Amz-Cf-*` (CloudFront)
- Error page signatures: WAF block pages have unique HTML/text patterns
- Timing analysis: WAF-proxied responses have different latency profiles
- Use MCP `greyhatcc_sec__header_analysis` for comprehensive header inspection
- Use MCP `greyhatcc_sec__tech_fingerprint` for CDN detection layer

---

## Per-WAF Bypass Playbook

### Cloudflare

**Origin Discovery (bypass the proxy entirely):**
- **Shodan SSL cert search**: Use `greyhatcc_s__shodan_ssl_cert` with the target domain — find IPs serving the same cert without Cloudflare proxy
- **Historical DNS**: Use `greyhatcc_sec__dns_records` + WebSearch for SecurityTrails/ViewDNS — find pre-Cloudflare IPs
- **SPF/MX record leakage**: `dig +short TXT <domain> | grep spf` — mail server IPs often sit on the same host as the origin
- **Favicon hash matching**: Download favicon, compute mmh3 hash, search Shodan: `http.favicon.hash:<hash>` — finds origin by unique favicon
- **CrimeFlare databases**: WebSearch for CrimeFlare/CloudFail lookups against the domain
- **Check apex vs www**: `dig +short <domain>` vs `dig +short www.<domain>` — sometimes apex is DNS-only (shows origin) while www is proxied
- **Outbound connection leakage**: If the app makes callbacks (webhooks, SSRF, email), capture the source IP — it may be the origin

**Bot Bypass (when origin can't be found):**
- `curl_cffi` with Chrome impersonation (Python): Mimics full browser TLS fingerprint
- Playwright MCP with real Chrome: Most reliable — passes all JS challenges
- Residential proxy rotation: Cloudflare bot scoring uses IP reputation
- Avoid reusing TLS session tickets across requests

**WAF Rule Bypass:**
- Cloudflare WAF has strict XSS/SQLi rules — use double URL encoding (`%2527`), Unicode fullwidth characters (U+FF01-U+FF5E)
- Chunked transfer encoding with small chunk sizes
- Content-Type switching: `application/json` vs `multipart/form-data` vs `text/xml`

### Akamai

**Detection**: `X-Akamai-*` headers, Akamai Pragma headers, `AkamaiGHost` server banner

**Cipher Stunting:**
- Randomize TLS ClientHello cipher suite order per-connection
- Akamai Bot Manager scores based on TLS fingerprint consistency
- Use `curl_cffi` (Python) or CycleTLS (Go/JS) to randomize fingerprints

**Playwright Automation:**
- Full browser automation for Akamai sensor data generation
- Akamai Bot Manager injects `_abck` cookie via JavaScript — headless must execute it
- Session rotation BEFORE score accumulates past threshold — Akamai scores build over time

**Request Evasion:**
- Never reuse TLS session tickets across requests
- Body padding past Akamai inspection limits
- Header case randomization (HTTP/1.1)
- Path normalization tricks: `/./endpoint`, `//endpoint`, `/endpoint/`

### AWS WAF

**Detection**: Responses blocked by AWS WAF return specific error pages, `x-amzn-RequestId` headers

**8KB Body Inspection Limit:**
- AWS WAF only inspects the first 8KB of request body (16KB for some configs)
- Pad the body with benign data past 8KB, place payload after the limit
- Example: `{"padding": "A"*8192, "payload": "<script>alert(1)</script>"}`
- This is reliable and well-documented

**HTTP Parameter Pollution (HPP):**
- Duplicate parameters split payload across WAF inspection boundaries
- 70%+ bypass rate per WAFFLED 2024 research
- ASP.NET comma-concatenates duplicate params: `?q=sel&q=ect * fr&q=om users`
- Different backends merge/override differently — test each

**Content-Type Switching:**
- Switch between `application/json`, `multipart/form-data`, `text/xml`, `application/x-www-form-urlencoded`
- AWS WAF has different parsing/inspection for each content type
- XML payloads often bypass JSON-specific WAF rules

**Method Override:**
- `X-HTTP-Method-Override: PUT` with POST request
- `_method=DELETE` parameter in body
- Different rule sets may apply to different HTTP methods

### Azure WAF

**Detection**: `X-Azure-Ref` header, Azure-specific error pages

**OWASP CRS 3.2 (Outdated):**
- Azure WAF still uses OWASP CRS 3.2 rules in many configurations (not the latest 4.x)
- Well-known bypass techniques for CRS 3.2 still work
- Escaped backslash bypass: `\' OR 1=1--` instead of `' OR 1=1--`
- Comment-padded SQL: `/*!50000SELECT*/ * /*!50000FROM*/ users`

**Encoding Tricks:**
- Double URL encoding: `%2527` decodes to `%27` which decodes to `'`
- Mixed case SQL with inline comments: `sElEcT/**/1/**/fRoM/**/users`
- Unicode normalization: full-width characters, homoglyphs

---

## General WAF Bypass Techniques

### HTTP Parameter Pollution (HPP)
```
Duplicate parameters to split payloads across WAF inspection:
?search=harmless&search=<script>alert(1)</script>

Backend behavior varies:
- ASP.NET: Concatenates with comma → "harmless,<script>alert(1)</script>"
- PHP: Uses last value → "<script>alert(1)</script>"
- Java: Uses first value → "harmless"
- Node/Express: Returns array → ["harmless", "<script>alert(1)</script>"]
```

### Oversized Request Body
```
Pad body past WAF inspection limit:
- AWS WAF: 8KB (some configs 16KB)
- Cloudflare: varies by plan
- Akamai: varies by config
- Azure: typically 128KB

Place payload AFTER the inspection limit boundary.
```

### Request Smuggling
```
H2.CL and H2.TE via CRLF injection in HTTP/2 headers:
- Primary WAF bypass vector 2024-2025
- Tools: Burp HTTP Request Smuggler, http2smugl
- Works when frontend (WAF) and backend disagree on request boundaries
```

### Encoding Tricks
```
- Double URL encoding: %2527 for single quote
- Unicode fullwidth: U+FF01-U+FF5E (e.g., ＜ instead of <)
- Null bytes: %00 can terminate WAF string matching
- Mixed case SQL: sElEcT, UnIoN, fRoM
- Comment padding: SEL/**/ECT, UN/**/ION
- Hex encoding: 0x53454C454354 for SELECT
- Base64 in parameters when backend decodes
```

### Content-Type Switching
```
Switch between content types to trigger different WAF parsing paths:
- application/json → application/xml (XXE potential)
- application/x-www-form-urlencoded → multipart/form-data
- application/json → text/plain (some APIs accept it)
Different parsing engines = different rule coverage
```

---

## Rate Limiting Evasion

### Header Rotation
```
Cycle these headers to create separate rate limit buckets:
X-Forwarded-For: <random_ip>
X-Client-IP: <random_ip>
True-Client-IP: <random_ip>
CF-Connecting-IP: <random_ip>
X-Real-IP: <random_ip>
X-Originating-IP: <random_ip>
```

### HTTP/2 Last-Frame Sync
```
Race condition exploitation:
- Prepare all requests in HTTP/2 streams
- Withhold the final DATA frame for each
- Release all final frames simultaneously (single-packet attack)
- All requests arrive at the server within microseconds
- Use for: OTP brute force, coupon redemption, balance manipulation
```

### GraphQL Alias Batching
```
100+ operations in a single HTTP request — rate limiter counts as 1:
{"query": "{
  a1: user(id:1){email}
  a2: user(id:2){email}
  ...
  a100: user(id:100){email}
}"}
```

### IP Rotation
```
- Residential proxies: Best IP reputation for bypassing rate limits
- Cloud function rotation: Spin up Lambda/Cloud Functions per-request
- Tor exit node cycling: Last resort — many sites block Tor entirely
```

---

## TLS Fingerprint Evasion

### JA3 / JA4 Background
- **JA3** is effectively dead — Chrome 110+ randomizes extension order in ClientHello
- **JA4** sorts fields before hashing (harder to spoof) and adds HTTP application-layer context
- JA4+ adds even more context (JA4H for HTTP, JA4S for server)

### Evasion Tools
| Tool | Language | Approach | Reliability |
|------|----------|----------|-------------|
| `curl_cffi` | Python | Chrome TLS impersonation | HIGH — mirrors real Chrome fingerprint |
| `CycleTLS` | Go/JS | Configurable TLS fingerprint | HIGH — can mimic any browser |
| Playwright | Any | Full real browser stack | HIGHEST — is a real browser |
| `tls-client` | Go | Custom TLS configuration | MEDIUM — requires manual tuning |

### When to Use What
```
First attempt: Standard curl
If blocked: curl_cffi with Chrome impersonation
If still blocked: Playwright with real Chrome (headful if possible)
If still blocked: Playwright + residential proxy + realistic browsing pattern
```

---

## Output
Save to `recon/waf_detection.md` with:
- Detected WAF product and version (if detectable)
- Confidence level (HIGH/MEDIUM/LOW)
- Detection method (headers, error page, timing)
- Recommended bypass techniques (ordered by reliability)
- Rate limiting behavior observed
- TLS fingerprint requirements

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
