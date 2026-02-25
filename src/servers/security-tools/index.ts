import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SECURITY_TOOLS } from './tools.js';
import { CveClient } from './cve-client.js';
import {
  dnsLookup,
  sslAnalysis,
  httpHeaderAnalysis,
  wafDetect,
  corsCheck,
  techFingerprint,
  subdomainEnum,
  portCheck,
  redirectChain,
  cvssCalculate,
} from './utils.js';
import { loadConfig } from '../../shared/config.js';

const config = loadConfig();
const cveClient = new CveClient(config.nvd.apiKey);

function execFilePromise(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process');
    execFile(command, args, { timeout: 15000, encoding: 'utf-8' }, (error: any, stdout: string, stderr: string) => {
      if (error && !stdout) {
        reject(new Error(error.message));
      } else {
        resolve(stdout || stderr || '');
      }
    });
  });
}

const server = new Server(
  { name: 'greyhatcc-security-tools', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: SECURITY_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'cve_search':
        result = await cveClient.search(args.query as string, args.year as number, args.severity as string);
        break;

      case 'cve_detail':
        result = await cveClient.detail(args.cve_id as string);
        break;

      case 'exploit_db_search':
        result = {
          query: args.query,
          note: 'Use WebSearch with site:exploit-db.com for exploit lookup',
          suggestion: `site:exploit-db.com ${args.query}`,
        };
        break;

      case 'cvss_calculate':
        result = cvssCalculate(args.vector as string);
        break;

      case 'whois_lookup': {
        const whoisTarget = (args.target as string || '').trim();
        const domainOrIpRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!whoisTarget || whoisTarget.startsWith('-') || !domainOrIpRegex.test(whoisTarget)) {
          throw new Error('Invalid whois target: must be a domain name or IPv4 address');
        }
        const output = await execFilePromise('whois', [whoisTarget]);
        result = { target: whoisTarget, raw: output.slice(0, 5000) };
        break;
      }

      case 'dns_records': {
        const types = args.types ? (args.types as string).split(',').map(t => t.trim()) : undefined;
        result = await dnsLookup(args.domain as string, types);
        break;
      }

      case 'header_analysis':
        result = await httpHeaderAnalysis(args.url as string);
        break;

      case 'ssl_analysis':
        result = await sslAnalysis(args.hostname as string, args.port as number);
        break;

      case 'waf_detect':
        result = await wafDetect(args.url as string);
        break;

      // ── New tools ──────────────────────────────────────────────
      case 'cors_check': {
        const origins = args.origins
          ? (args.origins as string).split(',').map(o => o.trim())
          : undefined;
        result = await corsCheck(args.url as string, origins);
        break;
      }

      case 'tech_fingerprint':
        result = await techFingerprint(args.url as string);
        break;

      case 'subdomain_enum':
        result = await subdomainEnum(args.domain as string, args.include_expired as boolean);
        break;

      case 'port_check': {
        const ports = args.ports
          ? (args.ports as string).split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n))
          : undefined;
        result = await portCheck(args.host as string, ports, args.timeout as number);
        break;
      }

      case 'redirect_chain':
        result = await redirectChain(args.url as string, args.max_redirects as number);
        break;

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
