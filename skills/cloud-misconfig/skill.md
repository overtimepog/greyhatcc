---
name: cloud-misconfig
description: Cloud infrastructure misconfiguration hunting - S3/GCS/Azure bucket takeover, cloud metadata SSRF, IAM policy analysis, serverless exposure, and CDN origin discovery
---

# Cloud Misconfiguration Hunting

## Usage
`/greyhatcc:cloud <domain or program_name>`

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (cloud recon section, SSRF chains)
2. Load program guidelines: scope.md → assets, exclusions, rules, bounty table
3. Load engagement: findings_log.md, gadgets.json, tested.json
4. Load recon artifacts: subdomains, JS analysis (bucket names from CSP/JS), tech stack
5. Load memory: Check for target-specific cloud notes from previous sessions

---

## Phase 1: Cloud Asset Discovery

### From Recon Artifacts (Already Collected)
Pull cloud references from existing recon data:
```
Sources to mine:
- JS bundles (js-analysis skill output) → S3 URLs, Firebase refs, Cognito pools
- CSP headers → S3 bucket names, CloudFront distributions, GCS buckets
- DNS records → CNAME to cloud services, ELB hostnames
- Subdomains → *.s3.amazonaws.com, *.blob.core.windows.net patterns
- HTTP responses → X-Amz-*, X-GCloud-*, Azure headers
- Error pages → Cloud provider error signatures
- Source maps → Infrastructure URLs in original source
```

### Active Cloud Enumeration

#### S3 Bucket Discovery
```bash
# Check bucket names derived from: domain, org name, common patterns
# Pattern: <domain>, <domain>-assets, <domain>-backup, <domain>-dev, <domain>-staging,
#          <domain>-uploads, <domain>-media, <domain>-static, <domain>-logs,
#          <org>-<service>, <org>-production, <org>-internal

# Check bucket existence and permissions
aws s3 ls s3://<bucket-name> --no-sign-request 2>&1
# 200 = public listing (HIGH finding)
# AccessDenied = exists but private (note for later)
# NoSuchBucket = doesn't exist (potential takeover if referenced)

# Check for public write
echo "test" | aws s3 cp - s3://<bucket-name>/pentest_write_test.txt --no-sign-request 2>&1
# If succeeds = CRITICAL finding (public write)
# IMMEDIATELY delete: aws s3 rm s3://<bucket-name>/pentest_write_test.txt --no-sign-request
```

#### Azure Blob Discovery
```bash
# Check blob containers
curl -sk "https://<storage-account>.blob.core.windows.net/<container>?restype=container&comp=list"
# 200 with XML = public listing
```

#### GCS Discovery
```bash
# Check GCS buckets
curl -sk "https://storage.googleapis.com/<bucket-name>"
# 200 = public listing
```

#### Firebase Discovery
```bash
# Check Firebase Realtime Database
curl -sk "https://<project-id>.firebaseio.com/.json"
# 200 with data = public read (HIGH/CRITICAL)

# Check Firestore
curl -sk "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents"

# Check Firebase Storage
curl -sk "https://firebasestorage.googleapis.com/v0/b/<project-id>.appspot.com/o"
# 200 with items = public listing

# Check Firebase Storage write (upload a test file)
curl -sk -X POST \
  "https://firebasestorage.googleapis.com/v0/b/<project-id>.appspot.com/o?name=pentest_write_test.txt" \
  -H "Content-Type: text/plain" \
  -d "pentest write test - overtimedev"
# 200 = CRITICAL: public write to Firebase Storage
```

#### Cognito Pool Enumeration
```bash
# If pool ID is known (from JS analysis):
aws cognito-idp describe-user-pool-client \
  --user-pool-id <pool-id> \
  --client-id <client-id> \
  --region <region> 2>&1

# Check self-signup
aws cognito-idp sign-up \
  --client-id <client-id> \
  --username test@test.com \
  --password TestPass123! \
  --region <region> 2>&1
# If no CAPTCHA/verification = hCaptcha bypass (finding)
```

### CDN Origin Discovery
```bash
# Shodan SSL cert search for origin IPs behind CDN
# Use MCP: shodan_ssl_cert with target domain

# Historical DNS for pre-CDN IPs
# Use MCP: dns_records + WebSearch for SecurityTrails/ViewDNS

# SPF record leakage (mail servers often on origin)
dig +short TXT <domain> | grep spf

# Check if apex vs www have different CDN behavior
dig +short <domain>
dig +short www.<domain>
```

---

## Phase 2: Cloud Metadata / SSRF Chains

### If SSRF is Found
```
Cloud metadata endpoints to target:

AWS IMDSv1 (no headers needed):
  http://169.254.169.254/latest/meta-data/
  http://169.254.169.254/latest/meta-data/iam/security-credentials/
  http://169.254.169.254/latest/user-data

AWS IMDSv2 (needs PUT for token first):
  TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
  curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/

GCP:
  http://metadata.google.internal/computeMetadata/v1/ (needs Metadata-Flavor: Google header)
  http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token

Azure:
  http://169.254.169.254/metadata/instance?api-version=2021-02-01 (needs Metadata: true header)
  http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/

DigitalOcean:
  http://169.254.169.254/metadata/v1/

Kubernetes:
  https://kubernetes.default.svc/api/v1/
  /var/run/secrets/kubernetes.io/serviceaccount/token
```

### Internal Service Discovery via DNS
```
Check for internal hostnames in public DNS (found in recon):
- *.internal.<domain> → often resolves to RFC1918 IPs
- autoqueue.internal.*, worker.internal.*, etc.
- These are SSRF pivot targets if any SSRF exists
```

---

## Phase 3: Bucket Takeover Assessment

### S3 Bucket Takeover Conditions
```
A bucket is takeover-able when:
1. The target references it (in CSP, JS, DNS CNAME, etc.)
2. The bucket doesn't exist (NoSuchBucket) or was deleted
3. An attacker can create a bucket with the same name

Check: Is the bucket referenced in a security-sensitive context?
- CSP script-src → attacker serves malicious JS = XSS on the target (CRITICAL)
- Asset loading (images, CSS) → content injection (MEDIUM)
- CNAME to S3 → subdomain takeover (HIGH)
- Backup/data bucket → data exposure or supply chain (HIGH-CRITICAL)
```

### Dangling Cloud Resources
```
Check for:
- CNAME → *.s3.amazonaws.com that returns NoSuchBucket
- CNAME → *.herokuapp.com that returns "no such app"
- CNAME → *.azurewebsites.net that returns "not found"
- CNAME → *.cloudfront.net with no distribution
- CNAME → *.elasticbeanstalk.com that's unclaimed
- NS records pointing to decommissioned DNS providers
```

---

## Phase 4: Output

### Artifacts to Save
```
bug_bounty/<program>_bug_bounty/recon/cloud/
├── buckets.md              → All discovered buckets with access status
├── firebase.md             → Firebase project findings
├── cognito.md              → Cognito pool enumeration results
├── cdn_origins.md          → Origin IPs discovered behind CDN
├── cloud_metadata.md       → SSRF/metadata test results
├── takeover_candidates.md  → Dangling cloud resources for takeover
└── cloud_summary.md        → Executive summary with findings
```

### Update Engagement State
1. Add findings to findings_log.md via `/greyhatcc:findings`
2. Add to gadgets.json — bucket references feed into XSS chains, SSRF chains feed into IAM compromise
3. Update tested.json with cloud assets checked
4. If CRITICAL (public write, metadata credentials, bucket takeover in CSP) → generate h1-report immediately

### Common Chains
- CSP references non-existent S3 bucket → takeover → serve malicious JS → XSS on target (CRITICAL)
- Public Firebase write → inject data into app → business logic compromise
- Cognito self-signup without verification → enumerate users → password reset → ATO
- SSRF → cloud metadata → IAM credentials → full cloud account compromise
- Dangling CNAME → cloud service takeover → trusted origin → CORS bypass

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Delegation
- Full cloud audit → `recon-specialist-high` (opus) with this skill
- Quick bucket checks → `recon-specialist-low` (haiku)
- Shodan/cert searches → `recon-specialist` (sonnet)
- SSRF chain exploitation → `exploit-developer` (opus)

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
