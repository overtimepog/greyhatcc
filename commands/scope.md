---
name: scope
description: "Define or validate target scope for the current engagement"
aliases:
  - targets
  - engagement
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep
argument-hint: "show | check <target>"
skill: greyhatcc:scope-management
---

# Scope Management

Invoke the `greyhatcc:scope-management` skill with: {{ARGUMENTS}}

When an active hunt exists (`hunt-state/`), scope is read from `hunt-state/hunt.json`
(the `scope` field of HuntState). Otherwise falls back to `.greyhatcc/scope.json`.

Manages the target scope for the current engagement, ensuring all testing stays within
authorized boundaries:

**Operations:**
- `show` - Display the current scope including in-scope assets, exclusions, and out-of-scope items
- `check <target>` - Validate whether a specific domain, IP, or URL falls within scope
- `set <program-url>` - Auto-extract scope from a HackerOne/Bugcrowd program page
- `add <target>` - Manually add a domain, IP range, or URL to the in-scope list
- `remove <target>` - Remove an asset from scope
- `export` - Export scope as JSON for tool integration

**Scope Data Structure:**
- In-scope domains and wildcards (e.g., *.target.com)
- In-scope IP ranges and CIDR blocks
- Explicit exclusions (third-party services, production databases, specific paths)
- Out-of-scope vulnerability types (e.g., self-XSS, missing headers, rate limiting)
- Program-specific rules (required headers, VPN access, test account restrictions)

**Scope Validation:**
- Every finding is automatically checked against scope before report generation
- Wildcard matching supports nested subdomains (a.b.target.com matches *.target.com)
- IP ranges are validated against CIDR notation
- Exclusion patterns are checked at both domain and path level

The scope.json file is the single source of truth used by all other greyhatcc commands
for scope enforcement, finding validation, and report generation.
