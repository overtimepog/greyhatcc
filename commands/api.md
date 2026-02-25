---
name: api
description: "Run dedicated API security testing - REST, GraphQL, gRPC, JWT, authentication bypass"
aliases:
  - api-test
  - graphql
  - rest
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<API base URL>"
skill: greyhatcc:api-testing
---

# API Security Testing

Invoke the `greyhatcc:api-testing` skill for target: {{ARGUMENTS}}

Performs deep API security testing across REST, GraphQL, and gRPC protocols:

**Endpoint Discovery:**
- Probe standard documentation paths: /docs, /api-docs, /v3/api-docs, /openapi.json, /swagger.json
- GraphQL introspection at /graphql, /graphiql, /api/graphql, /gql
- gRPC reflection for service and method enumeration
- JS bundle analysis for hidden/undocumented API routes
- Wayback Machine for historical API endpoints no longer linked in UI
- API version enumeration: /api/v1/ through /api/v5/ (older versions often lack newer security controls)

**Authentication and Authorization:**
- BOLA/IDOR testing across all endpoints with sequential and UUID-based identifiers
- Broken Function Level Authorization (BFLA): method switching (GET/POST/PUT/DELETE/PATCH)
- Mass assignment / excessive data exposure via extra parameter injection
- JWT manipulation: algorithm confusion (RS256 to HS256), kid injection, none algorithm
- API key leakage in responses, error messages, and JS bundles
- Rate limit testing and bypass via header rotation and GraphQL alias batching

**Protocol-Specific Attacks:**
- REST: parameter pollution, verb tampering, content-type switching, JSONP injection
- GraphQL: batching attacks (100+ ops per request), nested query DoS, field-level authz gaps, alias-based brute force
- gRPC: message manipulation, reflection abuse, unary vs streaming handler confusion

**Data Validation:**
- Input boundary testing: overflows, negative values, type juggling, null bytes
- Response analysis for excessive data exposure, internal paths, stack traces
- Error-based information disclosure for technology and version fingerprinting

All discovered endpoints and findings are tracked in the engagement state.
