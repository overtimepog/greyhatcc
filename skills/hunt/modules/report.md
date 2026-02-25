# Report Module -- Hunt Loop H1 Report Generation

You are executing a `type: "report"` work item within the hunt loop. You receive validated findings and produce HackerOne-ready vulnerability reports. Your reports must be submission-quality -- no placeholders, no ambiguity, no generic language.

## Output Contract

```json
{
  "success": true,
  "summary": "Report generated: [title] -> hunt-state/reports/[filename].md",
  "new_surfaces": [],
  "signals": [],
  "findings": [{ "...updated finding with status: 'reported'..." }],
  "gadgets": [],
  "new_work_items": [],
  "raw_output": "",
  "tokens_used": 0,
  "duration_ms": 0
}
```

The primary output is a markdown report file written to `hunt-state/reports/` and the finding's status updated to `"reported"`.

## Default Tier

- **sonnet** for standard single-vulnerability reports
- **opus** for critical findings, chain findings, and findings where business impact needs nuanced articulation

---

## Report Structure

Every report MUST follow this exact structure. Missing sections = quality gate failure.

### 1. Title

Format: `[Vulnerability Type] in [Component/Asset] allows [Specific Impact]`

Rules:
- Under 100 characters
- Specific, not generic
- Names the exact affected component
- States the concrete impact, not just the vulnerability class

Examples:
- Bad: "XSS vulnerability"
- Bad: "Security issue in the application"
- Good: "Stored XSS in /api/comments allows session hijacking of any user"
- Good: "IDOR in /api/v2/users/{id}/profile allows reading any user's PII"
- Good: "SQL Injection in /search endpoint allows extraction of all user credentials"

### 2. Severity and CVSS

```markdown
**Severity**: Critical / High / Medium / Low
**CVSS Score**: X.X
**CVSS Vector**: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N

### CVSS Metric Rationale
| Metric | Value | Rationale |
|--------|-------|-----------|
| Attack Vector (AV) | Network | Exploitable over the internet with no special access |
| Attack Complexity (AC) | Low | No special conditions or preconditions required |
| Privileges Required (PR) | None | No authentication needed |
| User Interaction (UI) | None | No victim action required |
| Scope (S) | Unchanged | Impact stays within the vulnerable component |
| Confidentiality (C) | High | Full database contents accessible |
| Integrity (I) | High | Arbitrary data modification possible |
| Availability (A) | None | No impact on availability |
```

Rules:
- Use `cvss_calculate` to verify the score matches the vector. Do NOT manually compute.
- Every metric gets a rationale. "High" is not a rationale. "Full database contents accessible including password hashes" is a rationale.
- Be conservative. When in doubt, use the lower value.
- Reference the program's bounty table to contextualize severity (e.g., "Based on the bounty table, this Critical finding falls in the $X-$Y range").

### 3. Asset

```markdown
**Asset**: api.target.com (URL)
```

Rules:
- MUST exactly match an entry from the program's structured scopes (call `h1_structured_scopes` to verify).
- Include the asset type in parentheses: (URL), (Domain), (Android App), (iOS App), (Source Code), etc.
- If the vulnerability affects a specific subdomain, use that subdomain -- NOT the wildcard.
- If testing was done on staging but the vuln affects production, clearly state both.

### 4. Weakness

```markdown
**Weakness**: CWE-89: Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')
```

Rules:
- Use the most specific CWE, not generic parents.
- Common mappings:
  - XSS -> CWE-79
  - SQLi -> CWE-89
  - IDOR -> CWE-639
  - SSRF -> CWE-918
  - CSRF -> CWE-352
  - Command Injection -> CWE-78
  - Path Traversal -> CWE-22
  - File Upload -> CWE-434
  - Open Redirect -> CWE-601
  - Broken Auth -> CWE-287
  - Mass Assignment -> CWE-915
  - Deserialization -> CWE-502
  - SSTI -> CWE-1336
  - CORS -> CWE-942
  - Race Condition -> CWE-362

### 5. Summary (TLDR)

Three sentences maximum:
1. What the vulnerability is and where it exists
2. What an attacker can do with it
3. The scale of impact (affected users, data types, blast radius)

Example:
> The `/api/v2/users/{id}/profile` endpoint does not verify that the authenticated user has permission to access the requested profile. An attacker with a valid session can enumerate user IDs and read any user's full profile including email, phone number, and physical address. With approximately 50,000 registered users, this exposes PII for the entire user base.

### 6. Steps to Reproduce

Numbered, specific, copy-pasteable steps. Every HTTP request includes ALL required headers.

```markdown
## Steps to Reproduce

**Prerequisites**: Create a free account at https://target.com/signup (or use test account credentials: ...)

### Step 1: Authenticate and obtain session token
\`\`\`bash
curl -sk -X POST 'https://target.com/api/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'X-HackerOne-Research: overtimedev' \
  -d '{"email": "attacker@example.com", "password": "testpassword123"}'
\`\`\`

**Expected response**: JSON with `token` field
\`\`\`json
{"token": "eyJ..."}
\`\`\`

### Step 2: Access another user's profile
\`\`\`bash
curl -sk 'https://target.com/api/v2/users/1/profile' \
  -H 'Authorization: Bearer <token_from_step_1>' \
  -H 'X-HackerOne-Research: overtimedev'
\`\`\`

**Expected response**: Profile data for user ID 1 (a different user)
\`\`\`json
{"id": 1, "name": "John Doe", "email": "john@example.com", "phone": "+1234567890"}
\`\`\`

### Step 3: Demonstrate enumeration
\`\`\`bash
# Access user 2
curl -sk 'https://target.com/api/v2/users/2/profile' \
  -H 'Authorization: Bearer <token_from_step_1>' \
  -H 'X-HackerOne-Research: overtimedev'

# Access user 3
curl -sk 'https://target.com/api/v2/users/3/profile' \
  -H 'Authorization: Bearer <token_from_step_1>' \
  -H 'X-HackerOne-Research: overtimedev'
\`\`\`

**Result**: Different user data returned for each ID, confirming IDOR.
```

Rules:
- EVERY curl command includes `X-HackerOne-Research: overtimedev` header
- EVERY curl command includes `Content-Type` and `Authorization` headers as needed
- Show expected response after each step
- Use placeholders only with clear instructions on how to obtain the value (e.g., `<token_from_step_1>`)
- Steps must be reproducible by someone unfamiliar with the application
- For chain findings: clearly label each chain step and show how output of one step feeds the next

### 7. Impact Statement

Business-focused, not just technical. Address:
- WHO is affected (all users, admin users, specific roles)
- WHAT data/functionality is compromised (PII, financial, health, admin controls)
- HOW MANY records/users are at risk (quantify when possible)
- WHAT an attacker could do (read data, modify data, delete accounts, take over accounts)
- Regulatory implications if applicable (GDPR, HIPAA, PCI-DSS)

Example:
> An unauthenticated attacker can extract the complete user database including names, email addresses, phone numbers, and physical addresses for all ~50,000 registered users. This data could be used for targeted phishing, identity theft, or sold on dark web markets. Under GDPR, this constitutes a personal data breach requiring notification to supervisory authorities within 72 hours (Article 33) and notification to affected data subjects (Article 34) given the high risk to their rights and freedoms.

### 8. Suggested Fix

Specific, actionable remediation advice. Not "fix the bug" or "validate input."

Example:
> 1. **Authorization check**: Add server-side verification that the authenticated user's ID matches the requested user ID, or that the user has admin privileges:
>    ```python
>    if request.user.id != requested_user_id and not request.user.is_admin:
>        return HttpResponseForbidden()
>    ```
> 2. **Use indirect references**: Replace sequential user IDs with UUIDs to prevent enumeration.
> 3. **Rate limiting**: Add rate limiting on the `/api/v2/users/` endpoint to slow down bulk extraction even if authorization is bypassed.

### 9. Evidence

Reference all evidence artifacts:
```markdown
## Evidence

### HTTP Request/Response
[Raw request and response from Step 2]

### Screenshot
![Profile data for another user](evidence/F-XXX/screenshot_01.png)

### Data Sample (redacted)
| User ID | Name | Email (redacted) | Phone (redacted) |
|---------|------|-------------------|-------------------|
| 1 | John D. | j***@example.com | +1***890 |
| 2 | Jane S. | j***@test.com | +1***234 |
```

---

## Chain Finding Reports

For findings that consist of a vulnerability chain:

### Additional Structure
After the title, add a chain overview:

```markdown
## Vulnerability Chain Overview

| Step | Vulnerability | Severity Alone | Role in Chain |
|------|--------------|----------------|---------------|
| 1 | Open Redirect on /login | Excluded (standalone) | Provides controlled redirect for OAuth flow |
| 2 | OAuth redirect_uri accepts subdirectory | N/A alone | Allows attacker to redirect auth code to controlled URL |
| **Combined** | **Account Takeover via OAuth Token Theft** | **High** | Full chain: steal auth tokens via crafted login URL |
```

### Chain PoC Format
In Steps to Reproduce, clearly delineate each chain component:

```markdown
### Chain Step 1: Establish open redirect
[curl command demonstrating the redirect]

### Chain Step 2: Craft OAuth URL exploiting the redirect
[URL construction showing how redirect feeds into OAuth]

### Chain Step 3: Victim clicks link, token is stolen
[Full attack flow]
```

---

## Report File Naming

```
hunt-state/reports/{finding_id}_{severity}_{vuln_type_slug}.md
```

Examples:
- `hunt-state/reports/F-001_critical_sqli_search_endpoint.md`
- `hunt-state/reports/F-003_high_idor_user_profiles.md`
- `hunt-state/reports/CHAIN-001_high_oauth_token_theft.md`

---

## Bounty Context

When writing the report, reference the program's bounty table:

1. Load bounty table from hunt state or call `h1_bounty_table`.
2. Include a note at the end of the report (for internal use, not submitted):
   ```markdown
   ---
   ## Internal Notes (do not submit)
   - Bounty range for {severity}: ${min} - ${max}
   - Dupe risk: {LOW|MEDIUM|HIGH}
   - Chain potential: {description}
   - Priority: {submit immediately | wait for chain | hold for more impact}
   ```

---

## Quality Self-Check

Before finalizing the report, run through this checklist:

- [ ] Title follows `[Type] in [Asset] allows [Impact]` format and is under 100 characters
- [ ] CVSS vector is present and verified with `cvss_calculate`
- [ ] Every CVSS metric has a written rationale
- [ ] Asset name exactly matches structured scopes entry
- [ ] CWE ID is present and specific
- [ ] Summary is 3 sentences or fewer
- [ ] Steps are numbered with curl commands including all headers
- [ ] `X-HackerOne-Research: overtimedev` header in every curl command
- [ ] Expected output shown after each step
- [ ] Impact is business-focused with quantified blast radius
- [ ] Remediation is specific and actionable (not "fix the bug")
- [ ] Evidence is referenced and exists on disk
- [ ] For chains: chain overview table and step-by-step chain PoC

If ANY item fails, fix it before outputting the report. Do not rely on the validate module to catch report quality issues -- catch them here.

---

## Post-Report Actions

1. Update finding status to `"reported"`.
2. Write report file to `hunt-state/reports/`.
3. The orchestrator will spawn a `validate` work item for final verification before submission.
4. If the report is for a chain, update all gadgets in the chain to `status: "reported"`.
5. Emit signal: `"report-generated"` with finding ID, severity, and file path.
