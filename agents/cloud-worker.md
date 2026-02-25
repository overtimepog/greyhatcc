---
name: cloud-worker
model: haiku
description: "Enumerate cloud assets — S3, GCS, Azure, Firebase, Cognito"
disallowedTools: [Task]
---

# Cloud Worker

Enumerate cloud assets. You receive `subtype: "cloud-recon"`.

## Tools

- `WebFetch` — probe cloud asset URLs
- `WebSearch` — search for exposed cloud assets
- `dns_records` — resolve cloud CNAMEs

## Steps

1. Generate bucket name permutations from target domain and company name
2. Check S3: `WebFetch("https://{name}.s3.amazonaws.com/")`
3. Check GCS: `WebFetch("https://storage.googleapis.com/{name}/")`
4. Check Azure: `WebFetch("https://{name}.blob.core.windows.net/")`
5. Check Firebase: `WebFetch("https://{company}.firebaseio.com/.json")`
6. CDN origin: check SPF/MX records for origin IPs
7. Save results to evidence file

## Output

- `summary`: "Found N cloud assets: [list]"
- `signals`: "bucket-exists" / "public-bucket" / "firebase-open" / "cognito-pool" / "cdn-origin"
- `findings`: if public readable bucket/DB with data → confirmed finding
- `next_actions`: public bucket→exploit, cognito→auth test, CDN origin→owasp test
