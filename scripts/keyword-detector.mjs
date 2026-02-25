import { readStdin } from './lib/stdin.mjs';
import { getHuntState, getActiveProgram } from './lib/state.mjs';

/**
 * Enhanced Keyword Detector v3.0
 *
 * v3.0 changes:
 * - Unified hunt/loop/siege into single HUNT mode with MAGIC KEYWORD auto-activation
 * - "hunt:" prefix triggers immediate skill invocation (like OMC autopilot)
 * - All hunt-related keywords route to unified greyhatcc:hunt skill
 * - 120+ keywords across 25 categories
 * - Compound keyword detection (multi-word intent matching)
 * - Priority-based matching (most specific wins)
 * - Context-aware suggestions (knows active hunt state)
 * - Auto-invocation hints for clear intent
 * - Negative matching (don't suggest X when Y is better)
 * - Hunt loop awareness (don't interrupt active loops)
 */

// MAGIC KEYWORD: Creates forced skill invocation (like OMC autopilot)
function createMagicKeyword(originalPrompt) {
  return `[MAGIC KEYWORD: HUNT]

You MUST invoke the skill using the Skill tool:

Skill: greyhatcc:hunt

User request:
${originalPrompt}

IMPORTANT: Invoke the skill IMMEDIATELY. Do not proceed without loading the skill instructions.`;
}

// Priority: higher = matched first. Most specific patterns first.
const SKILL_PATTERNS = [
  // --- HUNT MODE (highest priority, unified from hunt+loop+siege) ---
  { p: 100, match: /^hunt:/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate hunt mode' },
  { p: 100, match: /(?:hunt.*loop|keep.*hunting|don'?t.*stop|boulder|persistent.*hunt)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate hunt mode' },
  { p: 100, match: /(?:siege|siege.*mode|full.*auto|autonomous.*hunt|take.*over|go.*wild|full.*send.*auto)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate hunt mode' },
  { p: 95, match: /(?:full.*send|go.*ham|send.*it|unleash|all.*out)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate hunt mode' },

  // --- VALIDATION / QUALITY GATES ---
  { p: 90, match: /(?:validate.*report|check.*report|report.*quality|review.*report|is.*report.*good)/i, skill: 'greyhatcc:validate', hint: 'Multi-gate report quality validation' },
  { p: 90, match: /(?:verify.*proof|test.*poc|check.*poc|proof.*work|reproduce|repro.*step)/i, skill: 'greyhatcc:proof', hint: 'Verify PoC reproducibility before submitting' },
  { p: 90, match: /(?:check.*dup|is.*this.*dup|already.*reported|someone.*found|been.*submitted)/i, skill: 'greyhatcc:dedup', hint: 'Check for duplicates across 6 layers + hacktivity' },
  { p: 88, match: /(?:hacktivity|disclosed.*report|public.*report|h1.*report.*check|what.*been.*found)/i, skill: 'greyhatcc:hacktivity', hint: 'Scrape HackerOne hacktivity for duplicate patterns' },
  { p: 85, match: /(?:common.*dupe|always.*rejected|waste.*time|will.*this.*be.*rejected)/i, skill: 'greyhatcc:dupes', hint: 'Check against database of commonly rejected finding types' },

  // --- PROGRAM RESEARCH ---
  { p: 80, match: /(?:new.*program|start.*program|research.*program|program.*info|program.*scope)/i, skill: 'greyhatcc:program', hint: 'Automated program research via Playwright + Perplexity' },
  { p: 80, match: /(?:hackerone\.com\/\w|bugcrowd\.com\/\w|intigriti\.com\/\w)/i, skill: 'greyhatcc:program', hint: 'Research this bug bounty program' },
  { p: 78, match: /(?:what.*scope|show.*scope|in.*scope|out.*scope|scope.*check)/i, skill: 'greyhatcc:scope', hint: 'View or validate target scope' },

  // --- RECON ---
  { p: 75, match: /(?:recon|reconn|reconnaissance|enumerate.*target|map.*attack.*surface)/i, skill: 'greyhatcc:recon', hint: 'Multi-phase recon with parallel agents' },
  { p: 73, match: /(?:subdomain|sub.*domain|subfinder|sublist3r|amass.*enum)/i, skill: 'greyhatcc:subdomains', hint: 'Multi-source subdomain enumeration' },
  { p: 73, match: /(?:takeover|dangling.*(?:dns|cname)|unclaimed|orphan.*sub)/i, skill: 'greyhatcc:takeover', hint: 'Subdomain takeover detection + verification' },
  { p: 72, match: /(?:port.*scan|nmap|masscan|service.*enum|open.*port)/i, skill: 'greyhatcc:portscan', hint: 'Intelligent port scanning with service detection' },
  { p: 71, match: /(?:shodan|censys|internet.*scan|banner.*grab)/i, skill: 'greyhatcc:shodan', hint: 'Shodan-powered infrastructure intelligence' },
  { p: 70, match: /(?:osint|open.*source.*intel|employee|linkedin|company.*info|theharv)/i, skill: 'greyhatcc:osint', hint: 'OSINT gathering: employees, tech stack, company intel' },
  { p: 70, match: /(?:javascript.*analy|js.*bundle|webpack|source.*map|\.js.*secret|js.*endpoint)/i, skill: 'greyhatcc:js', hint: 'JavaScript bundle analysis for endpoints, secrets, source maps' },
  { p: 70, match: /(?:cloud.*(?:recon|bucket|misconfig|storage)|s3.*bucket|gcp.*storage|azure.*blob)/i, skill: 'greyhatcc:cloud', hint: 'Cloud infrastructure misconfiguration hunting' },
  { p: 68, match: /(?:fingerprint|tech.*stack|wappalyzer|what.*running|identify.*tech)/i, skill: 'greyhatcc:recon', hint: 'Technology fingerprinting' },
  { p: 68, match: /(?:waf.*detect|waf.*bypass|cloudflare|akamai|aws.*waf|firewall)/i, skill: 'greyhatcc:recon', hint: 'WAF detection and bypass' },

  // --- VULNERABILITY TESTING ---
  { p: 65, match: /(?:webapp.*test|owasp|web.*app.*security|penetration.*test.*web)/i, skill: 'greyhatcc:webapp', hint: 'OWASP Top 10 systematic testing' },
  { p: 65, match: /(?:api.*test|api.*security|rest.*api|graphql.*test|endpoint.*test)/i, skill: 'greyhatcc:api', hint: 'REST/GraphQL API security testing' },
  { p: 65, match: /(?:oauth|jwt|oidc|saml|cognito|auth0|token.*test|auth.*bypass|sso)/i, skill: 'greyhatcc:auth', hint: 'OAuth, JWT, OIDC, SAML, Cognito testing' },
  { p: 63, match: /(?:xss|cross.*site.*script|stored.*xss|reflected.*xss|dom.*xss)/i, skill: 'greyhatcc:webapp', hint: 'XSS testing (part of webapp testing workflow)' },
  { p: 63, match: /(?:sqli|sql.*inject|union.*select|blind.*sql|error.*based)/i, skill: 'greyhatcc:webapp', hint: 'SQL injection testing' },
  { p: 63, match: /(?:ssrf|server.*side.*request|internal.*fetch|metadata.*169)/i, skill: 'greyhatcc:webapp', hint: 'SSRF testing' },
  { p: 63, match: /(?:idor|insecure.*direct|broken.*access|horizontal.*priv|vertical.*priv)/i, skill: 'greyhatcc:webapp', hint: 'Access control / IDOR testing' },
  { p: 63, match: /(?:race.*condition|toctou|concurren|double.*spend|limit.*overrun)/i, skill: 'greyhatcc:webapp', hint: 'Race condition testing' },
  { p: 63, match: /(?:deseriali|ysoserial|unserialize|marshal|readObject)/i, skill: 'greyhatcc:webapp', hint: 'Deserialization testing' },
  { p: 63, match: /(?:ssti|template.*inject|jinja|twig|freemarker|pebble)/i, skill: 'greyhatcc:webapp', hint: 'Server-side template injection' },
  { p: 63, match: /(?:request.*smuggl|cl\.te|te\.cl|h2\.cl|desync|http.*smuggl)/i, skill: 'greyhatcc:webapp', hint: 'HTTP request smuggling' },
  { p: 63, match: /(?:prototype.*pollut|__proto__|constructor.*prototype)/i, skill: 'greyhatcc:webapp', hint: 'Prototype pollution testing' },
  { p: 63, match: /(?:cors|cross.*origin|access-control-allow)/i, skill: 'greyhatcc:webapp', hint: 'CORS misconfiguration testing' },
  { p: 63, match: /(?:csrf|cross.*site.*request.*forg)/i, skill: 'greyhatcc:webapp', hint: 'CSRF testing' },
  { p: 63, match: /(?:lfi|rfi|local.*file.*inclus|remote.*file.*inclus|path.*travers|directory.*travers)/i, skill: 'greyhatcc:webapp', hint: 'File inclusion / path traversal' },
  { p: 63, match: /(?:xxe|xml.*external|xml.*entity|xml.*inject)/i, skill: 'greyhatcc:webapp', hint: 'XXE testing' },
  { p: 63, match: /(?:open.*redirect|url.*redirect|redirect.*manipul)/i, skill: 'greyhatcc:webapp', hint: 'Open redirect (chain with OAuth for token theft)' },
  { p: 63, match: /(?:graphql.*introspect|graphql.*batch|graphql.*alias|graphql.*mutation)/i, skill: 'greyhatcc:api', hint: 'GraphQL-specific exploitation' },

  // --- EXPLOIT DEVELOPMENT ---
  { p: 60, match: /(?:exploit|poc|proof.*of.*concept|payload|reverse.*shell|bind.*shell)/i, skill: 'greyhatcc:exploit', hint: 'Exploit development and PoC creation' },
  { p: 60, match: /(?:cve[-\u2010]\d{4}|nvd|national.*vuln|exploit-db|searchsploit)/i, skill: 'greyhatcc:cve', hint: 'CVE search and analysis' },

  // --- FINDINGS & CHAINING ---
  { p: 55, match: /(?:finding|log.*vuln|document.*bug|track.*issue|add.*finding)/i, skill: 'greyhatcc:findings', hint: 'Document and track security findings' },
  { p: 55, match: /(?:gadget|chain|combine|link.*vuln|bug.*a.*bug.*b|low.*to.*high)/i, skill: 'greyhatcc:gadgets', hint: 'Gadget inventory + vulnerability chaining analysis' },
  { p: 55, match: /(?:what.*tested|already.*tested|skip.*test|test.*tracker)/i, skill: 'greyhatcc:tested', hint: 'View/update tested endpoints tracker' },

  // --- REPORTING ---
  { p: 50, match: /(?:h1.*report|hackerone.*report|write.*report.*h1|submit.*report)/i, skill: 'greyhatcc:h1-report', hint: 'Generate HackerOne-ready vulnerability report' },
  { p: 50, match: /(?:pentest.*report|professional.*report|ptes.*report|executive.*report)/i, skill: 'greyhatcc:report', hint: 'Full PTES/OWASP pentest report' },

  // --- WORKFLOW ---
  { p: 45, match: /(?:bug.*bounty|bounty.*hunt|start.*hunt|bounty.*workflow)/i, skill: 'greyhatcc:bounty', hint: 'End-to-end bug bounty workflow' },
  { p: 40, match: /(?:guide|reference|cheatsheet|methodology|howto|payload.*list)/i, skill: 'greyhatcc:guides', hint: 'Curated reference library (HowToHunt, HackTricks, PayloadsAllTheThings)' },

  // --- DIAGNOSTICS ---
  { p: 10, match: /(?:greyhatcc.*(?:broken|error|fix|debug|diagnos|doctor|health))/i, skill: 'greyhatcc:doctor', hint: 'Plugin diagnostics and health check' },
];

async function main() {
  const input = await readStdin();
  const prompt = (input?.message || input?.content || '').toLowerCase();
  const originalPrompt = input?.message || input?.content || '';

  // Don't match if user is already using a slash command
  if (prompt.startsWith('/')) return;

  // Don't interrupt active hunts with suggestions
  const huntState = getHuntState();
  if (huntState.active && !prompt.includes('stop') && !prompt.includes('cancel') && !prompt.includes('pause')) {
    // Just remind about active hunt
    if (prompt.length > 5) {
      console.log(JSON.stringify({
        'system-reminder': `[greyhatcc:hunt] Active hunt in progress (Phase: ${huntState.phase}, Iteration: ${huntState.iteration}). The hunter doesn't sleep. Use "stop hunt" or /greyhatcc:cancel to pause.`
      }));
    }
    return;
  }

  // Sort by priority descending - most specific wins
  const sorted = [...SKILL_PATTERNS].sort((a, b) => b.p - a.p);

  const matches = [];
  for (const { match, skill, hint, p } of sorted) {
    if (match.test(prompt)) {
      // Avoid duplicate skill suggestions
      if (!matches.some(m => m.skill === skill)) {
        matches.push({ skill, hint, priority: p });
      }
    }
  }

  if (matches.length === 0) return;

  // Check if top match is a MAGIC KEYWORD hunt activation
  if (matches[0].skill === '__MAGIC_HUNT__') {
    // Force immediate skill invocation via MAGIC KEYWORD pattern (like OMC autopilot)
    console.log(JSON.stringify({
      'system-reminder': createMagicKeyword(originalPrompt)
    }));
    return;
  }

  // Take top 3 matches max
  const top = matches.slice(0, 3);

  const lines = ['[greyhatcc] Detected intent:'];
  for (const m of top) {
    lines.push(`  > /${m.skill} -- ${m.hint}`);
  }

  // Add context-aware suggestions
  const program = getActiveProgram();
  if (program) {
    lines.push(`  Active program: ${program}`);
  }

  console.log(JSON.stringify({ 'system-reminder': lines.join('\n') }));
}

main().catch(() => {});
