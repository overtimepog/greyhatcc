# Recon Module -- Hunt Loop Reconnaissance

You are executing a `type: "recon"` work item within the hunt loop. Your job is to discover attack surface, emit signals, and spawn follow-on work items. You do NOT test for vulnerabilities -- you map the terrain.

## Output Contract

Every recon work item MUST return a `WorkItemResult` with these fields populated:

```json
{
  "success": true,
  "summary": "One-line summary of what was discovered",
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

- `new_surfaces` -- every new subdomain, endpoint, parameter, JS file, cloud asset, or service you discover
- `signals` -- anything anomalous or interesting that warrants deeper investigation
- `findings` -- only if you encounter something already confirmed (e.g., public S3 bucket with data, confirmed subdomain takeover)
- `gadgets` -- recon rarely produces gadgets, but if you find something chainable (e.g., open redirect during JS analysis), log it
- `new_work_items` -- follow-on work to enqueue (tech-fingerprint per live subdomain, targeted tests per technology, etc.)

## Default Tier

Recon defaults to **haiku** unless the target is complex (large scope, WAF-protected, requires multi-source correlation). Escalate to **sonnet** when:
- Target has >50 subdomains requiring correlation
- WAF/CDN fingerprinting requires evasion-aware probing
- JS analysis reveals obfuscated or packed bundles
- Cloud recon requires permission enumeration beyond basic listing

---

## Subtype: subdomain-enum

**Purpose**: Discover all subdomains for the target domain(s).

**Tools**:
- `subdomain_enum` (primary) -- MCP tool for subdomain discovery
- `crt.sh` via `WebFetch` -- Certificate Transparency logs (`https://crt.sh/?q=%.target.com&output=json`)
- `shodan_dns_domain` -- Shodan's DNS database for the domain
- `dns_records` -- resolve discovered subdomains to confirm they are live

**Execution Steps**:
1. Run `subdomain_enum` against each in-scope domain.
2. Query crt.sh for Certificate Transparency entries: `WebFetch("https://crt.sh/?q=%25.{domain}&output=json")`. Parse JSON, extract unique `name_value` fields. Split multi-line entries on newlines.
3. Query `shodan_dns_domain` for additional DNS entries.
4. Deduplicate all results into a single list.
5. For each unique subdomain, run `dns_records` to check if it resolves (A/AAAA/CNAME records). Mark as `live` or `dead`.
6. For live subdomains, check HTTP(S) availability by attempting `WebFetch` on ports 80/443. Record status code, redirect target, and response headers.

**Output**:
- `new_surfaces`: One `Surface` per live subdomain with `type: "subdomain"`, URL, and any detected response headers in `notes`.
- `signals`:
  - `"dangling-cname"` if CNAME points to unclaimed service (AWS, Azure, GitHub, Heroku, etc.)
  - `"wildcard-dns"` if wildcard resolution is detected (random subdomain resolves)
  - `"internal-subdomain"` if subdomain name suggests internal use (admin, staging, dev, internal, vpn, api-internal)
  - `"new-infrastructure"` if CT log shows very recent certificate issuance (<30 days)
- `new_work_items`: Spawn `{ type: "recon", subtype: "tech-fingerprint", target: "<subdomain>" }` for every live subdomain. Spawn `{ type: "recon", subtype: "subdomain-takeover", target: "<subdomain>" }` for any subdomain with CNAME to external service.

**Tier**: haiku. Escalate to sonnet if >100 subdomains found (correlation needed).

---

## Subtype: tech-fingerprint

**Purpose**: Identify the technology stack, WAF, and CDN for a specific host.

**Tools**:
- `tech_fingerprint` -- primary technology detection
- `header_analysis` -- HTTP security headers and server identification
- `waf_detect` -- WAF/CDN fingerprinting

**Execution Steps**:
1. Run `tech_fingerprint` against the target URL.
2. Run `header_analysis` against the target URL.
3. Run `waf_detect` against the target URL.
4. Correlate results: merge technology lists, note WAF product, note CDN provider.
5. Check for interesting headers: `X-Powered-By`, `X-AspNet-Version`, `X-Debug`, `X-Backend-Server`, `X-Real-IP`, `Server`, `Via`, `X-Amz-*`, `X-Request-Id`, custom debug headers.
6. Record framework version numbers for CVE correlation.

**Output**:
- `new_surfaces`: Update the existing surface with `tech_stack` populated. If new endpoints are revealed by redirect chains or headers, add them.
- `signals`:
  - `"debug-headers"` if X-Debug, X-Backend-Server, or similar headers are present (confidence 0.8+)
  - `"version-disclosure"` if specific software version is revealed (confidence 0.7, include version string)
  - `"no-waf"` if no WAF detected (confidence 0.6 -- indicates easier testing)
  - `"cdn-bypass-possible"` if origin IP is leaked via headers
  - `"interesting-tech"` for GraphQL, WebSocket, OAuth/OIDC, Cognito, Firebase, or other complex tech
- `new_work_items`: Based on detected technology, spawn targeted test items:
  - GraphQL detected -> `{ type: "test", subtype: "graphql-introspection", priority: 70 }`
  - WordPress detected -> `{ type: "test", subtype: "wordpress-vulns", priority: 65 }`
  - Version disclosed -> `{ type: "test", subtype: "owasp-quick", context: { cve_check: "<tech> <version>" }, priority: 60 }`
  - OAuth/JWT detected -> `{ type: "test", subtype: "auth-test", priority: 70 }`
  - No WAF -> boost priority of all test items for this target by +10
  - Debug headers -> `{ type: "test", subtype: "ssrf-test", priority: 75 }` and `{ type: "test", subtype: "header-injection", priority: 65 }`

**Tier**: haiku. Escalate to sonnet if WAF evasion needed for fingerprinting.

---

## Subtype: shodan

**Purpose**: Deep infrastructure intelligence via Shodan -- discover services, ports, banners, vulnerabilities, and certificates.

**Tools**:
- `shodan_host_lookup` -- full host details for resolved IPs
- `shodan_search` -- query Shodan's database for the organization
- `shodan_dns_domain` -- DNS entries from Shodan
- `shodan_vulns` -- known vulnerabilities for a host
- `shodan_ssl_cert` -- SSL certificate details
- `shodan_ports` -- open ports summary

**Execution Steps**:
1. Resolve target domain(s) to IP(s) using `shodan_dns_resolve`.
2. For each IP, run `shodan_host_lookup` to get full service/port/banner data.
3. Run `shodan_search` with `ssl.cert.subject.CN:{domain}` to find all hosts with matching SSL certificates (discovers hidden infrastructure, origin IPs behind CDN).
4. Run `shodan_search` with `org:"{org_name}"` if organization name is known.
5. Check `shodan_vulns` for each host IP.
6. Run `shodan_ssl_cert` for certificate chain analysis on interesting hosts.
7. Cross-reference Shodan IPs with CDN/proxy IPs to identify potential origin servers.

**Output**:
- `new_surfaces`: One `Surface` per discovered service with `type: "service"`, including port, protocol, and banner in notes.
- `signals`:
  - `"unusual-port"` for non-standard ports (not 80, 443, 22, 21, 25, 53, 110, 143, 993, 995, 3306, 5432, 8080, 8443)
  - `"old-software"` if banner reveals outdated software with known CVEs
  - `"origin-ip"` if IP appears to be origin behind CDN (no CDN headers, same SSL cert as CDN-fronted domain)
  - `"exposed-service"` for databases (MySQL 3306, PostgreSQL 5432, MongoDB 27017, Redis 6379, Elasticsearch 9200), admin panels (8080, 8443, 9090), or debug ports
  - `"known-vuln"` if `shodan_vulns` returns CVEs (include CVE IDs)
- `new_work_items`:
  - Known CVE found -> `{ type: "test", subtype: "owasp-quick", context: { cve_ids: [...] }, priority: 75 }`
  - Origin IP discovered -> `{ type: "test", subtype: "owasp-quick", target: "http://<origin_ip>", context: { note: "origin-behind-cdn" }, priority: 80 }`
  - Exposed database -> `{ type: "test", subtype: "auth-test", context: { service: "database", port: N }, priority: 85 }`

**Tier**: haiku.

---

## Subtype: osint

**Purpose**: Gather organizational intelligence -- company background, acquisitions, tech stack from job postings, breach data, employee information.

**Tools**:
- `perplexity_ask` -- AI-powered web search for company intelligence
- `WebSearch` -- general web search
- `whois_lookup` -- domain registration data

**Execution Steps**:
1. Run `perplexity_ask` with: "Company background, technology stack, recent acquisitions, security incidents, and data breaches for {target}. Include any HackerOne or bug bounty history."
2. Run `perplexity_ask` with: "Job postings for {target} that reveal technology stack, internal tools, VPN products, security tools, or cloud providers."
3. Run `whois_lookup` for the primary domain. Note registrant org, registration date, nameservers.
4. Run `perplexity_ask` with: "{target} data breaches, leaked credentials, exposed repositories, or security incidents in the past 2 years."
5. If acquisitions found, note acquired company domains for scope expansion consideration.
6. Search for GitHub organization: `WebSearch("{target} site:github.com org:")`.

**Output**:
- `new_surfaces`: Acquired company domains (if in scope), discovered GitHub repos, exposed services mentioned in breach reports.
- `signals`:
  - `"recent-acquisition"` for companies acquired in last 2 years (confidence 0.7 -- these are often weakly integrated)
  - `"breach-history"` if target has had data breaches (include types of data leaked)
  - `"exposed-repo"` if public GitHub repos found with potential secrets
  - `"tech-stack-intel"` with list of technologies from job postings (frameworks, databases, cloud providers, CI/CD tools)
  - `"credential-leak"` if breach databases show leaked credentials for the target domain
- `new_work_items`:
  - GitHub repo found -> `{ type: "recon", subtype: "js-analysis", target: "<repo_url>", priority: 65 }`
  - Acquisition found -> `{ type: "recon", subtype: "subdomain-enum", target: "<acquired_domain>", priority: 55 }`
  - Tech stack discovered -> targeted test items per technology (see tech-fingerprint spawn rules)

**Tier**: haiku for single-source. Sonnet if multiple sources need correlation.

---

## Subtype: js-analysis

**Purpose**: Analyze JavaScript bundles for API endpoints, secrets, source maps, debug flags, internal paths, and S3/cloud references.

**Tools**:
- `browser_navigate` + `browser_evaluate` (Playwright) -- load page and extract all script sources
- `web_js_extract` -- extract JS from web pages
- `web_evaluate` -- execute JS in page context
- `WebFetch` -- download JS files and source maps directly

**Execution Steps**:
1. Navigate to target URL with Playwright (`browser_navigate`).
2. Extract all script sources from the page: `browser_evaluate("Array.from(document.querySelectorAll('script[src]')).map(s => s.src)")`.
3. Also extract inline scripts: `browser_evaluate("Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent.substring(0, 5000))")`.
4. For each external JS file:
   a. Fetch the JS content with `WebFetch`.
   b. Check for source map reference: look for `//# sourceMappingURL=` at end of file.
   c. If source map exists, fetch it with `WebFetch`. This is HIGH VALUE -- source maps reveal complete original source code.
5. Search all JS content for:
   - **API endpoints**: regex for `/api/`, `/v1/`, `/v2/`, `/graphql`, URL path patterns
   - **Secrets**: regex for `apiKey`, `api_key`, `secret`, `token`, `password`, `AWS_`, `REACT_APP_`, `NEXT_PUBLIC_`, `firebase`, `Bearer `, base64-encoded strings that decode to key-like values
   - **S3/Cloud references**: `s3.amazonaws.com`, `.blob.core.windows.net`, `storage.googleapis.com`, `firebaseio.com`, `cognito-idp`
   - **Internal paths**: `/admin`, `/internal`, `/debug`, `/actuator`, `/health`, `/metrics`, `/swagger`, `/api-docs`
   - **Debug flags**: `debug`, `DEBUG`, `isDev`, `isStaging`, `__DEV__`, `enableDebug`
   - **Environment indicators**: `process.env`, `window.__ENV__`, `window.__CONFIG__`
6. Parse webpack chunk manifests if present to discover additional JS bundles.
7. Check for `.map` files alongside every `.js` file (try appending `.map` to URL).

**Output**:
- `new_surfaces`: One `Surface` per discovered API endpoint with `type: "api_route"`, method if determinable, and parameters. One `Surface` per JS file with `type: "js_file"`.
- `signals`:
  - `"source-map-exposed"` -- HIGH VALUE signal (confidence 0.95). Source maps allow full source code reconstruction.
  - `"api-key-in-js"` -- include the key type and a redacted version (confidence 0.85)
  - `"debug-flag-enabled"` -- debug/staging indicators in production (confidence 0.7)
  - `"hidden-api-endpoint"` -- undocumented API routes found in JS (confidence 0.8)
  - `"cloud-reference"` -- S3 buckets, Firebase URLs, Cognito pools (confidence 0.9)
  - `"internal-path"` -- admin or internal paths referenced (confidence 0.75)
- `gadgets`: If an API key or cloud credential is found, create a gadget with `provides: ["api_key"]` or `provides: ["cloud_credentials"]`.
- `new_work_items`:
  - Source map found -> `{ type: "recon", subtype: "js-analysis", target: "<map_url>", context: { is_source_map: true }, priority: 85 }`
  - API endpoints found -> `{ type: "test", subtype: "api-test", target: "<endpoint>", priority: 70 }` per endpoint
  - S3 bucket found -> `{ type: "recon", subtype: "cloud-recon", target: "<bucket_url>", priority: 75 }`
  - Admin path found -> `{ type: "test", subtype: "auth-test", target: "<admin_path>", priority: 75 }`
  - API key found -> `{ type: "test", subtype: "api-test", context: { leaked_key: true }, priority: 80 }`

**Tier**: sonnet (JS analysis requires pattern recognition). Haiku for quick endpoint-only extraction when `context.quick_mode` is set.

---

## Subtype: cloud-recon

**Purpose**: Enumerate cloud assets -- S3 buckets, GCS buckets, Azure blobs, Firebase databases, Cognito pools, and CDN origins.

**Tools**:
- `WebFetch` -- probe cloud asset URLs
- `WebSearch` -- search for exposed cloud assets
- `shodan_search` -- find cloud infrastructure
- `perplexity_ask` -- search for known cloud exposures
- `dns_records` -- resolve cloud asset CNAMEs

**Execution Steps**:
1. Generate bucket name permutations from target domain and company name:
   - `{company}`, `{company}-dev`, `{company}-staging`, `{company}-prod`, `{company}-backup`, `{company}-assets`, `{company}-uploads`, `{company}-static`, `{company}-logs`, `{company}-data`, `{domain}`, `{domain}-backup`, `{subdomain}` for each known subdomain
2. For each permutation, check:
   - S3: `WebFetch("https://{name}.s3.amazonaws.com/")` -- look for `ListBucketResult` (public listing) or `AccessDenied` (exists but private)
   - GCS: `WebFetch("https://storage.googleapis.com/{name}/")` -- similar checks
   - Azure: `WebFetch("https://{name}.blob.core.windows.net/")` -- check for container listing
3. Check Firebase: `WebFetch("https://{company}.firebaseio.com/.json")` -- returns data if public
4. Check Cognito: look for `cognito-idp.{region}.amazonaws.com` references in JS analysis results. If pool ID found, test for unauthenticated signup flows.
5. CDN origin discovery:
   - Check SPF records via `dns_records` for origin IPs
   - Check MX records for mail server IPs (often same network as web servers)
   - Compare Shodan SSL cert results with CDN-fronted domain cert

**Output**:
- `new_surfaces`: One `Surface` per discovered cloud asset with `type: "cloud_asset"`.
- `findings`: If a bucket/database is publicly readable with data, this is a confirmed finding:
  - `{ severity: "high", vulnerability_type: "cloud-misconfiguration", title: "Public S3 bucket {name} exposes {data_type}" }`
- `signals`:
  - `"bucket-exists"` for buckets that exist but are private (potential for policy misconfiguration)
  - `"public-bucket"` for publicly listable/readable buckets (confidence 0.95)
  - `"firebase-open"` for Firebase databases returning data without auth (confidence 0.95)
  - `"cognito-pool"` for discovered Cognito user pool IDs (confidence 0.8)
  - `"cdn-origin"` for discovered origin IPs behind CDN (confidence varies)
- `new_work_items`:
  - Public bucket -> `{ type: "exploit", subtype: "cloud-exploit", target: "<bucket>", priority: 85 }`
  - Cognito pool -> `{ type: "test", subtype: "auth-test", context: { cognito_pool_id: "..." }, priority: 75 }`
  - CDN origin -> `{ type: "test", subtype: "owasp-quick", target: "http://<origin_ip>", priority: 80 }`

**Tier**: haiku for enumeration. Sonnet if permission testing or policy analysis needed.

---

## Subtype: h1-research

**Purpose**: Gather HackerOne program intelligence -- scope, bounty table, disclosed reports, program policy, and known weaknesses for deduplication.

**Tools**:
- `h1_program_detail` -- program metadata and response metrics
- `h1_structured_scopes` -- exact scope assets with eligibility and max severity
- `h1_bounty_table` -- bounty ranges by severity
- `h1_program_policy` -- full policy text with rules and exclusions
- `h1_scope_summary` -- quick in-scope/out-of-scope overview
- `h1_hacktivity` -- disclosed reports (use `disclosed_only: true`)
- `h1_program_weaknesses` -- CWE types the program accepts

**Execution Steps**:
1. Call all H1 API tools in parallel:
   - `h1_program_detail(handle)` -- get program stats, response times, state
   - `h1_structured_scopes(handle)` -- get exact assets, types, eligibility, max severity per asset
   - `h1_bounty_table(handle)` -- get payout ranges
   - `h1_program_policy(handle)` -- get full policy including exclusions
   - `h1_hacktivity(handle, disclosed_only=true)` -- get disclosed reports for dedup awareness
   - `h1_program_weaknesses(handle)` -- get accepted CWE types
   - `h1_scope_summary(handle)` -- quick overview
2. Parse scope into `ScopeDefinition`:
   - `in_scope`: all eligible assets
   - `out_of_scope`: all ineligible assets
   - `bounty_table`: severity -> min/max payout
   - `exclusions`: extract from policy text (look for "Out of scope", "Not eligible", "Will not accept", exclusion lists)
   - `program_policy`: raw policy text
3. Parse hacktivity for dedup intelligence:
   - Extract vulnerability types and affected assets from disclosed reports
   - Build a "common dupes" list for this program
   - Note any patterns (same vuln type reported multiple times = high dupe risk)
4. Build priority multipliers from bounty table:
   - Critical payout > $5000 -> boost critical-path testing
   - Low payout < $100 -> deprioritize low-severity standalone findings

**Output**:
- This subtype primarily produces context for the hunt state, not surfaces/signals:
  - Write `scope.md` to `hunt-state/scope/`
  - Write `bounty_table.json` to `hunt-state/`
  - Write `common_dupes.json` to `hunt-state/`
- `signals`:
  - `"high-bounty-program"` if critical payout > $10,000
  - `"new-program"` if program launched within 60 days (high ROI window)
  - `"narrow-scope"` if fewer than 5 in-scope assets (focus deep)
  - `"wide-scope"` if wildcard domains or >20 assets (breadth-first recon)
  - `"strict-exclusions"` if exclusion list is extensive (avoid wasted work)
  - `"common-dupe-risk"` for each vuln type with 3+ disclosed reports
- `new_work_items`:
  - Per in-scope domain -> `{ type: "recon", subtype: "subdomain-enum", target: "<domain>", priority: 60 }`
  - Per in-scope URL -> `{ type: "recon", subtype: "tech-fingerprint", target: "<url>", priority: 55 }`
  - Wildcard scope -> `{ type: "recon", subtype: "subdomain-enum", priority: 65 }`
  - If program is new -> boost all work item priorities by +10

**Tier**: haiku (API calls are deterministic, no complex reasoning needed).

---

## Subtype: subdomain-takeover

**Purpose**: Check subdomains for dangling DNS records that could allow takeover.

**Tools**:
- `dns_records` -- get CNAME, NS, MX records
- `WebFetch` -- check HTTP responses for takeover signatures

**Execution Steps**:
1. For each target subdomain, query `dns_records` for CNAME, A, NS, and MX records.
2. If CNAME exists, check if the CNAME target is claimable:
   - **AWS S3**: CNAME to `*.s3.amazonaws.com` + `WebFetch` returns `NoSuchBucket`
   - **GitHub Pages**: CNAME to `*.github.io` + 404 response
   - **Heroku**: CNAME to `*.herokuapp.com` + `No such app` error
   - **Azure**: CNAME to `*.azurewebsites.net` or `*.cloudapp.azure.com` + error page
   - **Shopify**: CNAME to `shops.myshopify.com` + `Sorry, this shop is currently unavailable`
   - **Fastly**: CNAME to `*.fastly.net` + `Fastly error: unknown domain`
   - **Pantheon**: CNAME to `*.pantheonsite.io` + 404
   - **Tumblr**: CNAME to `*.tumblr.com` + `There's nothing here`
   - **WordPress.com**: CNAME to `*.wordpress.com` + error
   - **Unbounce**: CNAME to `unbouncepages.com` + error
   - **Zendesk**: CNAME to `*.zendesk.com` + `Help Center Closed`
3. Check NS records: if NS points to a nameserver you could register/claim, this is NS takeover (full zone control -- CRITICAL).
4. Check MX records: if MX points to unclaimed service, this is MX takeover (email interception including password resets -- HIGH).
5. For confirmed takeovers, document the exact claim process.

**Output**:
- `findings`: Confirmed takeover is a direct finding:
  - CNAME takeover -> `{ severity: "medium", vulnerability_type: "subdomain-takeover", title: "Subdomain Takeover on {subdomain} via dangling CNAME to {service}" }`
  - NS takeover -> `{ severity: "critical", vulnerability_type: "ns-takeover" }`
  - MX takeover -> `{ severity: "high", vulnerability_type: "mx-takeover" }`
- `gadgets`: Every confirmed takeover is also a gadget with `provides: ["trusted_origin", "js_hosting", "cookie_scope"]`
- `signals`:
  - `"dangling-cname"` for CNAMEs pointing to unresponsive but not yet confirmed claimable targets
  - `"dangling-ns"` for NS records pointing to potentially claimable nameservers
  - `"dangling-mx"` for MX records pointing to potentially claimable mail services
- `new_work_items`:
  - Confirmed takeover -> `{ type: "validate", target: "<subdomain>", priority: 85 }`
  - Takeover with CORS on sibling domain -> `{ type: "exploit", subtype: "chain-exploit", context: { chain: "takeover+cors" }, priority: 90 }`

**Tier**: haiku (deterministic checks). Sonnet if second-order takeover analysis needed.

---

## Subtype: port-scan

**Purpose**: Discover open ports and running services on target hosts.

**Tools**:
- `port_check` -- MCP port scanning tool
- `shodan_host_lookup` -- Shodan host data (passive, no active scanning)
- `shodan_internetdb` -- quick IP lookup (no API key needed)

**Execution Steps**:
1. Resolve target to IP address(es).
2. Run `shodan_internetdb` for quick passive port data (no rate limits).
3. Run `port_check` for active port scanning on the target.
4. Run `shodan_host_lookup` for detailed service banners and version info.
5. Correlate results: merge port lists, note discrepancies (port open on active scan but not in Shodan = recently opened).
6. For each open port, identify the service and version from banner data.
7. Check for common interesting port/service combinations:
   - 9200 (Elasticsearch), 27017 (MongoDB), 6379 (Redis), 5432 (PostgreSQL), 3306 (MySQL) -- databases
   - 8080, 8443, 9090, 3000, 4000, 5000 -- application servers
   - 2375/2376 (Docker API), 10250 (Kubelet), 6443 (K8s API) -- container orchestration
   - 11211 (Memcached), 8500 (Consul), 2181 (ZooKeeper) -- infrastructure services
   - 9091, 9100 (Prometheus), 3100 (Loki), 16686 (Jaeger) -- monitoring
   - 5601 (Kibana), 8888 (Jupyter) -- dashboards
   - 4443, 8444 (admin panels), 1433 (MSSQL), 1521 (Oracle) -- enterprise databases

**Output**:
- `new_surfaces`: One `Surface` per open port/service with `type: "service"`.
- `signals`:
  - `"exposed-database"` for database ports accessible from internet (confidence 0.9)
  - `"exposed-admin"` for admin/dashboard ports (confidence 0.8)
  - `"exposed-container-api"` for Docker/K8s APIs (confidence 0.95 -- CRITICAL if unauthenticated)
  - `"unusual-port"` for non-standard ports not in the common list above
  - `"recently-opened"` for ports found in active scan but not Shodan (recently deployed)
  - `"version-banner"` with software name and version from banner
- `new_work_items`:
  - Database port open -> `{ type: "test", subtype: "auth-test", context: { service: "database", port: N }, priority: 80 }`
  - Admin panel -> `{ type: "test", subtype: "auth-test", target: "http://<ip>:<port>", priority: 75 }`
  - Container API -> `{ type: "test", subtype: "auth-test", context: { service: "container-api" }, priority: 90 }`
  - Version banner -> `{ type: "test", subtype: "owasp-quick", context: { version: "..." }, priority: 65 }`

**Tier**: haiku.

---

## General Recon Rules

1. **Every live host gets tech-fingerprinted.** No exceptions. If you discover a subdomain or service, spawn a tech-fingerprint work item.

2. **Signals are cheap, findings are expensive.** When in doubt, emit a signal rather than claiming a finding. Let the test module confirm.

3. **Context flows downstream.** Always populate `context` on spawned work items with relevant recon data (discovered tech, headers, versions, endpoints). The test module should not need to re-discover what you already found.

4. **Dedup your surfaces.** Before adding a surface, check if it already exists in hunt state. If a subdomain was already discovered, do not re-add it -- but DO check if new information should update the existing surface.

5. **Respect scope.** Before spawning work items for newly discovered assets, verify they fall within the program's `in_scope` definition. Wildcard scopes (`*.example.com`) match subdomains. Do not spawn work for out-of-scope targets.

6. **Parallelize aggressively.** Recon subtypes are largely independent. The orchestrator should run subdomain-enum, osint, shodan, and h1-research in parallel. JS-analysis and cloud-recon can run once initial subdomains are known.

7. **Escalation path.** If a recon subtype fails (tool timeout, rate limit, empty results), retry once with adjusted parameters. If it fails again, emit a `"recon-failed"` signal with the subtype and target, and move on. Do not block the hunt loop on failed recon.
