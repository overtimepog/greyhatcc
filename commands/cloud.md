---
name: cloud
description: "Hunt for cloud infrastructure misconfigurations - S3 buckets, Firebase, Cognito, CDN origins"
aliases:
  - s3
  - bucket
  - firebase
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<domain or org name>"
skill: greyhatcc:cloud-misconfig
---

# Cloud Misconfiguration Hunting

Invoke the `greyhatcc:cloud-misconfig` skill for target: {{ARGUMENTS}}

Systematic cloud infrastructure assessment across all major providers:

**AWS:**
- S3 bucket discovery via DNS brute force, JS bundle extraction, and CNAME analysis
- S3 permission testing: ListBucket, GetObject, PutObject, ACL enumeration
- S3 bucket takeover detection for abandoned buckets still referenced by the target
- CloudFront misconfiguration: origin access, cache behavior, custom error pages
- Cognito user pool enumeration: self-signup, attribute manipulation, unverified claims
- EC2 metadata SSRF: IMDSv1 (169.254.169.254) and IMDSv2 token bypass attempts
- Lambda function URL discovery and unauthenticated invocation testing
- Elastic Beanstalk environment takeover via unclaimed CNAME

**Google Cloud:**
- GCS bucket discovery and permission testing (allUsers, allAuthenticatedUsers)
- Firebase Realtime Database: open read/write rules (/.json endpoint)
- Firebase Storage: bucket permission enumeration
- Firestore: collection listing and document access without authentication
- Google API key restriction testing: unrestricted keys used in JS bundles

**Azure:**
- Blob storage container enumeration and anonymous access testing
- Azure App Service: deployment slot exposure, Kudu console access
- Azure AD: tenant enumeration, user discovery, OAuth misconfiguration

**General Cloud Attacks:**
- Serverless function discovery and unauthenticated invocation
- CDN origin IP discovery behind WAF/CDN via certificate matching and DNS history
- Cloud metadata SSRF exploitation for IAM credential theft
- Supply chain via abandoned cloud resources still trusted by the application
- Terraform/CloudFormation state file exposure for infrastructure secrets
