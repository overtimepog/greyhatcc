---
name: doctor
description: "Diagnose and fix greyhatcc plugin installation and configuration issues"
aliases:
  - doc
  - health
allowed-tools: Task, Bash, Read, Glob, Grep
argument-hint: ""
skill: greyhatcc:doctor
---

# Plugin Diagnostics

Invoke the `greyhatcc:doctor` skill to check plugin health.

Comprehensive diagnostic check for the greyhatcc plugin environment:

**State File Checks:**
- Verify scope.json exists and is valid JSON with required fields
- Check findings.json for data integrity and consistent IDs
- Validate gadgets.json structure and provides/requires tag format
- Confirm tested-set.json tracks coverage data correctly
- Check engagement directory structure and file permissions

**Scope Validation:**
- Verify at least one in-scope target is defined
- Check for stale scope (program pages update frequently)
- Validate wildcard patterns and CIDR notation
- Confirm exclusion list is populated

**MCP Server Connectivity:**
- Test connection to Shodan MCP server
- Test connection to Security tools MCP server
- Test Playwright browser automation availability
- Verify Perplexity/WebSearch access for research queries
- Check Context7 for documentation lookup capability

**Tool Availability:**
- Verify nmap, dig, curl, and other CLI tools are installed
- Check Python virtual environment activation and required packages
- Validate Nuclei templates are up to date
- Confirm subfinder, httpx, and other ProjectDiscovery tools

**Agent and Hook Health:**
- Verify skill files are readable and properly formatted
- Check command files for valid frontmatter (name, description, aliases, skill)
- Validate hook scripts execute without errors
- Test keyword detector configuration

**Output:**
- Health report with PASS/FAIL/WARN status for each check
- Automatic fix suggestions for common issues
- One-command remediation where possible
