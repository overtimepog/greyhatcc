# Gadget Chaining Rules

This document defines the methodology for building vulnerability chains from the gadget inventory. The intel module uses these rules to identify exploitable chains automatically.

## Core Philosophy

> "Does bug A produce input for bug B?"

A single low-severity finding is noise. A chain of two lows can be a critical. The gadget inventory catalogs every finding — even informational — with what it provides and what it requires. Chain analysis connects these into exploitable attack paths.

## Standard Provides/Requires Vocabulary

Use these consistent tags across all gadgets for automated matching:

### Capability Tags

| Tag | Description | Example Source |
|-----|-------------|---------------|
| `redirect-control` | Can redirect users to arbitrary URLs | Open redirect parameter |
| `html-injection` | Can inject HTML content in trusted context | Self-XSS, stored HTML injection |
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
| `script-execution` | Can execute JavaScript in victim browser | XSS (any type) |
| `cross-origin-read` | Can read cross-origin responses with creds | CORS misconfiguration |
| `cross-origin-write` | Can write/mutate cross-origin with creds | CORS with write methods |
| `credential-relay` | Can relay auth tokens cross-origin | CORS + credential theft |
| `trusted-origin` | Can serve content from trusted domain | Subdomain takeover |
| `js-hosting` | Can host JavaScript on trusted origin | Subdomain takeover |
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

## High-Value Chain Templates

These are the classic chain patterns. The intel module should check for these first.

### Chain 1: Self-XSS + CSRF → Account Takeover

```
Gadget A: Self-XSS (html-injection in own account)
  provides: [html-injection]
  requires: [victim-interaction]

Gadget B: CSRF on the XSS-vulnerable form
  provides: [victim-interaction]  (forces victim to submit form)
  requires: []

Chain: Attacker crafts page with CSRF that submits XSS payload to victim's profile.
       Victim visits attacker page → CSRF fires → XSS stored in victim's profile →
       Next time victim views profile, JS executes → session token stolen → ATO.

Severity: Individual LOW+LOW → Chain HIGH/CRITICAL
```

### Chain 2: Open Redirect + OAuth → Token Theft

```
Gadget A: Open redirect on authorized OAuth redirect_uri domain
  provides: [redirect-control]
  requires: []

Chain: Attacker crafts OAuth authorization URL with redirect_uri pointing to the
       open redirect, which then forwards to attacker's server with the OAuth code/token.

Severity: Individual LOW → Chain CRITICAL (full account takeover)
```

### Chain 3: SSRF + Cloud Metadata → IAM Credential Theft

```
Gadget A: SSRF (even partial — DNS resolution counts)
  provides: [ssrf-access]
  requires: []

Chain: SSRF request to http://169.254.169.254/latest/meta-data/iam/security-credentials/
       → Retrieve IAM role name → Retrieve temporary credentials → Use credentials to
       access S3, DynamoDB, etc.

Severity: Individual MEDIUM → Chain CRITICAL (full cloud compromise)
```

### Chain 4: IDOR + PII Endpoint → Mass Data Breach

```
Gadget A: Sequential/predictable user IDs
  provides: [id-enumeration]
  requires: []

Gadget B: API endpoint returning PII without proper authz
  provides: [pii-access]
  requires: [id-enumeration]

Chain: Enumerate user IDs 1-N → For each ID, request PII endpoint → Bulk-harvest
       personal data.

Severity: Individual MEDIUM+MEDIUM → Chain CRITICAL (mass data breach)
```

### Chain 5: Header Injection + Cache → Stored XSS via Cache Poisoning

```
Gadget A: CRLF injection in a header
  provides: [header-injection]
  requires: []

Gadget B: Caching proxy in front of the application
  provides: [cache-control]
  requires: [header-injection]

Chain: Inject malicious headers via CRLF → Response with injected content gets cached →
       All users requesting the cached URL receive the poisoned response with XSS payload.

Severity: Individual LOW+LOW → Chain HIGH (persistent XSS affecting all users)
```

### Chain 6: API Downgrade + Method Change + JSONP → XSS → ATO

```
Gadget A: Old API version (/api/v1/) without security controls of /api/v2/
  provides: [api-access]
  requires: []

Gadget B: JSONP callback parameter on the old API
  provides: [jsonp-callback, script-execution]
  requires: [api-access]

Chain: Access /api/v1/ (bypasses WAF/auth on v2) → Find JSONP endpoint → Inject
       callback with XSS → Steal authenticated user's session.

Severity: Individual LOW+LOW → Chain HIGH (ATO via reflected XSS)
```

### Chain 7: Race Condition + OTP → Account Takeover

```
Gadget A: No rate limiting on OTP verification endpoint
  provides: [otp-bypass]
  requires: []

Chain: Send 1000 parallel requests with different OTP values using HTTP/2
       single-packet attack → One request will have the correct OTP →
       Bypass 2FA → Full account access.

Severity: Individual MEDIUM → Chain CRITICAL (authentication bypass)
```

### Chain 8: File Upload + Path Traversal → RCE

```
Gadget A: File upload with extension bypass
  provides: [file-write]
  requires: []

Gadget B: Path traversal in upload filename
  provides: [path-control]
  requires: [file-write]

Chain: Upload PHP webshell with path traversal in filename (../../../var/www/html/shell.php)
       → Access shell.php → Execute arbitrary commands.

Severity: Individual MEDIUM+MEDIUM → Chain CRITICAL (remote code execution)
```

## Graph Traversal Algorithm

### Building the Graph

```
For each gadget G in gadgets.json:
  For each capability C in G.provides:
    For each gadget H in gadgets.json (H ≠ G):
      If C is in H.requires:
        Add edge: G → H (G enables H)
```

### Finding Chains

```
For each gadget G with no unmet requirements (all requires satisfied or empty):
  BFS/DFS from G following provides→requires edges
  For each path of length >= 2:
    Calculate chain severity
    Check if chain matches a known high-value template
    If severity > max(individual severities):
      Record as viable chain
```

### Scoring Chains

| Chain Length | Severity Uplift |
|-------------|----------------|
| 2 gadgets | Highest individual + 1 level |
| 3 gadgets | Highest individual + 2 levels |
| 4+ gadgets | Cap at CRITICAL |

Severity levels: INFO → LOW → MEDIUM → HIGH → CRITICAL

### Missing Link Detection

```
For each high-value chain template T:
  Check which gadgets exist that match T's requirements
  If all but one gadget exist:
    The missing gadget is the "missing link"
    Create a targeted test work item to find it (priority 80)
    Set context: "Looking for [capability] to complete chain: [template name]"
```

## Integration with Intel Module

The intel module runs chain analysis every 5 completed work items:

1. Load gadgets.json
2. Build the provides/requires graph
3. Check all high-value chain templates
4. Perform BFS for novel chains not in templates
5. For each viable chain: create exploit work item (priority 85+)
6. For each near-complete chain (1 missing link): create test work item (priority 80)
7. Update gadgets with chain_ids referencing connected gadgets
