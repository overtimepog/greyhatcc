import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ShodanClient } from './client.js';
import { SHODAN_TOOLS } from './tools.js';
import { loadConfig } from '../../shared/config.js';
import {
  formatOutput,
  guardOutputSize,
  formatHostSummary,
  formatSearchSummary,
  formatCountSummary,
  formatInternetDbSummary,
  formatDnsDomainSummary,
  formatExploitsSummary,
  formatApiInfoSummary,
} from './formatter.js';

const config = loadConfig();
const apiKey = config.shodan.apiKey;
const client = apiKey ? new ShodanClient(apiKey) : null;

const server = new Server(
  { name: 'greyhatcc-shodan', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: SHODAN_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // InternetDB doesn't need an API key
  const needsKey = name !== 'shodan_internetdb';

  if (needsKey && !client) {
    return {
      content: [{ type: 'text', text: 'ERROR: SHODAN_API_KEY not configured. Set it via environment variable or in .greyhatcc/config.json' }],
      isError: true,
    };
  }

  // For InternetDB without a key, create a temporary client with empty key
  const c = client || new ShodanClient('');

  try {
    let output: string;

    switch (name) {
      // ── Host Intelligence ────────────────────────────────────────
      case 'shodan_host_lookup': {
        const result = await c.hostLookup(args.ip as string, {
          history: args.history as boolean | undefined,
          minify: args.minify as boolean | undefined,
        });
        output = formatOutput(result, {
          fields: args.fields as string | undefined,
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatHostSummary,
        });
        break;
      }

      // ── Search ───────────────────────────────────────────────────
      case 'shodan_search': {
        const limit = Math.min(Math.max((args.limit as number) || 5, 1), 100);
        const result = await c.search(args.query as string, {
          facets: args.facets as string | undefined,
          page: args.page as number | undefined,
          minify: args.minify as boolean | undefined,
        });
        output = formatOutput(result, {
          limit,
          fields: args.fields as string | undefined,
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatSearchSummary,
        });
        break;
      }

      case 'shodan_count': {
        const result = await c.count(args.query as string, args.facets as string | undefined);
        output = formatOutput(result, {
          summary: true, // Always summarize counts — they're small
          summaryFormatter: formatCountSummary,
        });
        break;
      }

      case 'shodan_search_tokens': {
        const result = await c.searchTokens(args.query as string);
        output = guardOutputSize(JSON.stringify(result, null, 2));
        break;
      }

      // ── InternetDB ──────────────────────────────────────────────
      case 'shodan_internetdb': {
        const result = await c.internetDb(args.ip as string);
        output = formatOutput(result, {
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatInternetDbSummary,
        });
        break;
      }

      // ── DNS ──────────────────────────────────────────────────────
      case 'shodan_dns_resolve': {
        const result = await c.dnsResolve(args.hostnames as string);
        output = guardOutputSize(JSON.stringify(result, null, 2));
        break;
      }

      case 'shodan_dns_reverse': {
        const result = await c.dnsReverse(args.ips as string);
        output = guardOutputSize(JSON.stringify(result, null, 2));
        break;
      }

      case 'shodan_dns_domain': {
        const result = await c.dnsDomain(args.domain as string, {
          history: args.history as boolean | undefined,
          type: args.type as string | undefined,
          page: args.page as number | undefined,
        });
        output = formatOutput(result, {
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatDnsDomainSummary,
        });
        break;
      }

      // ── Exploits ─────────────────────────────────────────────────
      case 'shodan_exploits_search': {
        const limit = Math.min(Math.max((args.limit as number) || 10, 1), 100);
        const result = await c.exploitsSearch(args.query as string, {
          type: args.type as string | undefined,
          facets: args.facets as string | undefined,
          page: args.page as number | undefined,
        });
        output = formatOutput(result, {
          limit,
          fields: undefined,
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatExploitsSummary,
        });
        break;
      }

      // ── Convenience: ports & vulns ───────────────────────────────
      case 'shodan_ports': {
        const result = await c.ports(args.ip as string);
        if (args.summary) {
          output = `## Ports for ${args.ip} (source: ${result.source})\n\n${result.ports.join(', ') || 'No open ports found'}`;
        } else {
          output = guardOutputSize(JSON.stringify(result, null, 2));
        }
        break;
      }

      case 'shodan_vulns': {
        const result = await c.vulns(args.ip as string);
        if (args.summary) {
          output = `## Vulnerabilities for ${args.ip} (source: ${result.source})\n\n${result.vulns.length} CVEs: ${result.vulns.join(', ') || 'None found'}`;
        } else {
          output = guardOutputSize(JSON.stringify(result, null, 2));
        }
        break;
      }

      // ── SSL cert search ──────────────────────────────────────────
      case 'shodan_ssl_cert': {
        const limit = Math.min(Math.max((args.limit as number) || 5, 1), 100);
        const result = await c.sslCert(args.hostname as string);
        output = formatOutput(result, {
          limit,
          fields: args.fields as string | undefined,
          summary: args.summary as boolean | undefined,
          summaryFormatter: formatSearchSummary,
        });
        break;
      }

      // ── Scanning ─────────────────────────────────────────────────
      case 'shodan_scan': {
        const result = await c.scan(args.ips as string);
        output = guardOutputSize(JSON.stringify(result, null, 2));
        break;
      }

      case 'shodan_scan_status': {
        const result = await c.scanStatus(args.id as string);
        output = guardOutputSize(JSON.stringify(result, null, 2));
        break;
      }

      // ── Utility ──────────────────────────────────────────────────
      case 'shodan_honeypot_check': {
        const score = await c.honeypotCheck(args.ip as string);
        output = JSON.stringify({ ip: args.ip, honeypot_score: score, is_honeypot: score > 0.5 }, null, 2);
        break;
      }

      case 'shodan_api_info': {
        const result = await c.apiInfo();
        output = formatApiInfoSummary(result);
        break;
      }

      case 'shodan_search_facets': {
        const result = await c.searchFacets();
        output = `## Available Shodan Search Facets\n\n${(result as string[]).join(', ')}`;
        break;
      }

      case 'shodan_search_filters': {
        const result = await c.searchFilters();
        output = `## Available Shodan Search Filters\n\n${(result as string[]).join(', ')}`;
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Shodan error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
