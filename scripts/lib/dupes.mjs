/**
 * Common duplicate/rejected finding patterns across bug bounty programs.
 * These are findings that are ALMOST ALWAYS rejected as N/A, Informational,
 * or Duplicate. The system auto-flags these before report writing.
 *
 * Confidence levels:
 * - ALWAYS_REJECTED: 95%+ rejection rate. Don't submit unless chained.
 * - USUALLY_REJECTED: 70-95% rejection rate. Need strong PoC + impact.
 * - SOMETIMES_REJECTED: 40-70% rejection rate. Program-dependent.
 * - CONTEXT_DEPENDENT: Depends entirely on proof and program rules.
 */

export const COMMON_DUPES = [
  // --- ALWAYS REJECTED (95%+) ---
  {
    id: 'DUPE-001',
    pattern: /missing.*(?:hsts|strict-transport-security)/i,
    title: 'Missing HSTS header',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Almost universally excluded. Only submit if you can demonstrate a real MITM downgrade attack with session hijacking PoC.',
    chainWith: 'HTTP downgrade + session hijack + cookie theft',
  },
  {
    id: 'DUPE-002',
    pattern: /missing.*(?:x-frame-options|clickjack)/i,
    title: 'Missing X-Frame-Options / Clickjacking',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Excluded by virtually all programs. Only submit if you have a working clickjacking PoC that performs a sensitive action (password change, fund transfer).',
    chainWith: 'Clickjack + sensitive action (CSRF-like impact)',
  },
  {
    id: 'DUPE-003',
    pattern: /missing.*(?:csp|content-security-policy)/i,
    title: 'Missing/weak CSP header',
    confidence: 'ALWAYS_REJECTED',
    advice: 'CSP absence alone is never accepted. Only matters if you have XSS and CSP would be the only mitigation.',
    chainWith: 'XSS + CSP bypass = full exploitation',
  },
  {
    id: 'DUPE-004',
    pattern: /missing.*(?:spf|dkim|dmarc|email.*auth)/i,
    title: 'Missing email security (SPF/DKIM/DMARC)',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Email misconfiguration is excluded by 99% of programs. Not a web vulnerability.',
    chainWith: null,
  },
  {
    id: 'DUPE-005',
    pattern: /(?:cookie|session).*(?:httponly|secure|samesite).*(?:flag|missing|absent)/i,
    title: 'Missing cookie security flags',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Cookie flag findings are universally excluded. Only relevant if you have XSS + can demonstrate session theft specifically because of missing HttpOnly.',
    chainWith: 'XSS + missing HttpOnly = session theft',
  },
  {
    id: 'DUPE-006',
    pattern: /robots\.txt|sitemap\.xml.*(?:disclosure|exposed)/i,
    title: 'robots.txt / sitemap.xml disclosure',
    confidence: 'ALWAYS_REJECTED',
    advice: 'These are public by design. Never submit.',
    chainWith: null,
  },
  {
    id: 'DUPE-007',
    pattern: /(?:ssl|tls).*(?:weak|cipher|protocol|beast|poodle|sweet32)/i,
    title: 'Weak SSL/TLS configuration',
    confidence: 'ALWAYS_REJECTED',
    advice: 'TLS configuration findings are excluded by most programs. Only submit if you can demonstrate actual decryption or downgrade attack.',
    chainWith: null,
  },
  {
    id: 'DUPE-008',
    pattern: /(?:banner|version).*(?:grab|disclosure|detect)/i,
    title: 'Server version/banner disclosure',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Information disclosure of server versions is never bounty-worthy alone. Use as recon intel, not a report.',
    chainWith: 'Version + known CVE with working exploit = real finding',
  },
  {
    id: 'DUPE-009',
    pattern: /(?:self[- ]?xss)/i,
    title: 'Self-XSS',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Self-XSS requires the victim to paste payload in their own browser. Only submit if chained with CSRF to force execution.',
    chainWith: 'Self-XSS + CSRF = forced XSS (login CSRF variant)',
  },
  {
    id: 'DUPE-010',
    pattern: /(?:root|jailbreak).*detect|ssl.*(?:pin|cert).*bypass/i,
    title: 'Root/jailbreak detection or SSL pinning bypass',
    confidence: 'ALWAYS_REJECTED',
    advice: 'Mobile hardening bypass is excluded by virtually all programs. The vuln must be what you find AFTER bypass.',
    chainWith: null,
  },

  // --- USUALLY REJECTED (70-95%) ---
  {
    id: 'DUPE-011',
    pattern: /open.*redirect(?!.*oauth|.*token|.*ssrf)/i,
    title: 'Open redirect (without chain)',
    confidence: 'USUALLY_REJECTED',
    advice: 'Open redirect alone is Low/Informational. Chain with OAuth token theft, phishing, or SSRF to make it impactful.',
    chainWith: 'Open redirect + OAuth flow = token theft to attacker server',
  },
  {
    id: 'DUPE-012',
    pattern: /cors.*(?:misconfigur|wildcard|null)(?!.*exfil|.*data|.*read|.*steal)/i,
    title: 'CORS misconfiguration (without data exfiltration proof)',
    confidence: 'USUALLY_REJECTED',
    advice: 'CORS findings without a working PoC page that demonstrates actual data exfiltration are always rejected. Build the PoC HTML page.',
    chainWith: 'CORS + authenticated endpoint = cross-origin data theft',
  },
  {
    id: 'DUPE-013',
    pattern: /(?:user|email|account).*(?:enum|harvest|discover)(?!.*admin|.*bulk|.*api)/i,
    title: 'User enumeration',
    confidence: 'USUALLY_REJECTED',
    advice: 'User enumeration is excluded by most programs ("by design"). Only submit if it enables bulk enumeration of ALL users or targets admin accounts.',
    chainWith: 'User enum + credential stuffing + rate limit bypass = ATO',
  },
  {
    id: 'DUPE-014',
    pattern: /(?:content|html).*inject(?!.*stored|.*admin|.*xss)/i,
    title: 'Content/HTML injection (without XSS)',
    confidence: 'USUALLY_REJECTED',
    advice: 'HTML injection without script execution is almost always Informational. Escalate to stored XSS or phishing impact.',
    chainWith: 'HTML injection + form spoofing = credential phishing',
  },
  {
    id: 'DUPE-015',
    pattern: /(?:csrf|cross-site.*request).*(?:login|logout|lang|theme|newsletter)/i,
    title: 'CSRF on non-sensitive action',
    confidence: 'USUALLY_REJECTED',
    advice: 'CSRF on login/logout/preferences is excluded. CSRF must target a sensitive state-changing action (password change, email change, fund transfer).',
    chainWith: 'Login CSRF + self-XSS = force victim into attacker account + XSS fires',
  },
  {
    id: 'DUPE-016',
    pattern: /(?:rate.*limit|brute.*force)(?!.*otp|.*2fa|.*payment|.*financial)/i,
    title: 'Missing rate limiting (generic)',
    confidence: 'USUALLY_REJECTED',
    advice: 'Rate limiting absence is excluded unless it enables OTP bypass, account takeover, or financial damage. Demonstrate the specific attack.',
    chainWith: 'No rate limit + OTP endpoint = OTP brute force = ATO',
  },
  {
    id: 'DUPE-017',
    pattern: /(?:stack.*trace|verbose.*error|debug.*mode|error.*message)/i,
    title: 'Verbose error messages / stack traces',
    confidence: 'USUALLY_REJECTED',
    advice: 'Stack traces are informational unless they leak secrets, internal IPs, or database structure exploitable for SQLi.',
    chainWith: 'Stack trace + internal path disclosure + LFI/SSRF = chain',
  },
  {
    id: 'DUPE-018',
    pattern: /(?:vulnerable|outdated).*(?:librar|dependenc|component|jquery|bootstrap)/i,
    title: 'Outdated library/dependency',
    confidence: 'USUALLY_REJECTED',
    advice: 'Vulnerable library reports without a WORKING PoC exploit against the specific target are always rejected. Prove exploitability.',
    chainWith: 'Outdated lib + working CVE exploit against target = real finding',
  },

  // --- SOMETIMES REJECTED (40-70%) ---
  {
    id: 'DUPE-019',
    pattern: /(?:host.*header|x-forwarded|injection.*host)/i,
    title: 'Host header injection',
    confidence: 'SOMETIMES_REJECTED',
    advice: 'Host header injection needs demonstrated impact: cache poisoning, password reset link manipulation, or SSRF. A simple reflection is not enough.',
    chainWith: 'Host header + password reset = reset link points to attacker domain',
  },
  {
    id: 'DUPE-020',
    pattern: /(?:subdomain.*takeover|dangling.*(?:dns|cname))/i,
    title: 'Subdomain takeover',
    confidence: 'SOMETIMES_REJECTED',
    advice: 'Subdomain takeover is often accepted but must prove actual claim capability. A dangling CNAME alone is not enough — you need to demonstrate the takeover or prove the service allows claiming.',
    chainWith: 'Subdomain takeover + CORS trust + cookie scope = session hijack',
  },
  {
    id: 'DUPE-021',
    pattern: /(?:graphql|introspection).*(?:enabled|exposed|schema)/i,
    title: 'GraphQL introspection enabled',
    confidence: 'SOMETIMES_REJECTED',
    advice: 'GraphQL introspection alone is often Informational. Demonstrate what sensitive data/mutations the schema exposes. Enumerate actual unauthorized access.',
    chainWith: 'Introspection + unauthorized mutation access = real finding',
  },
  {
    id: 'DUPE-022',
    pattern: /(?:actuator|health.*check|status.*endpoint).*(?:exposed|public)/i,
    title: 'Exposed actuator/health endpoint',
    confidence: 'SOMETIMES_REJECTED',
    advice: '/health and /info are often intentionally public. Focus on /env, /heapdump, /mappings, /configprops — endpoints that leak secrets or internal config.',
    chainWith: 'Actuator /env + leaked DB credentials = database access',
  },

  // --- CONTEXT DEPENDENT ---
  {
    id: 'DUPE-023',
    pattern: /(?:idor|insecure.*direct.*object)/i,
    title: 'IDOR',
    confidence: 'CONTEXT_DEPENDENT',
    advice: 'IDOR quality depends entirely on what data is accessed. Reading your own data with a different ID format = N/A. Reading OTHER users\' PII = Critical. Prove cross-user access.',
    chainWith: 'IDOR + PII endpoint + enumerable IDs = mass data breach',
  },
  {
    id: 'DUPE-024',
    pattern: /(?:ssrf|server.*side.*request)/i,
    title: 'SSRF',
    confidence: 'CONTEXT_DEPENDENT',
    advice: 'Blind SSRF with DNS-only callback = Low. SSRF to cloud metadata (169.254.169.254) with IAM cred extraction = Critical. Demonstrate the deepest impact.',
    chainWith: 'SSRF + cloud metadata + IAM creds = full cloud compromise',
  },
];

/**
 * Check a finding description against common dupe patterns.
 * Returns array of matches with confidence and advice.
 */
export function checkCommonDupes(description) {
  const matches = [];
  for (const dupe of COMMON_DUPES) {
    if (dupe.pattern.test(description)) {
      matches.push({
        id: dupe.id,
        title: dupe.title,
        confidence: dupe.confidence,
        advice: dupe.advice,
        chainWith: dupe.chainWith,
      });
    }
  }
  return matches;
}

/**
 * Get rejection risk level for a finding.
 * Returns: 'BLOCK' | 'WARN' | 'CAUTION' | 'CLEAR'
 */
export function getRejectionRisk(description) {
  const matches = checkCommonDupes(description);
  if (matches.length === 0) return { risk: 'CLEAR', matches: [] };

  const hasAlways = matches.some(m => m.confidence === 'ALWAYS_REJECTED');
  const hasUsually = matches.some(m => m.confidence === 'USUALLY_REJECTED');

  if (hasAlways) return { risk: 'BLOCK', matches };
  if (hasUsually) return { risk: 'WARN', matches };
  return { risk: 'CAUTION', matches };
}
