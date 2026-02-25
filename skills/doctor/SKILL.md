---
name: doctor
description: Diagnose and fix greyhatcc plugin installation, configuration, dependency, and MCP server health issues
---

# Plugin Diagnostics

## Usage
`/greyhatcc:doctor`

## Checks

### 1. Plugin Installation
- Verify .claude-plugin/plugin.json exists and is valid JSON
- Verify .mcp.json exists and is valid JSON
- Verify hooks/hooks.json exists and is valid JSON

### 2. MCP Server Health
- Check Shodan API key availability (env var or config)
- Test Shodan API connectivity: Use `greyhatcc_s__shodan_api_info`
- Check security-tools server is responding

### 3. Configuration
- Check .greyhatcc/config.json exists
- Validate config schema
- Check .greyhatcc/scope.json if exists

### 4. External Tools (optional but recommended)
Run via Bash and check exit codes:
```bash
which nmap && nmap --version
which subfinder && subfinder -version
which nuclei && nuclei -version
which curl && curl --version
which dig
which python3 && python3 --version
which jq && jq --version
```

### 5. Directory Structure
- Verify skills/ contains all SKILL.md files
- Verify agents/ contains all agent .md files
- Verify commands/ contains all command .md files
- Verify scripts/ contains all hook scripts

## Output
Display a diagnostic table:
```
greyhatcc Doctor Report
========================
[PASS] Plugin manifest valid
[PASS] MCP servers configured
[PASS] Shodan API key: configured (credits: 95/100)
[WARN] NVD API key: not configured (rate limited)
[PASS] Hooks configured (6 scripts)
[PASS] nmap: 7.94 installed
[FAIL] subfinder: not installed (brew install subfinder)
[PASS] nuclei: 3.1.0 installed
[PASS] curl: 8.4.0 installed
[PASS] python3: 3.12.0 installed
```
