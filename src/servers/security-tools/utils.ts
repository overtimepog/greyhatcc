import { connect as tlsConnect } from 'node:tls';
import * as https from 'node:https';
import * as http from 'node:http';
import * as net from 'node:net';

// ── Browser-like request defaults ──────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const DEFAULT_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

// ── Types ──────────────────────────────────────────────────────────

export interface SimpleResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  redirectChain?: Array<{ url: string; status: number }>;
}

// ── URL Validation ─────────────────────────────────────────────────

export function validateExternalUrl(input: string): void {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol} — only http/https allowed`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (hostname === '::1' || hostname === '0000:0000:0000:0000:0000:0000:0000:0001') {
    throw new Error('Blocked: IPv6 loopback address');
  }

  const blockedHosts = ['localhost', 'metadata.google.internal'];
  if (blockedHosts.includes(hostname.toLowerCase())) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 127 || a === 0 || a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      throw new Error(`Blocked internal IP: ${hostname}`);
    }
  }
}

// ── Core HTTP Client (node:https/http — full TLS control) ──────────

function doRequest(
  url: string,
  options: {
    method?: string;
    timeout?: number;
    maxRedirects?: number;
    headers?: Record<string, string>;
    trackRedirects?: boolean;
  } = {},
  _redirectChain: Array<{ url: string; status: number }> = [],
): Promise<SimpleResponse> {
  const {
    method = 'GET',
    timeout = 30000,
    maxRedirects = 10,
    headers = {},
    trackRedirects = false,
  } = options;

  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'User-Agent': randomUA(), ...DEFAULT_HEADERS, ...headers },
      timeout,
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    };

    const req = mod.request(reqOptions, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        let redirectUrl: string;
        try {
          redirectUrl = new URL(res.headers.location, url).toString();
        } catch {
          redirectUrl = res.headers.location;
        }
        res.resume();

        const chain = trackRedirects
          ? [..._redirectChain, { url, status: res.statusCode }]
          : _redirectChain;

        doRequest(redirectUrl, { ...options, maxRedirects: maxRedirects - 1 }, chain)
          .then(resolve)
          .catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxBody = 2 * 1024 * 1024; // 2MB limit

      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize <= maxBody) chunks.push(chunk);
      });

      res.on('end', () => {
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value) responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        }
        resolve({
          status: res.statusCode || 0,
          headers: responseHeaders,
          body: Buffer.concat(chunks).toString('utf-8'),
          ...(trackRedirects
            ? { redirectChain: [..._redirectChain, { url, status: res.statusCode || 0 }] }
            : {}),
        });
      });

      res.on('error', (err) =>
        reject(new Error(`Response error from ${url}: ${err.message}`)),
      );
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms: ${url}`));
    });

    req.on('error', (err: Error) => {
      reject(new Error(`Connection to ${url} failed: ${err.message}`));
    });

    req.end();
  });
}

export async function securityFetch(
  url: string,
  options: {
    method?: string;
    timeout?: number;
    headers?: Record<string, string>;
    maxRedirects?: number;
    trackRedirects?: boolean;
  } = {},
  maxRetries = 2,
): Promise<SimpleResponse> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await doRequest(url, options);
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)));
      }
    }
  }
  throw lastError || new Error(`Request failed after ${maxRetries + 1} attempts: ${url}`);
}

// ── DNS Lookup ─────────────────────────────────────────────────────

export async function dnsLookup(
  domain: string,
  types: string[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'],
): Promise<Record<string, any>> {
  const results: Record<string, any> = { domain };
  try {
    const { Resolver } = await import('dns/promises');
    const resolver = new Resolver();

    for (const type of types) {
      try {
        switch (type.toUpperCase()) {
          case 'A': results.A = await resolver.resolve4(domain); break;
          case 'AAAA': results.AAAA = await resolver.resolve6(domain).catch(() => []); break;
          case 'MX': results.MX = await resolver.resolveMx(domain).catch(() => []); break;
          case 'TXT': results.TXT = await resolver.resolveTxt(domain).catch(() => []); break;
          case 'NS': results.NS = await resolver.resolveNs(domain).catch(() => []); break;
          case 'CNAME': results.CNAME = await resolver.resolveCname(domain).catch(() => []); break;
          case 'SOA': results.SOA = await resolver.resolveSoa(domain).catch(() => null); break;
        }
      } catch {}
    }
  } catch (err: any) {
    results.error = `DNS lookup failed: ${err.message}`;
  }
  return results;
}

// ── SSL/TLS Analysis ───────────────────────────────────────────────

export async function sslAnalysis(hostname: string, port: number = 443): Promise<any> {
  try {
    return await new Promise((resolve, reject) => {
      const socket = tlsConnect({ host: hostname, port, rejectUnauthorized: false }, () => {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();

        const weakProtocols = ['SSLv3', 'TLSv1', 'TLSv1.1'];
        const isWeakProtocol = protocol ? weakProtocols.includes(protocol) : false;
        const isWeakCipher = cipher?.name ? /RC4|DES|NULL|EXPORT|anon/i.test(cipher.name) : false;

        const now = new Date();
        const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
        const validFrom = cert?.valid_from ? new Date(cert.valid_from) : null;
        const isExpired = validTo ? validTo < now : false;
        const isNotYetValid = validFrom ? validFrom > now : false;
        const daysUntilExpiry = validTo ? Math.ceil((validTo.getTime() - now.getTime()) / 86400000) : null;
        const isSelfSigned = cert?.subject?.CN === cert?.issuer?.CN;

        resolve({
          hostname,
          port,
          protocol,
          cipher: cipher ? { name: cipher.name, version: cipher.version, bits: (cipher as any).bits } : null,
          certificate: cert
            ? {
                subject: cert.subject,
                issuer: cert.issuer,
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                serialNumber: cert.serialNumber,
                fingerprint256: cert.fingerprint256,
                subjectAltName: cert.subjectaltname,
                selfSigned: isSelfSigned,
              }
            : null,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError || null,
          security: {
            isExpired,
            isNotYetValid,
            daysUntilExpiry,
            isWeakProtocol,
            isWeakCipher,
            isSelfSigned,
          },
        });
        socket.end();
      });

      socket.on('error', (err) =>
        reject(new Error(`TLS connection to ${hostname}:${port} failed: ${err.message}`)),
      );
      socket.setTimeout(15000, () => {
        socket.destroy();
        reject(new Error(`TLS connection timeout: ${hostname}:${port}`));
      });
    });
  } catch (err: any) {
    return { hostname, port, error: err.message };
  }
}

// ── HTTP Security Header Analysis ──────────────────────────────────

export async function httpHeaderAnalysis(url: string): Promise<any> {
  try { validateExternalUrl(url); } catch (err: any) {
    return { url, error: err.message };
  }

  let res: SimpleResponse;
  try {
    res = await securityFetch(url, { method: 'HEAD', timeout: 20000 }, 1);
    if (res.status === 405 || res.status === 501) throw new Error('HEAD not allowed');
  } catch {
    try {
      res = await securityFetch(url, { method: 'GET', timeout: 20000 }, 2);
    } catch (err: any) {
      return { url, error: `Connection failed: ${err.message}` };
    }
  }

  const { headers } = res;

  const SECURITY_HEADERS: Array<{ name: string; severity: string; description: string }> = [
    { name: 'strict-transport-security', severity: 'HIGH', description: 'Enforces HTTPS connections' },
    { name: 'content-security-policy', severity: 'HIGH', description: 'Prevents XSS and injection attacks' },
    { name: 'x-content-type-options', severity: 'MEDIUM', description: 'Prevents MIME-type sniffing' },
    { name: 'x-frame-options', severity: 'MEDIUM', description: 'Prevents clickjacking' },
    { name: 'referrer-policy', severity: 'MEDIUM', description: 'Controls referrer information leakage' },
    { name: 'permissions-policy', severity: 'MEDIUM', description: 'Controls browser feature access' },
    { name: 'cross-origin-opener-policy', severity: 'LOW', description: 'Isolates browsing context' },
    { name: 'cross-origin-resource-policy', severity: 'LOW', description: 'Controls cross-origin resource loading' },
    { name: 'cross-origin-embedder-policy', severity: 'LOW', description: 'Controls cross-origin embedding' },
    { name: 'x-xss-protection', severity: 'INFO', description: 'Legacy XSS filter (deprecated)' },
  ];

  const present: Array<{ name: string; value: string; severity: string }> = [];
  const missing: Array<{ name: string; severity: string; description: string }> = [];

  for (const h of SECURITY_HEADERS) {
    if (headers[h.name]) {
      present.push({ name: h.name, value: headers[h.name], severity: h.severity });
    } else {
      missing.push(h);
    }
  }

  // Information leakage detection
  const infoLeaks: Array<{ header: string; value: string; risk: string }> = [];
  const leakHeaders = [
    'server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version',
    'x-generator', 'x-drupal-cache', 'x-varnish', 'via',
  ];
  for (const h of leakHeaders) {
    if (headers[h]) {
      infoLeaks.push({ header: h, value: headers[h], risk: 'Technology/version disclosure' });
    }
  }

  // Cookie flag analysis
  const cookies = headers['set-cookie'] || '';
  const cookieIssues: string[] = [];
  if (cookies) {
    if (!cookies.toLowerCase().includes('httponly')) cookieIssues.push('Missing HttpOnly flag');
    if (!cookies.toLowerCase().includes('secure')) cookieIssues.push('Missing Secure flag');
    if (!cookies.toLowerCase().includes('samesite')) cookieIssues.push('Missing SameSite attribute');
  }

  // Severity-weighted scoring
  const weights: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0.5 };
  const maxScore = SECURITY_HEADERS.reduce((sum, h) => sum + (weights[h.severity] || 0), 0);
  const actualScore = present.reduce((sum, h) => sum + (weights[h.severity] || 0), 0);
  const score = Math.round((actualScore / maxScore) * 100);
  const rating = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

  return {
    url,
    statusCode: res.status,
    headers,
    securityHeaders: { present, missing },
    infoLeaks: infoLeaks.length > 0 ? infoLeaks : undefined,
    cookieIssues: cookieIssues.length > 0 ? cookieIssues : undefined,
    score,
    rating,
  };
}

// ── WAF/CDN Detection ──────────────────────────────────────────────

export async function wafDetect(url: string): Promise<any> {
  try { validateExternalUrl(url); } catch (err: any) {
    return { url, error: err.message, detected: [] };
  }

  let res: SimpleResponse;
  try {
    res = await securityFetch(url, { method: 'GET', timeout: 20000 }, 2);
  } catch (err: any) {
    return { url, error: `Connection failed: ${err.message}`, detected: [] };
  }
  const { headers, body } = res;
  const serverHeader = (headers['server'] || '').toLowerCase();

  // Header-based WAF indicators
  const headerIndicators: Record<string, string[]> = {
    cloudflare: ['cf-ray', 'cf-cache-status', 'cf-request-id', 'cf-connecting-ip'],
    akamai: ['x-akamai-transformed', 'akamai-grn', 'x-akamai-session-info', 'x-akamai-request-id'],
    'aws-cloudfront': ['x-amz-cf-id', 'x-amz-cf-pop'],
    'aws-waf': ['x-amzn-waf-action', 'x-amzn-requestid'],
    imperva: ['x-iinfo', 'x-cdn', 'visid_incap'],
    sucuri: ['x-sucuri-id', 'x-sucuri-cache'],
    fastly: ['x-served-by', 'x-cache', 'x-timer', 'fastly-io-info'],
    'azure-front-door': ['x-azure-ref', 'x-fd-healthprobe'],
    'azure-cdn': ['x-msedge-ref', 'x-ec-custom-error'],
    stackpath: ['x-sp-edge', 'x-sp-url', 'x-hw'],
    f5: ['x-wa-info', 'x-cnection', 'bigipserver'],
    barracuda: ['barra_counter_session'],
    fortiweb: ['fortiwafsid'],
    'google-cloud': ['x-goog-generation', 'x-guploader-uploadid'],
    varnish: ['x-varnish'],
    reblaze: ['rbzid'],
    wallarm: ['x-wallarm-waf-check'],
    radware: ['x-sl-compstate'],
  };

  // Server header patterns
  const serverPatterns: Record<string, string> = {
    cloudflare: 'cloudflare',
    akamai: 'akamaighost',
    nginx: 'nginx',
    apache: 'apache',
    iis: 'microsoft-iis',
    f5: 'bigip',
    varnish: 'varnish',
    litespeed: 'litespeed',
    openresty: 'openresty',
    'aws-elb': 'awselb',
    caddy: 'caddy',
    envoy: 'envoy',
  };

  // Body patterns (WAF block pages)
  const bodyPatterns: Record<string, RegExp[]> = {
    cloudflare: [/attention required.*cloudflare/i, /ray id:/i, /cloudflare to restrict access/i],
    akamai: [/access denied.*akamai/i, /reference#\d+\.\w+/i],
    imperva: [/incapsula incident/i, /powered by incapsula/i],
    sucuri: [/access denied.*sucuri/i, /sucuri website firewall/i],
    'aws-waf': [/request blocked.*aws/i, /aws waf/i],
    f5: [/the requested url was rejected/i, /support id/i],
    fortiweb: [/fortigate/i, /fortiweb/i],
    barracuda: [/barracuda/i],
    wordfence: [/wordfence/i, /generated by wordfence/i],
    modsecurity: [/modsecurity/i, /not acceptable.*modsecurity/i],
  };

  const detected: Array<{ waf: string; confidence: string; evidence: string[] }> = [];

  // Check response headers
  for (const [waf, indicators] of Object.entries(headerIndicators)) {
    const found = indicators.filter((h) => headers[h]);
    if (found.length > 0) {
      detected.push({
        waf,
        confidence: found.length >= 2 ? 'HIGH' : 'MEDIUM',
        evidence: found.map((h) => `header: ${h}=${headers[h]}`),
      });
    }
  }

  // Check server header
  for (const [waf, pattern] of Object.entries(serverPatterns)) {
    if (serverHeader.includes(pattern)) {
      const existing = detected.find((d) => d.waf === waf);
      if (existing) {
        existing.evidence.push(`server: ${headers['server']}`);
        existing.confidence = 'HIGH';
      } else {
        detected.push({ waf, confidence: 'HIGH', evidence: [`server: ${headers['server']}`] });
      }
    }
  }

  // Check body patterns (first 50KB only)
  const bodySnippet = body.slice(0, 50000);
  for (const [waf, patterns] of Object.entries(bodyPatterns)) {
    const matched = patterns.filter((p) => p.test(bodySnippet));
    if (matched.length > 0) {
      const existing = detected.find((d) => d.waf === waf);
      if (existing) {
        existing.evidence.push(`body_pattern: ${matched[0].source}`);
        existing.confidence = 'HIGH';
      } else {
        detected.push({
          waf,
          confidence: matched.length >= 2 ? 'HIGH' : 'MEDIUM',
          evidence: matched.map((m) => `body_pattern: ${m.source}`),
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = detected.filter((d) => {
    if (seen.has(d.waf)) return false;
    seen.add(d.waf);
    return true;
  });

  return {
    url,
    statusCode: res.status,
    server: headers['server'] || null,
    detected: unique.length > 0 ? unique : [{ waf: 'none-detected', confidence: 'LOW', evidence: [] }],
    allHeaders: headers,
  };
}

// ── CORS Misconfiguration Check ────────────────────────────────────

export async function corsCheck(url: string, customOrigins?: string[]): Promise<any> {
  try { validateExternalUrl(url); } catch (err: any) {
    return { url, error: err.message, overallRisk: 'ERROR', tests: [], vulnerabilities: [] };
  }

  let parsed: URL;
  try { parsed = new URL(url); } catch (err: any) {
    return { url, error: `Invalid URL: ${err.message}`, overallRisk: 'ERROR', tests: [], vulnerabilities: [] };
  }
  const baseOrigin = `${parsed.protocol}//${parsed.host}`;

  const origins = customOrigins || [
    'https://evil.com',
    'null',
    `https://sub.${parsed.hostname}`,
    `https://${parsed.hostname}.evil.com`,
    baseOrigin,
    'https://localhost',
    `http://${parsed.hostname}`,
  ];

  const results: Array<{
    origin: string;
    allowed: boolean;
    acao: string | null;
    acac: boolean;
    risk: string;
  }> = [];

  for (const origin of origins) {
    try {
      const res = await securityFetch(
        url,
        { method: 'GET', timeout: 15000, headers: { Origin: origin } },
        1,
      );

      const acao = res.headers['access-control-allow-origin'] || null;
      const acac = res.headers['access-control-allow-credentials']?.toLowerCase() === 'true';

      let risk = 'NONE';
      if (acao === '*' && acac) {
        risk = 'CRITICAL';
      } else if (acao === origin && origin === 'null') {
        risk = 'HIGH';
      } else if (acao === origin && origin.includes('evil.com')) {
        risk = 'CRITICAL';
      } else if (acao === origin && origin.includes(`.${parsed.hostname}`)) {
        risk = acac ? 'HIGH' : 'MEDIUM';
      } else if (acao === '*') {
        risk = 'LOW';
      } else if (acao === origin && origin !== baseOrigin) {
        risk = acac ? 'HIGH' : 'MEDIUM';
      }

      results.push({ origin, allowed: acao === origin || acao === '*', acao, acac, risk });
    } catch {
      results.push({ origin, allowed: false, acao: null, acac: false, risk: 'ERROR' });
    }
  }

  const riskOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0, ERROR: -1 };
  const maxRisk = results.reduce(
    (max, r) => ((riskOrder[r.risk] || 0) > (riskOrder[max] || 0) ? r.risk : max),
    'NONE',
  );

  return {
    url,
    overallRisk: maxRisk,
    tests: results,
    vulnerabilities: results.filter((r) => r.risk !== 'NONE' && r.risk !== 'ERROR'),
  };
}

// ── Technology Fingerprinting ──────────────────────────────────────

export async function techFingerprint(url: string): Promise<any> {
  try { validateExternalUrl(url); } catch (err: any) {
    return { url, error: err.message, technologies: [], byCategory: {}, count: 0 };
  }

  let res: SimpleResponse;
  try {
    res = await securityFetch(url, { method: 'GET', timeout: 20000 }, 2);
  } catch (err: any) {
    return { url, error: `Connection failed: ${err.message}`, technologies: [], byCategory: {}, count: 0 };
  }
  const { headers, body } = res;

  const technologies: Array<{ name: string; category: string; version?: string; evidence: string }> = [];
  const addTech = (name: string, category: string, evidence: string, version?: string) => {
    if (!technologies.find((t) => t.name === name)) {
      technologies.push({ name, category, evidence, ...(version ? { version } : {}) });
    }
  };

  // Header-based detection
  const serverVal = headers['server'] || '';
  const poweredBy = headers['x-powered-by'] || '';

  const headerPatterns: Array<[RegExp, string, string]> = [
    [/nginx\/([\d.]+)/i, 'Nginx', 'Web Server'],
    [/apache\/([\d.]+)/i, 'Apache', 'Web Server'],
    [/microsoft-iis\/([\d.]+)/i, 'IIS', 'Web Server'],
    [/litespeed/i, 'LiteSpeed', 'Web Server'],
    [/caddy/i, 'Caddy', 'Web Server'],
    [/envoy/i, 'Envoy', 'Proxy'],
    [/openresty/i, 'OpenResty', 'Web Server'],
    [/cloudflare/i, 'Cloudflare', 'CDN'],
  ];

  for (const [pattern, name, category] of headerPatterns) {
    const match = serverVal.match(pattern);
    if (match) addTech(name, category, `server: ${serverVal}`, match[1]);
  }

  const poweredByPatterns: Array<[RegExp, string, string]> = [
    [/php\/([\d.]+)/i, 'PHP', 'Language'],
    [/asp\.net/i, 'ASP.NET', 'Framework'],
    [/express/i, 'Express', 'Framework'],
    [/next\.?js/i, 'Next.js', 'Framework'],
    [/nuxt/i, 'Nuxt', 'Framework'],
  ];

  for (const [pattern, name, category] of poweredByPatterns) {
    const match = poweredBy.match(pattern);
    if (match) addTech(name, category, `x-powered-by: ${poweredBy}`, match[1]);
  }

  // Cookie-based detection
  const setCookie = headers['set-cookie'] || '';
  const cookiePatterns: Array<[RegExp, string, string]> = [
    [/jsessionid/i, 'Java/Servlet', 'Language'],
    [/phpsessid/i, 'PHP', 'Language'],
    [/asp\.net_sessionid|\.aspxauth/i, 'ASP.NET', 'Framework'],
    [/laravel_session/i, 'Laravel', 'Framework'],
    [/csrftoken/i, 'Django', 'Framework'],
    [/wordpress_logged_in|wp-settings/i, 'WordPress', 'CMS'],
    [/drupal\./i, 'Drupal', 'CMS'],
    [/cognito/i, 'AWS Cognito', 'Auth'],
    [/connect\.sid/i, 'Express Session', 'Framework'],
  ];

  for (const [pattern, name, category] of cookiePatterns) {
    if (pattern.test(setCookie)) {
      addTech(name, category, `cookie: ${pattern.source}`);
    }
  }

  // Body-based detection (first 100KB)
  const bodySlice = body.slice(0, 100000);
  const bodyPatterns: Array<[RegExp, string, string, RegExp?]> = [
    [/react[-.]|__react|data-reactroot|_reactlistening/i, 'React', 'JS Framework'],
    [/data-v-[a-f0-9]|__vue/i, 'Vue.js', 'JS Framework'],
    [/ng-version="([\d.]+)"/i, 'Angular', 'JS Framework', /ng-version="([\d.]+)"/],
    [/__next|_next\/static/i, 'Next.js', 'Framework'],
    [/__nuxt|_nuxt\//i, 'Nuxt', 'Framework'],
    [/jquery[-.]min\.js|jquery[-.][\d.]+/i, 'jQuery', 'JS Library', /jquery[-.]([\d.]+)/i],
    [/wp-content|wp-includes|wp-json/i, 'WordPress', 'CMS'],
    [/drupal\.js|drupal\.settings/i, 'Drupal', 'CMS'],
    [/joomla|com_content/i, 'Joomla', 'CMS'],
    [/shopify\.com|cdn\.shopify/i, 'Shopify', 'E-commerce'],
    [/mage\/cookies|magento/i, 'Magento', 'E-commerce'],
    [/bootstrap[-.]min\.(css|js)/i, 'Bootstrap', 'CSS Framework'],
    [/tailwindcss/i, 'Tailwind CSS', 'CSS Framework'],
    [/google-analytics\.com|gtag|analytics\.js/i, 'Google Analytics', 'Analytics'],
    [/googletagmanager\.com|gtm\.js/i, 'Google Tag Manager', 'Analytics'],
    [/static\.hotjar/i, 'Hotjar', 'Analytics'],
    [/sentry[-.]io|sentry\.init/i, 'Sentry', 'Monitoring'],
    [/datadoghq\.com|dd-rum/i, 'Datadog', 'Monitoring'],
    [/cloudflareinsights|cf-beacon/i, 'Cloudflare Analytics', 'Analytics'],
    [/recaptcha|grecaptcha/i, 'reCAPTCHA', 'Security'],
    [/hcaptcha/i, 'hCaptcha', 'Security'],
    [/firebase[-.]|firebaseapp\.com|firebaseio\.com/i, 'Firebase', 'Backend'],
    [/amazonaws\.com/i, 'AWS', 'Cloud'],
    [/js\.stripe\.com/i, 'Stripe', 'Payment'],
    [/webpackjsonp|webpack_require/i, 'Webpack', 'Build Tool'],
    [/\/@vite/i, 'Vite', 'Build Tool'],
    [/graphql|__schema|__typename/i, 'GraphQL', 'API'],
    [/socket\.io/i, 'Socket.io', 'Realtime'],
    [/posthog/i, 'PostHog', 'Analytics'],
    [/intercom/i, 'Intercom', 'Support'],
    [/freshchat|fcwidget/i, 'Freshchat', 'Support'],
    [/zdassets\.com|zendesk/i, 'Zendesk', 'Support'],
    [/swagger-ui/i, 'Swagger UI', 'API Docs'],
  ];

  for (const [pattern, name, category, versionPattern] of bodyPatterns) {
    if (pattern.test(bodySlice)) {
      let version: string | undefined;
      if (versionPattern) {
        const match = bodySlice.match(versionPattern);
        version = match?.[1];
      }
      addTech(name, category, `body_pattern: ${pattern.source}`, version);
    }
  }

  // Meta generator tag
  const generatorMatch = body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (generatorMatch) {
    addTech(generatorMatch[1], 'Generator', `meta: ${generatorMatch[1]}`);
  }

  // Group by category
  const byCategory: Record<string, Array<{ name: string; version?: string }>> = {};
  for (const tech of technologies) {
    if (!byCategory[tech.category]) byCategory[tech.category] = [];
    byCategory[tech.category].push({ name: tech.name, ...(tech.version ? { version: tech.version } : {}) });
  }

  return { url, statusCode: res.status, technologies, byCategory, count: technologies.length };
}

// ── Subdomain Enumeration (crt.sh CT logs) ─────────────────────────

export async function subdomainEnum(domain: string, includeExpired = false): Promise<any> {
  if (!/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain)) {
    return { domain, source: 'crt.sh', error: `Invalid domain format: ${domain}`, uniqueSubdomains: 0, subdomains: [] };
  }

  const crtUrl = `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`;

  let res: SimpleResponse;
  try {
    res = await securityFetch(crtUrl, { timeout: 45000 }, 2);
  } catch (err: any) {
    return {
      domain,
      source: 'crt.sh',
      error: `Failed to connect to crt.sh: ${err.message}`,
      suggestion: 'crt.sh may be rate-limiting or temporarily down. Try again in a few minutes.',
      uniqueSubdomains: 0,
      subdomains: [],
    };
  }

  // crt.sh returns non-200 on overload/rate-limit
  if (res.status !== 200) {
    return {
      domain,
      source: 'crt.sh',
      error: `crt.sh returned HTTP ${res.status}`,
      suggestion: res.status === 503 ? 'Service overloaded — retry in 30-60 seconds' :
                  res.status === 429 ? 'Rate limited — wait before retrying' :
                  'Unexpected status code — service may be unavailable',
      uniqueSubdomains: 0,
      subdomains: [],
    };
  }

  let entries: any[];
  try {
    entries = JSON.parse(res.body);
  } catch {
    // crt.sh sometimes returns HTML error page instead of JSON
    const isHtml = res.body.trim().startsWith('<') || res.body.includes('<!DOCTYPE');
    return {
      domain,
      source: 'crt.sh',
      error: 'Failed to parse crt.sh response',
      detail: isHtml ? 'Received HTML instead of JSON — crt.sh may be overloaded or returning an error page' :
              res.body.length === 0 ? 'Empty response body' :
              `Unexpected response format (first 100 chars): ${res.body.slice(0, 100)}`,
      suggestion: 'Retry in 30-60 seconds, or use alternative subdomain enumeration methods',
      uniqueSubdomains: 0,
      subdomains: [],
    };
  }

  // Handle non-array responses (e.g. crt.sh returning an error object)
  if (!Array.isArray(entries)) {
    return {
      domain,
      source: 'crt.sh',
      error: 'crt.sh returned unexpected data format',
      detail: typeof entries === 'object' ? JSON.stringify(entries).slice(0, 200) : 'Non-array response',
      uniqueSubdomains: 0,
      subdomains: [],
    };
  }

  const subdomains = new Map<string, { firstSeen: string; lastSeen: string; issuer: string; expired: boolean }>();
  const now = new Date();

  for (const entry of entries) {
    const names = (entry.name_value || '').split('\n').map((n: string) => n.trim().toLowerCase());
    const notAfter = new Date(entry.not_after);
    const isExpired = notAfter < now;
    if (!includeExpired && isExpired) continue;

    for (const name of names) {
      if (!name || name.startsWith('*') || !name.endsWith(domain)) continue;

      const existing = subdomains.get(name);
      if (!existing || new Date(entry.entry_timestamp) > new Date(existing.lastSeen)) {
        subdomains.set(name, {
          firstSeen: existing?.firstSeen || entry.entry_timestamp,
          lastSeen: entry.entry_timestamp,
          issuer: entry.issuer_name || 'Unknown',
          expired: isExpired,
        });
      }
    }
  }

  const sorted = [...subdomains.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, info]) => ({ name, ...info }));

  return {
    domain,
    source: 'crt.sh',
    totalCerts: entries.length,
    uniqueSubdomains: sorted.length,
    subdomains: sorted,
  };
}

// ── TCP Port Check ─────────────────────────────────────────────────

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445,
  993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 9090, 27017,
];

export async function portCheck(host: string, ports?: number[], timeout = 3000): Promise<any> {
  const portsToCheck = ports || COMMON_PORTS;

  const checkPort = (port: number): Promise<{ port: number; open: boolean; latency?: number; banner?: string }> => {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const latency = Date.now() - start;
        let banner = '';
        socket.once('data', (data) => {
          banner = data.toString('utf-8').trim().slice(0, 200);
        });
        setTimeout(() => {
          socket.destroy();
          resolve({ port, open: true, latency, ...(banner ? { banner } : {}) });
        }, 500);
      });

      socket.on('timeout', () => { socket.destroy(); resolve({ port, open: false }); });
      socket.on('error', () => { socket.destroy(); resolve({ port, open: false }); });

      socket.connect(port, host);
    });
  };

  // Parallel in batches of 10
  const results: Array<{ port: number; open: boolean; latency?: number; banner?: string }> = [];
  const batchSize = 10;
  for (let i = 0; i < portsToCheck.length; i += batchSize) {
    const batch = portsToCheck.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(checkPort));
    results.push(...batchResults);
  }

  const openPorts = results.filter((r) => r.open);

  return {
    host,
    portsScanned: portsToCheck.length,
    openPorts,
    closedCount: results.length - openPorts.length,
    summary: openPorts.length > 0
      ? `${openPorts.length} open: ${openPorts.map((p) => p.port).join(', ')}`
      : 'No open ports found',
  };
}

// ── Redirect Chain Analysis ────────────────────────────────────────

export async function redirectChain(url: string, maxRedirects = 10): Promise<any> {
  try { validateExternalUrl(url); } catch (err: any) {
    return { startUrl: url, error: err.message, chain: [], hops: 0 };
  }

  let res: SimpleResponse;
  try {
    res = await securityFetch(
      url,
      { method: 'GET', timeout: 20000, maxRedirects, trackRedirects: true },
      1,
    );
  } catch (err: any) {
    return { startUrl: url, error: `Connection failed: ${err.message}`, chain: [], hops: 0 };
  }

  const chain = res.redirectChain || [{ url, status: res.status }];

  const issues: string[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    try {
      const from = new URL(chain[i].url);
      const to = new URL(chain[i + 1].url);
      if (from.protocol === 'https:' && to.protocol === 'http:') {
        issues.push(`HTTPS downgrade: ${chain[i].url} → ${chain[i + 1].url}`);
      }
      if (from.hostname !== to.hostname) {
        issues.push(`Cross-domain redirect: ${from.hostname} → ${to.hostname}`);
      }
    } catch {}
  }

  return {
    startUrl: url,
    finalUrl: chain[chain.length - 1].url,
    finalStatus: res.status,
    hops: chain.length - 1,
    chain,
    securityIssues: issues.length > 0 ? issues : undefined,
  };
}

// ── CVSS v3.1 Calculator ───────────────────────────────────────────

export function cvssCalculate(vector: string): any {
  const metrics = new Map<string, string>();
  const parts = vector.replace('CVSS:3.1/', '').split('/');
  for (const part of parts) {
    const [k, v] = part.split(':');
    metrics.set(k, v);
  }

  const avWeights: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.20 };
  const acWeights: Record<string, number> = { L: 0.77, H: 0.44 };
  const prWeightsU: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
  const prWeightsC: Record<string, number> = { N: 0.85, L: 0.68, H: 0.50 };
  const uiWeights: Record<string, number> = { N: 0.85, R: 0.62 };
  const ciaWeights: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

  const scopeChanged = metrics.get('S') === 'C';
  const prWeights = scopeChanged ? prWeightsC : prWeightsU;

  const av = avWeights[metrics.get('AV') || 'N'] || 0;
  const ac = acWeights[metrics.get('AC') || 'L'] || 0;
  const pr = prWeights[metrics.get('PR') || 'N'] || 0;
  const ui = uiWeights[metrics.get('UI') || 'N'] || 0;
  const c = ciaWeights[metrics.get('C') || 'N'] || 0;
  const i = ciaWeights[metrics.get('I') || 'N'] || 0;
  const a = ciaWeights[metrics.get('A') || 'N'] || 0;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * av * ac * pr * ui;

  let baseScore: number;
  if (impact <= 0) {
    baseScore = 0;
  } else if (scopeChanged) {
    baseScore = Math.min(1.08 * (impact + exploitability), 10);
  } else {
    baseScore = Math.min(impact + exploitability, 10);
  }
  baseScore = Math.ceil(baseScore * 10) / 10;

  const severity =
    baseScore === 0 ? 'NONE' : baseScore < 4.0 ? 'LOW' : baseScore < 7.0 ? 'MEDIUM' : baseScore < 9.0 ? 'HIGH' : 'CRITICAL';

  return {
    vector,
    baseScore,
    severity,
    impact: Math.round(impact * 10) / 10,
    exploitability: Math.round(exploitability * 10) / 10,
  };
}

// ── HackerOne Program Fetch ───────────────────────────────────────

export async function h1ProgramFetch(
  handle: string,
  apiToken?: string,
  username?: string,
  includeScopes = true,
): Promise<any> {
  // Validate handle
  if (!handle || !/^[a-zA-Z0-9_-]+$/.test(handle)) {
    throw new Error(`Invalid HackerOne program handle: ${handle}`);
  }

  // Strategy 1: HackerOne REST API (requires auth)
  if (apiToken && username) {
    const authHeader = Buffer.from(`${username}:${apiToken}`).toString('base64');
    const apiBase = 'https://api.hackerone.com/v1/hackers/programs';

    try {
      // Fetch program list and find by handle
      const programRes = await securityFetch(
        `${apiBase}?filter[handle]=${encodeURIComponent(handle)}`,
        {
          method: 'GET',
          timeout: 30000,
          headers: {
            Authorization: `Basic ${authHeader}`,
            Accept: 'application/json',
          },
        },
        2,
      );

      if (programRes.status === 200) {
        const programData = JSON.parse(programRes.body);
        const program = programData.data?.[0];

        if (!program) {
          return {
            handle,
            source: 'h1_api',
            error: 'Program not found or not accessible with current token',
            suggestion: 'Verify handle is correct and your H1 account has access to this program',
          };
        }

        const result: any = {
          handle,
          source: 'h1_api',
          id: program.id,
          name: program.attributes?.name,
          state: program.attributes?.state,
          started_accepting_at: program.attributes?.started_accepting_at,
          submission_state: program.attributes?.submission_state,
          offers_bounties: program.attributes?.offers_bounties,
          policy: program.attributes?.policy,
          profile: {
            name: program.attributes?.profile?.name,
            about: program.attributes?.profile?.about,
            website: program.attributes?.profile?.website,
          },
        };

        // Fetch structured scopes
        if (includeScopes && program.id) {
          try {
            const scopeRes = await securityFetch(
              `${apiBase}/${program.id}/structured_scopes?page[size]=100`,
              {
                method: 'GET',
                timeout: 30000,
                headers: {
                  Authorization: `Basic ${authHeader}`,
                  Accept: 'application/json',
                },
              },
              1,
            );

            if (scopeRes.status === 200) {
              const scopeData = JSON.parse(scopeRes.body);
              const scopes = (scopeData.data || []).map((s: any) => ({
                asset_identifier: s.attributes?.asset_identifier,
                asset_type: s.attributes?.asset_type,
                eligible_for_bounty: s.attributes?.eligible_for_bounty,
                eligible_for_submission: s.attributes?.eligible_for_submission,
                instruction: s.attributes?.instruction,
                max_severity: s.attributes?.max_severity,
                created_at: s.attributes?.created_at,
              }));

              result.scopes = {
                in_scope: scopes.filter((s: any) => s.eligible_for_submission),
                out_of_scope: scopes.filter((s: any) => !s.eligible_for_submission),
                total: scopes.length,
              };
            }
          } catch {
            result.scopes = { error: 'Failed to fetch structured scopes' };
          }
        }

        return result;
      }

      if (programRes.status === 401 || programRes.status === 403) {
        return {
          handle,
          source: 'h1_api',
          error: `Authentication failed (${programRes.status})`,
          suggestion: 'Check H1_API_TOKEN and hackerone.username in config',
        };
      }
    } catch (err: any) {
      // Fall through to public scrape
    }
  }

  // Strategy 2: Public page scrape (no auth required, limited data)
  // Attempt to fetch the program's policy_scopes page which sometimes returns
  // partial data even without full JS rendering
  try {
    const publicUrl = `https://hackerone.com/${handle}`;
    const res = await securityFetch(publicUrl, { method: 'GET', timeout: 20000 }, 1);

    // Extract any JSON-LD or meta data from the HTML
    const jsonLdMatch = res.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const metaDescription = res.body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const ogTitle = res.body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

    // Extract __NEXT_DATA__ or similar hydration data (React SPA pattern)
    const nextDataMatch = res.body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

    const result: any = {
      handle,
      source: 'public_scrape',
      note: 'Limited data - HackerOne requires JS rendering. Use Playwright MCP for full extraction, or configure H1_API_TOKEN for API access.',
      url: publicUrl,
      statusCode: res.status,
    };

    if (jsonLdMatch) {
      try {
        result.structured_data = JSON.parse(jsonLdMatch[1]);
      } catch {}
    }

    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        result.hydration_data = nextData?.props?.pageProps;
      } catch {}
    }

    if (metaDescription) result.description = metaDescription[1];
    if (ogTitle) result.title = ogTitle[1];

    // Check if page redirected or returned error
    if (res.status === 404) {
      result.error = 'Program not found (404)';
    } else if (res.status === 302 || res.status === 301) {
      result.note = 'Program page redirected - may be private or renamed';
    }

    return result;
  } catch (err: any) {
    return {
      handle,
      source: 'public_scrape',
      error: `Failed to fetch program page: ${err.message}`,
      suggestion: 'Use Playwright MCP browser tools for JS-rendered pages, or configure H1_API_TOKEN',
    };
  }
}
