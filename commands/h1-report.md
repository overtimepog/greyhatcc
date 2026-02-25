---
name: h1-report
description: "Generate a HackerOne-ready vulnerability report with CVSS, steps to reproduce, and business impact"
aliases:
  - h1
  - hackerone-report
  - submit
allowed-tools: Task, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<finding ID>"
skill: greyhatcc:h1-report
---

# HackerOne Report Generator

Invoke the `greyhatcc:h1-report` skill for: {{ARGUMENTS}}

Generates a submission-ready HackerOne report with:
1. Title following `[Vulnerability] in [Component] allows [Impact]` format
2. TLDR (3 sentences)
3. Numbered reproduction steps with exact URLs, headers, payloads
4. Per-metric CVSS v3.1 rationale
5. Business-focused impact statement
6. Suggested remediation

**Report Sections:**

**Title:**
- Format: `[Vulnerability Type] in [Specific Component/Endpoint] allows [Concrete Impact]`
- Bad: "XSS vulnerability"
- Good: "Stored XSS in /profile/bio allows session hijacking via crafted profile link"

**TLDR:**
- Three sentences: What the vulnerability is, where it exists, what an attacker can achieve
- Written for a triager who reviews 50+ reports per day

**Steps to Reproduce:**
- Numbered steps with exact URLs, HTTP methods, headers, and payloads
- Copy-paste ready: a triager should reproduce in under 5 minutes
- Include curl commands or Burp Suite request/response pairs
- Specify any prerequisites: authenticated session, specific role, test account

**CVSS v3.1 Rationale:**
- Individual justification for each metric: AV, AC, PR, UI, S, C, I, A
- Explains why each metric was chosen with target-specific context
- Calculates final score and maps to severity rating

**Business Impact:**
- Quantified where possible: "affects N users", "exposes M records"
- Maps technical impact to business consequence: revenue, reputation, compliance
- References relevant regulations (GDPR, PCI-DSS, HIPAA) when applicable

**Remediation:**
- Specific code fix or configuration change, not generic advice
- References to framework documentation or security best practices
- Defense-in-depth recommendations beyond the immediate fix

**Pre-Submission Checks:**
- Dedup validation against internal findings log and hacktivity
- Scope verification against program rules and exclusion list
- Common rejection pattern check (missing headers, self-XSS without chain, etc.)
