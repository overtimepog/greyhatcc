# Signal Amplification Rules

The intel module uses these rules to convert weak signals into targeted investigations. When a signal
in `signals` (on `HuntState`) matches a rule, the intel module creates a new high-priority `WorkItem`
and adds it to the queue. Amplification turns noise into actionable work — a single signal from a
recon step can unlock an entire attack tree.

---

## How Signal Matching Works

The intel module evaluates every unactioned `Signal` against this table on each intel run
(`hunt_state.intel_runs` increments after each pass).

### Matching Criteria

1. **Exact type match**: `signal.type` exactly equals the `Signal Type` column value (case-insensitive,
   underscores and hyphens normalized). This is the primary match.

2. **Fuzzy description match**: If no exact type match exists, the intel module scans `signal.description`
   for keywords from the `Signal Type` column. A fuzzy match requires at least 2 keyword hits from the
   signal type string. Fuzzy matches receive a 50% priority boost reduction (i.e., half the boost).

3. **Compound signals**: If two signals on the same `target` have types that appear in the same chain
   template (see `chaining.md`), the intel module creates a chain investigation work item with the
   combined priority boost of both signals.

### Signal Already Actioned Check

Before creating a new work item, the intel module must verify:

- No existing `WorkItem` with `subtype` matching the `New Work Item Subtype` column is already
  `queued`, `active`, or `done` for the same `signal.target`.
- If such a work item already exists and is `done`, check its result. If `result.success` is `false`
  or the result contains no findings/gadgets, the amplification may still fire (the prior attempt
  may have been blocked by WAF — escalate evasion level instead of re-running the same approach).

### Confidence Threshold

Do NOT amplify signals with `signal.confidence < 0.2`. These are too speculative to spend tokens on.
Signals with `confidence` between 0.2 and 0.5 are amplified but receive the work item's `model_tier`
set to `"haiku"` (low-cost exploration). Signals with `confidence >= 0.5` use `"sonnet"`. Signals
with `confidence >= 0.9` use `"opus"` for maximum depth.

---

## Priority Calculation

```
final_priority = base_item_priority + boost
```

Where:
- `base_item_priority` = 50 (default for intel-spawned items)
- `boost` = value from the `Priority Boost` column
- Cap at 100 (maximum queue priority)
- Fuzzy matches: `boost * 0.5`
- Chain matches: `boost_A + boost_B`, capped at 100

The source signal's `confidence` further scales the effective priority:

```
effective_priority = min(100, floor(final_priority * signal.confidence + final_priority * 0.3))
```

This means a `confidence: 1.0` signal gets full priority, while `confidence: 0.2` gets 50% priority
even after the boost.

---

## Amplification Table

| Signal Type | Investigation Action | Priority Boost | New Work Item Subtype | Rationale |
|------------|---------------------|----------------|----------------------|-----------|
| `source-map-found` | Full source reconstruction via `.map` file fetch, secret scanning with TruffleHog patterns against reconstructed source, internal path enumeration from source paths | +25 | `test/source-map-analysis` | Source maps contain the complete original source code. A `.map` file can reconstruct minified JS into readable classes, revealing API keys, internal service URLs, hardcoded credentials, and debug flags left in development code. One sourcemap disclosure paid $25k. |
| `graphql-introspection-enabled` | Full schema dump via `__schema` query, enumerate all types and fields, query complexity analysis (deeply nested query DoS), test each type/field for authorization gaps by comparing authenticated vs unauthenticated responses, check for alias-based batching bypass on rate-limited mutations | +20 | `test/graphql-introspection` | Introspection gives the complete API blueprint — every query, mutation, subscription, and their argument types. This is equivalent to having the full API documentation including internal/admin operations that may not be in public docs. |
| `verbose-error-stack-trace` | Technology identification from stack trace (framework, version, file paths, internal class names), error-based injection testing (SQLi error messages, template error messages for SSTI, XML parse errors for XXE), enumerate internal service names and paths from stack frames | +20 | `test/error-injection` | Stack traces reveal the exact framework (Spring Boot, Django, Rails, Laravel), version numbers (searchable against CVE databases), internal file paths (can aid LFI), and internal class/method names (aids in deserialization gadget chain construction). |
| `open-redirect` | Chain with active OAuth flows (craft authorization URL with `redirect_uri` pointing at attacker server), chain with SSRF payloads (some SSRF filters allow redirects), test for scheme-based bypass (`javascript://`, `data://`), document as high-value gadget even if standalone is out of scope | +25 | `exploit/redirect-chain` | Open redirect alone is typically P5/out-of-scope. But redirect-control is the key primitive for OAuth token theft. If the application uses OAuth, an open redirect becomes critical. Even without OAuth, redirect chains can bypass referer-based CSRF protections. |
| `self-xss` | Chain with CSRF to force victim into attacker-controlled state where XSS fires, test login CSRF (force victim to log into attacker account, XSS executes in victim's browser context and exfiltrates victim's real session if they were previously authenticated), document provides/requires for gadget inventory | +25 | `exploit/self-xss-chain` | Self-XSS is ineligible alone but becomes critical when chained. The classic chain: CSRF forces victim to attacker's account → self-XSS fires in victim's browser → XSS exfiltrates victim's real session cookies (stored in browser memory) → full ATO. Requires login CSRF to be viable. |
| `debug-endpoint` | Deep information disclosure enumeration (`/debug`, `/actuator/*`, `/_debug`, `/console`, `/__debug__`, `/.env`, `/config`, `/status`), test for unauthenticated admin panel access, extract environment variables and credentials from verbose output, check for interactive consoles (Spring Boot Actuator `/jolokia`, Django debug toolbar, Rails `/letter_opener`) | +20 | `test/debug-endpoint` | Debug endpoints frequently bypass authentication middleware applied to normal routes. Spring Actuator `/env` leaks all environment variables including DB passwords and API keys. Rails `/letter_opener` shows all outbound emails. Django debug toolbar shows SQL queries and session data. These are often forgotten in production. |
| `jwt-weak-algorithm` | Test `alg: none` attack (strip signature, set alg to none), test HS256/RS256 confusion (sign token with RSA public key as HMAC secret — public key is often available at `/jwks.json` or `/.well-known/openid-configuration`), test algorithm confusion with empty string, test `kid` parameter injection (SQL injection in `kid` header, path traversal to known file with empty/known content), attempt key derivation if token entropy appears low | +30 | `exploit/jwt-forge` | JWT algorithm confusion is a critical authentication bypass. The RS256→HS256 confusion attack requires only the public key (which is public by design) and produces a valid signature accepted by vulnerable implementations. `alg: none` works against libraries that trust the token's own algorithm claim. Both attacks result in forging arbitrary JWT claims = full auth bypass. |
| `cors-wildcard-or-null` | Identify sensitive endpoints (profile data, tokens, payment info, PII), craft PoC page that makes credentialed cross-origin request to sensitive endpoint and exfiltrates response, test `Origin: null` (sandbox iframe bypass), test subdomain-based CORS (`Origin: evil.target.com` if wildcard is `*.target.com`), verify that `Access-Control-Allow-Credentials: true` is present (required for exploitation) | +20 | `exploit/cors-theft` | CORS misconfiguration alone is low unless paired with sensitive data exposure. The exploitation chain: victim visits attacker page → attacker's JS makes credentialed XHR to target API → target responds with CORS headers allowing attacker origin → API response (tokens, PII, account data) exfiltrated to attacker. Requires `Allow-Credentials: true` to steal cookies/tokens. |
| `s3-bucket-listing` | Enumerate all objects in bucket, look for credentials/config files/backups, test for write access (upload a test file), test for ACL misconfiguration (public-read-write = supply chain attack), check bucket policy via `?policy` query, look for other bucket names in listed objects (references to other internal buckets) | +25 | `exploit/s3-abuse` | Listable S3 bucket is a confirmed data breach vector. Automated tools rarely test write access — manual testing can reveal public-read-write ACL which enables supply chain attacks (overwrite JavaScript files, insert malware into downloadable software packages). Even read-only listing may expose credentials, database backups, or PII. |
| `reflected-input` | Identify reflection context (HTML body, HTML attribute, JavaScript string, JavaScript template literal, CSS value, URL parameter in `href`), develop context-appropriate XSS payload (plain `<script>`, attribute-breaking `" onmouseover=`, JS-context `'-alert(1)-'`, DOM-based `#<img src=x onerror=>`), test CSP bypass if CSP is present (JSONP endpoints, Angular gadgets, CDN whitelisted hosts), confirm full XSS execution with `alert(document.domain)` | +15 | `test/xss-test` | Reflected input is a precondition, not a vulnerability. The reflection context determines exploitability and payload. HTML body reflection with no encoding = trivial XSS. Attribute context = requires quote breakout. JS string context = requires string termination. Each context needs a different payload family. Never report reflected input — only report confirmed XSS with executed payload. |
| `rate-limit-absent-auth` | Credential stuffing against login endpoint with common password list, OTP/2FA code brute force if 6-digit numeric codes are used (1M combinations, window typically 30-60s allows ~2-3 attempts per window — test window reset behavior), password reset token brute force (test entropy of reset tokens), account lockout bypass (test `X-Forwarded-For` rotation, user enumeration via timing difference in locked vs valid accounts) | +15 | `test/brute-force` | Missing rate limiting on authentication endpoints is exploitable but requires proof of impact. Credential stuffing needs a known-breached credential list for the target's user base. OTP brute force needs a timing attack on the validation window. The real finding is demonstrated account takeover, not just "no rate limit" — the latter is often low/informational. |
| `old-software-version` | CVE lookup for exact version (`searchsploit`, NVD, ExploitDB), check for public PoC on GitHub, test authentication bypass CVEs first (highest impact), check for memory corruption CVEs if service is internet-facing, verify exploitability against actual service response (some CVEs require specific configuration or are patched in vendor backports), develop custom exploit if public PoC requires adaptation | +20 | `test/cve-exploit` | Known software versions have searchable CVE databases. Critical CVEs with public PoCs against unpatched production systems are immediate criticals. The key is verifying exploitability — many CVEs require specific configurations not present in target. Always attempt exploitation rather than just reporting version disclosure. |
| `ssrf-partial` | Blind SSRF confirmation via DNS callback (use `*.burpcollaborator.net` or `interactsh`), test for cloud metadata access (`http://169.254.169.254/latest/meta-data/`), test for internal service discovery (scan common internal ports via SSRF: 80, 443, 8080, 8443, 3000, 5000, 8888), DNS rebinding for SSRF bypass, try alternative URL schemes (`gopher://`, `dict://`, `file://`, `ftp://`), test for SSRF in less-obvious parameters (webhook URLs, avatar URLs, PDF generation endpoints, XML imports) | +20 | `test/blind-ssrf` | Partial SSRF (e.g., DNS-only, blocked HTTP) may become full SSRF with technique changes. DNS rebinding can convert DNS-only SSRF into HTTP request capability. `gopher://` scheme bypass is effective against Redis (arbitrary command execution), Memcached, and SMTP (email relay). Cloud metadata SSRF is an automatic critical on cloud-hosted targets. |
| `file-upload-accepted` | Extension bypass (double extension `shell.php.jpg`, null byte `shell.php%00.jpg`, MIME type mismatch, polyglot files), path traversal in filename (`../../../var/www/html/shell.php`), stored XSS via SVG upload (`<svg onload=alert(1)>`), SSRF via URL-based upload (if application fetches remote URLs), check upload storage location (same origin = webshell execution possible, S3 = supply chain), test image processing CVEs (ImageMagick CVE-2016-3714 "ImageTragick", libvips, Pillow), check for zip slip via archive upload | +20 | `test/file-upload` | File upload is one of the highest-value attack surfaces. The attack path depends on server-side processing: PHP/ASP.NET server that serves uploaded files directly = webshell = RCE. Image processing pipeline = ImageMagick/libvips CVE exploitation. SVG rendering in browser = stored XSS. URL-fetch upload = SSRF. Each mechanism requires different payload development. |
| `websocket-endpoint` | WebSocket authentication bypass (test connecting without session cookie, test with another user's cookie), WebSocket injection (CRLF injection in handshake headers, message injection if messages are reflected), Cross-Site WebSocket Hijacking (CSWSH — WebSocket lacks CORS, only checks `Origin` header which is forgeable in non-browser contexts), test for lack of authorization on WebSocket messages vs HTTP equivalents, test race conditions on WS message ordering | +15 | `test/websocket` | WebSockets frequently lack the same security controls applied to HTTP endpoints. The most impactful finding is CSWSH: a malicious page can open a WebSocket connection to the target (using the victim's cookies) and exfiltrate real-time data or perform actions. WS auth bypass is also common — developers forget that WS upgrades need the same auth middleware as HTTP routes. |
| `api-version-old` | Access old API version (`/api/v1/`, `/v1/`, `/api/v0/`), compare endpoint list between versions (old versions often have undocumented endpoints), test for missing authorization on old version endpoints (rate limiting, auth middleware, input validation often only applied to latest version), test for BOLA/IDOR on old versions (access controls sometimes version-specific), check if old version accepts deprecated auth methods (API key in URL parameter instead of header) | +20 | `test/api-downgrade` | Old API versions are a consistent high-value target. Security controls are added incrementally — v1 rarely has the same protections as v5. The most impactful chains: old version lacks rate limiting (enables brute force), old version lacks authorization on some endpoints (enables IDOR/BOLA), old version accepts insecure auth methods (API key in URL = exposed in logs/referrer). |
| `exposed-swagger` | Full API schema extraction (all endpoints, methods, parameters, authentication schemes), identify admin/internal endpoints not linked from UI, test endpoints with missing authentication, test for BOLA by accessing other users' resources via documented object IDs, identify bulk operation endpoints (high DoS/data scraping risk), find file upload endpoints documented in spec but not reachable from UI, look for deprecated/beta API endpoints in spec | +20 | `test/api-test` | Swagger/OpenAPI spec is the complete API map. It reveals endpoints that have no UI entry point (internal admin APIs, deprecated endpoints, debug routes). The spec also shows parameter types — integer IDs signal BOLA testing opportunity, file upload parameters signal file upload testing, webhook URL parameters signal SSRF testing. |
| `spring-actuator` | Enumerate all actuator endpoints (`/actuator`, `/actuator/health`, `/actuator/env`, `/actuator/beans`, `/actuator/mappings`, `/actuator/logfile`, `/actuator/heapdump`, `/actuator/threaddump`, `/actuator/jolokia`), extract environment variables from `/env` (look for DB passwords, API keys, cloud credentials), download heap dump and analyze for credentials/session tokens, use `/jolokia` for JMX-based RCE if exposed, check `/mappings` for full route listing including internal routes | +20 | `test/actuator-abuse` | Spring Boot Actuator is consistently high-value. `/env` endpoint exposes all environment variables including database passwords and third-party API keys. `/heapdump` provides a JVM heap snapshot that can be analyzed offline for live session tokens, database credentials, and encryption keys (tools: `jhat`, Eclipse Memory Analyzer). `/jolokia` can invoke JMX MBeans for RCE on some configurations. |
| `subdomain-wildcard-dns` | Test any random subdomain for resolution (if resolves, wildcard is confirmed), check if resolved IP has an unclaimed service (Heroku, GitHub Pages, Fastly, Netlify — check their error pages), test for wildcard bypass (some wildcard DNS has specific subdomain overrides — enumerate to find them), check for wildcard cookie scope issues (cookies set on `*.target.com` are accessible to any subdomain, enabling cookie tossing attacks) | +15 | `test/subdomain-takeover` | Wildcard DNS can mask dangling CNAME records. A subdomain takeover requires: DNS record pointing to external service + external service not claimed. Wildcard DNS complicates detection but doesn't prevent takeover if a specific subdomain CNAME exists. Also: wildcard DNS means any subdomain resolves, making cookie-scope attacks viable if cookies are scoped to `*.target.com`. |
| `cloud-metadata-accessible` | Extract IAM role credentials from metadata endpoint (`/latest/meta-data/iam/security-credentials/<role>`), use credentials to enumerate AWS permissions (`aws sts get-caller-identity`, `aws iam list-attached-role-policies`), attempt privilege escalation via misconfigured IAM policies, access S3 buckets, EC2 instances, Lambda functions, Secrets Manager entries, check for IMDSv2 requirement (hop limit 1 = SSRF-accessible only from EC2 itself, hop limit > 1 = exploitable via SSRF), document full blast radius | +30 | `exploit/cloud-metadata` | Cloud metadata service access via SSRF is an automatic critical. AWS metadata at `169.254.169.254` provides IAM role credentials that rotate every 6 hours. These credentials can grant access to the entire AWS account depending on the role's permissions. The chain: SSRF → metadata → IAM creds → AWS API access → S3 data exfiltration / EC2 compromise / full account takeover. |

---

## How the Intel Module Should Process This Table

### Processing Algorithm

```
for each intel_run:
  unactioned_signals = signals where amplification_match is null
  for each signal in unactioned_signals:
    if signal.confidence < 0.2:
      skip  # too speculative

    rule = find_matching_rule(signal.type)
    if not rule:
      rule = fuzzy_match_rule(signal.description)
      if rule: boost = rule.boost * 0.5

    if rule:
      # Check for existing work item
      existing = find_work_item(
        subtype=rule.new_subtype,
        target=signal.target,
        status in ["queued", "active", "done"]
      )
      if existing and existing.status == "done" and existing.result.success:
        skip  # already handled successfully

      # Check for compound signals (chain opportunity)
      companion_signals = find_companion_signals(signal.target, chain_templates)
      if companion_signals:
        create_chain_investigation_item(signal, companion_signals, combined_boost)
      else:
        priority = calculate_priority(base=50, boost=boost, confidence=signal.confidence)
        create_work_item(
          type=rule.new_subtype.split("/")[0],
          subtype=rule.new_subtype.split("/")[1],
          target=signal.target,
          priority=priority,
          parent_id=signal.source_work_item,
          context={ signal: signal, rule: rule }
        )

      signal.amplification_match = rule.signal_type
```

### Work Item Context Payload

When creating an amplified work item, pass the following in `context`:

```json
{
  "amplified_from_signal": "<signal_id>",
  "signal_type": "<signal_type>",
  "signal_description": "<signal_description>",
  "signal_confidence": 0.85,
  "amplification_rule": "<signal_type>",
  "original_discovery_work_item": "<work_item_id>",
  "investigation_action": "<text from Investigation Action column>"
}
```

The executor uses `context.investigation_action` as the primary directive for what to do.

### When NOT to Amplify

1. `signal.confidence < 0.2` — too speculative, skip entirely
2. A `done + successful` work item already exists for this `(subtype, target)` pair
3. The signal's `target` is not in `hunt_state.scope.in_scope` — always scope-check before spawning
4. The signal type matches an item in `hunt_state.scope.exclusions` — program explicitly out of scope
5. `hunt_state.stats.cost_estimate_usd > budget_limit` — cost guard, pause amplification and alert

### Deduplication Window

Signals of the same type on the same target within a single intel run are deduplicated — only one
work item is created even if 5 signals of type `reflected-input` fire on the same endpoint. The
work item's `context` receives all 5 signals merged, so the executor can test all reflection points.
