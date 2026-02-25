import type {
  ShodanHostResult,
  ShodanSearchResult,
  ShodanCountResult,
  InternetDbResult,
  ShodanDnsDomainResult,
  ShodanExploitsResult,
  ShodanApiInfo,
  ShodanBanner,
  ShodanFacetEntry,
} from '../../shared/types.js';

const MAX_OUTPUT_CHARS = 50_000;

// ── Output size guard ────────────────────────────────────────────────

export function guardOutputSize(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  const truncated = text.slice(0, MAX_OUTPUT_CHARS);
  const lastNewline = truncated.lastIndexOf('\n');
  const cleanCut = lastNewline > MAX_OUTPUT_CHARS * 0.8 ? truncated.slice(0, lastNewline) : truncated;
  return (
    cleanCut +
    '\n\n--- OUTPUT TRUNCATED ---\n' +
    `Response was ${text.length.toLocaleString()} chars (limit: ${MAX_OUTPUT_CHARS.toLocaleString()}).\n` +
    'Use `limit`, `fields`, `summary`, or `minify` parameters to reduce output size.'
  );
}

// ── Field selection ──────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function selectFields(data: any, fields: string): any {
  const fieldList = fields.split(',').map((f) => f.trim()).filter(Boolean);
  if (fieldList.length === 0) return data;

  if (Array.isArray(data)) {
    return data.map((item) => selectFieldsFromObject(item, fieldList));
  }
  return selectFieldsFromObject(data, fieldList);
}

function selectFieldsFromObject(obj: any, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of fields) {
    const value = getNestedValue(obj, field);
    if (value !== undefined) {
      result[field] = value;
    }
  }
  return result;
}

// ── Result limiting ──────────────────────────────────────────────────

export function limitResults(data: any, limit: number): any {
  if (Array.isArray(data)) {
    return data.slice(0, limit);
  }
  if (data && Array.isArray(data.matches)) {
    return { ...data, matches: data.matches.slice(0, limit) };
  }
  if (data && Array.isArray(data.data)) {
    return { ...data, data: data.data.slice(0, limit) };
  }
  return data;
}

// ── Facet formatting helper ──────────────────────────────────────────

function formatFacets(facets: Record<string, ShodanFacetEntry[]> | undefined): string {
  if (!facets || Object.keys(facets).length === 0) return '';
  let out = '\n### Facets\n';
  for (const [name, entries] of Object.entries(facets)) {
    out += `\n**${name}**\n`;
    out += '| Value | Count |\n|-------|-------|\n';
    for (const entry of entries) {
      out += `| ${entry.value} | ${entry.count.toLocaleString()} |\n`;
    }
  }
  return out;
}

// ── Host summary ─────────────────────────────────────────────────────

export function formatHostSummary(host: ShodanHostResult): string {
  const lines: string[] = [];
  lines.push(`## Host: ${host.ip_str}`);
  lines.push('');

  const meta: string[] = [];
  if (host.org) meta.push(`**Org:** ${host.org}`);
  if (host.isp && host.isp !== host.org) meta.push(`**ISP:** ${host.isp}`);
  if (host.asn) meta.push(`**ASN:** ${host.asn}`);
  if (host.os) meta.push(`**OS:** ${host.os}`);
  if (host.country_name) meta.push(`**Location:** ${host.city || ''}${host.city ? ', ' : ''}${host.country_name}`);
  if (host.hostnames?.length) meta.push(`**Hostnames:** ${host.hostnames.join(', ')}`);
  if (host.tags?.length) meta.push(`**Tags:** ${host.tags.join(', ')}`);
  if (host.last_update) meta.push(`**Last updated:** ${host.last_update}`);
  lines.push(meta.join(' | '));
  lines.push('');

  // Ports & services table
  if (host.data?.length) {
    lines.push('### Services');
    lines.push('| Port | Proto | Product | Version | Banner |');
    lines.push('|------|-------|---------|---------|--------|');
    for (const svc of host.data) {
      const banner = (svc.banner || '').replace(/\n/g, ' ').slice(0, 80);
      lines.push(
        `| ${svc.port} | ${svc.transport} | ${svc.product || '-'} | ${svc.version || '-'} | ${banner || '-'} |`,
      );
    }
    lines.push('');
  } else {
    lines.push(`**Ports:** ${host.ports?.join(', ') || 'none'}`);
    lines.push('');
  }

  // Vulnerabilities
  if (host.vulns?.length) {
    lines.push(`### Vulnerabilities (${host.vulns.length})`);
    lines.push(host.vulns.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

// ── Search summary ───────────────────────────────────────────────────

export function formatSearchSummary(result: ShodanSearchResult): string {
  const lines: string[] = [];
  lines.push(`## Search Results (${result.total.toLocaleString()} total)`);
  lines.push('');

  if (result.matches?.length) {
    lines.push(`Showing ${result.matches.length} of ${result.total.toLocaleString()} results:`);
    lines.push('');
    lines.push('| IP | Port | Org | Product | Title/Banner |');
    lines.push('|----|------|-----|---------|-------------|');
    for (const m of result.matches) {
      const title = m.http?.title || (m.banner || '').replace(/\n/g, ' ').slice(0, 60) || '-';
      lines.push(
        `| ${m.ip_str || '-'} | ${m.port} | ${m.org || '-'} | ${m.product || '-'} | ${title} |`,
      );
    }
    lines.push('');
  }

  lines.push(formatFacets(result.facets));
  return lines.join('\n');
}

// ── Count summary ────────────────────────────────────────────────────

export function formatCountSummary(result: ShodanCountResult): string {
  const lines: string[] = [];
  lines.push(`## Count: ${result.total.toLocaleString()} results`);
  lines.push(formatFacets(result.facets));
  return lines.join('\n');
}

// ── InternetDB summary ──────────────────────────────────────────────

export function formatInternetDbSummary(result: InternetDbResult): string {
  const lines: string[] = [];
  lines.push(`## InternetDB: ${result.ip}`);
  lines.push('');
  if (result.hostnames?.length) lines.push(`**Hostnames:** ${result.hostnames.join(', ')}`);
  if (result.ports?.length) lines.push(`**Ports:** ${result.ports.join(', ')}`);
  if (result.tags?.length) lines.push(`**Tags:** ${result.tags.join(', ')}`);
  if (result.cpes?.length) {
    lines.push('');
    lines.push('### CPEs');
    for (const cpe of result.cpes) lines.push(`- ${cpe}`);
  }
  if (result.vulns?.length) {
    lines.push('');
    lines.push(`### Vulnerabilities (${result.vulns.length})`);
    lines.push(result.vulns.join(', '));
  }
  if (!result.ports?.length && !result.vulns?.length && !result.hostnames?.length) {
    lines.push('*No data available for this IP in InternetDB.*');
  }
  lines.push('');
  return lines.join('\n');
}

// ── DNS Domain summary ──────────────────────────────────────────────

export function formatDnsDomainSummary(result: ShodanDnsDomainResult): string {
  const lines: string[] = [];
  lines.push(`## DNS: ${result.domain}`);
  lines.push('');
  if (result.tags?.length) lines.push(`**Tags:** ${result.tags.join(', ')}`);
  if (result.subdomains?.length) {
    lines.push(`**Subdomains found:** ${result.subdomains.length}${result.more ? '+' : ''}`);
    lines.push('');
    lines.push('### Subdomains');
    for (const sub of result.subdomains) {
      lines.push(`- ${sub}.${result.domain}`);
    }
    lines.push('');
  }
  if (result.data?.length) {
    lines.push('### DNS Records');
    lines.push('| Subdomain | Type | Value |');
    lines.push('|-----------|------|-------|');
    for (const rec of result.data.slice(0, 100)) {
      const sub = rec.subdomain || '@';
      lines.push(`| ${sub} | ${rec.type} | ${rec.value} |`);
    }
    if (result.data.length > 100) {
      lines.push(`| ... | ... | *(${result.data.length - 100} more records)* |`);
    }
    lines.push('');
  }
  if (result.more) lines.push('*More results available — use `page` parameter.*');
  return lines.join('\n');
}

// ── Exploits summary ────────────────────────────────────────────────

export function formatExploitsSummary(result: ShodanExploitsResult): string {
  const lines: string[] = [];
  lines.push(`## Exploits (${result.total.toLocaleString()} total)`);
  lines.push('');

  if (result.matches?.length) {
    lines.push(`Showing ${result.matches.length} results:`);
    lines.push('');
    lines.push('| Source | Type | Platform | CVEs | Description |');
    lines.push('|--------|------|----------|------|-------------|');
    for (const e of result.matches) {
      const desc = (e.description || '').replace(/\n/g, ' ').slice(0, 80);
      const cves = e.cve?.join(', ') || '-';
      lines.push(
        `| ${e.source || '-'} | ${e.type || '-'} | ${e.platform || '-'} | ${cves} | ${desc || '-'} |`,
      );
    }
    lines.push('');
  }

  lines.push(formatFacets(result.facets));
  return lines.join('\n');
}

// ── API Info summary ─────────────────────────────────────────────────

export function formatApiInfoSummary(info: ShodanApiInfo): string {
  const lines: string[] = [];
  lines.push('## Shodan API Info');
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Plan | ${info.plan} |`);
  lines.push(`| Query Credits | ${info.query_credits} / ${info.usage_limits?.query_credits ?? '?'} |`);
  lines.push(`| Scan Credits | ${info.scan_credits} / ${info.usage_limits?.scan_credits ?? '?'} |`);
  lines.push(`| Monitored IPs | ${info.monitored_ips} / ${info.usage_limits?.monitored_ips ?? '?'} |`);
  lines.push(`| HTTPS | ${info.https} |`);
  lines.push(`| Unlocked | ${info.unlocked} (${info.unlocked_left} left) |`);
  lines.push('');
  return lines.join('\n');
}

// ── Generic output pipeline ─────────────────────────────────────────

export interface FormatOptions {
  fields?: string;
  limit?: number;
  summary?: boolean;
  summaryFormatter?: (data: any) => string;
}

export function formatOutput(data: any, options: FormatOptions): string {
  let result = data;

  // Apply limit first
  if (options.limit != null) {
    result = limitResults(result, options.limit);
  }

  // Summary mode
  if (options.summary && options.summaryFormatter) {
    const text = options.summaryFormatter(result);
    return guardOutputSize(text);
  }

  // Field selection
  if (options.fields) {
    // For search results, apply to matches array
    if (result && Array.isArray(result.matches)) {
      result = { ...result, matches: selectFields(result.matches, options.fields) };
    } else if (result && Array.isArray(result.data)) {
      result = { ...result, data: selectFields(result.data, options.fields) };
    } else {
      result = selectFields(result, options.fields);
    }
  }

  const text = JSON.stringify(result, null, 2);
  return guardOutputSize(text);
}
