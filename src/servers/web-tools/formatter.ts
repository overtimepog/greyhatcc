import type { SessionInfo, TrafficEntry, FuzzResult } from './types.js';

const MAX_OUTPUT_CHARS = 50_000;

// ── Output size guard ────────────────────────────────────────────────

export function guardOutputSize(text: string, maxChars?: number): string {
  const limit = maxChars ?? MAX_OUTPUT_CHARS;
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  const lastNewline = truncated.lastIndexOf('\n');
  const cleanCut = lastNewline > limit * 0.8 ? truncated.slice(0, lastNewline) : truncated;
  return (
    cleanCut +
    '\n\n--- OUTPUT TRUNCATED ---\n' +
    `Response was ${text.length.toLocaleString()} chars (limit: ${limit.toLocaleString()}).\n` +
    'Use pagination, filters, or limit parameters to reduce output size.'
  );
}

// ── Session List Formatting ──────────────────────────────────────────

export function formatSessionList(sessions: SessionInfo[]): string {
  const lines: string[] = [];
  lines.push(`## Sessions (${sessions.length})`);
  lines.push('');

  if (sessions.length === 0) {
    lines.push('No sessions found.');
    lines.push('');
    return guardOutputSize(lines.join('\n'));
  }

  lines.push('| ID | URL | Created | Requests | Intercepting |');
  lines.push('|----|-----|---------|----------|--------------|');
  for (const session of sessions) {
    const intercepting = session.intercepting ? 'Yes' : 'No';
    const created = new Date(session.createdAt).toISOString();
    lines.push(
      `| ${session.id} | ${session.url} | ${created} | ${session.capturedRequests} | ${intercepting} |`,
    );
  }
  lines.push('');

  return guardOutputSize(lines.join('\n'));
}

// ── Traffic Entry Formatting ─────────────────────────────────────────

export function formatTrafficEntry(entry: TrafficEntry): string {
  const lines: string[] = [];
  lines.push(`## Request Details`);
  lines.push('');
  lines.push(`**Timestamp:** ${new Date(entry.timestamp).toISOString()}`);
  lines.push(`**Method:** ${entry.method}`);
  lines.push(`**URL:** ${entry.url}`);
  lines.push('');

  lines.push('### Response');
  lines.push(`**Status:** ${entry.status}`);
  lines.push(`**Content-Type:** ${entry.mimeType || '-'}`);
  const responseLen = entry.responseBody != null ? entry.responseBody.length : null;
  lines.push(`**Length:** ${responseLen != null ? responseLen.toLocaleString() + ' bytes' : '-'}`);
  if (entry.durationMs) {
    lines.push(`**Timing:** ${entry.durationMs}ms`);
  }
  lines.push('');

  lines.push('### Request Headers');
  lines.push('```');
  for (const [key, val] of Object.entries(entry.requestHeaders)) {
    lines.push(`${key}: ${val}`);
  }
  lines.push('```');
  lines.push('');

  if (entry.requestBody) {
    lines.push('### Request Body');
    const bodyPreview = entry.requestBody.length > 500 ? entry.requestBody.slice(0, 500) + '...' : entry.requestBody;
    lines.push('```');
    lines.push(bodyPreview);
    lines.push('```');
    lines.push('');
  }

  if (entry.responseBody) {
    lines.push('### Response Body');
    const bodyPreview = entry.responseBody.length > 500 ? entry.responseBody.slice(0, 500) + '...' : entry.responseBody;
    lines.push('```');
    lines.push(bodyPreview);
    lines.push('```');
    if (entry.responseBodyTruncated) {
      lines.push('*Response body was truncated.*');
    }
    lines.push('');
  }

  return guardOutputSize(lines.join('\n'));
}

// ── Traffic Search Formatting ────────────────────────────────────────

export function formatTrafficSearch(entries: TrafficEntry[], pattern: string): string {
  const lines: string[] = [];
  lines.push(`## Traffic Search Results`);
  lines.push(`Pattern: \`${pattern}\``);
  lines.push(`Found: ${entries.length} matches`);
  lines.push('');

  if (entries.length === 0) {
    lines.push('No matching traffic entries found.');
    lines.push('');
    return guardOutputSize(lines.join('\n'));
  }

  lines.push('| Timestamp | Method | URL | Status | Length | Timing |');
  lines.push('|-----------|--------|-----|--------|--------|--------|');
  for (const entry of entries.slice(0, 100)) {
    const url = entry.url.length > 60 ? entry.url.slice(0, 57) + '...' : entry.url;
    const timing = entry.durationMs ? `${entry.durationMs}ms` : '-';
    const length = entry.responseBody != null ? entry.responseBody.length.toLocaleString() : '-';
    const ts = new Date(entry.timestamp).toISOString();
    lines.push(
      `| ${ts} | ${entry.method} | ${url} | ${entry.status} | ${length} | ${timing} |`,
    );
  }

  if (entries.length > 100) {
    lines.push(`| ... | ... | *(${entries.length - 100} more entries)* | ... | ... | ... |`);
  }
  lines.push('');

  return guardOutputSize(lines.join('\n'));
}

// ── Traffic Export Formatting ────────────────────────────────────────

export function formatTrafficExport(
  entries: TrafficEntry[],
  format: 'json' | 'curl' | 'markdown',
): string {
  if (format === 'json') {
    return guardOutputSize(JSON.stringify(entries, null, 2));
  }

  if (format === 'curl') {
    const lines: string[] = [];
    lines.push(`## cURL Commands (${entries.length} requests)`);
    lines.push('');

    for (const entry of entries) {
      const ts = new Date(entry.timestamp).toISOString();
      lines.push(`# ${ts} - ${entry.method} ${entry.url}`);

      let cmd = `curl -X ${entry.method}`;

      // Add headers
      for (const [key, val] of Object.entries(entry.requestHeaders)) {
        cmd += ` -H '${key}: ${val}'`;
      }

      // Add body if present
      if (entry.requestBody) {
        const bodyEscaped = entry.requestBody.replace(/'/g, "'\"'\"'");
        cmd += ` -d '${bodyEscaped}'`;
      }

      cmd += ` '${entry.url}'`;
      lines.push(cmd);
      lines.push('');
    }

    return guardOutputSize(lines.join('\n'));
  }

  // markdown format
  const lines: string[] = [];
  lines.push(`# Traffic Export`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Requests: ${entries.length}`);
  lines.push('');

  for (const entry of entries) {
    const ts = new Date(entry.timestamp).toISOString();
    lines.push(`## ${entry.method} ${entry.url}`);
    lines.push(`**Status:** ${entry.status}`);
    lines.push(`**Timestamp:** ${ts}`);
    if (entry.durationMs) lines.push(`**Timing:** ${entry.durationMs}ms`);
    lines.push('');
  }

  return guardOutputSize(lines.join('\n'));
}

// ── Fuzz Results Formatting ──────────────────────────────────────────

export function formatFuzzResults(results: FuzzResult[]): string {
  const lines: string[] = [];
  lines.push(`## Fuzz Results (${results.length} total)`);
  lines.push('');

  if (results.length === 0) {
    lines.push('No fuzz results.');
    lines.push('');
    return guardOutputSize(lines.join('\n'));
  }

  // Summary statistics
  const errors = results.filter((r) => r.error != null).length;
  lines.push(`**Errors:** ${errors} | **Successful:** ${results.length - errors}`);
  lines.push('');

  lines.push('| # | Payload | Status | Length | Timing | Error |');
  lines.push('|---|---------|--------|--------|--------|-------|');

  for (const result of results.slice(0, 100)) {
    const payload = result.payload.length > 40 ? result.payload.slice(0, 37) + '...' : result.payload;
    const timing = `${result.durationMs}ms`;
    const error = result.error || '-';
    lines.push(
      `| ${result.index} | ${payload} | ${result.status} | ${result.contentLength.toLocaleString()} | ${timing} | ${error} |`,
    );
  }

  if (results.length > 100) {
    lines.push(`| ... | ... | ... | ... | ... | *(${results.length - 100} more results)* |`);
  }
  lines.push('');

  return guardOutputSize(lines.join('\n'));
}

// ── Form Data Formatting ─────────────────────────────────────────────

export function formatFormData(forms: any[]): string {
  const lines: string[] = [];
  lines.push(`## Extracted Forms (${forms.length})`);
  lines.push('');

  if (forms.length === 0) {
    lines.push('No forms found.');
    lines.push('');
    return guardOutputSize(lines.join('\n'));
  }

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    lines.push(`### Form ${i + 1}`);
    if (form.id) lines.push(`**ID:** ${form.id}`);
    if (form.name) lines.push(`**Name:** ${form.name}`);
    if (form.action) lines.push(`**Action:** ${form.action}`);
    if (form.method) lines.push(`**Method:** ${form.method}`);
    lines.push('');

    if (form.fields && Array.isArray(form.fields)) {
      lines.push('| Name | Type | Value |');
      lines.push('|------|------|-------|');
      for (const field of form.fields) {
        const value = field.value ? String(field.value).slice(0, 40) : '-';
        lines.push(`| ${field.name || '-'} | ${field.type || 'text'} | ${value} |`);
      }
      lines.push('');
    }
  }

  return guardOutputSize(lines.join('\n'));
}

// ── Links Formatting ─────────────────────────────────────────────────

export function formatLinks(links: any): string {
  const lines: string[] = [];

  if (!links || typeof links !== 'object') {
    return guardOutputSize('No links data.');
  }

  let totalLinks = 0;

  // Handle array of links
  if (Array.isArray(links)) {
    lines.push(`## Links (${links.length})`);
    lines.push('');
    for (const link of links.slice(0, 200)) {
      lines.push(`- ${link.href || link}`);
    }
    if (links.length > 200) {
      lines.push(`\n*(${links.length - 200} more links)*`);
    }
    return guardOutputSize(lines.join('\n'));
  }

  // Handle object with categories
  lines.push('## Links by Category');
  lines.push('');

  for (const [category, items] of Object.entries(links)) {
    if (!Array.isArray(items) || items.length === 0) continue;

    totalLinks += items.length;
    lines.push(`### ${category} (${items.length})`);
    for (const item of items.slice(0, 50)) {
      const href = typeof item === 'string' ? item : item.href || item;
      lines.push(`- ${href}`);
    }
    if (items.length > 50) {
      lines.push(`*(${items.length - 50} more ${category})*`);
    }
    lines.push('');
  }

  if (totalLinks === 0) {
    lines.push('No links found.');
  }

  return guardOutputSize(lines.join('\n'));
}
