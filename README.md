# greyhatcc

Grey hat penetration testing toolkit for Claude Code. 18 skills, 2 MCP servers (Shodan + security tools), and hooks for credential guarding, scope validation, and finding tracking.

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

### Option C: From GitHub

```bash
claude plugin marketplace add https://github.com/overtimedev/greyhatcc.git
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

### Example config

Copy and edit the example config:

```bash
cp config/greyhatcc.example.json config/greyhatcc.json
```

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/greyhatcc:recon` | `recon` | Multi-phase reconnaissance |
| `/greyhatcc:bounty` | `bb`, `bugbounty` | Bug bounty workflow |
| `/greyhatcc:hunt` | `h`, `autohunt`, `fullsend` | Automated vulnerability hunting |
| `/greyhatcc:exploit` | `exp` | Exploit assistance |
| `/greyhatcc:report` | `rep` | Pentest report writing |
| `/greyhatcc:cve` | `cve` | CVE lookup and research |
| `/greyhatcc:shodan` | `shodan` | Shodan reconnaissance |
| `/greyhatcc:webapp` | `webapp`, `web` | Web application testing |
| `/greyhatcc:osint` | `osint` | OSINT gathering |
| `/greyhatcc:portscan` | `ps`, `ports` | Port scanning |
| `/greyhatcc:subdomains` | `subs`, `subenum` | Subdomain enumeration |
| `/greyhatcc:scope` | `scope` | Scope management |
| `/greyhatcc:findings` | `findings`, `log` | Findings log |
| `/greyhatcc:doctor` | `doc` | Plugin diagnostics |

## Skills (18)

- **recon** - Multi-phase reconnaissance (ASN, DNS, cloud, code intel, OSINT)
- **bug-bounty-workflow** - End-to-end bug bounty workflow
- **hunt** - Automated vulnerability hunting
- **exploit-assist** - Exploit development and adaptation
- **report-writing** - Professional pentest report generation
- **h1-report** - HackerOne-ready bug bounty reports
- **cve-lookup** - CVE search and analysis via NVD
- **shodan-recon** - Shodan-powered infrastructure recon
- **webapp-testing** - Web application security testing
- **osint** - Open source intelligence gathering
- **port-scanning** - Network port scanning and service detection
- **subdomain-enum** - Subdomain enumeration and discovery
- **scope-management** - Target scope tracking
- **findings-log** - Vulnerability findings tracker
- **evidence-capture** - Evidence collection and documentation
- **waf-detect** - WAF detection and fingerprinting
- **tech-fingerprint** - Technology stack identification
- **doctor** - Plugin health diagnostics

## MCP Servers

### Shodan (`shodan`)
- `shodan_host_lookup` - Host IP information, ports, vulns
- `shodan_search` - Query with filters
- `shodan_dns_resolve` - Hostname to IP resolution

### Security Tools (`sec`)
- `cve_search` - NVD CVE search by keyword/severity
- `cve_detail` - Full CVE details
- `exploit_db_search` - Exploit-DB PoC search

## Hooks

| Event | Script | Purpose |
|-------|--------|---------|
| SessionStart | `session-start.mjs` | Initialize session context |
| UserPromptSubmit | `keyword-detector.mjs` | Detect security keywords |
| PreToolUse (Bash) | `scope-validator.mjs` | Validate targets are in scope |
| PreToolUse (Write/Edit) | `credential-guard.mjs` | Prevent credential leaks |
| PostToolUse (Bash) | `scan-output-logger.mjs` | Log scan outputs |
| PostToolUse (Bash) | `finding-tracker.mjs` | Track discovered findings |

## Agent Architecture

Tiered agent model for cost-efficient execution:

| Tier | Model | Use Case |
|------|-------|----------|
| LOW (Haiku) | Quick lookups, simple tasks | Port scan parsing, CVE lookups |
| MEDIUM (Sonnet) | Standard analysis | Recon, webapp testing, report drafts |
| HIGH (Opus) | Complex reasoning | Exploit chains, deep analysis, orchestration |

## Development

```bash
npm install
npm run build          # Build all MCP servers
npm run build:shodan   # Build Shodan server only
npm run build:sectools # Build security tools server only
npm run typecheck      # TypeScript type checking
```

## License

MIT
