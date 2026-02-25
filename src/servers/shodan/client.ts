import type {
  ShodanHostResult,
  ShodanSearchResult,
  ShodanCountResult,
  InternetDbResult,
  ShodanDnsDomainResult,
  ShodanScanResult,
  ShodanScanStatusResult,
  ShodanApiInfo,
  ShodanExploitsResult,
  ShodanSearchTokensResult,
} from '../../shared/types.js';
import { RateLimiter } from './rate-limiter.js';

const BASE_URL = 'https://api.shodan.io';
const EXPLOITS_URL = 'https://exploits.shodan.io/api';
const INTERNETDB_URL = 'https://internetdb.shodan.io';

export class ShodanClient {
  private rateLimiter = new RateLimiter(1, 1); // 1 req/sec

  constructor(private apiKey: string) {}

  // ── Core fetch methods ───────────────────────────────────────────

  private async fetch(url: string, params: Record<string, string> = {}): Promise<any> {
    await this.rateLimiter.acquire();
    const searchParams = new URLSearchParams({ key: this.apiKey, ...params });
    const fullUrl = `${url}?${searchParams}`;
    let res: Response;
    try {
      res = await globalThis.fetch(fullUrl, { redirect: 'error' });
    } catch (err: any) {
      if (err?.message?.includes('redirect')) {
        throw new Error('Shodan API error: unexpected redirect');
      }
      throw new Error('Shodan API error: network request failed');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shodan API error (${res.status}): ${text}`);
    }
    return res.json();
  }

  /** Fetch from endpoints that don't need an API key (e.g. InternetDB). */
  private async fetchNoAuth(url: string): Promise<any> {
    await this.rateLimiter.acquire();
    let res: Response;
    try {
      res = await globalThis.fetch(url, { redirect: 'error' });
    } catch (err: any) {
      if (err?.message?.includes('redirect')) {
        throw new Error('API error: unexpected redirect');
      }
      throw new Error('API error: network request failed');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error (${res.status}): ${text}`);
    }
    return res.json();
  }

  /** POST with API key in query string and form body. */
  private async post(url: string, body: Record<string, string>, params: Record<string, string> = {}): Promise<any> {
    await this.rateLimiter.acquire();
    const searchParams = new URLSearchParams({ key: this.apiKey, ...params });
    const fullUrl = `${url}?${searchParams}`;
    let res: Response;
    try {
      res = await globalThis.fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
        redirect: 'error',
      });
    } catch (err: any) {
      if (err?.message?.includes('redirect')) {
        throw new Error('Shodan API error: unexpected redirect');
      }
      throw new Error('Shodan API error: network request failed');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shodan API error (${res.status}): ${text}`);
    }
    return res.json();
  }

  // ── Host Intelligence ────────────────────────────────────────────

  async hostLookup(ip: string, options?: { history?: boolean; minify?: boolean }): Promise<ShodanHostResult> {
    const params: Record<string, string> = {};
    if (options?.history) params.history = 'true';
    if (options?.minify) params.minify = 'true';
    return this.fetch(`${BASE_URL}/shodan/host/${encodeURIComponent(ip)}`, params);
  }

  // ── Search ───────────────────────────────────────────────────────

  async search(query: string, options?: { facets?: string; page?: number; minify?: boolean }): Promise<ShodanSearchResult> {
    const params: Record<string, string> = { query };
    if (options?.facets) params.facets = options.facets;
    if (options?.page) params.page = String(options.page);
    if (options?.minify) params.minify = 'true';
    return this.fetch(`${BASE_URL}/shodan/host/search`, params);
  }

  async count(query: string, facets?: string): Promise<ShodanCountResult> {
    const params: Record<string, string> = { query };
    if (facets) params.facets = facets;
    return this.fetch(`${BASE_URL}/shodan/host/count`, params);
  }

  async searchTokens(query: string): Promise<ShodanSearchTokensResult> {
    return this.fetch(`${BASE_URL}/shodan/host/search/tokens`, { query });
  }

  async searchFacets(): Promise<string[]> {
    return this.fetch(`${BASE_URL}/shodan/host/search/facets`);
  }

  async searchFilters(): Promise<string[]> {
    return this.fetch(`${BASE_URL}/shodan/host/search/filters`);
  }

  // ── InternetDB (free, no auth) ───────────────────────────────────

  async internetDb(ip: string): Promise<InternetDbResult> {
    return this.fetchNoAuth(`${INTERNETDB_URL}/${encodeURIComponent(ip)}`);
  }

  // ── DNS ──────────────────────────────────────────────────────────

  async dnsResolve(hostnames: string): Promise<Record<string, string>> {
    return this.fetch(`${BASE_URL}/dns/resolve`, { hostnames });
  }

  async dnsReverse(ips: string): Promise<Record<string, string[]>> {
    return this.fetch(`${BASE_URL}/dns/reverse`, { ips });
  }

  async dnsDomain(domain: string, options?: { history?: boolean; type?: string; page?: number }): Promise<ShodanDnsDomainResult> {
    const params: Record<string, string> = {};
    if (options?.history) params.history = 'true';
    if (options?.type) params.type = options.type;
    if (options?.page) params.page = String(options.page);
    return this.fetch(`${BASE_URL}/dns/domain/${encodeURIComponent(domain)}`, params);
  }

  // ── Exploits ─────────────────────────────────────────────────────

  async exploitsSearch(query: string, options?: { type?: string; facets?: string; page?: number }): Promise<ShodanExploitsResult> {
    const params: Record<string, string> = { query };
    if (options?.type) params.type = options.type;
    if (options?.facets) params.facets = options.facets;
    if (options?.page) params.page = String(options.page);
    return this.fetch(`${EXPLOITS_URL}/search`, params);
  }

  // ── Convenience: ports & vulns with InternetDB fallback ──────────

  async ports(ip: string): Promise<{ ports: number[]; source: 'internetdb' | 'shodan' }> {
    try {
      const idb = await this.internetDb(ip);
      if (idb.ports?.length) {
        return { ports: idb.ports, source: 'internetdb' };
      }
    } catch {
      // InternetDB failed, fall through to Shodan
    }
    const result = await this.hostLookup(ip, { minify: true });
    return { ports: result.ports || [], source: 'shodan' };
  }

  async vulns(ip: string): Promise<{ vulns: string[]; source: 'internetdb' | 'shodan' }> {
    try {
      const idb = await this.internetDb(ip);
      if (idb.vulns?.length) {
        return { vulns: idb.vulns, source: 'internetdb' };
      }
    } catch {
      // InternetDB failed, fall through to Shodan
    }
    const result = await this.hostLookup(ip);
    return { vulns: result.vulns || [], source: 'shodan' };
  }

  // ── SSL cert search ──────────────────────────────────────────────

  async sslCert(hostname: string, options?: { minify?: boolean }): Promise<ShodanSearchResult> {
    return this.search(`ssl.cert.subject.cn:${hostname}`, { minify: options?.minify });
  }

  // ── Scanning ─────────────────────────────────────────────────────

  async scan(ips: string): Promise<ShodanScanResult> {
    return this.post(`${BASE_URL}/shodan/scan`, { ips });
  }

  async scanStatus(id: string): Promise<ShodanScanStatusResult> {
    return this.fetch(`${BASE_URL}/shodan/scan/${encodeURIComponent(id)}`);
  }

  // ── Utility ──────────────────────────────────────────────────────

  async honeypotCheck(ip: string): Promise<number> {
    return this.fetch(`${BASE_URL}/labs/honeyscore/${encodeURIComponent(ip)}`);
  }

  async apiInfo(): Promise<ShodanApiInfo> {
    return this.fetch(`${BASE_URL}/api-info`);
  }
}
