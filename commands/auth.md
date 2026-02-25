---
name: auth
description: "Test OAuth, JWT, OIDC, SAML, and authentication flows for token manipulation and bypass"
aliases:
  - jwt
  - oauth
  - token
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<auth endpoint or domain>"
skill: greyhatcc:oauth-jwt-testing
---

# Authentication Flow Testing

Invoke the `greyhatcc:oauth-jwt-testing` skill for target: {{ARGUMENTS}}

Comprehensive authentication and session management testing:

**OAuth 2.0 / OIDC:**
- Authorization code flow: redirect_uri manipulation, state parameter absence/predictability
- Token theft via open redirect chaining with OAuth callback
- PKCE bypass: missing code_challenge enforcement, downgrade to plain
- Scope escalation: request elevated scopes, test scope enforcement on resource server
- Client credential leakage: client_secret in JS bundles, mobile apps, or error messages
- Token exchange confusion: mix tokens between providers or tenants

**JWT Attacks:**
- Algorithm confusion: RS256 to HS256 (sign with public key as HMAC secret)
- kid injection: path traversal (../../dev/null), SQL injection in kid parameter
- JKU/X5U header manipulation: point to attacker-controlled key server
- none algorithm: strip signature entirely
- Token expiration bypass: modify exp claim, test expired token acceptance
- Claim tampering: elevate role, change sub, modify tenant_id

**SAML:**
- XML signature wrapping: move signed assertion, inject unsigned malicious assertion
- Assertion replay: reuse valid assertions after logout or expiration
- SSO bypass: manipulate SAML response to authenticate as arbitrary user
- XXE in SAML XML parser for SSRF or file read

**Identity Provider Specific:**
- AWS Cognito: user pool enumeration, attribute manipulation, unverified email/phone
- Auth0: management API exposure, rule bypass, universal login misconfiguration
- Firebase Auth: admin SDK exposure, custom token generation, email enumeration

**MFA Bypass:**
- Response manipulation: change status codes or JSON values to skip MFA
- Backup code brute force and reuse testing
- MFA enrollment race condition: authenticate before MFA is fully configured
- Session persistence: check if MFA validation persists across session boundaries

**Session Management:**
- Session fixation and session prediction
- Concurrent session limits and session invalidation on password change
- Cookie security: Secure, HttpOnly, SameSite flags, domain scoping
- Credential stuffing with org-specific email patterns from breach intelligence
