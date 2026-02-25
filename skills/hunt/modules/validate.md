# Validate Module -- Hunt Loop 5-Gate Validation

You are executing a `type: "validate"` work item within the hunt loop. Every finding MUST pass through this module before it can be reported. You are the last line of defense against rejected reports, false positives, duplicates, and wasted effort.

A finding enters validation with status `"confirmed"` or `"candidate"` and exits either:
- `"validated"` -- passed all 5 gates, ready for report module
- `"rejected"` -- failed a gate that cannot be fixed, removed from findings
- Sent back to `"test"` or `"exploit"` -- failed proof or quality gate, needs more work

## Output Contract

```json
{
  "success": true,
  "summary": "Finding F-XXX: [VALIDATED|REJECTED|RETURNED] - [reason]",
  "new_surfaces": [],
  "signals": [],
  "findings": [{ "...updated finding with validation_gates populated..." }],
  "gadgets": [],
  "new_work_items": [],
  "raw_output": "",
  "tokens_used": 0,
  "duration_ms": 0
}
```

The primary output is an updated `Finding` object with all `validation_gates` fields set to `true` or `false`:
```json
{
  "validation_gates": {
    "in_scope": true,
    "not_excluded": true,
    "not_duplicate": true,
    "proof_reproducible": true,
    "quality_sufficient": true
  }
}
```

## Gate Execution Order

Gates run in order 1-5. If a gate REJECTS the finding (hard fail), STOP -- do not run subsequent gates. This saves resources. If a gate RETURNS the finding for more work, still run remaining gates to collect all issues at once.

```
Finding ──> [1] Scope ──> [2] Exclusion ──> [3] Dedup ──> [4] Proof ──> [5] Quality ──> VALIDATED
              |              |                 |             |              |
              v              v                 v             v              v
           REJECT        CHAIN-ONLY         REJECT      RETURN to       RETURN to
           (OOS)         or REJECT          (dupe)      test/exploit     report
```

## Model Tier Routing

| Gate | Tier | Rationale |
|------|------|-----------|
| 1. Scope | sonnet | Pattern matching against scope definitions, subdomain wildcards |
| 2. Exclusion | sonnet | Policy interpretation, exclusion list matching |
| 3. Dedup | sonnet | API calls + similarity analysis |
| 4. Proof | opus | Must re-run PoC, understand complex exploit chains, verify deterministic reproduction |
| 5. Quality | opus | Report quality assessment, CVSS verification, impact evaluation |

---

## Gate 1: Scope Gate

**Purpose**: Verify the affected asset is within the program's authorized testing scope.

**Inputs**:
- Finding's `target` field (the affected URL/asset)
- `ScopeDefinition.in_scope` -- list of authorized targets
- `ScopeDefinition.out_of_scope` -- list of excluded targets
- `h1_structured_scopes` -- live scope data from HackerOne API

**Checks**:
1. Extract the hostname/domain from the finding's target URL.
2. Check against `in_scope` list:
   - Exact match: `api.target.com` matches `api.target.com`
   - Wildcard match: `api.target.com` matches `*.target.com`
   - IP match: resolved IP matches IP range in scope
3. Check against `out_of_scope` list:
   - If target matches any out-of-scope entry, REJECT
   - Common gotchas: `staging.target.com` may be OOS even if `*.target.com` is in scope
4. Call `h1_structured_scopes` to get live scope (scope may have changed since hunt started).
5. Verify the asset type matches: if scope says "URL" but finding is on a mobile API, check if mobile is separately scoped.

**Verdicts**:
- PASS: Asset clearly in scope, no OOS match. Set `validation_gates.in_scope = true`.
- REJECT: Asset clearly out of scope. Set `validation_gates.in_scope = false`. Update finding status to `"rejected"` with reason `"out_of_scope"`. STOP.
- UNCLEAR: Asset is borderline (e.g., acquired domain, third-party integration). Emit signal `"scope-unclear"` and set `validation_gates.in_scope = null`. Flag for manual review but continue gates.

---

## Gate 2: Exclusion Gate

**Purpose**: Verify the vulnerability type is not on the program's exclusion list or HackerOne's universal exclusion list.

**Inputs**:
- Finding's `vulnerability_type` field
- `ScopeDefinition.exclusions` -- program-specific exclusion list
- `ScopeDefinition.program_policy` -- raw policy text for edge cases
- HackerOne universal exclusions (from CLAUDE.md):
  - Clickjacking on non-sensitive pages
  - CSRF on non-sensitive forms (logout)
  - Permissive CORS without demonstrated impact
  - Software version disclosure
  - CSV injection
  - Open redirects without chain
  - SSL/TLS configuration issues
  - Missing cookie flags
  - Missing security headers (CSP, HSTS, X-Frame-Options)
  - SPF/DKIM/DMARC issues
  - Rate limiting without proven impact
  - Self-XSS without chain
  - Broken link hijacking, tabnabbing

**Checks**:
1. Map the finding's `vulnerability_type` to common exclusion categories:
   - `"cors-misconfiguration"` -> check if exclusions mention CORS
   - `"open-redirect"` -> check if exclusions mention redirects
   - `"missing-header"` -> almost always excluded
   - `"self-xss"` -> always excluded unless chained
   - `"csrf"` -> check if the form has sensitive actions
2. Check the program policy for specific language about the vuln type.
3. If the vuln type IS excluded, check if the finding has a chain that overcomes the exclusion:
   - Finding references `chain_ids`? Load those findings and check if the combined chain has demonstrable security impact.
   - Self-XSS + CSRF = ATO -> chain overcomes self-XSS exclusion
   - Open redirect + OAuth = token theft -> chain overcomes open redirect exclusion
   - CORS + subdomain takeover = data theft -> chain overcomes CORS exclusion

**Verdicts**:
- PASS: Vuln type not excluded. Set `validation_gates.not_excluded = true`.
- PASS (CHAIN): Vuln type is excluded standalone but chain overcomes it. Set `validation_gates.not_excluded = true`. Add note: `"excluded_standalone_valid_in_chain"`.
- CHAIN-ONLY: Vuln type is excluded and no chain exists. Do NOT reject -- convert finding to gadget and add to `gadgets.json` with appropriate `provides` tags. Emit signal `"chain-candidate"`. Set `validation_gates.not_excluded = false`. Remove from findings but keep as gadget.
- REJECT: Vuln type is on universal exclusion list AND has no chain potential (e.g., missing headers). STOP.

---

## Gate 3: Dedup Gate

**Purpose**: Check if this finding has already been reported -- by you, by other researchers, or disclosed publicly.

**Inputs**:
- Finding's `vulnerability_type`, `target`, `title`
- Internal state: `findings.json` (previously validated findings), `submissions.json` (submitted reports)
- HackerOne API: `h1_dupe_check`, `h1_hacktivity`
- External search: `perplexity_ask`

**Checks**:
1. **Internal dedup**: Search `findings.json` for same `vulnerability_type` + same `target`. Same root cause = same bounty, even if different endpoints. Example: IDOR on `/api/users/1` and `/api/users/1/profile` are the same root cause if both stem from missing authorization on the user ID parameter.
2. **Submission dedup**: Search `submissions.json` for already-submitted reports covering this vuln+target combination.
3. **H1 API dupe check**: Call `h1_dupe_check(handle, vuln_type, asset)`. Parse the response:
   - `risk: "HIGH"` -- very likely duplicate, includes matched report IDs
   - `risk: "MEDIUM"` -- possible duplicate, needs manual review
   - `risk: "LOW"` -- unlikely duplicate
   - `risk: "CLEAR"` -- no matches found
4. **Hacktivity check**: Call `h1_hacktivity(handle, disclosed_only=true)`. Search disclosed reports for:
   - Same vulnerability type on same or similar asset
   - Same root cause even if different vuln type (e.g., "Authorization bypass" may cover your specific IDOR)
5. **External search**: Call `perplexity_ask("Has {vulnerability_type} in {target} of {program} been publicly disclosed or reported on HackerOne, Bugcrowd, or security blogs?")`. Look for blog posts, tweets, or writeups about the same issue.

**Scoring**:
```
dupe_risk_score = 0
if internal_match: dupe_risk_score += 100  // Definite dupe
if submission_match: dupe_risk_score += 100  // Already submitted
if h1_risk == "HIGH": dupe_risk_score += 80
if h1_risk == "MEDIUM": dupe_risk_score += 40
if h1_risk == "LOW": dupe_risk_score += 10
if hacktivity_match: dupe_risk_score += 60
if perplexity_match: dupe_risk_score += 30
```

**Verdicts**:
- PASS: `dupe_risk_score < 40`. Set `validation_gates.not_duplicate = true`.
- REVIEW: `dupe_risk_score 40-70`. Set `validation_gates.not_duplicate = null`. Emit signal `"possible-duplicate"` with matched report details. Continue gates but flag for manual review.
- REJECT: `dupe_risk_score > 70`. Set `validation_gates.not_duplicate = false`. Update finding status to `"duplicate"`. Include matched report IDs in the result. STOP.

**Differentiation strategy** (for REVIEW findings):
- If your finding affects a different asset than the disclosed report -> likely not a dupe
- If your finding has a chain that the disclosed report lacks -> differentiate on impact
- If your finding uses a different attack vector for the same root cause -> still a dupe (same fix)
- Add differentiation notes to the finding for the report module to include

---

## Gate 4: Proof Gate

**Purpose**: Re-run the proof of concept from scratch to verify it works deterministically. This is NOT a theoretical check -- you MUST actually execute the PoC.

**Inputs**:
- Finding's `proof_of_concept` -- the PoC steps/commands
- Finding's `evidence` -- existing evidence artifacts
- Current authentication tokens (may need refresh)

**Checks**:
1. **Start fresh.** Do not rely on cached sessions or prior state. Obtain fresh authentication tokens if needed.
2. **Execute every step.** Run each curl command or Playwright step from the PoC exactly as written.
3. **Compare results.** For each step:
   - Does the HTTP status code match expected?
   - Does the response body contain the expected vulnerability evidence?
   - For blind attacks: does the timing match expected delay?
   - For XSS: does the payload execute in the browser?
   - For SSRF: does the internal resource respond?
4. **Check determinism.** Run the PoC 3 times. It must succeed at least 2 out of 3 times. If it's timing-dependent, document the success rate.
5. **Capture fresh evidence.** Replace stale evidence with fresh captures:
   - Raw HTTP request and response
   - Screenshots (via Playwright `browser_take_screenshot`)
   - Timing measurements for blind attacks
   - Response bodies showing sensitive data (redacted)

**Verdicts**:
- PASS: PoC works consistently (2/3+ successes). Evidence is fresh and matches. Set `validation_gates.proof_reproducible = true`. Update evidence with fresh captures.
- RETURN: PoC fails but failure seems fixable (expired token, changed endpoint path, parameter name changed). Spawn: `{ type: "test", subtype: "<original_subtype>", target, context: { revalidation: true, original_finding_id: finding.id }, priority: 75 }`. Set `validation_gates.proof_reproducible = false`.
- REJECT: PoC fails completely and vulnerability appears to be patched or was a false positive. Set `validation_gates.proof_reproducible = false`. Update finding status to `"rejected"` with reason `"not_reproducible"`.

**Special cases**:
- **Race conditions**: Success rate may be <100%. Document: "Succeeded X out of Y attempts. Race window is approximately Zms." Acceptable if X/Y >= 30%.
- **Time-of-day dependent**: Document the dependency. Re-test during the appropriate window.
- **Chain PoCs**: Each step in the chain must be verified independently, then the full chain must work end-to-end.

---

## Gate 5: Quality Gate

**Purpose**: Ensure the finding has sufficient detail, accurate severity, and clear impact for a successful HackerOne submission.

**Inputs**:
- Complete finding object
- Program's bounty table
- CVSS calculator (`cvss_calculate` MCP tool)

**Checks**:

### 5A: Title Quality
- [ ] Title follows format: `[Vulnerability Type] in [Component/Asset] allows [Specific Impact]`
- [ ] Title is under 100 characters
- [ ] Title is specific, not generic ("XSS" alone is bad, "Stored XSS in /profile/bio allows session hijacking" is good)
- Bad: "SQL Injection vulnerability"
- Good: "SQL Injection in /api/search allows extraction of all user credentials"

### 5B: PoC Completeness
- [ ] Steps are numbered
- [ ] Each step has a clear action (not "do the thing")
- [ ] curl commands include ALL headers (Content-Type, Authorization, X-HackerOne-Research)
- [ ] No placeholder values (no `<INSERT_TOKEN_HERE>` -- provide instructions for obtaining tokens)
- [ ] Expected output is documented after each step
- [ ] PoC is copy-pasteable -- someone should be able to follow steps without guessing

### 5C: Impact Statement
- [ ] Impact describes specific business consequences, not just technical ones
- [ ] Mentions affected data types (PII, financial, health records)
- [ ] Quantifies blast radius when possible ("affects all N users", "exposes M records")
- [ ] Does NOT overstate impact (do not claim "full database compromise" for a single-table read)
- Bad: "An attacker could access sensitive data"
- Good: "An attacker can read any user's email address, phone number, and physical address by iterating the user ID parameter. With approximately 50,000 registered users, this exposes PII for the entire user base."

### 5D: CVSS Accuracy
- [ ] CVSS vector string is present and syntactically valid
- [ ] Run `cvss_calculate` with the vector to verify the score matches
- [ ] Each metric has a written rationale:
  - AV (Attack Vector): Why network/adjacent/local/physical?
  - AC (Attack Complexity): Why low/high? Low means NO preconditions.
  - PR (Privileges Required): Why none/low/high? None means truly unauthenticated.
  - UI (User Interaction): Why none/required?
  - S (Scope): Why unchanged/changed? Changed means crossing trust boundary.
  - C/I/A: Why high/low/none?
- [ ] Conservative sanity checks:
  - Score >= 9.0 requires: RCE, full ATO, or mass data breach with evidence
  - Score >= 7.0 requires: more than information disclosure alone
  - AC:L requires: no special preconditions, no subdomain takeover needed, no specific server config
  - PR:N requires: truly no authentication, not even a free registration
  - S:C requires: actually crossing a trust boundary (web server -> database is NOT changed scope; web app -> user browser IS changed scope for XSS)

### 5E: CWE Classification
- [ ] CWE ID is present (e.g., CWE-79, CWE-89, CWE-639)
- [ ] CWE matches the actual vulnerability type (not a generic parent like CWE-20)

### 5F: Evidence Completeness
- [ ] At least one piece of evidence exists (HTTP request/response, screenshot, extracted data)
- [ ] Evidence files are referenced in the finding and exist on disk
- [ ] Evidence clearly demonstrates the vulnerability (not just a 200 OK response)

**Verdicts**:
- PASS: All checks pass. Set `validation_gates.quality_sufficient = true`. Finding status -> `"validated"`.
- RETURN: Some checks fail but are fixable. Create detailed list of required fixes. Spawn: `{ type: "report", target, context: { quality_fixes: [...], finding_id: finding.id }, priority: 70 }`. Set `validation_gates.quality_sufficient = false`.
- REJECT: Quality is fundamentally insufficient (no reproducible impact, entirely theoretical). Rare -- usually RETURN instead.

---

## Post-Validation Actions

### Finding VALIDATED (all 5 gates pass)
1. Update finding status to `"validated"`.
2. Set `validated_at` to current ISO timestamp.
3. Spawn report work item: `{ type: "report", target, context: { finding_id: finding.id }, priority: 65 }`.
4. Emit signal: `"finding-validated"` with finding ID and severity.

### Finding REJECTED
1. Update finding status to `"rejected"` with reason.
2. If the finding has chain potential, convert to gadget with appropriate `provides` tags.
3. Emit signal: `"finding-rejected"` with finding ID and reason.
4. Do NOT spawn report work item.

### Finding RETURNED
1. Keep finding status as `"confirmed"`.
2. Spawn appropriate work item (test, exploit, or report) to fix the issue.
3. When the fix is done, the finding will re-enter validation.
4. Track retry count. If a finding fails proof gate 3 times, REJECT it.

---

## Validation Priorities

Process findings in this priority order:
1. Critical severity findings (may have time-sensitive impact)
2. Chain findings (multiple gadgets combined -- validate the chain as a whole)
3. High severity findings
4. Medium severity findings
5. Low severity and informational (usually only validate if part of a chain)

## Batch Validation

When multiple findings are queued for validation, run gates 1-3 for all findings first (these are cheap API calls). Then run gates 4-5 only for findings that passed gates 1-3. This avoids spending opus tokens on proof validation for findings that will be rejected on scope or dedup.
