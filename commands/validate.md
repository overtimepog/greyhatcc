---
name: validate
description: "Multi-gate report quality validation before HackerOne submission"
aliases:
  - val
  - qa
allowed-tools: Task, Bash, Read, Glob, Grep, WebFetch, WebSearch
argument-hint: "<report path>"
skill: greyhatcc:validate-report
---

# Report Validation

Invoke the `greyhatcc:validate-report` skill for: {{ARGUMENTS}}

Runs 8 quality gates on a report before HackerOne submission to prevent rejections:

**Gate 1 - Asset Accuracy:**
- Verify the reported asset (domain, IP, endpoint) actually exists and resolves
- Confirm the asset belongs to the target organization
- Check for typos in URLs, parameters, and hostnames

**Gate 2 - Scope Compliance:**
- Validate the affected asset falls within the program's in-scope list
- Check wildcard scope matching for subdomains
- Verify the asset type (web, API, mobile, network) is in scope

**Gate 3 - Exclusion List:**
- Check against program-specific excluded vulnerability types
- Verify the finding is not in the "will not fix" or "known issue" category
- Confirm the endpoint is not on the program's exclusion list

**Gate 4 - Duplicate Check:**
- Run full 6-layer dedup analysis against internal log and hacktivity
- Check for similar findings in the same engagement
- Search for publicly disclosed reports matching this vulnerability

**Gate 5 - Steps to Reproduce:**
- Verify reproduction steps are numbered, specific, and copy-paste ready
- Confirm all URLs, headers, and payloads are included
- Check that prerequisites (auth tokens, test accounts) are documented
- Validate that a triager can reproduce in under 5 minutes

**Gate 6 - CVSS Integrity:**
- Validate CVSS v3.1 vector string syntax
- Check each metric against the vulnerability description for consistency
- Flag inflated or deflated severity relative to actual impact

**Gate 7 - Report Completeness:**
- Title follows `[Vuln] in [Component] allows [Impact]` format
- TLDR present with three concise sentences
- Impact statement references business consequences
- Remediation is specific, not generic

**Gate 8 - Program Rule Compliance:**
- Required headers or tokens included in requests
- Testing conducted within allowed hours (if specified)
- No destructive actions performed against production (if prohibited)
- Report format matches program-specific requirements
