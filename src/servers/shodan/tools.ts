export const SHODAN_TOOLS = [
  // ── Host Intelligence ──────────────────────────────────────────────
  {
    name: 'shodan_host_lookup',
    description:
      'Get all available information for a host IP: open ports, banners, services, vulnerabilities, organization, OS, geolocation, and SSL certs. FREE (no query credits). Use `minify: true` to cut response size, `summary: true` for a compact markdown table, or `fields` to select specific keys (e.g. "ip_str,ports,vulns,org,data.port,data.product").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ip: { type: 'string', description: 'Target IP address to look up' },
        history: { type: 'boolean', description: 'Include all historical banners (default: false). WARNING: can return very large responses.' },
        minify: { type: 'boolean', description: 'Only return ports, vulns, hostnames, tags, OS, org (default: false)' },
        fields: { type: 'string', description: 'Comma-separated dot-notation fields to extract, e.g. "ip_str,ports,vulns,org,data.port,data.product,data.ssl.cert.subject"' },
        summary: { type: 'boolean', description: 'Return a compact markdown summary table instead of raw JSON (default: false)' },
      },
      required: ['ip'],
    },
  },

  // ── Search ─────────────────────────────────────────────────────────
  {
    name: 'shodan_search',
    description: `Search Shodan for hosts matching a query. Costs 1 query credit per page.

SEARCH FILTERS (use in query string):
  General: port, org, asn, country, city, state, net, ip, hostname, os, product, version, cpe, device, geo, isp, has_vuln, has_ssl, has_screenshot, has_ipv6, scan
  HTTP: http.title, http.status, http.html, http.component, http.component_category, http.favicon.hash, http.waf, http.server_hash, http.headers_hash
  SSL: ssl.cert.subject.cn, ssl.cert.issuer.cn, ssl.cert.expired, ssl.cert.serial, ssl.cert.fingerprint, ssl.jarm, ssl.ja3s, ssl.version, ssl.cipher.name, ssl.alpn
  Cloud: cloud.provider, cloud.region, cloud.service
  SSH: ssh.hassh, ssh.type
  Screenshots: screenshot.label, screenshot.hash

FACETS (for statistical breakdowns): country, org, port, asn, domain, city, product, version, os, device, ssl.version, ssl.cert.issuer.cn, cloud.provider, http.component, http.title, vuln
  Format: "facet:count" e.g. "country:10,org:5,port:20"

Defaults to 5 results. Use limit to increase (max 100). Use summary:true for markdown tables. Use fields to select specific keys per result.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Shodan query with filters. Examples: "apache country:US port:443", "ssl.cert.subject.cn:example.com", "http.favicon.hash:116323821", "product:nginx vuln:CVE-2021-23017", "has_screenshot:true city:London"' },
        facets: { type: 'string', description: 'Comma-separated facets with optional count, e.g. "country:10,org:5,port:20"' },
        page: { type: 'number', description: 'Page number (default: 1). Each page past 1 costs 1 additional credit.' },
        limit: { type: 'number', description: 'Max results to return from this page, 1-100 (default: 5). Does NOT affect credit cost — just truncates response.' },
        fields: { type: 'string', description: 'Comma-separated fields per result, e.g. "ip_str,port,org,product,http.title,ssl.cert.subject.cn"' },
        minify: { type: 'boolean', description: 'Request minified results from API (default: false)' },
        summary: { type: 'boolean', description: 'Return markdown summary table instead of JSON (default: false)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'shodan_count',
    description:
      'Count results for a Shodan query WITHOUT consuming query credits (FREE). Returns total count and optional facet breakdowns. ALWAYS use this before shodan_search to preview result volume and save credits. Supports the same query filters and facets as shodan_search.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Shodan search query (same syntax as shodan_search)' },
        facets: { type: 'string', description: 'Comma-separated facets, e.g. "country:10,org:5,port:20,product:10"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'shodan_search_tokens',
    description:
      'Parse a Shodan search query into tokens (FREE). Shows how Shodan interprets your query — useful for debugging complex filter queries. Returns parsed filters, string tokens, and error messages.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Shodan search query to tokenize' },
      },
      required: ['query'],
    },
  },

  // ── InternetDB (Free, No Auth) ─────────────────────────────────────
  {
    name: 'shodan_internetdb',
    description:
      'Fast IP triage via InternetDB — FREE, no API key needed. Returns open ports, known CVEs, hostnames, CPEs, and tags for any IP. Updated weekly. Use this for quick recon before spending credits on full shodan_host_lookup. Great for bulk IP triage.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ip: { type: 'string', description: 'Target IP address (IPv4 only)' },
        summary: { type: 'boolean', description: 'Return compact markdown summary (default: false)' },
      },
      required: ['ip'],
    },
  },

  // ── DNS ────────────────────────────────────────────────────────────
  {
    name: 'shodan_dns_resolve',
    description: 'Resolve hostnames to IP addresses (FREE). Accepts up to 100 hostnames.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hostnames: { type: 'string', description: 'Comma-separated hostnames to resolve (max 100)' },
      },
      required: ['hostnames'],
    },
  },
  {
    name: 'shodan_dns_reverse',
    description: 'Reverse DNS lookup for IP addresses (FREE). Accepts up to 100 IPs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ips: { type: 'string', description: 'Comma-separated IPs for reverse DNS (max 100)' },
      },
      required: ['ips'],
    },
  },
  {
    name: 'shodan_dns_domain',
    description:
      'Enumerate subdomains and DNS records for a domain. Costs 1 query credit. Returns all discovered subdomains with their A, AAAA, CNAME, MX, NS, SOA, TXT records. Excellent for subdomain discovery and attack surface mapping.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string', description: 'Domain to enumerate (e.g. "example.com")' },
        history: { type: 'boolean', description: 'Include historical DNS data (default: false)' },
        type: { type: 'string', description: 'DNS record type filter: A, AAAA, CNAME, MX, NS, SOA, TXT' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        summary: { type: 'boolean', description: 'Return markdown summary (default: false)' },
      },
      required: ['domain'],
    },
  },

  // ── Exploits ───────────────────────────────────────────────────────
  {
    name: 'shodan_exploits_search',
    description:
      'Search for known exploits by CVE, product name, or keyword. Returns exploit DB entries, Metasploit modules, and Nuclei templates. Use facets for statistical breakdowns by type/platform/source.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query — CVE ID (e.g. "CVE-2021-44228"), product name (e.g. "Apache"), or keyword' },
        type: { type: 'string', enum: ['exploit', 'metasploit', 'nuclei'], description: 'Filter by exploit type' },
        facets: { type: 'string', description: 'Comma-separated facets (e.g. "type,platform,source")' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Max results to return (default: 10)' },
        summary: { type: 'boolean', description: 'Return markdown summary (default: false)' },
      },
      required: ['query'],
    },
  },

  // ── Convenience Host Tools ─────────────────────────────────────────
  {
    name: 'shodan_ports',
    description:
      'List open ports for an IP. Tries FREE InternetDB first; falls back to Shodan host lookup if InternetDB has no data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ip: { type: 'string', description: 'Target IP address' },
        summary: { type: 'boolean', description: 'Return markdown summary (default: false)' },
      },
      required: ['ip'],
    },
  },
  {
    name: 'shodan_vulns',
    description:
      'Get known CVEs for an IP. Tries FREE InternetDB first; falls back to Shodan host lookup if InternetDB has no data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ip: { type: 'string', description: 'Target IP address' },
        summary: { type: 'boolean', description: 'Return markdown summary (default: false)' },
      },
      required: ['ip'],
    },
  },

  // ── SSL/TLS ────────────────────────────────────────────────────────
  {
    name: 'shodan_ssl_cert',
    description:
      'Search for SSL certificates by hostname to discover related infrastructure, CDN origins, shadow IT, and certificate transparency. Uses shodan_search with ssl.cert.subject.cn filter. Costs 1 query credit.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hostname: { type: 'string', description: 'Hostname to search SSL certs for (e.g. "example.com")' },
        limit: { type: 'number', description: 'Max results (default: 5)' },
        fields: { type: 'string', description: 'Comma-separated fields per result, e.g. "ip_str,port,ssl.cert.subject,ssl.cert.issuer,ssl.cert.expires"' },
        summary: { type: 'boolean', description: 'Return markdown summary (default: false)' },
      },
      required: ['hostname'],
    },
  },

  // ── Scanning ───────────────────────────────────────────────────────
  {
    name: 'shodan_scan',
    description:
      'Request Shodan to scan specific IPs on-demand. Costs 1 scan credit per IP. Returns a scan ID — check progress with shodan_scan_status. Results appear in shodan_host_lookup once complete.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ips: { type: 'string', description: 'Comma-separated IPs to scan (e.g. "1.2.3.4,5.6.7.8")' },
      },
      required: ['ips'],
    },
  },
  {
    name: 'shodan_scan_status',
    description: 'Check the status of a previously submitted on-demand scan (FREE). Returns status: SUBMITTING, QUEUE, PROCESSING, or DONE.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Scan ID returned by shodan_scan' },
      },
      required: ['id'],
    },
  },

  // ── Utility (All Free) ─────────────────────────────────────────────
  {
    name: 'shodan_honeypot_check',
    description: 'Check if an IP is a known honeypot. Returns score 0.0-1.0 (higher = more likely honeypot). Use before engaging targets.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ip: { type: 'string', description: 'IP address to check' },
      },
      required: ['ip'],
    },
  },
  {
    name: 'shodan_api_info',
    description: 'Check Shodan API plan info, remaining query/scan credits, monitored IPs, and usage limits (FREE).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'shodan_search_facets',
    description: 'List all available Shodan search facets (FREE). Returns every facet you can use with shodan_search and shodan_count for statistical breakdowns.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'shodan_search_filters',
    description: 'List all available Shodan search filters (FREE). Returns every filter keyword you can use in search queries (e.g. port, org, http.title, ssl.cert.subject.cn, etc.).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];
