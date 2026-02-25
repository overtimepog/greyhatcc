# greyhatcc

Autonomous offensive security toolkit for Claude Code. 33 skills, 32 commands, 31 agents, 3 MCP servers (Shodan 18 tools, Security Tools 14 tools, HackerOne API 15 tools), and 8 hooks for credential guarding, scope validation, finding tracking, and context persistence.

**v6.0.0** — Now with full HackerOne API integration, autopilot-style hunt mode with Task() dispatch, multi-wave attack strategy, signal amplification, graph-based vulnerability chaining, and adaptive WAF evasion.

## Prerequisites

- [Claude Code](https://claude.ai/code) CLI installed
- Node.js 20+
- Optional external tools: `nmap`, `subfinder`, `httpx`, `nuclei`, `katana`, `whois`, `dig`

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

## Hunt Mode — The Autonomous Bounty Pipeline

Hunt mode is the flagship feature — an elite autonomous bug bounty operator inspired by XBOW, PentestGPT, and Big Sleep. It runs 5 phases from zero to validated H1-ready reports.

```bash
/greyhatcc:hunt <program>
```

### Architecture

```
HUNT ORCHESTRATOR (coordinates everything)
├── Phase 1: EXPAND — H1 API research + parallel 5-phase recon
│   ├── recon-specialist (sonnet) — ASN/BGP, DNS, WAF, Shodan
│   ├── osint-researcher (sonnet) — Employees, acquisitions, tech stack
│   ├── js-analyst (sonnet) — JS bundles, source maps, secrets
│   ├── cloud-recon (sonnet) — S3/GCS/Azure/Firebase
│   ├── subdomain-takeover (sonnet) — Dangling CNAME/NS/MX
│   └── network-analyst-low (haiku) — Port scanning
├── Phase 2: PLAN — ROI ranking + Context7 tech mapping + CVE intel
├── Phase 3: ATTACK — Multi-wave persistent hunt loop
│   ├── Wave 1: Quick wins (all parallel, haiku, 15min/target)
│   ├── Wave 2: Deep testing (sonnet/opus, 60min/target)
│   └── Wave 3: Advanced exploitation (opus, chain-focused)
├── Phase 4: VALIDATE — 5-gate pipeline + chain analysis
│   └── Scope → Exclusion → Dedup → Proof → Quality
├── Phase 5: REPORT — H1-ready reports + quality gate
└── TRIPLE VERIFICATION — Coverage × Quality × Completeness
```

### Advanced Intelligence Systems

| System | Description |
|--------|-------------|
| **Signal Amplification** | 15 weak-signal → focused-investigation mappings. Unusual header → SSRF hunt, source map → full source reconstruction, GraphQL introspection → schema dump |
| **Confidence Scoring** | Findings scored 0-1. Routes: >0.8 fast-track, 0.5-0.8 more testing, <0.5 log as signal |
| **Graph-Based Chaining** | Directed graph with provides/requires tags. Auto-discovers chains: Self-XSS+CSRF→ATO, SSRF→metadata→IAM→cloud takeover |
| **Adaptive WAF Evasion** | 8-level escalation: headers → encoding → content-type → Playwright → HPP → body padding → HTTP/2 smuggling |
| **Multi-Wave Attack** | Wave 1 signals feed Wave 2 focus. Wave 2 gadgets feed Wave 3 chains |
| **Cross-Target Correlation** | Shared frameworks, auth, CDN patterns across multiple assets |
| **Historical Learning** | Cross-session intelligence via MEMORY.md |

### Task() Dispatch

Hunt mode delegates all work via OMC autopilot-style `Task()` calls:

```
Task(
  subagent_type="greyhatcc:webapp-tester",
  model="opus",
  prompt="Full OWASP Top 10 testing on <target>...",
  run_in_background=true
)
```

Smart model routing: `haiku` for quick checks, `sonnet` for testing workflows, `opus` for exploitation and analysis.

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
| `/greyhatcc:doctor` | `doc`, `health` | Plugin diagnostics and health check |

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

## MCP Servers (3 servers, 47 tools)

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

## Hooks (8)

| Event | Script | Purpose |
|-------|--------|---------|
| `SessionStart` | `session-start.mjs` | Initialize session context and load engagement state |
| `UserPromptSubmit` | `keyword-detector.mjs` | Detect security keywords and suggest relevant skills |
| `PreToolUse` (Bash) | `scope-validator.mjs` | Validate targets are in scope before execution |
| `PreToolUse` (Write/Edit) | `credential-guard.mjs` | Prevent credential leaks in written files |
| `PreCompact` | `pre-compact.mjs` | Persist directives and context before compaction |
| `PostToolUse` (Bash) | `scan-output-logger.mjs` | Log scan outputs for later analysis |
| `PostToolUse` (Bash) | `finding-tracker.mjs` | Track discovered findings automatically |
| `PostToolUse` (Write/Edit) | `report-validator.mjs` | Validate report quality on save |

## Agent Architecture (31 agents)

Tiered agent model for cost-efficient Task() dispatch:

### Recon Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| `recon-specialist` | Sonnet | Full 5-phase recon: ASN/BGP, passive DNS, cloud, WAF, Shodan |
| `recon-specialist-low` | Haiku | CT logs, single-source enum, quick Shodan |
| `recon-specialist-high` | Opus | Complex targets, evasion-aware, multi-source correlation |
| `osint-researcher` | Sonnet | Employees, acquisitions, tech stack, job postings |
| `osint-researcher-low` | Haiku | Single-source lookups |
| `osint-researcher-high` | Opus | Breach correlation, identity mapping, supply chain |
| `js-analyst` | Sonnet | JS bundles, source maps, secrets, endpoints |
| `js-analyst-low` | Haiku | Quick endpoint extraction |
| `cloud-recon` | Sonnet | S3/GCS/Azure/Firebase misconfig, CDN origin |
| `cloud-recon-low` | Haiku | Quick bucket enumeration |
| `subdomain-takeover` | Sonnet | Dangling CNAME/NS/MX detection |
| `network-analyst` | Sonnet | Port scan interpretation, service enum |
| `network-analyst-low` | Haiku | Quick port/service lookups |

### Testing Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| `webapp-tester` | Opus | Full OWASP Top 10 + business logic |
| `webapp-tester-low` | Haiku | Quick headers, cookies, CORS |
| `auth-tester` | Opus | OAuth/OIDC/JWT/SAML/Cognito deep testing |
| `auth-tester-low` | Haiku | JWT decode, token inspection |
| `api-tester` | Opus | REST/GraphQL/gRPC: BOLA, mass assignment, schema |
| `api-tester-low` | Haiku | Quick endpoint enum |

### Analysis & Exploit Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| `vuln-analyst` | Opus | Deep CVE research, attack chain mapping |
| `vuln-analyst-low` | Haiku | Quick CVE lookups |
| `exploit-developer` | Opus | Custom PoC, payload crafting |
| `exploit-developer-low` | Haiku | Quick PoC adaptation |

### Reporting & Validation Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| `report-writer` | Sonnet | Professional H1/pentest reports |
| `report-writer-low` | Haiku | Quick finding notes |
| `report-writer-high` | Opus | Executive-level, business impact, compliance |
| `proof-validator` | Opus | Re-run exploits, verify deterministic proof |
| `report-quality-gate` | Opus | Validate reports for H1 submission |
| `scope-manager` | Haiku | Scope validation, engagement rules (READ-ONLY) |

### Orchestration Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| `bounty-hunter` | Opus | Full hunt lifecycle orchestration with Task() dispatch |
| `hunt-loop-orchestrator` | Opus | Persistent 5-phase lifecycle with state tracking |

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
npm run build            # Build all 3 MCP servers
npm run build:shodan     # Build Shodan server only
npm run build:sectools   # Build security tools server only
npm run build:hackerone   # Build HackerOne server only
npm run typecheck        # TypeScript type checking
```

### Project Structure

```
greyhatcc/
├── agents/              # 31 agent definitions
├── bridge/              # Compiled MCP server bundles (CJS)
│   ├── hackerone-server.cjs
│   ├── security-tools-server.cjs
│   └── shodan-server.cjs
├── commands/            # 32 slash command definitions
├── config/              # Example configuration
├── hooks/               # hooks.json event registry
├── scripts/             # Hook scripts + shared libraries
│   └── lib/             # Shared utilities (scope, state, dupes, stdin)
├── skills/              # 33 skill definitions
│   └── hunt/            # Flagship autonomous hunt pipeline
├── src/                 # TypeScript source
│   ├── servers/
│   │   ├── hackerone/        # HackerOne API v1 client (15 tools)
│   │   ├── security-tools/   # CVE, exploit, header, WAF, CORS, etc.
│   │   └── shodan/           # Shodan API client (18 tools)
│   └── shared/               # Config and type definitions
├── .mcp.json            # MCP server declarations
├── esbuild.config.mjs   # Build configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## License

MIT
