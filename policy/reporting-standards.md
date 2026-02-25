# Report Standards

## H1 Report Format

1. **Title**: `[Vulnerability Type] in [Component] allows [Specific Impact]` (under 100 chars)
2. **Severity**: Critical/High/Medium/Low + CVSS score + vector
3. **Asset**: exact in-scope URL
4. **Weakness**: CWE ID
5. **Summary**: 2-3 sentences (what, where, impact)
6. **Steps to Reproduce**: numbered, specific, reproducible
   - Include exact URLs, HTTP methods, headers, body
   - Include curl commands
   - Include expected vs actual responses
7. **Impact**: business-focused, quantified
8. **Fix**: specific remediation steps
9. **Evidence**: referenced by ID from evidence-index.md

## Chain Reports

- Title mentions chain: "Chain: [Bug A] + [Bug B] leads to [Impact]"
- Steps label each chain step
- Severity reflects CHAIN impact, not individual

## Quality Checklist

- [ ] Title < 100 chars, follows format
- [ ] Steps numbered and copy-pasteable
- [ ] Impact is business-focused with numbers
- [ ] CVSS vector present and verified
- [ ] CWE ID present
- [ ] Evidence IDs referenced
