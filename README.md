# greyhatcc

Grey hat penetration testing toolkit for Claude Code. 33 skills, 28 commands, 20 agents, 2 MCP servers (Shodan 17 tools + security tools 16 tools), and 8 hooks for credential guarding, scope validation, finding tracking, and context persistence.

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

Set the `SHODAN_API_KEY` environment variable:

```bash
export SHODAN_API_KEY="your_key_here"
```

Or add it to your shell profile (`~/.zshrc`, `~/.bashrc`).

### NVD API Key (optional, higher rate limits)

```bash
export NVD_API_KEY="your_key_here"
```

### HackerOne API Token (optional, for program research)

```bash
export H1_API_TOKEN="your_token_here"
```

### Example config

Copy and edit the example config:

```bash
cp config/greyhatcc.example.json config/greyhatcc.json
```

## Commands (28)

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

### Hunting & Testing

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:hunt` | `h`, `autohunt`, `fullsend`, `siege`, `loop` | Ultra-autonomous bug bounty hunting — expand, plan, attack, validate, report with persistent loops, 5-gate validation, and triple-verification. Auto-activates with `hunt:` prefix. |
| `/greyhatcc:webapp` | `web`, `owasp` | OWASP web application security tests |
| `/greyhatcc:auth` | `jwt`, `oauth` | OAuth, JWT, OIDC, SAML testing |
| `/greyhatcc:api` | `api-test`, `graphql` | API security testing (REST, GraphQL, gRPC) |
| `/greyhatcc:exploit` | `exp`, `poc` | Exploit development and research |
| `/greyhatcc:cve` | `vuln`, `vulnerability` | CVE lookup by ID, product, or keyword |

### Reporting & Validation

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:report` | `rep`, `write-report` | Professional pentest report generation |
| `/greyhatcc:findings` | `f`, `finding` | Document or review security findings |
| `/greyhatcc:proof` | — | Verify PoC reproducibility |
| `/greyhatcc:validate` | — | Multi-gate report quality validation before submission |
| `/greyhatcc:dedup` | `dup`, `duplicate` | Check if a bug has been previously reported |
| `/greyhatcc:dupes` | — | Check finding against commonly rejected bug types |
| `/greyhatcc:hacktivity` | — | Search HackerOne hacktivity for disclosed reports |
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
| `hunt` | Ultra-autonomous bug bounty hunting (unified hunt + loop + siege) |
| `webapp-testing` | Web application security testing (OWASP) |
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
| `program-research` | Bug bounty program research via Playwright + Perplexity + H1 API |
| `reference-guides` | HowToHunt, HackTricks, PayloadsAllTheThings, OWASP cheatsheets |
| `scope-management` | Target scope tracking and validation |
| `findings-log` | Vulnerability findings tracker |
| `gadget-inventory` | Gadget cataloging and chain analysis |
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
| `hacktivity-check` | HackerOne hacktivity search for prior art |
| `dedup-checker` | Duplicate finding checker |
| `common-dupes` | Database of commonly rejected bug types |
| `doctor` | Plugin health diagnostics |

## MCP Servers

### Shodan (`shodan`) — 17 tools

| Tool | Description |
|------|-------------|
| `shodan_host_lookup` | Host IP information, ports, vulns |
| `shodan_search` | Search with Shodan query filters |
| `shodan_count` | Count results for a query |
| `shodan_search_tokens` | Parse search query into tokens |
| `shodan_internetdb` | Fast IP lookup via InternetDB |
| `shodan_dns_resolve` | Hostname to IP resolution |
| `shodan_dns_reverse` | IP to hostname reverse lookup |
| `shodan_dns_domain` | Domain DNS records |
| `shodan_exploits_search` | Search exploits database |
| `shodan_ports` | List common ports seen |
| `shodan_vulns` | Search for vulnerabilities |
| `shodan_ssl_cert` | SSL certificate search |
| `shodan_scan` | Launch on-demand scan |
| `shodan_scan_status` | Check scan status |
| `shodan_honeypot_check` | Honeypot probability score |
| `shodan_api_info` | API plan and usage info |
| `shodan_search_facets` | Available search facets |
| `shodan_search_filters` | Available search filters |

### Security Tools (`sec`) — 16 tools

| Tool | Description |
|------|-------------|
| `cve_search` | NVD CVE search by keyword or severity |
| `cve_detail` | Full CVE details with references |
| `exploit_db_search` | Exploit-DB PoC search |
| `cvss_calculate` | CVSS score calculation |
| `whois_lookup` | WHOIS domain registration data |
| `dns_records` | DNS record enumeration |
| `header_analysis` | HTTP header security analysis (severity-weighted) |
| `ssl_analysis` | SSL/TLS configuration analysis |
| `waf_detect` | WAF detection and fingerprinting (18+ WAFs) |
| `cors_check` | CORS misconfiguration testing (7-origin test) |
| `tech_fingerprint` | Technology stack fingerprinting (30+ patterns) |
| `subdomain_enum` | Subdomain enumeration via crt.sh CT logs |
| `port_check` | TCP port scan with banner grab |
| `redirect_chain` | Redirect chain analysis with security issue detection |

### HackerOne MCP Server (12 tools)

| Tool | Description |
|------|-------------|
| `h1_list_programs` | List accessible HackerOne programs |
| `h1_program_detail` | Full program info (scope, bounty, policy, stats) |
| `h1_structured_scopes` | Structured scope assets per program |
| `h1_hacktivity` | Public activity feed (disclosed/resolved reports) |
| `h1_earnings` | Hacker earnings history |
| `h1_my_programs` | Private/invited programs |
| `h1_search_programs` | Search program directory |
| `h1_scope_summary` | Quick scope validation digest |
| `h1_dupe_check` | Smart fuzzy duplicate detection with risk scoring |
| `h1_bounty_table` | Bounty ranges by severity |
| `h1_program_policy` | Full policy text and exclusions |
| `h1_auth_status` | API authentication verification |

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

## Agent Architecture (20 agents)

Tiered agent model for cost-efficient execution:

| Tier | Model | Agents | Use Case |
|------|-------|--------|----------|
| LOW (Haiku) | Fast, cheap | recon-specialist-low, osint-researcher-low, vuln-analyst-low, webapp-tester-low, exploit-developer-low, report-writer-low | Port scan parsing, CVE lookups, quick analysis |
| MEDIUM (Sonnet) | Balanced | recon-specialist, osint-researcher, vuln-analyst, webapp-tester, exploit-developer, report-writer, network-analyst, scope-manager, bounty-hunter, proof-validator | Recon, webapp testing, report drafts |
| HIGH (Opus) | Deep reasoning | recon-specialist-high, report-writer-high, bounty-hunter, hunt-loop-orchestrator, report-quality-gate | Exploit chains, deep analysis, hunt orchestration |

### Templates

- `base-agent.md` — Shared agent foundation (tool access, output format, error handling)
- `tier-instructions.md` — Tier-specific behavioral guidelines

## Development

```bash
npm install
npm run build          # Build all MCP servers
npm run build:shodan   # Build Shodan server only
npm run build:sectools # Build security tools server only
npm run typecheck      # TypeScript type checking
```

### Project Structure

```
greyhatcc/
├── agents/            # 20 agent definitions + templates
│   └── templates/     # Base agent and tier instructions
├── bridge/            # Compiled MCP server bundles (CJS)
├── commands/          # 30 slash command definitions
├── config/            # Example configuration
├── hooks/             # hooks.json event registry
├── scripts/           # Hook scripts + shared libraries
│   └── lib/           # Shared utilities (scope, state, dupes, stdin)
├── skills/            # 35 skill definitions
├── src/               # TypeScript source
│   ├── servers/
│   │   ├── security-tools/  # CVE, exploit, header, WAF, CORS, etc.
│   │   └── shodan/          # Shodan API client + tools
│   └── shared/              # Config and type definitions
├── .mcp.json          # MCP server declarations
├── esbuild.config.mjs # Build configuration
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## License

MIT
