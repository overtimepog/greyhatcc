---
name: doctor
description: Diagnose and fix greyhatcc plugin installation, configuration, dependency, and MCP server health issues
---

# Plugin Diagnostics

## Usage
`/greyhatcc:doctor`

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## All Diagnostic Checks

### 1. Plugin Installation
- Verify `.claude-plugin/plugin.json` exists and is valid JSON
- Verify `.mcp.json` exists and is valid JSON
- Verify `hooks/hooks.json` exists and is valid JSON
- Verify plugin version matches expected (check `package.json` version)

### 2. MCP Server Health
- Check Shodan API key availability (env var `SHODAN_API_KEY` or config)
- Test Shodan API connectivity: Use `greyhatcc_s__shodan_api_info` — verify credits remaining
- Check security-tools server is responding: Use `greyhatcc_sec__dns_records` with a known domain
- Check Playwright MCP is available: Verify browser tools are accessible
- Check Perplexity MCP is available: Verify `mcp__perplexity-ask__perplexity_ask` responds
- Check Context7 MCP is available: Verify `mcp__Context7__resolve-library-id` responds

### 3. Configuration Files
- Check `.greyhatcc/config.json` exists — validate config schema
- Check `.greyhatcc/scope.json` if exists — validate scope schema (version 2)
- Check `.greyhatcc/hunt-state.json` if exists — validate hunt state schema

### 4. Scope Health (if engagement active)
- Verify `scope.json` has `authorized.assets` with at least one entry
- Verify `excluded.vulnTypes` is populated (programs always have exclusions)
- Verify `rules.requiredHeaders` is set (most H1 programs require research header)
- Verify `bountyTable` has values (needed for ROI calculation)
- Cross-check: scope.json matches scope.md content

### 5. State Files (if engagement active)
- Check `findings_log.md` exists and has valid header format
- Check `gadgets.json` exists and is valid JSON with `gadgets` array
- Check `tested.json` exists and is valid JSON with `tested` array
- Check `submissions.json` exists and is valid JSON with `submissions` array
- Check for orphaned findings (in findings_log but not in gadgets)
- Check for stale tested entries (tested > 7 days ago with no re-validation)

### 6. Hook Scripts
- Verify all hook scripts exist and are executable:
  * `scripts/keyword-detector.mjs` — keyword detection hook
  * Any other scripts referenced in `hooks/hooks.json`
- Verify Node.js can execute hook scripts: `node --version`
- Check hook event bindings in `hooks/hooks.json`

### 7. Agent Files
- Verify `agents/` directory exists (or `docs/agents/`)
- Verify agent template files exist:
  * `templates/base-agent.md`
  * `templates/tier-instructions.md`
- Count total agent definitions available

### 8. Skill Files
- Verify `skills/` directory exists
- Count total skill files (expected: 33)
- List any missing skills compared to expected set
- Verify each skill.md has valid YAML frontmatter (name, description)

### 9. Command Files
- Verify `commands/` directory exists
- Count total command files
- Verify each command .md references a valid skill

### 10. External Tools (optional but recommended)
Run via Bash and check exit codes:
```bash
which nmap && nmap --version
which subfinder && subfinder -version
which nuclei && nuclei -version
which curl && curl --version
which dig
which python3 && python3 --version
which jq && jq --version
which httpx && httpx -version
which ffuf && ffuf -V
which sqlmap && sqlmap --version
which gobuster && gobuster version
```

### 11. Python Environment
```bash
# Check venv exists
test -d venv && echo "venv exists" || echo "venv missing"

# Check key Python packages
python3 -c "import requests; print('requests:', requests.__version__)"
python3 -c "import paramiko; print('paramiko:', paramiko.__version__)"
```

## Output
Display a diagnostic table:
```
greyhatcc Doctor Report v5.0
==============================
[PASS] Plugin manifest valid (v5.0.0)
[PASS] MCP servers configured
[PASS] Shodan API key: configured (credits: 95/100)
[WARN] NVD API key: not configured (rate limited)
[PASS] Playwright MCP: available
[PASS] Perplexity MCP: available
[PASS] Context7 MCP: available
[PASS] Hooks configured (6 scripts)
[PASS] Skills: 33/33 found
[PASS] Agents: 24 definitions found
[PASS] Commands: 23 found
[PASS] Scope: valid (12 assets, 18 exclusions)
[PASS] State files: all present and valid
[PASS] nmap: 7.94 installed
[FAIL] subfinder: not installed (brew install subfinder)
[PASS] nuclei: 3.1.0 installed
[PASS] curl: 8.4.0 installed
[PASS] python3: 3.12.0 installed
[WARN] httpx: not installed (go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest)
[PASS] jq: 1.7.1 installed

Overall: 15 PASS, 1 FAIL, 2 WARN
```

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
