---
name: oauth-jwt-testing
description: Dedicated OAuth/OIDC/JWT/SAML authentication testing - token manipulation, flow bypass, scope escalation, provider-specific attacks
---

# OAuth / JWT / Authentication Flow Testing

## Usage
`/greyhatcc:auth <URL or auth endpoint>`

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
1. Load guidelines: CLAUDE.md (OAuth/OIDC abuse row in attack vectors table)
2. Load program guidelines: scope.md → assets, exclusions (check if "credential leakage with 2FA" is excluded)
3. Load engagement: findings_log.md, gadgets.json
4. Load recon: JS analysis output (auth flow code, token handling, provider config)
5. Load memory: Target-specific auth notes from previous sessions

---

## Phase 1: Auth Flow Discovery

### Identify Authentication Mechanisms
```
Check for:
1. OAuth 2.0 / OIDC — Look for /authorize, /token, /callback, /oauth endpoints
2. SAML — Look for /saml, /sso, /login/callback with SAMLResponse params
3. JWT — Check Authorization: Bearer headers, cookie-stored JWTs
4. Session cookies — Traditional server-side sessions
5. API keys — X-API-Key, Authorization: ApiKey headers
6. Cognito — cognito-idp.*.amazonaws.com URLs in JS
7. Auth0 — *.auth0.com URLs in JS
8. Firebase Auth — firebaseapp.com auth calls in JS
9. Social login — Google, Facebook, Apple, GitHub OAuth buttons
10. MFA/2FA — TOTP, SMS, email verification flows
```

### Extract Auth Configuration from JS
```
Look for in JS bundles (from js-analysis output):
- OAuth client_id, redirect_uri, scopes
- OIDC discovery URL (.well-known/openid-configuration)
- JWT signing algorithm expectations
- Cognito User Pool IDs and Client IDs
- Auth0 domain and client_id
- Firebase config object (apiKey, authDomain, projectId)
- Token storage mechanism (localStorage, sessionStorage, cookies)
- Refresh token handling logic
- Role/permission checks (isAdmin, hasRole, canAccess)
```

---

## Phase 2: JWT Testing

### 2a. Token Analysis
```
For every JWT encountered:
1. Decode (base64) — header, payload, signature
   echo "<token>" | cut -d. -f1 | base64 -d 2>/dev/null
   echo "<token>" | cut -d. -f2 | base64 -d 2>/dev/null

2. Document:
   - Algorithm (alg): RS256, HS256, ES256, PS256, none
   - Key ID (kid): reference for key lookup
   - Claims: sub, iss, aud, exp, iat, scope, role, permissions
   - Custom claims: any app-specific claims (user_id, org_id, tier)
```

### 2b. Algorithm Attacks
```
1. none algorithm:
   - Set header {"alg":"none","typ":"JWT"}
   - Remove signature (trailing dot only)
   - Send: <header>.<payload>.

2. RS256 → HS256 confusion:
   - Change alg to HS256
   - Sign with the PUBLIC key as the HMAC secret
   - If server uses same key for verify → accepts the forged token

3. jwk header injection:
   - Add {"jwk": <your_public_key>} to header
   - Sign with your private key
   - If server trusts the embedded jwk → full token forgery

4. jku header injection:
   - Point jku to your server hosting a JWK Set
   - Sign with your private key matching the hosted JWK

5. kid injection:
   - kid: "../../dev/null" → empty key = easy to forge
   - kid: with SQL injection → extract signing key
   - kid: path traversal to known file → use file content as key
```

### 2c. Claim Manipulation
```
1. Expiration bypass:
   - Remove exp claim entirely
   - Set exp to far future
   - Send expired token — is it actually rejected?

2. Role/permission escalation:
   - Change role: "user" → "admin"
   - Change scope: "read" → "read write admin"
   - Add permissions claim if it doesn't exist

3. Subject/audience confusion:
   - Change sub to another user's ID
   - Change aud to a different service
   - Use token from service A against service B

4. Issuer confusion:
   - Change iss to your server
   - Test if iss is validated at all
```

### 2d. Token Lifecycle
```
1. Refresh token rotation:
   - Use refresh token → get new access + refresh
   - Try old refresh token again → should be rejected
   - If accepted = refresh token replay (HIGH)

2. Token revocation:
   - Logout → try old access token → should fail
   - Password change → try old access token → should fail
   - If tokens survive logout/password change = persistent session (MED-HIGH)

3. Concurrent sessions:
   - Login from two locations → does one invalidate the other?
   - Forced logout → does it affect all sessions?
```

---

## Phase 3: OAuth 2.0 / OIDC Testing

### 3a. Authorization Flow
```
1. redirect_uri manipulation:
   - Exact match: https://app.target.com/callback
   - Subdirectory: https://app.target.com/callback/../attacker
   - Subdomain: https://attacker.target.com/callback
   - Open redirect on target: https://app.target.com/redirect?url=https://attacker.com
   - URL encoding tricks: https://app.target.com%40attacker.com/callback
   - Fragment/path confusion: https://app.target.com/callback#@attacker.com

2. State parameter:
   - Remove state parameter entirely → CSRF on OAuth
   - Reuse state from different session
   - Check if state is bound to session

3. PKCE bypass:
   - Remove code_verifier from token exchange
   - Use code_challenge_method=plain with known verifier
   - If PKCE is optional → downgrade to implicit flow

4. Scope escalation:
   - Request additional scopes: openid profile email admin
   - Check if unrequested scopes are granted
   - Token exchange with elevated scope parameter
```

### 3b. Token Theft Vectors
```
1. Token in URL fragment:
   - Implicit flow tokens in URL → Referer leakage
   - Check if token appears in server logs

2. Token in URL parameter:
   - Authorization code in URL → browser history, proxy logs

3. Postmessage leakage:
   - OAuth popup → parent window postMessage
   - Check targetOrigin validation in postMessage

4. Open redirect chain:
   - Find open redirect on target domain
   - Craft OAuth URL: /authorize?redirect_uri=https://target.com/redirect?url=https://attacker.com
   - Token/code redirected to attacker
```

### 3c. Provider-Specific Testing

#### AWS Cognito
```
1. User pool enumeration:
   - ListUsers (if admin scope available)
   - SignUp to test self-registration
   - ForgotPassword to enumerate valid users

2. Attribute abuse:
   - UpdateUserAttributes to change email without verification
   - custom:role attribute writable by user?
   - email_verified manually set to true?

3. Client configuration:
   - Is the pool ID + client ID enough to interact? (from JS)
   - ALLOW_USER_SRP_AUTH vs ALLOW_USER_PASSWORD_AUTH
   - Is MFA enforced or optional?
```

#### Auth0
```
1. Management API exposure:
   - /api/v2/ endpoints accessible?
   - /.well-known/openid-configuration for discovery

2. Universal Login customization:
   - XSS in login page parameters
   - Redirect manipulation in login flow
```

#### Firebase Auth
```
1. Anonymous auth enabled?
2. Email enumeration via signInWithEmailAndPassword
3. Custom token generation if admin SDK key exposed
4. Auth rules permissive (Firestore/RTDB)
```

---

## Phase 4: SAML Testing (If Applicable)

```
1. Signature wrapping:
   - Move signed assertion, add unsigned malicious assertion
   - Duplicate assertion with different subject

2. Assertion replay:
   - Capture valid SAMLResponse
   - Replay after session expires

3. XXE in SAML:
   - XML external entity injection in SAMLResponse XML

4. Recipient/Destination manipulation:
   - Change Recipient URL in assertion
   - Change Destination in AuthnRequest
```

---

## Phase 5: Output

### Artifacts to Save
```
bug_bounty/<program>_bug_bounty/recon/auth/
├── auth_flows.md           → Discovered auth mechanisms and configurations
├── jwt_analysis.md         → Token structure, algorithm, claims, test results
├── oauth_config.md         → OAuth endpoints, client IDs, redirect URIs
├── provider_config.md      → Cognito/Auth0/Firebase specific findings
├── auth_testing_summary.md → Executive summary with findings
```

### Update Engagement State
1. Add findings to findings_log.md
2. Add gadgets: auth bypass feeds into IDOR, token theft feeds into ATO chains
3. Update tested.json with auth mechanisms tested
4. If token forgery, OAuth bypass, or provider misconfiguration → h1-report immediately

### Common Chains
- Open redirect + OAuth redirect_uri = token theft → ATO (CRITICAL)
- JWT none algorithm + admin claim = full privilege escalation (CRITICAL)
- Cognito self-signup + unverified attributes = account creation bypass (HIGH)
- Expired tokens accepted + no revocation = persistent access after logout (HIGH)
- SAML replay + no audience validation = cross-service ATO (CRITICAL)

## Delegation
- Full auth assessment → `webapp-tester` (opus) with this skill
- Quick JWT decode/check → `webapp-tester-low` (sonnet)
- Cognito/Firebase deep dive → `exploit-developer` (opus)
- Custom token forging script → `exploit-developer` (opus)


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
