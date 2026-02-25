export interface GreyhatConfig {
  shodan: { apiKey?: string };
  nvd: { apiKey?: string };
  defaults: {
    reportFormat: 'ptes' | 'owasp' | 'nist';
    severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    rateLimit: { requestsPerSecond: number; burstSize: number };
  };
  directories: Record<string, string>;
  hackerone: { username?: string; apiToken?: string };
  webTools?: {
    headless?: boolean;
    maxSessions?: number;
    maxTrafficEntries?: number;
    maxBodySize?: number;
    defaultScope?: string[];
    chromiumPath?: string;
    defaultUserAgent?: string;
    defaultViewport?: { width: number; height: number };
  };
}

// ── Shodan Banner (individual service record) ────────────────────────

export interface ShodanBanner {
  port: number;
  transport: string;
  product?: string;
  version?: string;
  banner?: string;
  cpe?: string[];
  vulns?: Record<string, { verified: boolean; cvss?: number; summary?: string }>;
  ssl?: {
    cert: {
      subject: Record<string, string>;
      issuer: Record<string, string>;
      serial: number;
      fingerprint: Record<string, string>;
      expires: string;
      expired: boolean;
    };
    cipher: { bits: number; name: string; version: string };
    chain: string[];
    versions: string[];
    alpn: string[];
    ja3s?: string;
    jarm?: string;
  };
  http?: {
    status: number;
    title?: string;
    server?: string;
    html?: string;
    robots?: string;
    favicon?: { hash: number; data: string };
    headers_hash?: number;
    html_hash?: number;
    redirects?: Array<{ host: string; data: string }>;
    components?: Record<string, { categories: string[] }>;
    waf?: string;
    securitytxt?: string;
  };
  ssh?: {
    hassh?: string;
    type?: string;
    key?: string;
    cipher?: string;
    mac?: string;
    fingerprint?: string;
  };
  cloud?: {
    provider?: string;
    region?: string;
    service?: string;
  };
  opts?: Record<string, any>;
  timestamp?: string;
  hostnames?: string[];
  domains?: string[];
  org?: string;
  isp?: string;
  asn?: string;
  ip_str?: string;
  location?: {
    city?: string;
    region_code?: string;
    country_code?: string;
    country_name?: string;
    latitude?: number;
    longitude?: number;
  };
}

// ── Shodan Host Result ───────────────────────────────────────────────

export interface ShodanHostResult {
  ip_str: string;
  ports: number[];
  hostnames: string[];
  domains?: string[];
  org: string;
  isp?: string;
  asn?: string;
  os: string | null;
  vulns?: string[];
  tags?: string[];
  city?: string;
  region_code?: string;
  country_code?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  last_update?: string;
  data: ShodanBanner[];
}

// ── Shodan Search Result ─────────────────────────────────────────────

export interface ShodanFacetEntry {
  value: string | number;
  count: number;
}

export interface ShodanSearchResult {
  matches: ShodanBanner[];
  total: number;
  facets?: Record<string, ShodanFacetEntry[]>;
}

// ── Shodan Count Result ──────────────────────────────────────────────

export interface ShodanCountResult {
  total: number;
  facets?: Record<string, ShodanFacetEntry[]>;
}

// ── InternetDB Result ────────────────────────────────────────────────

export interface InternetDbResult {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

// ── Shodan DNS Domain Result ─────────────────────────────────────────

export interface ShodanDnsRecord {
  subdomain: string;
  type: string;
  value: string;
  last_seen?: string;
}

export interface ShodanDnsDomainResult {
  domain: string;
  tags?: string[];
  data: ShodanDnsRecord[];
  subdomains: string[];
  more: boolean;
}

// ── Shodan Scan Result ───────────────────────────────────────────────

export interface ShodanScanResult {
  id: string;
  count: number;
  credits_left: number;
}

export interface ShodanScanStatusResult {
  id: string;
  status: 'SUBMITTING' | 'QUEUE' | 'PROCESSING' | 'DONE';
  count: number;
  created: string;
}

// ── Shodan API Info ──────────────────────────────────────────────────

export interface ShodanApiInfo {
  scan_credits: number;
  usage_limits: {
    scan_credits: number;
    query_credits: number;
    monitored_ips: number;
  };
  plan: string;
  https: boolean;
  unlocked: boolean;
  query_credits: number;
  monitored_ips: number;
  unlocked_left: number;
  telnet: boolean;
}

// ── Shodan Exploits Result ───────────────────────────────────────────

export interface ShodanExploit {
  _id: string;
  description?: string;
  author?: string;
  code?: string;
  source?: string;
  type?: string;
  platform?: string;
  port?: number;
  cve?: string[];
  date?: string;
}

export interface ShodanExploitsResult {
  matches: ShodanExploit[];
  total: number;
  facets?: Record<string, ShodanFacetEntry[]>;
}

// ── Shodan Search Tokens Result ──────────────────────────────────────

export interface ShodanSearchTokensResult {
  attributes: Record<string, string[]>;
  errors: string[];
  string: string;
  filters: string[];
}

// ── Legacy types (non-Shodan) ────────────────────────────────────────

export interface CveResult {
  id: string;
  description: string;
  cvss: number | null;
  severity: string;
  published: string;
  references: string[];
  cwe: string[];
  affected: string[];
}

export interface ExploitResult {
  id: string;
  title: string;
  description: string;
  type: string;
  platform: string;
  url: string;
}
