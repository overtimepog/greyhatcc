# Gadget Chaining Rules

> "Does bug A produce input for bug B?"

## Provides/Requires Vocabulary

| Tag | Description | Example Source |
|-----|-------------|---------------|
| `redirect-control` | Can redirect users to arbitrary URLs | Open redirect parameter |
| `html-injection` | Can inject HTML in trusted context | Self-XSS, stored HTML injection |
| `cookie-access` | Can read/set cookies on target domain | Subdomain takeover, XSS |
| `cookie-scope` | Can set cookies scoped to parent domain | Subdomain control |
| `session-token` | Has valid session token for another user | Token theft, session fixation |
| `csrf-token-leak` | Can leak CSRF tokens cross-origin | CORS misconfiguration |
| `victim-interaction` | Requires victim to visit attacker URL | Social engineering prerequisite |
| `auth-bypass` | Can bypass authentication entirely | JWT none alg, auth logic flaw |
| `ssrf-access` | Can make server-side requests | SSRF in URL parameter |
| `cloud-credentials` | Has cloud IAM/API credentials | SSRF to metadata endpoint |
| `file-write` | Can write files to server filesystem | File upload, path traversal |
| `file-read` | Can read arbitrary server files | LFI, path traversal |
| `path-control` | Can control file paths on server | Path traversal in filename |
| `code-execution` | Can execute code on server | RCE, SSTI, deserialization |
| `script-execution` | Can execute JS in victim browser | XSS (any type) |
| `cross-origin-read` | Can read cross-origin responses with creds | CORS misconfiguration |
| `cross-origin-write` | Can write/mutate cross-origin with creds | CORS with write methods |
| `credential-relay` | Can relay auth tokens cross-origin | CORS + credential theft |
| `trusted-origin` | Can serve content from trusted domain | Subdomain takeover |
| `js-hosting` | Can host JS on trusted origin | Subdomain takeover |
| `internal-network` | Can access internal network resources | SSRF to internal services |
| `api-access` | Has access to undocumented API endpoints | API discovery, version downgrade |
| `api-key` | Has valid API key or secret | Key in JS bundle, .env exposure |
| `id-enumeration` | Can enumerate valid user/object IDs | User enumeration, sequential IDs |
| `pii-access` | Can access personally identifiable info | IDOR on profile endpoint |
| `admin-access` | Has administrative privileges | Privilege escalation |
| `debug-info` | Has debug/error info disclosing internals | Verbose errors, stack traces |
| `header-injection` | Can inject HTTP headers | CRLF injection |
| `cache-control` | Can influence cache behavior | Cache key manipulation |
| `otp-bypass` | Can bypass OTP/2FA verification | Race condition on OTP, brute force |
| `jsonp-callback` | Can control JSONP callback parameter | JSONP endpoint with user input |

## Chain Templates

### 1. Self-XSS + CSRF → ATO
- A: Self-XSS — provides: `[html-injection]`, requires: `[victim-interaction]`
- B: CSRF on XSS-vulnerable form — provides: `[victim-interaction]`
- Result: CSRF stores XSS in victim profile → JS executes → session stolen
- Severity: LOW+LOW → HIGH/CRITICAL

### 2. Open Redirect + OAuth → Token Theft
- A: Open redirect on OAuth redirect_uri domain — provides: `[redirect-control]`
- Chain: OAuth URL with redirect_uri → open redirect → token forwarded to attacker
- Severity: LOW → CRITICAL

### 3. SSRF + Cloud Metadata → IAM Theft
- A: SSRF (even partial) — provides: `[ssrf-access]`
- Chain: SSRF → 169.254.169.254 → IAM role creds → cloud API access
- Severity: MEDIUM → CRITICAL

### 4. IDOR + PII Endpoint → Mass Data Breach
- A: Sequential/predictable IDs — provides: `[id-enumeration]`
- B: API endpoint returning PII without authz — provides: `[pii-access]`, requires: `[id-enumeration]`
- Chain: Enumerate IDs → bulk-harvest PII
- Severity: MEDIUM+MEDIUM → CRITICAL

### 5. Header Injection + Cache → Stored XSS
- A: CRLF injection — provides: `[header-injection]`
- B: Caching proxy — provides: `[cache-control]`, requires: `[header-injection]`
- Chain: Inject headers → poisoned response cached → all users get XSS
- Severity: LOW+LOW → HIGH

### 6. API Downgrade + JSONP → XSS → ATO
- A: Old API version without controls — provides: `[api-access]`
- B: JSONP callback on old API — provides: `[jsonp-callback, script-execution]`, requires: `[api-access]`
- Chain: Access v1 → find JSONP → inject callback XSS → steal session
- Severity: LOW+LOW → HIGH

### 7. Race Condition + OTP → ATO
- A: No rate limiting on OTP endpoint — provides: `[otp-bypass]`
- Chain: HTTP/2 single-packet attack with 1000 OTP values → bypass 2FA
- Severity: MEDIUM → CRITICAL

### 8. File Upload + Path Traversal → RCE
- A: File upload with extension bypass — provides: `[file-write]`
- B: Path traversal in filename — provides: `[path-control]`, requires: `[file-write]`
- Chain: Upload webshell with traversal filename → access shell → RCE
- Severity: MEDIUM+MEDIUM → CRITICAL

## Graph Traversal Algorithm

### Building the Graph
```
For each gadget G in gadgets.json:
  For each capability C in G.provides:
    For each gadget H (H != G):
      If C in H.requires: Add edge G → H
```

### Finding Chains
```
For each gadget G with no unmet requirements (requires empty or satisfied):
  BFS/DFS from G following provides→requires edges
  For each path length >= 2:
    Calculate chain severity
    Check if matches known template
    If severity > max(individual): record as viable chain
```

### Severity Uplift

| Chain Length | Uplift |
|-------------|--------|
| 2 gadgets | Highest individual + 1 level |
| 3 gadgets | Highest individual + 2 levels |
| 4+ gadgets | Cap at CRITICAL |

Levels: INFO → LOW → MEDIUM → HIGH → CRITICAL

### Missing Link Detection
```
For each high-value chain template T:
  Check which gadgets match T's requirements
  If all but one exist:
    Missing gadget = "missing link"
    Create targeted test work item (priority 80)
    Context: "Looking for [capability] to complete chain: [template name]"
```
