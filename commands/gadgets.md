---
name: gadgets
description: "Manage vulnerability gadget inventory and analyze chaining opportunities"
aliases:
  - chain
  - chains
  - inventory
allowed-tools: Task, Read, Write, Edit, Glob, Grep
argument-hint: "chain | show | add <details>"
skill: greyhatcc:gadget-inventory
---

# Gadget Inventory & Chain Builder

Invoke the `greyhatcc:gadget-inventory` skill with: {{ARGUMENTS}}

Usage:
- `/greyhatcc:gadgets show` - Display current gadget inventory
- `/greyhatcc:gadgets add "finding description"` - Add a gadget
- `/greyhatcc:gadgets chain` - Analyze all gadgets for chaining
- `/greyhatcc:gadgets check "new finding"` - Check chain potential

When an active hunt exists (`hunt-state/`), gadgets are read from and written to
`hunt-state/gadgets.json` in structured JSON format. Otherwise falls back to the
legacy `bug_bounty/<program>/gadgets.json` format.

The gadget inventory is the core of vulnerability chaining methodology:

**Gadget Structure:**
- Each finding is tagged with what it **provides** (e.g., "authenticated session", "SSRF",
  "open redirect", "reflected input", "file read") and what it **requires** (e.g.,
  "user interaction", "valid session", "specific parameter")
- Provides/requires tags create a directed graph of potential attack chains

**Chain Analysis:**
- Automatic graph traversal: find all paths from low-severity gadgets to high-impact outcomes
- Classic chain patterns detected automatically:
  - Self-XSS + CSRF = forced XSS execution = Account Takeover
  - Open Redirect + OAuth callback = token theft to attacker server
  - IDOR + PII endpoint = mass data exfiltration
  - SSRF + cloud metadata = IAM credential theft = full cloud compromise
  - API version downgrade + method change + JSONP = reflected XSS = ATO
  - Race condition + balance check = double-spend / limit bypass
- Impact escalation scoring: how much does the chain elevate severity?

**Low-to-High Chaining Patterns:**
- Informational findings (tech disclosure, path leak) provide targeting data for other bugs
- Low-severity findings (open redirect, verbose errors) become critical chain components
- Never discard a low: catalog it as a gadget and wait for the chain to complete

**Output:**
- Visual chain diagrams showing gadget connections
- Severity uplift calculations for each chain
- Prioritized list of "missing gadgets" that would complete high-value chains
