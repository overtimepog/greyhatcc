import * as https from 'node:https';
import { loadConfig } from '../../shared/config.js';
import { RateLimiter } from './rate-limiter.js';
import type {
  H1PaginatedResponse,
  H1Program,
  H1StructuredScope,
  H1Weakness,
  H1Earning,
  H1Report,
  ParsedProgram,
  ParsedScope,
  ParsedHacktivityItem,
  ParsedWeakness,
  ParsedEarning,
  ParsedReport,
  DupeCheckResult,
  ScopeSummary,
  BountyTable,
  AuthStatus,
} from './types.js';

// ── HTTP response type ───────────────────────────────────────────────

interface ApiResponse {
  status: number;
  body: string;
}

// ── HackerOne API Client ─────────────────────────────────────────────

export class HackerOneClient {
  private baseUrl = 'https://api.hackerone.com/v1';
  private username: string;
  private apiToken: string;
  private rateLimiter: RateLimiter;

  constructor(username?: string, apiToken?: string) {
    const config = loadConfig();
    this.username = username || config.hackerone?.username || process.env.H1_USERNAME || '';
    this.apiToken = apiToken || config.hackerone?.apiToken || process.env.H1_API_TOKEN || '';
    this.rateLimiter = new RateLimiter(10, 8);
  }

  // ── Auth helpers ─────────────────────────────────────────────────

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');
  }

  get isConfigured(): boolean {
    return !!(this.username && this.apiToken);
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'HackerOne API credentials not configured. ' +
        'Set H1_USERNAME and H1_API_TOKEN environment variables, or configure ' +
        'hackerone.username and hackerone.apiToken in your greyhatcc config file ' +
        '(.greyhatcc/config.json or $CLAUDE_PLUGIN_ROOT/config/greyhatcc.json).'
      );
    }
  }

  // ── Core HTTP (node:https) ───────────────────────────────────────

  private doRequest(
    url: string,
    options: { method?: string; timeout?: number; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse> {
    const { method = 'GET', timeout = 30000, headers = {} } = options;

    return new Promise((resolve, reject) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        reject(new Error(`Invalid URL: ${url}`));
        return;
      }

      // SSRF protection: only allow requests to the HackerOne API host
      const ALLOWED_HOSTS = new Set(['api.hackerone.com']);
      if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        reject(new Error(`Request blocked: hostname "${parsed.hostname}" is not an allowed HackerOne API host`));
        return;
      }

      const reqOptions: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'greyhatcc-hackerone/1.0.0',
          ...headers,
        },
        timeout,
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;
        const maxBody = 5 * 1024 * 1024; // 5MB limit

        res.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > maxBody) {
            req.destroy();
            reject(new Error(`Response body exceeded ${maxBody} byte limit`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });

        res.on('error', (err) =>
          reject(new Error(`Response error: ${err.message}`)),
        );
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms: ${url}`));
      });

      req.on('error', (err: Error) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      req.end();
    });
  }

  private async apiFetch(
    path: string,
    params: Record<string, string> = {},
    maxRetries = 2,
  ): Promise<any> {
    this.assertConfigured();
    await this.rateLimiter.acquire();

    const searchParams = new URLSearchParams(params);
    const separator = path.includes('?') ? '&' : '?';
    const paramStr = searchParams.toString();
    const url = `${this.baseUrl}${path}${paramStr ? separator + paramStr : ''}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.doRequest(url, {
          headers: {
            Authorization: this.authHeader,
          },
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error(
            `HackerOne API authentication failed (HTTP ${res.status}). ` +
            'Verify your H1_USERNAME and H1_API_TOKEN are correct.'
          );
        }

        if (res.status === 404) {
          throw new Error(`HackerOne API resource not found (HTTP 404): ${path}`);
        }

        if (res.status === 429) {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          throw new Error('HackerOne API rate limit exceeded. Try again in a minute.');
        }

        if (res.status >= 400) {
          let errorDetail = '';
          try {
            const errBody = JSON.parse(res.body);
            errorDetail = errBody.errors?.[0]?.detail || errBody.message || res.body.slice(0, 500);
          } catch {
            errorDetail = res.body.slice(0, 500);
          }
          throw new Error(`HackerOne API error (HTTP ${res.status}): ${errorDetail}`);
        }

        return JSON.parse(res.body);
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('authentication failed') || err.message?.includes('not found')) {
          throw err;
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)));
        }
      }
    }

    throw lastError || new Error(`HackerOne API request failed after ${maxRetries + 1} attempts`);
  }

  // ── Response parsers ─────────────────────────────────────────────

  private parseProgram(resource: H1Program): ParsedProgram {
    const a = resource.attributes;
    return {
      id: resource.id,
      handle: a.handle,
      name: a.name || a.profile?.name || a.handle,
      offers_bounties: a.offers_bounties ?? false,
      state: a.state,
      submission_state: a.submission_state,
      currency: a.currency || 'usd',
      policy: a.policy ?? null,
      bookmarked: a.bookmarked ?? false,
      open_scope: a.open_scope ?? false,
      fast_payments: a.fast_payments ?? false,
      gold_standard_safe_harbor: a.gold_standard_safe_harbor ?? false,
      allows_bounty_splitting: a.allows_bounty_splitting ?? false,
      number_of_reports_for_user: a.number_of_reports_for_user ?? null,
      bounty_earned_for_user: a.bounty_earned_for_user ?? null,
      started_accepting_at: a.started_accepting_at ?? null,
      response_efficiency_percentage: a.response_efficiency_percentage ?? null,
      average_time_to_first_response: a.average_time_to_first_program_response ?? null,
      average_time_to_bounty_awarded: a.average_time_to_bounty_awarded ?? null,
      average_time_to_resolved: a.average_time_to_report_resolved ?? null,
      minimum_bounty: a.minimum_bounty_table_value ?? null,
      maximum_bounty: a.maximum_bounty_table_value ?? null,
      total_bounties_paid: a.total_bounties_paid ?? null,
      resolved_report_count: a.resolved_report_count ?? null,
      allows_disclosure: a.allows_disclosure ?? false,
      website: a.website || a.profile?.website || null,
      about: a.about || a.profile?.about || null,
    };
  }

  private parseScope(resource: H1StructuredScope): ParsedScope {
    const a = resource.attributes;
    return {
      asset_identifier: a.asset_identifier,
      asset_type: a.asset_type,
      eligible_for_bounty: a.eligible_for_bounty,
      eligible_for_submission: a.eligible_for_submission,
      max_severity: a.max_severity,
      instruction: a.instruction,
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  }

  private parseWeakness(resource: H1Weakness): ParsedWeakness {
    const a = resource.attributes;
    return {
      id: resource.id,
      name: a.name,
      description: a.description,
      external_id: a.external_id,
      created_at: a.created_at,
    };
  }

  private parseEarning(resource: H1Earning): ParsedEarning {
    const a = resource.attributes;
    return {
      amount: a.amount,
      bonus_amount: a.bonus_amount,
      awarded_at: a.awarded_at,
      currency: a.awarded_currency,
    };
  }

  private parseReport(resource: H1Report): ParsedReport {
    const a = resource.attributes;
    return {
      id: resource.id,
      title: a.title,
      state: a.state,
      substate: a.substate,
      severity_rating: a.severity_rating,
      created_at: a.created_at,
      disclosed_at: a.disclosed_at,
      url: a.url,
      cve_ids: a.cve_ids || [],
    };
  }

  // ── Pagination helper ────────────────────────────────────────────

  private paginationParams(page?: number, pageSize?: number): Record<string, string> {
    const params: Record<string, string> = {};
    if (page && page > 0) params['page[number]'] = String(page);
    if (pageSize && pageSize > 0) params['page[size]'] = String(Math.min(pageSize, 100));
    return params;
  }

  // ── Validation ───────────────────────────────────────────────────

  private validateHandle(handle: string): void {
    if (!handle || !/^[a-zA-Z0-9_-]+$/.test(handle)) {
      throw new Error(`Invalid program handle: ${handle}`);
    }
  }

  // ── Public API methods ───────────────────────────────────────────

  /**
   * List HackerOne programs accessible to the authenticated hacker.
   * GET /hackers/programs
   */
  async listPrograms(
    page?: number,
    pageSize?: number,
  ): Promise<{ programs: ParsedProgram[]; pagination: { page: number; page_size: number; total: number | null } }> {
    const params = this.paginationParams(page || 1, pageSize || 25);
    const response: H1PaginatedResponse<H1Program> = await this.apiFetch(
      '/hackers/programs',
      params,
    );

    return {
      programs: (response.data || []).map((p) => this.parseProgram(p)),
      pagination: {
        page: page || 1,
        page_size: pageSize || 25,
        total: response.meta?.total_count ?? null,
      },
    };
  }

  /**
   * Get detailed info about a specific program by handle.
   * GET /hackers/programs/{handle}
   */
  async getProgram(handle: string): Promise<ParsedProgram> {
    this.validateHandle(handle);

    const response = await this.apiFetch(
      `/hackers/programs/${encodeURIComponent(handle)}`,
    );

    // Single-resource endpoint returns resource directly (no data wrapper)
    const resource = response.data ?? response;

    if (!resource?.attributes) {
      throw new Error(
        `Program "${handle}" not found or not accessible with current credentials. ` +
        'Verify the handle is correct and your H1 account has access.'
      );
    }

    return this.parseProgram(resource as H1Program);
  }

  /**
   * Get structured scope assets for a program.
   * GET /hackers/programs/{handle}/structured_scopes
   */
  async getStructuredScopes(
    handle: string,
    page?: number,
    pageSize?: number,
  ): Promise<{ scopes: ParsedScope[]; pagination: { page: number; page_size: number; total: number | null } }> {
    this.validateHandle(handle);

    const params = this.paginationParams(page || 1, pageSize || 100);
    const response: H1PaginatedResponse<H1StructuredScope> = await this.apiFetch(
      `/hackers/programs/${encodeURIComponent(handle)}/structured_scopes`,
      params,
    );

    return {
      scopes: (response.data || []).map((s) => this.parseScope(s)),
      pagination: {
        page: page || 1,
        page_size: pageSize || 100,
        total: response.meta?.total_count ?? null,
      },
    };
  }

  /**
   * Fetch hacktivity for a program.
   * GET /hackers/hacktivity
   * Uses queryString param with Apache Lucene syntax.
   */
  async getHacktivity(
    handle: string,
    page?: number,
    pageSize?: number,
    disclosedOnly?: boolean,
  ): Promise<{ items: ParsedHacktivityItem[]; pagination: { page: number; page_size: number } }> {
    this.validateHandle(handle);

    let queryString = `team_handle:${handle}`;
    if (disclosedOnly) {
      queryString += ' AND disclosed:true';
    }

    const params: Record<string, string> = {
      'queryString': queryString,
      ...this.paginationParams(page || 1, pageSize || 25),
    };

    const response: H1PaginatedResponse<any> = await this.apiFetch(
      '/hackers/hacktivity',
      params,
    );

    const items: ParsedHacktivityItem[] = (response.data || []).map((item: any) => {
      const a = item.attributes || {};
      // Reporter username is inline in relationships.reporter.data.attributes
      const reporter = item.relationships?.reporter?.data;
      const reporterUsername = reporter?.attributes?.username || null;
      // Program info is inline in relationships.program.data.attributes
      const program = item.relationships?.program?.data;
      const programHandle = program?.attributes?.handle || null;
      // Hacktivity summary from report_generated_content
      const genContent = item.relationships?.report_generated_content?.data;
      const summary = genContent?.attributes?.hacktivity_summary || null;

      return {
        id: String(item.id),
        title: a.title || null,
        substate: a.substate || null,
        url: a.url || null,
        disclosed_at: a.disclosed_at || null,
        cve_ids: a.cve_ids || [],
        cwe: a.cwe || null,
        severity_rating: a.severity_rating || null,
        votes: a.votes ?? 0,
        total_awarded_amount: a.total_awarded_amount != null ? String(a.total_awarded_amount) : null,
        submitted_at: a.submitted_at || null,
        disclosed: a.disclosed ?? false,
        reporter_username: reporterUsername,
        latest_activity: a.latest_disclosable_action || null,
        latest_activity_at: a.latest_disclosable_activity_at || null,
        program_handle: programHandle,
        summary: summary,
      } as ParsedHacktivityItem;
    });

    return {
      items,
      pagination: {
        page: page || 1,
        page_size: pageSize || 25,
      },
    };
  }

  /**
   * Get earnings history for the authenticated hacker.
   * GET /hackers/payments/earnings
   */
  async getEarnings(
    page?: number,
    pageSize?: number,
  ): Promise<{ earnings: ParsedEarning[]; pagination: { page: number; page_size: number; total: number | null } }> {
    const params = this.paginationParams(page || 1, pageSize || 25);
    const response: H1PaginatedResponse<H1Earning> = await this.apiFetch(
      '/hackers/payments/earnings',
      params,
    );

    return {
      earnings: (response.data || []).map((e) => this.parseEarning(e)),
      pagination: {
        page: page || 1,
        page_size: pageSize || 25,
        total: response.meta?.total_count ?? null,
      },
    };
  }

  /**
   * Get account balance.
   * GET /hackers/payments/balance
   */
  async getBalance(): Promise<any> {
    return this.apiFetch('/hackers/payments/balance');
  }

  /**
   * Get payout history.
   * GET /hackers/payments/payouts
   */
  async getPayouts(
    page?: number,
    pageSize?: number,
  ): Promise<any> {
    const params = this.paginationParams(page || 1, pageSize || 25);
    return this.apiFetch('/hackers/payments/payouts', params);
  }

  /**
   * List the authenticated hacker's submitted reports.
   * GET /hackers/me/reports
   */
  async getMyReports(
    page?: number,
    pageSize?: number,
  ): Promise<{ reports: ParsedReport[]; pagination: { page: number; page_size: number; total: number | null } }> {
    const params = this.paginationParams(page || 1, pageSize || 25);
    const response: H1PaginatedResponse<H1Report> = await this.apiFetch(
      '/hackers/me/reports',
      params,
    );

    return {
      reports: (response.data || []).map((r) => this.parseReport(r)),
      pagination: {
        page: page || 1,
        page_size: pageSize || 25,
        total: response.meta?.total_count ?? null,
      },
    };
  }

  /**
   * Get a specific report by ID.
   * GET /hackers/reports/{id}
   */
  async getReport(id: string): Promise<ParsedReport> {
    if (!id || !/^\d+$/.test(id)) {
      throw new Error(`Invalid report ID: ${id}`);
    }

    const response = await this.apiFetch(
      `/hackers/reports/${id}`,
    );

    // Single-resource endpoint may return resource directly (no data wrapper)
    const resource = response.data ?? response;

    if (!resource?.attributes) {
      throw new Error(`Report ${id} not found or not accessible.`);
    }

    return this.parseReport(resource as H1Report);
  }

  /**
   * Get weakness types accepted by a program.
   * GET /hackers/programs/{handle}/weaknesses
   */
  async getWeaknesses(
    handle: string,
    page?: number,
    pageSize?: number,
  ): Promise<{ weaknesses: ParsedWeakness[]; pagination: { page: number; page_size: number; total: number | null } }> {
    this.validateHandle(handle);

    const params = this.paginationParams(page || 1, pageSize || 100);
    const response: H1PaginatedResponse<H1Weakness> = await this.apiFetch(
      `/hackers/programs/${encodeURIComponent(handle)}/weaknesses`,
      params,
    );

    return {
      weaknesses: (response.data || []).map((w) => this.parseWeakness(w)),
      pagination: {
        page: page || 1,
        page_size: pageSize || 100,
        total: response.meta?.total_count ?? null,
      },
    };
  }

  // ── Composite / smart methods ────────────────────────────────────

  /**
   * Get a concise scope summary combining program detail + structured scopes.
   */
  async getScopeSummary(handle: string): Promise<ScopeSummary> {
    const program = await this.getProgram(handle);
    const { scopes } = await this.getStructuredScopes(handle, 1, 100);

    const inScope = scopes.filter((s) => s.eligible_for_submission);
    const outOfScope = scopes.filter((s) => !s.eligible_for_submission);

    return {
      handle,
      program_name: program.name,
      state: program.state,
      in_scope_count: inScope.length,
      out_of_scope_count: outOfScope.length,
      in_scope: inScope.map((s) => ({
        asset: s.asset_identifier,
        type: s.asset_type,
        bounty_eligible: s.eligible_for_bounty,
        max_severity: s.max_severity,
        instruction: s.instruction,
      })),
      out_of_scope: outOfScope.map((s) => ({
        asset: s.asset_identifier,
        type: s.asset_type,
      })),
      bounty_range: {
        minimum: program.minimum_bounty,
        maximum: program.maximum_bounty,
      },
      offers_bounties: program.offers_bounties,
      allows_disclosure: program.allows_disclosure,
    };
  }

  /**
   * Check if a vulnerability has likely been reported before (dupe detection).
   * Uses GET /hackers/hacktivity to search for similar findings.
   */
  async dupeCheck(
    handle: string,
    vulnType: string,
    asset?: string,
  ): Promise<DupeCheckResult> {
    const allItems: ParsedHacktivityItem[] = [];
    let partialWarning = '';
    for (let page = 1; page <= 3; page++) {
      try {
        const { items } = await this.getHacktivity(handle, page, 100, true);
        allItems.push(...items);
        if (items.length < 100) break;
      } catch (err: any) {
        if (page === 1) throw err;
        partialWarning = `Analysis incomplete: only checked ${allItems.length} items (page ${page} failed: ${err.message})`;
        break;
      }
    }

    const vulnTypeLower = vulnType.toLowerCase();
    const assetLower = asset?.toLowerCase() || '';

    const vulnAliases: Record<string, string[]> = {
      xss: ['xss', 'cross-site scripting', 'cross site scripting', 'script injection', 'reflected', 'stored xss', 'dom xss'],
      sqli: ['sql injection', 'sqli', 'sql', 'blind sql', 'error-based sql'],
      ssrf: ['ssrf', 'server-side request forgery', 'server side request forgery'],
      idor: ['idor', 'insecure direct object', 'broken access control', 'authorization bypass', 'bac'],
      rce: ['rce', 'remote code execution', 'command injection', 'code execution', 'os command'],
      csrf: ['csrf', 'cross-site request forgery', 'cross site request forgery'],
      lfi: ['lfi', 'local file inclusion', 'path traversal', 'directory traversal', 'file read'],
      open_redirect: ['open redirect', 'redirect', 'url redirect', 'open redirection'],
      xxe: ['xxe', 'xml external entity', 'xml injection'],
      ssti: ['ssti', 'server-side template injection', 'template injection'],
      race_condition: ['race condition', 'toctou', 'time of check'],
      info_disclosure: ['information disclosure', 'info disclosure', 'sensitive data', 'data exposure', 'data leak'],
      auth_bypass: ['authentication bypass', 'auth bypass', 'login bypass', '2fa bypass', 'mfa bypass'],
      privilege_escalation: ['privilege escalation', 'privesc', 'unauthorized access', 'role escalation'],
      account_takeover: ['account takeover', 'ato', 'password reset', 'session hijack'],
    };

    let searchTerms: string[] = [vulnTypeLower];
    for (const [, aliases] of Object.entries(vulnAliases)) {
      if (aliases.some((alias) => vulnTypeLower.includes(alias) || alias.includes(vulnTypeLower))) {
        searchTerms = [...new Set([...searchTerms, ...aliases])];
        break;
      }
    }

    const matchingItems: DupeCheckResult['matching_activities'] = [];

    for (const item of allItems) {
      const titleLower = (item.title || '').toLowerCase();
      const cweLower = (item.cwe || '').toLowerCase();

      let matchReason = '';

      const titleMatch = searchTerms.some((term) => titleLower.includes(term));
      if (titleMatch) {
        matchReason = 'Title matches vulnerability type';
      }

      const cweMatch = searchTerms.some((term) => cweLower.includes(term));
      if (cweMatch && !matchReason) {
        matchReason = 'CWE matches vulnerability category';
      }

      if (assetLower && titleLower.includes(assetLower)) {
        matchReason = matchReason
          ? `${matchReason} + asset match`
          : 'Asset/endpoint mentioned in report title';
      }

      if (matchReason) {
        matchingItems.push({
          title: item.title,
          severity: item.severity_rating,
          date: item.disclosed_at || item.submitted_at,
          match_reason: matchReason,
        });
      }
    }

    const totalChecked = allItems.length;
    let riskScore = 0;

    if (matchingItems.length > 0) {
      riskScore = Math.min(matchingItems.length * 20, 60);

      const assetMatches = matchingItems.filter((m) =>
        m.match_reason.includes('asset match'),
      ).length;
      riskScore += assetMatches * 25;

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentMatches = matchingItems.filter((m) => {
        try {
          return m.date ? new Date(m.date) > ninetyDaysAgo : false;
        } catch {
          return false;
        }
      }).length;
      riskScore += recentMatches * 10;

      riskScore = Math.min(riskScore, 100);
    }

    let risk: DupeCheckResult['risk'];
    let recommendation: string;

    if (riskScore >= 70) {
      risk = 'HIGH';
      recommendation =
        'High probability of duplicate. This vulnerability type has been reported multiple times on this program. ' +
        'Consider finding a unique variant, different endpoint, or chaining with another bug for higher impact.';
    } else if (riskScore >= 30) {
      risk = 'MEDIUM';
      recommendation =
        'Moderate dupe risk. Similar vulnerabilities have been reported. ' +
        'Ensure your finding is on a different asset or has a unique exploitation path. Include detailed PoC.';
    } else if (riskScore > 0) {
      risk = 'LOW';
      recommendation =
        'Low dupe risk. Some loosely related reports exist but your specific finding appears relatively novel. ' +
        'Proceed with a thorough report and clear reproduction steps.';
    } else {
      risk = 'CLEAR';
      recommendation =
        'No matching reports found in recent hacktivity. This appears to be a novel finding. ' +
        'Note: private/undisclosed reports are not visible, so some dupe risk always remains.';
    }

    return {
      handle,
      vuln_type: vulnType,
      asset: asset || null,
      risk,
      risk_score: riskScore,
      matching_activities: matchingItems.slice(0, 10),
      total_activities_checked: totalChecked,
      recommendation,
      ...(partialWarning ? { warning: partialWarning } : {}),
    };
  }

  /**
   * Get the bounty table for a program.
   */
  async getBountyTable(handle: string): Promise<BountyTable> {
    const program = await this.getProgram(handle);

    let note = '';
    if (!program.offers_bounties) {
      note = 'This program does NOT offer monetary bounties. It may be a VDP (Vulnerability Disclosure Program).';
    } else if (program.minimum_bounty && program.maximum_bounty) {
      note = `Bounties range from $${program.minimum_bounty} to $${program.maximum_bounty}.`;
    } else if (program.maximum_bounty) {
      note = `Maximum bounty is $${program.maximum_bounty}.`;
    } else {
      note = 'Bounty amounts not publicly specified. Check program policy for details.';
    }

    return {
      handle,
      program_name: program.name,
      offers_bounties: program.offers_bounties,
      minimum_bounty: program.minimum_bounty,
      maximum_bounty: program.maximum_bounty,
      total_paid: program.total_bounties_paid,
      currency: program.currency || 'USD',
      note,
    };
  }

  /**
   * Get the full policy text for a program.
   */
  async getProgramPolicy(handle: string): Promise<{ handle: string; program_name: string; policy: string | null; allows_disclosure: boolean; state: string }> {
    const program = await this.getProgram(handle);

    return {
      handle,
      program_name: program.name,
      policy: program.policy,
      allows_disclosure: program.allows_disclosure,
      state: program.state,
    };
  }

  /**
   * Check API authentication status.
   */
  async checkAuth(): Promise<AuthStatus> {
    if (!this.isConfigured) {
      return {
        authenticated: false,
        username: '',
        programs_accessible: 0,
        message:
          'HackerOne API credentials not configured. ' +
          'Set H1_USERNAME and H1_API_TOKEN environment variables, or configure ' +
          'hackerone.username and hackerone.apiToken in your greyhatcc config file.',
      };
    }

    try {
      const response: H1PaginatedResponse<H1Program> = await this.apiFetch(
        '/hackers/programs',
        { 'page[size]': '1' },
      );

      const total = response.meta?.total_count ?? response.data?.length ?? 0;

      return {
        authenticated: true,
        username: this.username,
        programs_accessible: total,
        message: `Authenticated as "${this.username}". Access to ${total} program(s).`,
      };
    } catch (err: any) {
      return {
        authenticated: false,
        username: this.username,
        programs_accessible: 0,
        message: `Authentication failed: ${err.message}`,
      };
    }
  }
}
