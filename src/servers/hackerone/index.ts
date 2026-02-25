import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HACKERONE_TOOLS } from './tools.js';
import { HackerOneClient } from './client.js';

const client = new HackerOneClient();

const server = new Server(
  { name: 'greyhatcc-hackerone', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: HACKERONE_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'h1_list_programs':
        result = await client.listPrograms(
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_program_detail':
        result = await client.getProgram(args.handle as string);
        break;

      case 'h1_structured_scopes':
        result = await client.getStructuredScopes(
          args.handle as string,
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_hacktivity':
        result = await client.getHacktivity(
          args.handle as string,
          args.page as number | undefined,
          args.page_size as number | undefined,
          args.disclosed_only as boolean | undefined,
        );
        break;

      case 'h1_earnings':
        result = await client.getEarnings(
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_balance':
        result = await client.getBalance();
        break;

      case 'h1_payouts':
        result = await client.getPayouts(
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_my_reports':
        result = await client.getMyReports(
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_report_detail':
        result = await client.getReport(args.id as string);
        break;

      case 'h1_program_weaknesses':
        result = await client.getWeaknesses(
          args.handle as string,
          args.page as number | undefined,
          args.page_size as number | undefined,
        );
        break;

      case 'h1_scope_summary':
        result = await client.getScopeSummary(args.handle as string);
        break;

      case 'h1_dupe_check':
        result = await client.dupeCheck(
          args.handle as string,
          args.vuln_type as string,
          args.asset as string | undefined,
        );
        break;

      case 'h1_bounty_table':
        result = await client.getBountyTable(args.handle as string);
        break;

      case 'h1_program_policy':
        result = await client.getProgramPolicy(args.handle as string);
        break;

      case 'h1_auth_status':
        result = await client.checkAuth();
        break;

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    const output = JSON.stringify(result, null, 2);
    const MAX_OUTPUT = 100_000;
    const text = output.length <= MAX_OUTPUT
      ? output
      : output.slice(0, MAX_OUTPUT) + '\n\n[... output truncated at 100KB ...]';
    return {
      content: [{ type: 'text', text }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
