# greyhatcc

Autonomous offensive security toolkit for Claude Code. 33 skills, 32 commands, 8 agents, 4 MCP servers (Shodan 18 tools, Security Tools 14 tools, HackerOne API 15 tools, Web Tools 24 tools), and 13 hooks for credential guarding, scope validation, finding tracking, hunt state persistence, and context compaction.

**v7.0.0** — Complete hunt architecture redesign: event-driven priority-queue engine replaces the waterfall pipeline. Continuous intelligence feedback loop with signal amplification, gadget chaining (provides/requires directed graph), 5-gate validation, dynamic model routing (haiku/sonnet/opus) with automatic escalation, and persistent `hunt-state/` directory that survives context compaction and session restarts. Agent count consolidated from 31 to 8 purpose-built workers. Full HackerOne API integration, 4 MCP servers (71 tools), and adaptive WAF evasion.

## Prerequisites

- [Claude Code](https://claude.ai/code) CLI installed
- Node.js 20+
- Optional external tools: `nmap`, `subfinder`, `httpx`, `nuclei`, `katana`, `whois`, `dig`
- Chromium (auto-installed via `npx playwright-core install chromium` on first use)

## Installation

### Option A: Add marketplace + install (recommended)

```bash
# Add the greyhatcc marketplace
claude plugin marketplace add /path/to/greyhatcc

# Install the plugin
claude plugin install greyhatcc@greyhatcc
```

### Option B: From GitHub

```bash
claude plugin marketplace add https://github.com/overtimepog/greyhatcc.git
claude plugin install greyhatcc@greyhatcc
```

### Verify installation

```bash
claude plugin list
```

You should see `greyhatcc@local` or `greyhatcc@greyhatcc` with status enabled.

## Configuration

### Shodan API Key

```bash
export SHODAN_API_KEY="your_key_here"
```

### HackerOne API (recommended)

```bash
export H1_API_TOKEN="your_token_here"
export H1_USERNAME="your_h1_username"
```
Get your API token from [HackerOne API Settings](https://hackerone.com/settings/api_token/edit).

### Web Tools (optional, auto-configured)

```bash
# Custom Chromium path (optional — auto-detected if installed via playwright-core)
export CHROMIUM_PATH="/path/to/chromium"

# Run browsers with visible UI instead of headless (default: headless)
export WEB_TOOLS_HEADLESS="false"
```

### NVD API Key (optional, higher rate limits)

```bash
export NVD_API_KEY="your_key_here"
```

### External AI (optional, enhances hunt mode)

```bash
# Perplexity — real-time CVE intel, program research, dupe checks
# Configure via MCP: mcp__perplexity-ask__perplexity_ask

# OpenRouter — large-context analysis via minimax/minimax-m2.5
# Configure via MCP: mcp__openrouter__openrouter_chat

# Context7 — live documentation for detected tech stacks
# Configure via MCP: mcp__Context7__resolve-library-id + query-docs
```

## Hunt Mode — Event-Driven Priority Queue Engine

Hunt mode is the flagship feature — an elite autonomous bug bounty operator inspired by XBOW, PentestGPT, and Big Sleep. It uses an **event-driven priority queue** that continuously dispatches, evaluates, and reprioritizes work items from zero to validated H1-ready reports.

```bash
/greyhatcc:hunt <program>
# Resume a previous hunt:
/greyhatcc:hunt --resume
# Focus on specific areas:
/greyhatcc:hunt <program> --focus ssrf,idor
```

### Architecture

```
HUNT ORCHESTRATOR (opus) — event loop
│
├── SEED: H1 API research → enqueue initial recon work items
│
├── HUNT LOOP (repeats until queue empty or budget exhausted):
│   ├── dequeue() → highest priority queued WorkItem
│   ├── Route to worker by type:
│   │   ├── recon-worker (haiku) — 9 subtypes
│   │   ├── test-worker (sonnet) — 15 subtypes + WAF evasion
│   │   ├── exploit-worker (opus) — PoC dev + chain execution
│   │   ├── validate-worker (sonnet/opus) — 5-gate pipeline
│   │   └── report-worker (sonnet) — H1-ready reports
│   ├── Process result → update surfaces, signals, gadgets, findings
│   ├── Auto-enqueue new_work_items from result
│   └── Every 5 items: intel-worker analyzes + reprioritizes queue
│
├── FINALIZE: coverage report + remaining queue summary
│
└── STATE: hunt-state/ directory (persists across compaction + restarts)
    ├── hunt.json, queue.json, findings.json, surfaces.json
    ├── gadgets.json, signals.json, coverage.json, intel-log.json
    └── reports/, evidence/
```

### Intelligence Systems

| System | Description |
|--------|-------------|
| **Priority Queue** | WorkItems scored 0-100, highest dequeued first. Dynamic reprioritization based on intel analysis |
| **Signal Amplification** | 20+ weak-signal → focused-investigation rules. Unusual header → SSRF hunt, source map → full source reconstruction |
| **Gadget Chaining** | Directed graph with 30+ provides/requires tags. BFS traversal discovers chains: Self-XSS+CSRF→ATO, SSRF→metadata→IAM→cloud takeover |
| **5-Gate Validation** | Scope → Exclusion → Dedup → Proof → Quality. Each gate must pass before report generation |
| **Model Escalation** | haiku → sonnet → opus on failure. Automatic escalation preserves work item context |
| **WAF Evasion Ladder** | 8-level escalation: encoding → HPP → content-type → body padding → smuggling → Playwright → origin discovery |
| **Coverage Tracking** | Endpoint × vuln-class matrix. Intel module identifies gaps and enqueues targeted tests |
| **Persistent State** | `hunt-state/` directory survives context compaction, Ctrl+C, session restarts via PreCompact hook |

### Dynamic Model Routing

| Work Type | Default Model | Escalation Path |
|-----------|--------------|-----------------|
| Recon (subdomain-enum, tech-fingerprint, shodan) | haiku | → sonnet → opus |
| Testing (OWASP, SSRF, IDOR, XSS, SQLi) | sonnet | → opus |
| Exploitation (PoC, chains) | opus | — |
| Validation (5-gate pipeline) | sonnet | → opus |
| Reporting (H1 format) | sonnet | → opus |
| Intel (analysis, reprioritization) | sonnet | — |

## Commands (32)

### Recon & Enumeration

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:recon` | `r`, `enumerate` | Multi-phase reconnaissance on a target |
| `/greyhatcc:subdomains` | `subs`, `subenum` | Subdomain enumeration from multiple sources |
| `/greyhatcc:shodan` | `sh`, `shodansearch` | Shodan reconnaissance on IP or domain |
| `/greyhatcc:portscan` | `nmap`, `scan` | Intelligent port scanning with service detection |
| `/greyhatcc:osint` | `intel`, `oi` | Open source intelligence gathering |
| `/greyhatcc:js` | `js-analysis`, `javascript` | JS bundle analysis for secrets, endpoints, source maps |
| `/greyhatcc:cloud` | `s3`, `bucket` | Cloud misconfig hunting (S3, Firebase, Cognito, CDN) |
| `/greyhatcc:takeover` | `sto`, `dangling` | Subdomain takeover — dangling CNAMEs, NS/MX takeover |
| `/greyhatcc:fingerprint` | — | Technology stack fingerprinting |
| `/greyhatcc:waf` | — | WAF detection and fingerprinting |

### Hunting & Testing

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:hunt` | `h`, `autohunt`, `fullsend`, `siege`, `loop` | Ultra-autonomous bug bounty hunting with multi-wave attack, signal amplification, and triple-verification |
| `/greyhatcc:webapp` | `web`, `owasp` | OWASP web application security tests |
| `/greyhatcc:auth` | `jwt`, `oauth` | OAuth, JWT, OIDC, SAML testing |
| `/greyhatcc:api` | `api-test`, `graphql` | API security testing (REST, GraphQL, gRPC) |
| `/greyhatcc:exploit` | `exp`, `poc` | Exploit development and research |
| `/greyhatcc:cve` | `vuln`, `vulnerability` | CVE lookup by ID, product, or keyword |

### Reporting & Validation

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:report` | `rep`, `write-report` | Professional pentest report generation |
| `/greyhatcc:h1-report` | — | HackerOne-specific report generation |
| `/greyhatcc:findings` | `f`, `finding` | Document or review security findings |
| `/greyhatcc:proof` | — | Verify PoC reproducibility |
| `/greyhatcc:validate` | — | Multi-gate report quality validation before submission |
| `/greyhatcc:dedup` | `dup`, `duplicate` | Check if a bug has been previously reported |
| `/greyhatcc:dupes` | — | Check finding against commonly rejected bug types |
| `/greyhatcc:hacktivity` | — | Search HackerOne hacktivity for disclosed reports |
| `/greyhatcc:evidence` | — | Capture evidence screenshots and documentation |
| `/greyhatcc:guides` | `references`, `cheatsheets` | Bug bounty reference guides and methodology resources |

### Management

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:scope` | `targets`, `engagement` | Define or validate target scope |
| `/greyhatcc:bounty` | `bb`, `bugbounty` | Bug bounty workflow for a target program |
| `/greyhatcc:program` | `research`, `bbp` | Research a bug bounty program (scope, bounties, rules) |
| `/greyhatcc:gadgets` | `chain`, `chains` | Gadget inventory and chaining analysis |
| `/greyhatcc:tested` | `coverage`, `gaps` | Track tested endpoints and vuln classes |
| `/greyhatcc:ghcc-doctor` | `ghcc-health` | Plugin diagnostics and health check |

## Skills (33)

### Offensive

| Skill | Description |
|-------|-------------|
| `recon` | Multi-phase reconnaissance (ASN, DNS, cloud, code intel, OSINT) |
| `hunt` | Ultra-autonomous bug bounty hunting with autopilot-style Task() dispatch, multi-wave attack, signal amplification, graph-based chaining, adaptive evasion, and triple-verification |
| `webapp-testing` | Web application security testing (OWASP Top 10 + business logic) |
| `api-testing` | REST, GraphQL, gRPC API testing |
| `oauth-jwt-testing` | OAuth, JWT, OIDC, SAML flow testing |
| `js-analysis` | JavaScript bundle analysis for secrets and endpoints |
| `cloud-misconfig` | Cloud infrastructure misconfiguration hunting |
| `subdomain-enum` | Subdomain enumeration from multiple sources |
| `subdomain-takeover` | Dangling CNAME, NS, MX takeover detection |
| `port-scanning` | Network port scanning and service detection |
| `shodan-recon` | Shodan-powered infrastructure reconnaissance |
| `waf-detect` | WAF detection and fingerprinting (18+ WAFs) |
| `tech-fingerprint` | Technology stack identification (30+ patterns) |
| `osint` | Open source intelligence gathering |
| `cve-lookup` | CVE search and analysis via NVD |
| `exploit-assist` | Exploit development and adaptation |

### Workflow & Management

| Skill | Description |
|-------|-------------|
| `bug-bounty-workflow` | End-to-end bug bounty workflow (Phase 0-4) |
| `program-research` | Bug bounty program research via H1 API + Playwright + Perplexity |
| `reference-guides` | HowToHunt, HackTricks, PayloadsAllTheThings, OWASP cheatsheets |
| `scope-management` | Target scope tracking and validation with H1 API |
| `findings-log` | Vulnerability findings tracker |
| `gadget-inventory` | Gadget cataloging and chain analysis (provides/requires graph) |
| `tested-tracker` | Endpoint and vuln class coverage tracking |
| `context-loader` | Session context loader for engagement state |
| `proof-validator` | PoC reproducibility verification |

### Reporting & Dedup

| Skill | Description |
|-------|-------------|
| `h1-report` | HackerOne-ready bug bounty reports |
| `report-writing` | Professional pentest report generation |
| `validate-report` | Multi-gate report quality validation |
| `evidence-capture` | Evidence collection and documentation |
| `hacktivity-check` | HackerOne hacktivity search via H1 API |
| `dedup-checker` | 6-layer duplicate detection with H1 API dupe check |
| `common-dupes` | Database of commonly rejected bug types |
| `doctor` | Plugin health diagnostics |

## MCP Servers (4 servers, 71 tools)

### HackerOne API (`hackerone`) — 15 tools

| Tool | Description |
|------|-------------|
| `h1_auth_status` | Verify API authentication is working |
| `h1_list_programs` | List accessible HackerOne programs (paginated) |
| `h1_program_detail` | Full program info — scope, bounty ranges, policy, stats |
| `h1_structured_scopes` | Structured scope assets with types, eligibility, max severity |
| `h1_hacktivity` | Disclosed/resolved reports feed (supports `disclosed_only` filter) |
| `h1_dupe_check` | Smart duplicate risk assessment — HIGH/MEDIUM/LOW/CLEAR with matched reports |
| `h1_bounty_table` | Bounty ranges by severity level |
| `h1_program_policy` | Full policy text, exclusions, testing rules |
| `h1_scope_summary` | Quick in-scope vs out-of-scope + bounty range |
| `h1_program_weaknesses` | CWEs accepted by program |
| `h1_my_reports` | Your submitted reports |
| `h1_report_detail` | Single report details by ID |
| `h1_earnings` | Your earnings history |
| `h1_balance` | Your account balance |
| `h1_payouts` | Your payout history |

### Shodan (`shodan`) — 18 tools

| Tool | Description |
|------|-------------|
| `shodan_host_lookup` | Host IP information, ports, vulns |
| `shodan_search` | Search with Shodan query filters |
| `shodan_count` | Count results for a query |
| `shodan_search_tokens` | Parse search query into tokens |
| `shodan_internetdb` | Fast IP lookup via InternetDB (no API key needed) |
| `shodan_dns_resolve` | Hostname to IP resolution |
| `shodan_dns_reverse` | IP to hostname reverse lookup |
| `shodan_dns_domain` | Domain DNS records |
| `shodan_exploits_search` | Search exploits database |
| `shodan_ports` | List open ports for an org |
| `shodan_vulns` | Known vulnerabilities for a host |
| `shodan_ssl_cert` | SSL certificate search |
| `shodan_scan` | Launch on-demand scan |
| `shodan_scan_status` | Check scan status |
| `shodan_honeypot_check` | Honeypot probability score |
| `shodan_api_info` | API plan and usage info |
| `shodan_search_facets` | Available search facets |
| `shodan_search_filters` | Available search filters |

### Security Tools (`sec`) — 14 tools

| Tool | Description |
|------|-------------|
| `cve_search` | NVD CVE search by keyword or severity |
| `cve_detail` | Full CVE details with references |
| `exploit_db_search` | Exploit-DB PoC search |
| `cvss_calculate` | CVSS v3.1 score calculation |
| `whois_lookup` | WHOIS domain registration data |
| `dns_records` | DNS record enumeration (A, AAAA, MX, TXT, NS, CNAME) |
| `header_analysis` | HTTP header security analysis |
| `ssl_analysis` | SSL/TLS configuration analysis |
| `waf_detect` | WAF detection and fingerprinting |
| `cors_check` | CORS misconfiguration testing |
| `tech_fingerprint` | Technology stack fingerprinting |
| `subdomain_enum` | Subdomain enumeration via crt.sh CT logs |
| `port_check` | TCP port scan with banner grab |
| `redirect_chain` | Redirect chain analysis |

### Web Tools (`web`) — 24 tools

Multi-session browser automation with Burp Suite-equivalent capabilities. Each session runs in an isolated Playwright BrowserContext (~50MB) with independent cookies, storage, and auth state.

#### Session Management

| Tool | Description |
|------|-------------|
| `web_session_create` | Create a new isolated browser session with optional proxy, user-agent, viewport |
| `web_session_list` | List all active sessions with URLs, status, traffic counts |
| `web_session_close` | Close a session or all sessions, releasing browser resources |
| `web_cookies` | Get or set cookies for a session |

#### Navigation & Interaction

| Tool | Description |
|------|-------------|
| `web_navigate` | Navigate to URL with configurable wait conditions |
| `web_screenshot` | Capture full-page or element screenshot (base64 PNG) |
| `web_snapshot` | Get page accessibility tree snapshot (structured DOM) |
| `web_click` | Click elements by CSS selector |
| `web_fill` | Fill form fields by CSS selector |
| `web_evaluate` | Execute arbitrary JavaScript in page context |
| `web_wait` | Wait for selector, navigation, or timeout |

#### Traffic Interception (Proxy)

| Tool | Description |
|------|-------------|
| `web_intercept_start` | Start capturing HTTP traffic with scope patterns |
| `web_intercept_stop` | Stop traffic interception |
| `web_intercept_modify` | Add request/response modification rules (header injection, body rewrite) |
| `web_intercept_modify_remove` | Remove a modification rule |
| `web_intercept_scope` | Update interception scope patterns |

#### Request Manipulation (Repeater/Intruder)

| Tool | Description |
|------|-------------|
| `web_request_send` | Send raw HTTP request (like Burp Repeater) |
| `web_request_replay` | Replay a captured traffic entry with modifications |
| `web_request_fuzz` | Fuzz parameters with wordlist using FUZZ placeholder (like Burp Intruder) |

#### Analysis

| Tool | Description |
|------|-------------|
| `web_traffic_list` | List captured traffic entries with URL/method/status filters |
| `web_traffic_detail` | Full request/response detail for a traffic entry |
| `web_traffic_search` | Regex/substring search across all captured traffic |
| `web_traffic_export` | Export traffic as JSON, cURL commands, or Markdown |
| `web_forms_extract` | Extract all forms from current page |
| `web_links_extract` | Extract all links from current page |
| `web_js_extract` | Extract JavaScript files and inline scripts |
| `web_storage_dump` | Dump localStorage, sessionStorage, and cookies |

## Hooks (13 scripts, 10 event types)

| Event | Script | Purpose |
|-------|--------|---------|
| `SessionStart` | `session-start.mjs` | Initialize session context, load engagement state, detect hunt-state/ for resume |
| `UserPromptSubmit` | `keyword-detector.mjs` | Detect security keywords and suggest relevant skills |
| `PreToolUse` (Bash) | `scope-validator.mjs` | Validate targets are in scope (reads hunt-state/hunt.json first, then .greyhatcc/scope.json) |
| `PreToolUse` (Write/Edit) | `credential-guard.mjs` | Prevent credential leaks in written files |
| `PreCompact` | `pre-compact.mjs` | Persist directives, context, and hunt-state/ before compaction |
| `PreCompact` | `hunt-state-saver.mjs` | Save hunt loop state (queue stats, findings count) for post-compaction resume |
| `PostToolUse` (Bash) | `scan-output-logger.mjs` | Log scan outputs for later analysis |
| `PostToolUse` (Bash) | `finding-tracker.mjs` | Track discovered findings (dedup-aware with hunt-state/findings.json) |
| `PostToolUse` (Write/Edit) | `report-validator.mjs` | Validate report quality on save |
| `SubagentStart` | `subagent-tracker.mjs` | Track spawned subagent lifecycle |
| `SubagentStop` | `subagent-tracker.mjs` | Record subagent completion |
| `Stop` | `hunt-persist.mjs` | Persist hunt state on Ctrl+C / session stop |
| `SessionEnd` | `session-end.mjs` | Clean up session resources |
| `PermissionRequest` (Bash) | `permission-handler.mjs` | Handle permission requests for bash commands |

## Agent Architecture (8 agents)

Consolidated from 31 → 8 purpose-built agents. Each agent handles one capability domain with dynamic model routing via the hunt orchestrator.

| Agent | Default Model | Purpose | Subtypes |
|-------|--------------|---------|----------|
| `hunt-orchestrator` | Opus | Main hunt loop, dispatches all work via Task(), manages queue and state | — |
| `recon-worker` | Haiku | All reconnaissance: subdomains, tech fingerprint, Shodan, OSINT, JS analysis, cloud recon, H1 research, subdomain takeover, port scanning | 9 |
| `test-worker` | Sonnet | All security testing: OWASP quick, SSRF, IDOR, XSS, SQLi, auth, API, business logic, file upload, open redirect, CORS, header injection, GraphQL, WordPress, cache poisoning | 15 |
| `exploit-worker` | Opus | PoC development, impact maximization, gadget chain execution | — |
| `validate-worker` | Sonnet | 5-gate validation: scope, exclusion, dedup, proof reproducibility, quality | — |
| `report-worker` | Sonnet | H1-ready report generation with CVSS, CWE, reproduction steps, impact | — |
| `intel-worker` | Sonnet | Signal amplification, gadget chain analysis, coverage gaps, cross-target correlation, queue reprioritization | 6 functions |
| `scope-manager` | Haiku | Scope validation and engagement rules (READ-ONLY) | — |

Previous 31 agents archived in `agents/_archive/` for reference.

## External AI Integration

Hunt mode integrates with external AI tools when available:

| Tool | Purpose | Phase |
|------|---------|-------|
| Perplexity (`perplexity_ask`) | CVE intel, program research, dupe checks | All phases |
| OpenRouter (`openrouter_chat`, minimax/minimax-m2.5) | Large-context recon aggregation, chain analysis | EXPAND, PLAN, VALIDATE |
| Context7 (`resolve-library-id` + `query-docs`) | Live framework docs, security configs | PLAN, ATTACK |
| Codex (`ask_codex`) | Exploit scripting, PoC generation | ATTACK |
| Gemini (`ask_gemini`) | Large file analysis (fallback) | VALIDATE, REPORT |

All external tools are optional — hunt mode gracefully degrades if unavailable.

## Development

```bash
npm install
npm run build            # Build all 4 MCP servers
npm run build:shodan     # Build Shodan server only
npm run build:sectools   # Build security tools server only
npm run build:hackerone   # Build HackerOne server only
npm run build:webtools   # Build web tools server only
npm run typecheck        # TypeScript type checking
```

### Project Structure

```
greyhatcc/
├── agents/              # 8 active agent definitions
│   ├── _archive/        # 30 archived v6 agents (reference only)
│   ├── hunt-orchestrator.md
│   ├── recon-worker.md
│   ├── test-worker.md
│   ├── exploit-worker.md
│   ├── validate-worker.md
│   ├── report-worker.md
│   ├── intel-worker.md
│   └── scope-manager.md
├── bridge/              # Compiled MCP server bundles (CJS)
│   ├── hackerone-server.cjs
│   ├── security-tools-server.cjs
│   ├── shodan-server.cjs
│   └── web-tools-server.cjs
├── commands/            # 32 slash command definitions
├── config/              # Example configuration
├── hooks/               # hooks.json event registry (13 hooks)
├── scripts/             # Hook scripts + shared libraries
│   ├── lib/
│   │   ├── hunt-queue.mjs   # Priority queue: enqueue, dequeue, escalate, reprioritize
│   │   └── hunt-state.mjs   # State persistence: findings, surfaces, gadgets, signals, coverage
│   └── hunt-state-saver.mjs # PreCompact hook for hunt state preservation
├── skills/              # 33 skill definitions
│   └── hunt/            # Event-driven hunt pipeline
│       ├── skill.md         # Main hunt loop algorithm
│       ├── modules/         # 6 capability modules (recon, test, exploit, validate, report, intel)
│       ├── amplification.md # Signal → investigation mapping rules
│       ├── chaining.md      # Gadget provides/requires graph + chain templates
│       ├── evasion.md       # 8-level WAF evasion ladder
│       └── schemas/         # Data type documentation with examples
├── src/                 # TypeScript source
│   ├── servers/
│   │   ├── hackerone/        # HackerOne API v1 client (15 tools)
│   │   ├── security-tools/   # CVE, exploit, header, WAF, CORS, etc.
│   │   ├── shodan/           # Shodan API client (18 tools)
│   │   └── web-tools/        # Browser automation + Burp Suite tools (24 tools)
│   └── shared/
│       └── hunt-types.ts     # Canonical TypeScript interfaces (11 types)
├── hunt-state/          # Runtime hunt state (created by hunt mode)
│   ├── hunt.json            # Top-level HuntState
│   ├── queue.json           # WorkItem[] priority queue
│   ├── findings.json        # Finding[] all findings
│   ├── surfaces.json        # Surface[] attack surface map
│   ├── gadgets.json         # Gadget[] exploitation primitives
│   ├── signals.json         # Signal[] weak signals
│   ├── coverage.json        # CoverageTracker
│   └── reports/             # Generated H1-ready reports
├── tests/               # Unit tests for hunt libraries
├── .mcp.json            # MCP server declarations
├── esbuild.config.mjs   # Build configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## License

MIT
