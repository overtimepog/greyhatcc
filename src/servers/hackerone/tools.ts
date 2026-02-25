// ── HackerOne MCP Tool Definitions ───────────────────────────────────

export const HACKERONE_TOOLS = [
  {
    name: 'h1_list_programs',
    description:
      'List HackerOne bug bounty programs accessible to the authenticated hacker. ' +
      'Returns program names, handles, bounty status, and response metrics. Use to discover which programs you can test.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 25)' },
      },
    },
  },
  {
    name: 'h1_program_detail',
    description:
      'Get detailed info about a specific HackerOne program including scope, bounty ranges, policy, ' +
      'response targets, and statistics. The primary tool for program research.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle (e.g. "shopify", "github")' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_structured_scopes',
    description:
      'Get structured scope assets for a HackerOne program. Returns asset identifiers, types ' +
      '(Domain/URL/API/Mobile), bounty eligibility, max severity, and testing instructions per asset.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 100)' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_hacktivity',
    description:
      'Fetch hacktivity (disclosed/resolved reports) for a HackerOne program. Shows report titles, ' +
      'severity, bounty amounts, CVEs. Critical for duplicate detection before submitting.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle to filter hacktivity' },
        disclosed_only: { type: 'boolean' as const, description: 'Only return disclosed reports with full details (default: false)' },
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 25)' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_earnings',
    description:
      'Get your HackerOne earnings history. Shows bounties received, amounts, dates, and associated reports. ' +
      'Useful for tracking ROI across programs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 25)' },
      },
    },
  },
  {
    name: 'h1_balance',
    description:
      'Get your HackerOne account balance. Shows pending and available balance.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'h1_payouts',
    description:
      'Get your HackerOne payout history. Shows completed payouts with amounts and dates.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 25)' },
      },
    },
  },
  {
    name: 'h1_my_reports',
    description:
      'List your submitted HackerOne reports. Shows report titles, states, severity, and dates. ' +
      'Use to track your submissions across programs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 25)' },
      },
    },
  },
  {
    name: 'h1_report_detail',
    description:
      'Get details of a specific HackerOne report by its numeric ID. Shows title, state, severity, ' +
      'and timeline. Only accessible for your own reports.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const, description: 'Report ID (numeric)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'h1_program_weaknesses',
    description:
      'Get weakness types (CWEs) accepted by a HackerOne program. Shows which vulnerability categories ' +
      'the program is interested in, helping focus testing efforts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
        page: { type: 'number' as const, description: 'Page number (default: 1)' },
        page_size: { type: 'number' as const, description: 'Results per page, max 100 (default: 100)' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_scope_summary',
    description:
      'Get a concise summary of a program scope: in-scope vs out-of-scope assets, bounty table, ' +
      'exclusion list. Designed for quick scope validation during testing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_dupe_check',
    description:
      'Check if a vulnerability has likely been reported before on a program by querying hacktivity ' +
      'for similar findings. Returns dupe risk assessment (HIGH/MEDIUM/LOW/CLEAR) with matched reports.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
        vuln_type: { type: 'string' as const, description: 'Vulnerability type (e.g. "XSS", "IDOR", "SSRF")' },
        asset: { type: 'string' as const, description: 'Asset/endpoint where the vuln was found (optional, improves accuracy)' },
      },
      required: ['handle', 'vuln_type'],
    },
  },
  {
    name: 'h1_bounty_table',
    description:
      'Get the bounty table for a HackerOne program. Shows reward ranges by severity level ' +
      '(Critical/High/Medium/Low) to help prioritize testing effort.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_program_policy',
    description:
      'Get the full policy text for a HackerOne program. Includes testing rules, disclosure policy, ' +
      'safe harbor, non-qualifying vulns, and special instructions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string' as const, description: 'Program handle' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'h1_auth_status',
    description:
      'Check HackerOne API authentication status. Verifies API token is valid and shows account info. ' +
      'Run this first to confirm API access is working.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];
