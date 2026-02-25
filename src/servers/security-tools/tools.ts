export const SECURITY_TOOLS = [
  {
    name: 'cve_search',
    description: 'Search NVD for CVEs by keyword, product name, or vulnerability type',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (product name, vulnerability type, etc.)' },
        year: { type: 'number', description: 'Filter by CVE year (e.g. 2024)' },
        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Filter by CVSS severity' },
      },
      required: ['query'],
    },
  },
  {
    name: 'cve_detail',
    description: 'Get full details for a specific CVE ID including CVSS, description, references, and affected products',
    inputSchema: {
      type: 'object' as const,
      properties: {
        cve_id: { type: 'string', description: 'CVE identifier (e.g. CVE-2024-1234)' },
      },
      required: ['cve_id'],
    },
  },
  {
    name: 'exploit_db_search',
    description: 'Search Exploit-DB for public exploits and PoC code',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for exploits' },
        type: { type: 'string', enum: ['webapps', 'local', 'remote', 'dos'], description: 'Exploit type filter' },
      },
      required: ['query'],
    },
  },
  {
    name: 'cvss_calculate',
    description: 'Calculate CVSS v3.1 score from a vector string',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vector: { type: 'string', description: 'CVSS v3.1 vector string (e.g. CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)' },
      },
      required: ['vector'],
    },
  },
  {
    name: 'whois_lookup',
    description: 'WHOIS information for a domain or IP address',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'Domain name or IP address to look up' },
      },
      required: ['target'],
    },
  },
  {
    name: 'dns_records',
    description: 'Comprehensive DNS record lookup for a domain (A, AAAA, MX, TXT, NS, CNAME, SOA)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string', description: 'Domain name to query' },
        types: { type: 'string', description: 'Comma-separated record types (default: A,AAAA,MX,TXT,NS,CNAME,SOA)' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'header_analysis',
    description: 'Analyze HTTP security headers with severity-weighted scoring, info leak detection, and cookie flag analysis',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Target URL to analyze headers for' },
      },
      required: ['url'],
    },
  },
  {
    name: 'ssl_analysis',
    description: 'Analyze SSL/TLS configuration including protocol versions, cipher suites, certificate details, and weak crypto detection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hostname: { type: 'string', description: 'Hostname to analyze SSL/TLS for' },
        port: { type: 'number', description: 'Port number (default: 443)' },
      },
      required: ['hostname'],
    },
  },
  {
    name: 'waf_detect',
    description: 'Detect WAF/CDN protecting a target via header analysis, server fingerprinting, and block page pattern matching (18+ WAFs)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Target URL to check for WAF/CDN' },
      },
      required: ['url'],
    },
  },
  // ── New tools ────────────────────────────────────────────────────
  {
    name: 'cors_check',
    description: 'Check CORS configuration for misconfigurations: wildcard, null origin trust, subdomain reflection, credential leaks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Target URL to check CORS for' },
        origins: { type: 'string', description: 'Comma-separated custom origins to test (e.g. "https://evil.com,null,https://sub.target.com")' },
      },
      required: ['url'],
    },
  },
  {
    name: 'tech_fingerprint',
    description: 'Detect technologies, frameworks, CMS, analytics, and cloud services from HTTP headers, cookies, and HTML body patterns',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Target URL to fingerprint' },
      },
      required: ['url'],
    },
  },
  {
    name: 'subdomain_enum',
    description: 'Enumerate subdomains via Certificate Transparency logs (crt.sh) with deduplication and expiry filtering',
    inputSchema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string', description: 'Root domain to enumerate (e.g. example.com)' },
        include_expired: { type: 'boolean', description: 'Include expired certificates (default: false)' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'port_check',
    description: 'Quick TCP port connectivity check with banner grabbing. Scans in parallel batches.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        host: { type: 'string', description: 'Target hostname or IP address' },
        ports: { type: 'string', description: 'Comma-separated ports (e.g. "80,443,8080") or omit for top 27 common ports' },
        timeout: { type: 'number', description: 'Connection timeout in ms per port (default: 3000)' },
      },
      required: ['host'],
    },
  },
  {
    name: 'redirect_chain',
    description: 'Follow and analyze the full HTTP redirect chain. Detects HTTPS downgrades and cross-domain redirects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Starting URL to follow redirects from' },
        max_redirects: { type: 'number', description: 'Maximum redirects to follow (default: 10)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'h1_program_fetch',
    description: 'Fetch HackerOne bug bounty program details via REST API. Returns structured scope, bounty ranges, policy, and program metadata. Requires H1_API_TOKEN env var or hackerone.apiToken in config.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string', description: 'HackerOne program handle (e.g. "meesho_bbp", "shopify")' },
        include_scopes: { type: 'boolean', description: 'Include structured scopes in response (default: true)' },
      },
      required: ['handle'],
    },
  },
];
