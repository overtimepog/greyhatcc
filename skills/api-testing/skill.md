---
name: api-testing
description: Dedicated API security testing - REST, GraphQL, gRPC endpoint discovery, schema extraction, authentication bypass, parameter fuzzing, and business logic testing
---

# API Security Testing

## Usage
`/greyhatcc:api <URL or domain>`

## Smart Input
`{{ARGUMENTS}}` is parsed automatically — just provide a target in any format:
- **URL** (https://example.com/path) → extracted domain + full URL used as target
- **Domain** (example.com) → https:// prepended, used as target  
- **IP** (1.2.3.4) → used directly for infrastructure testing
- **H1 URL** (hackerone.com/program) → program handle extracted, scope loaded via H1 API
- **Empty** → error: "Usage: /greyhatcc:<skill> <target>"

No format specification needed from user — detect and proceed.


## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (attack vectors table, API discovery section)
2. Load engagement: scope.md, findings_log.md, scope.json
3. Load recon/js artifacts: api_endpoints.md, tech_stack.md, JS analysis results
4. Check gadgets.json for findings that feed into API testing
5. Check tested.json — skip endpoints already tested for the same vuln class

---

## Phase 1: API Discovery

### REST API Discovery
```
Check these paths on every discovered host:
/api                    /api/v1              /api/v2              /api/v3
/api-docs               /swagger             /swagger.json        /swagger-ui
/openapi.json           /openapi.yaml        /v3/api-docs         /docs
/redoc                  /api/docs            /api/schema          /api/spec
/.well-known/openapi    /api/health          /api/status          /api/info
/graphql                /graphiql            /altair              /playground
/api/graphql            /v1/graphql          /query               /gql
```

For each discovered spec:
- Download and parse the full schema
- Extract all endpoints, methods, parameters, auth requirements
- Identify deprecated/undocumented endpoints
- Note endpoints with no auth requirement

### GraphQL Discovery & Enumeration
```
1. Introspection query (often disabled but always try):
   POST /graphql
   {"query": "{__schema{types{name,fields{name,args{name,type{name}}}}}}"}

2. If introspection disabled, enumerate via:
   - Error-based field probing: {"query": "{__type(name:\"User\"){fields{name}}}"}
   - Suggestion abuse: Send typos, collect "did you mean?" suggestions
   - clairvoyance tool for blind schema reconstruction
   - JS bundle analysis for query/mutation names (from js-analysis skill)

3. Extract from JS:
   - gql`` template literals
   - .graphql file imports
   - Query/mutation string constants
   - Fragment definitions
```

### API Version Testing
```
Critical pattern: /api/v1/ frequently lacks security controls applied in /api/v2/+

For every endpoint found:
1. Try all discovered API versions (v1, v2, v3, etc.)
2. Compare auth requirements between versions
3. Compare response schemas (old versions may return more data)
4. Check if deprecated versions are still accessible
```

### gRPC Discovery
```
Check for:
- grpc-web endpoints (Content-Type: application/grpc-web)
- Server reflection: grpcurl -plaintext target:port list
- .proto file discovery in JS bundles or source maps
- gRPC-Gateway REST endpoints (generated from proto)
```

---

## Phase 2: Authentication & Authorization Testing

### JWT Analysis
```
For every JWT token encountered:
1. Decode header + payload (base64, no key needed)
2. Check algorithm: RS256, HS256, ES256, none?
3. Test algorithm confusion:
   - none algorithm: {"alg":"none"} with empty signature
   - RS256→HS256 confusion: Sign with public key as HMAC secret
4. Check expiration: Is exp enforced? How long is the window?
5. Check claims: Are role/scope claims validated server-side?
6. Test with expired tokens — does the API reject them?
7. Test with tokens from different users — IDOR via token swap
8. Test jwk/jku header injection
```

### OAuth/OIDC Testing
```
1. Authorization flow:
   - Open redirect via redirect_uri manipulation
   - State parameter validation (CSRF on OAuth)
   - PKCE bypass (remove code_verifier, downgrade to implicit)
   - Scope escalation (request higher scopes than granted)
2. Token handling:
   - Token leakage in URL fragments, referrer, logs
   - Refresh token rotation — is old refresh token invalidated?
   - Token in URL parameter vs Authorization header
3. Provider-specific:
   - Cognito: Check user pool config, self-signup, unverified attributes
   - Auth0: Check management API exposure
   - Firebase: Check auth rules, anonymous auth
```

### Authorization Testing Matrix
```
For every endpoint, test with:
| Token Type | Expected | Test |
|-----------|----------|------|
| No token | 401 | Remove Authorization header entirely |
| Expired token | 401 | Use token with past exp claim |
| Other user's token | 403 | Swap user ID in token or use different user's session |
| Lower privilege token | 403 | Use viewer token on admin endpoint |
| Modified claims | 403 | Change role/scope in JWT payload |
| API key vs session | varies | Try both auth methods on each endpoint |
```

---

## Phase 3: Business Logic & Parameter Testing

### IDOR Testing
```
For every endpoint with an ID parameter:
1. Access resource with your ID → note response
2. Access resource with another user's ID → compare
3. Try sequential IDs (id+1, id-1)
4. Try UUIDs from other contexts
5. Try ID in different formats (string vs int, with/without prefix)
6. Check bulk endpoints: /api/users vs /api/users/123
```

### Parameter Manipulation
```
1. Type juggling: Send string where int expected, array where string expected
2. Mass assignment: Add extra fields (role, isAdmin, price, discount)
3. Negative values: price=-100, quantity=-1, amount=-999
4. Boundary values: MAX_INT, empty string, null, undefined
5. Array wrapping: id=1 → id[]=1&id[]=2 (parameter pollution)
6. Method override: X-HTTP-Method-Override, _method parameter
```

### Rate Limiting & Race Conditions
```
1. Identify rate-limited endpoints (login, OTP, coupon redemption)
2. Test bypass techniques:
   - Header rotation: X-Forwarded-For, X-Real-IP, X-Client-IP variations
   - GraphQL alias batching: 100 operations in one request
   - HTTP/2 single-packet attack for race conditions
   - Content-Type switching (JSON vs form-data vs XML)
3. Race condition targets:
   - Coupon/promo code redemption (double-spend)
   - Balance transfers (TOCTOU)
   - Like/vote endpoints (count inflation)
   - OTP validation (brute force window)
```

### GraphQL-Specific Testing
```
1. Batching attacks:
   {"query": "query { alias1: user(id:1){email} alias2: user(id:2){email} ... alias100: user(id:100){email} }"}
   → Bypasses rate limiting, enables mass IDOR

2. Nested query DoS:
   {user{friends{friends{friends{friends{name}}}}}}
   → Test query depth/complexity limits

3. Field-level authorization:
   → Access admin-only fields on user-accessible types
   → Check if resolved fields are filtered vs type-level access

4. Mutation fuzzing:
   → Test every mutation with minimal/maximal/invalid input
   → Check for mass assignment via extra input fields

5. Subscription abuse:
   → Subscribe to events you shouldn't see
   → Subscribe with manipulated filter parameters
```

---

## Phase 4: Output

### Artifacts to Save
```
bug_bounty/<program>_bug_bounty/recon/api/
├── endpoints.md          → All discovered endpoints with methods + auth
├── graphql_schema.md     → Extracted GraphQL schema (types, queries, mutations)
├── openapi_spec.json     → Downloaded OpenAPI/Swagger spec
├── auth_matrix.md        → Authorization test results per endpoint
├── api_testing_summary.md → Executive summary with findings
```

### Update Engagement State
1. Add to findings_log.md via `/greyhatcc:findings`
2. Add to gadgets.json: API endpoints feed into IDOR, SSRF, injection testing
3. Update tested.json with endpoints tested and vuln classes checked
4. If HIGH/CRITICAL finding → generate h1-report immediately

## Delegation
- Full API testing → `webapp-tester` (opus) with this skill as instruction
- Quick header/auth checks → `webapp-tester-low` (sonnet)
- GraphQL deep dive → `webapp-tester` (opus) with GraphQL section focus
- Exploit development from API finding → `exploit-developer` (opus)


## Agent Dispatch Protocol
When delegating to agents via Task(), ALWAYS:
1. **Prepend worker preamble**: "[WORKER] Execute directly. No sub-agents. Output ≤500 words. Save findings to disk. 3 failures = stop and report."
2. **Set max_turns**: haiku=10, sonnet=25, opus=40
3. **Pass full context**: scope, exclusions, existing findings, recon data
4. **Route by complexity**: Quick checks → haiku agents (-low). Standard work → sonnet agents. Deep analysis/exploitation → opus agents.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
