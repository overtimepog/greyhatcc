---
name: tech-fingerprint
description: Detect and document target technology stack including web frameworks, servers, CDNs, JavaScript libraries, and third-party services
---

# Technology Stack Fingerprinting

## Usage
Part of the recon workflow.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

---

## Detection Methods

### 1. HTTP Response Headers
Use MCP tool `greyhatcc_sec__header_analysis` for comprehensive header analysis.

| Header | Technology Indicator | Example Values |
|--------|---------------------|----------------|
| `Server` | Web server | `Apache/2.4.54`, `nginx/1.24`, `Microsoft-IIS/10.0`, `openresty`, `Kestrel` |
| `X-Powered-By` | Backend framework | `PHP/8.2`, `ASP.NET`, `Express`, `Next.js`, `Servlet/3.1` |
| `X-AspNet-Version` | .NET version | `4.0.30319` |
| `X-AspNetMvc-Version` | ASP.NET MVC | `5.2` |
| `X-Generator` | CMS/framework | `WordPress 6.4`, `Drupal 10`, `Hugo 0.121` |
| `X-Drupal-Cache` | Drupal CMS | Present = Drupal confirmed |
| `X-Varnish` | Varnish cache | Varnish cache layer in use |
| `X-Content-Type-Options` | Security awareness | Indicates security header awareness |
| `X-Frame-Options` | Framework defaults | Value hints at framework (e.g., SAMEORIGIN = Rails default) |
| `Strict-Transport-Security` | TLS maturity | max-age value indicates security maturity |
| `CF-RAY` | Cloudflare CDN | `<hex>-<datacenter>` |
| `X-Amz-Cf-Id` / `X-Amz-Cf-Pop` | CloudFront CDN | AWS CloudFront distribution |
| `X-Cache` | CDN/cache layer | `HIT from cloudfront`, `MISS`, cache behavior |
| `Via` | Proxy/CDN chain | `1.1 varnish`, `1.1 google`, proxy stack |
| `X-Akamai-*` | Akamai CDN | Various Akamai diagnostic headers |

### 2. Cookie Names
Cookie names are highly reliable technology indicators:

| Cookie Name | Technology | Confidence |
|-------------|-----------|------------|
| `JSESSIONID` | Java (Tomcat, Spring, JBoss) | HIGH |
| `ASP.NET_SessionId` | ASP.NET | HIGH |
| `PHPSESSID` | PHP | HIGH |
| `connect.sid` | Express.js (Node.js) | HIGH |
| `laravel_session` | Laravel (PHP) | HIGH |
| `XSRF-TOKEN` | Laravel / Angular default | MEDIUM |
| `_rails_session` / `_session_id` | Ruby on Rails | HIGH |
| `csrftoken` | Django (Python) | HIGH |
| `sessionid` | Django (Python) | MEDIUM |
| `ci_session` | CodeIgniter (PHP) | HIGH |
| `_gorilla_csrf` | Go (Gorilla toolkit) | HIGH |
| `wordpress_*` / `wp-*` | WordPress | HIGH |
| `__cfduid` / `__cf_bm` | Cloudflare | HIGH |
| `_ga` / `_gid` | Google Analytics | HIGH |
| `_fbp` | Facebook Pixel | HIGH |
| `AWSALBCookie` / `AWSALB` | AWS ALB | HIGH |
| `incap_ses_*` | Imperva/Incapsula WAF | HIGH |

### 3. JavaScript Framework Detection
Use Playwright `browser_evaluate` to detect frontend frameworks:

```javascript
// React detection
!!document.querySelector('[data-reactroot]') ||
!!window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
!!document.querySelector('#__next')  // Next.js

// Angular detection
!!window.ng || !!document.querySelector('[ng-version]') ||
!!document.querySelector('[ng-app]')

// Vue.js detection
!!window.__VUE__ || !!document.querySelector('[data-v-]') ||
!!window.__NUXT__  // Nuxt.js

// jQuery detection
!!window.jQuery || !!window.$

// Svelte detection
!!document.querySelector('[class*="svelte-"]')

// Ember.js detection
!!window.Ember || !!document.querySelector('.ember-view')
```

### 4. Meta Tags & HTML Patterns

| Pattern | Technology | Where to Look |
|---------|-----------|---------------|
| `<meta name="generator" content="WordPress X.Y">` | WordPress | `<head>` |
| `<meta name="generator" content="Drupal X">` | Drupal | `<head>` |
| `<meta name="generator" content="Joomla!">` | Joomla | `<head>` |
| `<div id="__next">` | Next.js | Body |
| `<div id="__nuxt">` | Nuxt.js | Body |
| `<script src="/_next/static/">` | Next.js | Script tags |
| `<script src="/static/js/main.*.js">` | React (CRA) | Script tags |
| `/wp-content/`, `/wp-includes/` | WordPress | Any URL path |
| `/static/admin/` | Django Admin | URL paths |
| `/rails/info/properties` | Rails (dev mode) | URL path probe |
| `<link href="/assets/application-*.css">` | Rails asset pipeline | `<head>` |

### 5. Favicon Hash Matching
Compute favicon hash for Shodan cross-reference:

```python
import mmh3, codecs, requests
response = requests.get('https://target.com/favicon.ico')
favicon_hash = mmh3.hash(codecs.lookup('base64').encode(response.content)[0])
# Search Shodan: http.favicon.hash:<hash>
```

Use `greyhatcc_s__shodan_search` with query `http.favicon.hash:<hash>` to find related infrastructure.

### 6. Error Page Fingerprinting

| Error Page Pattern | Technology |
|--------------------|-----------|
| "Whitelabel Error Page" with Spring branding | Spring Boot |
| "Laravel" in stack trace | Laravel |
| "Django" debug page with yellow/blue theme | Django (DEBUG=True) |
| "Application Error" with Heroku branding | Heroku |
| IIS detailed error with physical path | IIS / ASP.NET |
| "You're seeing this error because DEBUG = True" | Django |
| "Routing Error" with Rails routes table | Ruby on Rails |
| Apache "Not Found" with server version | Apache |
| nginx default page | nginx |
| Tomcat default error with stack trace | Apache Tomcat |
| Express default error "Cannot GET /path" | Express.js |

Trigger errors with:
- Non-existent paths: `/404test`, `/nonexistent`
- Invalid parameters: `?id=<>`, `?q='`
- Large payloads: Oversized URL or body
- Invalid HTTP methods: `PURGE`, `TRACE`

### 7. Default Files & Paths

| Path | Technology | Significance |
|------|-----------|-------------|
| `/robots.txt` | Any — check contents | May reveal framework-specific paths |
| `/sitemap.xml` | CMS platforms | Structure reveals CMS type |
| `/wp-json/wp/v2/` | WordPress REST API | Confirms WordPress, version in response |
| `/wp-login.php` | WordPress | Login page |
| `/administrator/` | Joomla | Admin panel |
| `/user/login` | Drupal | Login page |
| `/actuator/health` | Spring Boot | Actuator endpoint |
| `/actuator/info` | Spring Boot | App info endpoint |
| `/swagger-ui.html` | Spring/Java APIs | API documentation |
| `/api-docs` | Various API frameworks | OpenAPI spec |
| `/graphql` | GraphQL implementations | GraphQL endpoint |
| `/graphiql` | GraphQL with IDE | GraphQL IDE |
| `/.well-known/openid-configuration` | OIDC provider | Auth configuration |
| `/server-status` | Apache mod_status | Server stats |
| `/nginx_status` | nginx stub_status | nginx stats |
| `/elmah.axd` | ASP.NET ELMAH | Error log viewer |
| `/_next/data/` | Next.js | Data fetching routes |
| `/__nextjs_original-stack-frame` | Next.js (dev) | Development mode |

### 8. Shodan Banners
Use MCP tool `greyhatcc_s__shodan_host_lookup` for:
- Service versions from banner grabbing
- OS fingerprinting
- SSL certificate details (reveals hosting, org)
- HTTP component details (framework, server, libraries)

---

## CVE Correlation

For each detected technology+version, automatically check for known vulnerabilities:

### Lookup Process
1. Use MCP tool `greyhatcc_sec__cve_search` with `<technology> <version>` as query
2. Use MCP tool `greyhatcc_s__shodan_vulns` for host-level CVE data
3. Cross-reference Shodan vulnerability data with detected versions

### Version-Specific Attack Vectors

| Technology + Version | Known Attack Vectors | CVE Check Query |
|---------------------|---------------------|-----------------|
| Apache < 2.4.51 | Path traversal (CVE-2021-41773) | `apache 2.4` |
| nginx < 1.22 | Request smuggling variants | `nginx` |
| Spring Boot < 3.0 | SpEL injection, actuator RCE | `spring boot` |
| Log4j < 2.17 | Log4Shell RCE (CVE-2021-44228) | `log4j` |
| WordPress < 6.4 | Various plugin/core vulns | `wordpress <version>` |
| Drupal < 10.2 | Various RCE/auth bypass | `drupal <version>` |
| Laravel < 10 | Debug mode RCE, CSRF bypass | `laravel` |
| Django < 5.0 | SQL injection, XSS variants | `django <version>` |
| jQuery < 3.5 | XSS via html() (CVE-2020-11022) | `jquery` |
| Express < 4.19 | Various middleware vulns | `express` |
| Tomcat < 10.1 | Deserialization, ghostcat | `tomcat <version>` |
| IIS < 10.0 | Short filename disclosure, WebDAV | `iis` |
| PHP < 8.2 | Type juggling, various CVEs | `php <version>` |
| Node.js < 20 | Prototype pollution, HTTP smuggling | `node.js <version>` |
| OpenSSL < 3.2 | Various TLS vulns | `openssl <version>` |

### Priority Matrix
After CVE lookup, prioritize by:
1. **RCE vulnerabilities** with public exploit → Test immediately
2. **Auth bypass** vulnerabilities → Test immediately
3. **Information disclosure** with known exploit → Test next
4. **DoS vulnerabilities** → Note but don't test (usually OOS)
5. **Theoretical vulnerabilities** without exploit → Add to gadgets as potential

---

## Output
`recon/tech_stack.md` with:
- Detected technologies and versions (with confidence: HIGH/MEDIUM/LOW)
- Detection method for each (header, cookie, HTML, error page, Shodan)
- Associated CVEs with CVSS scores and exploit availability
- Recommended testing priorities based on tech stack
- Framework-specific attack vectors to pursue

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining (e.g., detected tech version with known CVE provides `debug_info` or `api_endpoint`)
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
