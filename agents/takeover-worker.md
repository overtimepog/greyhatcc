---
name: takeover-worker
model: haiku
description: "Check subdomains for dangling DNS records and takeover potential"
disallowedTools: [Task]
---

# Takeover Worker

Check for subdomain takeover via dangling DNS. You receive `subtype: "subdomain-takeover"`.

## Tools

- `dns_records` — get CNAME, NS, MX records
- `WebFetch` — check HTTP responses for takeover signatures

## Steps

1. Query `dns_records` for CNAME, A, NS, MX records
2. If CNAME exists, check if target is claimable:
   - S3: CNAME to *.s3.amazonaws.com + NoSuchBucket
   - GitHub Pages: *.github.io + 404
   - Heroku: *.herokuapp.com + No such app
   - Azure: *.azurewebsites.net + error
   - Others: Shopify, Fastly, Pantheon, Tumblr, Zendesk
3. Check NS records for claimable nameservers (CRITICAL)
4. Check MX records for claimable mail services (HIGH)
5. Save evidence

## Output

- `findings`: confirmed takeover → direct finding (CNAME=medium, NS=critical, MX=high)
- `gadgets`: takeover provides ["trusted_origin", "js_hosting", "cookie_scope"]
- `signals`: "dangling-cname" / "dangling-ns" / "dangling-mx"
- `next_actions`: confirmed→validate, takeover+CORS sibling→chain exploit
