import { readStdin } from './lib/stdin.mjs';
import { getHuntState, getActiveProgram } from './lib/state.mjs';

/**
 * Enhanced Keyword Detector v4.0
 *
 * v4.0 changes:
 * - MAGIC KEYWORD support for both hunt AND program research
 * - Broader keyword patterns for program research (URLs, handles, natural language)
 * - All commands now have explicit `skill:` frontmatter bindings
 * - 140+ keywords across 27 categories
 * - Improved compound keyword detection
 * - Better URL pattern matching for HackerOne/Bugcrowd/Intigriti
 * - h1-report command added
 */

// MAGIC KEYWORD: Creates forced skill invocation (like OMC autopilot)
function createMagicKeyword(skillName, label, originalPrompt) {
  return `[MAGIC KEYWORD: ${label}]

You MUST invoke the skill using the Skill tool:

Skill: greyhatcc:${skillName}

User request:
${originalPrompt}

IMPORTANT: Invoke the skill IMMEDIATELY. Do not proceed without loading the skill instructions.`;
}

// Priority: higher = matched first. Most specific patterns first.
const SKILL_PATTERNS = [
  // --- HUNT MODE (highest priority, unified from hunt+loop+siege) ---
  { p: 100, match: /^hunt:/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate Ultra hunt mode' },
  { p: 100, match: /(?:hunt\s+(?:mode|loop)|keep\s*hunting|don'?t\s*stop|persistent\s*hunt)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate Ultra hunt mode' },
  { p: 100, match: /(?:siege|siege\s*mode|full\s*auto|autonomous\s*hunt|take\s*over|go\s*wild)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate Ultra hunt mode' },
  { p: 95, match: /(?:full\s*send|go\s*ham|send\s*it|unleash|all\s*out)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate Ultra hunt mode' },
  { p: 95, match: /(?:hunt\s+\S|start\s+hunt|begin\s+hunt|launch\s+hunt)/i, skill: '__MAGIC_HUNT__', hint: 'MAGIC KEYWORD: Auto-activate Ultra hunt mode' },

  // --- PROGRAM RESEARCH (MAGIC KEYWORD for URLs and clear intent) ---
  { p: 92, match: /^program:/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Auto-activate program research' },
  { p: 92, match: /hackerone\.com\/[a-z0-9_-]+/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Research this HackerOne program' },
  { p: 92, match: /bugcrowd\.com\/[a-z0-9_-]+/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Research this Bugcrowd program' },
  { p: 92, match: /intigriti\.com\/[a-z0-9_-]+/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Research this Intigriti program' },
  { p: 90, match: /(?:research\s+(?:the\s+)?program|program\s+research|look\s*up\s+(?:the\s+)?program)/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Auto-activate program research' },
  { p: 90, match: /(?:new\s+program|start\s+(?:a\s+)?(?:new\s+)?program|set\s*up\s+program)/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Auto-activate program research' },
  { p: 88, match: /(?:get\s+(?:the\s+)?(?:program|scope|bounty)\s+(?:info|details|guidelines|rules))/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Extract program details' },
  { p: 88, match: /(?:what(?:'s|\s+is)\s+(?:the\s+)?scope|what\s+bugs?\s+(?:are|is)\s+(?:allowed|excluded|in.scope|out.of.scope))/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Extract program scope and rules' },
  { p: 88, match: /(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:bounty|payout|reward)|how\s+much\s+(?:do\s+they|does\s+it)\s+pay)/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Extract bounty table' },
  { p: 86, match: /(?:program\s+(?:info|details|scope|rules|guidelines|exclusions|bounties|bounty\s+table))/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Extract program details' },
  { p: 85, match: /(?:research|look\s*up|check\s+out|investigate|scrape|extract)\s+(?:the\s+)?(?:h1|hackerone|bugcrowd|intigriti)/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Research bug bounty platform program' },
  { p: 84, match: /(?:what\s+(?:are|is)\s+(?:the\s+)?(?:exclusions?|excluded|non.qualifying|out.of.scope))/i, skill: '__MAGIC_PROGRAM__', hint: 'MAGIC KEYWORD: Extract exclusion list' },

  // --- VALIDATION / QUALITY GATES ---
  { p: 82, match: /(?:validate\s*report|check\s*report|report\s*quality|review\s*report|is\s*report\s*good)/i, skill: 'greyhatcc:validate', hint: 'Multi-gate report quality validation' },
  { p: 82, match: /(?:verify\s*proof|test\s*poc|check\s*poc|proof\s*work|reproduce|repro\s*step)/i, skill: 'greyhatcc:proof', hint: 'Verify PoC reproducibility before submitting' },
  { p: 82, match: /(?:check\s*dup|is\s*this\s*(?:a\s*)?dup|already\s*reported|someone\s*found|been\s*submitted)/i, skill: 'greyhatcc:dedup', hint: 'Check for duplicates across 6 layers + hacktivity' },
  { p: 80, match: /(?:hacktivity|disclosed\s*report|public\s*report|h1\s*report\s*check|what\s*(?:has\s*)?been\s*found)/i, skill: 'greyhatcc:hacktivity', hint: 'Scrape HackerOne hacktivity for duplicate patterns' },
  { p: 78, match: /(?:common\s*dupe|always\s*rejected|waste\s*time|will\s*this\s*be\s*rejected)/i, skill: 'greyhatcc:dupes', hint: 'Check against database of commonly rejected finding types' },

  // --- SCOPE ---
  { p: 76, match: /(?:show\s*scope|view\s*scope|scope\s*check|in\s*scope|out\s*(?:of\s*)?scope|define\s*scope|set\s*scope)/i, skill: 'greyhatcc:scope', hint: 'View or validate target scope' },

  // --- RECON ---
  { p: 75, match: /(?:recon|reconn|reconnaissance|enumerate\s*target|map\s*(?:the\s*)?attack\s*surface)/i, skill: 'greyhatcc:recon', hint: 'Multi-phase recon with parallel agents' },
  { p: 73, match: /(?:subdomain|sub\s*domain|subfinder|sublist3r|amass\s*enum)/i, skill: 'greyhatcc:subdomains', hint: 'Multi-source subdomain enumeration' },
  { p: 73, match: /(?:takeover|dangling\s*(?:dns|cname)|unclaimed|orphan\s*sub)/i, skill: 'greyhatcc:takeover', hint: 'Subdomain takeover detection + verification' },
  { p: 72, match: /(?:port\s*scan|nmap|masscan|service\s*enum|open\s*port)/i, skill: 'greyhatcc:portscan', hint: 'Intelligent port scanning with service detection' },
  { p: 71, match: /(?:shodan|censys|internet\s*scan|banner\s*grab)/i, skill: 'greyhatcc:shodan', hint: 'Shodan-powered infrastructure intelligence' },
  { p: 70, match: /(?:osint|open\s*source\s*intel|employee|linkedin|company\s*info|theharv)/i, skill: 'greyhatcc:osint', hint: 'OSINT gathering: employees, tech stack, company intel' },
  { p: 70, match: /(?:javascript\s*analy|js\s*bundle|webpack|source\s*map|\.js\s*secret|js\s*endpoint)/i, skill: 'greyhatcc:js', hint: 'JavaScript bundle analysis for endpoints, secrets, source maps' },
  { p: 70, match: /(?:cloud\s*(?:recon|bucket|misconfig|storage)|s3\s*bucket|gcp\s*storage|azure\s*blob|firebase)/i, skill: 'greyhatcc:cloud', hint: 'Cloud infrastructure misconfiguration hunting' },
  { p: 68, match: /(?:fingerprint|tech\s*stack|wappalyzer|what(?:'s|\s+is)\s*running|identify\s*tech)/i, skill: 'greyhatcc:recon', hint: 'Technology fingerprinting' },
  { p: 68, match: /(?:waf\s*detect|waf\s*bypass|cloudflare|akamai|aws\s*waf|firewall)/i, skill: 'greyhatcc:recon', hint: 'WAF detection and bypass' },

  // --- VULNERABILITY TESTING ---
  { p: 65, match: /(?:webapp\s*test|owasp|web\s*app\s*security|penetration\s*test\s*web)/i, skill: 'greyhatcc:webapp', hint: 'OWASP Top 10 systematic testing' },
  { p: 65, match: /(?:api\s*test|api\s*security|rest\s*api|graphql\s*test|endpoint\s*test)/i, skill: 'greyhatcc:api', hint: 'REST/GraphQL API security testing' },
  { p: 65, match: /(?:oauth|jwt|oidc|saml|cognito|auth0|token\s*test|auth\s*bypass|sso)/i, skill: 'greyhatcc:auth', hint: 'OAuth, JWT, OIDC, SAML, Cognito testing' },
  { p: 63, match: /(?:xss|cross\s*site\s*script|stored\s*xss|reflected\s*xss|dom\s*xss)/i, skill: 'greyhatcc:webapp', hint: 'XSS testing (part of webapp testing workflow)' },
  { p: 63, match: /(?:sqli|sql\s*inject|union\s*select|blind\s*sql|error\s*based)/i, skill: 'greyhatcc:webapp', hint: 'SQL injection testing' },
  { p: 63, match: /(?:ssrf|server\s*side\s*request|internal\s*fetch|metadata\s*169)/i, skill: 'greyhatcc:webapp', hint: 'SSRF testing' },
  { p: 63, match: /(?:idor|insecure\s*direct|broken\s*access|horizontal\s*priv|vertical\s*priv)/i, skill: 'greyhatcc:webapp', hint: 'Access control / IDOR testing' },
  { p: 63, match: /(?:race\s*condition|toctou|concurren|double\s*spend|limit\s*overrun)/i, skill: 'greyhatcc:webapp', hint: 'Race condition testing' },
  { p: 63, match: /(?:deseriali|ysoserial|unserialize|marshal|readObject)/i, skill: 'greyhatcc:webapp', hint: 'Deserialization testing' },
  { p: 63, match: /(?:ssti|template\s*inject|jinja|twig|freemarker|pebble)/i, skill: 'greyhatcc:webapp', hint: 'Server-side template injection' },
  { p: 63, match: /(?:request\s*smuggl|cl\.te|te\.cl|h2\.cl|desync|http\s*smuggl)/i, skill: 'greyhatcc:webapp', hint: 'HTTP request smuggling' },
  { p: 63, match: /(?:prototype\s*pollut|__proto__|constructor\s*prototype)/i, skill: 'greyhatcc:webapp', hint: 'Prototype pollution testing' },
  { p: 63, match: /(?:cors|cross\s*origin|access-control-allow)/i, skill: 'greyhatcc:webapp', hint: 'CORS misconfiguration testing' },
  { p: 63, match: /(?:csrf|cross\s*site\s*request\s*forg)/i, skill: 'greyhatcc:webapp', hint: 'CSRF testing' },
  { p: 63, match: /(?:lfi|rfi|local\s*file\s*inclus|remote\s*file\s*inclus|path\s*travers|directory\s*travers)/i, skill: 'greyhatcc:webapp', hint: 'File inclusion / path traversal' },
  { p: 63, match: /(?:xxe|xml\s*external|xml\s*entity|xml\s*inject)/i, skill: 'greyhatcc:webapp', hint: 'XXE testing' },
  { p: 63, match: /(?:open\s*redirect|url\s*redirect|redirect\s*manipul)/i, skill: 'greyhatcc:webapp', hint: 'Open redirect (chain with OAuth for token theft)' },
  { p: 63, match: /(?:graphql\s*introspect|graphql\s*batch|graphql\s*alias|graphql\s*mutation)/i, skill: 'greyhatcc:api', hint: 'GraphQL-specific exploitation' },

  // --- EXPLOIT DEVELOPMENT ---
  { p: 60, match: /(?:exploit|poc|proof\s*of\s*concept|payload|reverse\s*shell|bind\s*shell)/i, skill: 'greyhatcc:exploit', hint: 'Exploit development and PoC creation' },
  { p: 60, match: /(?:cve[-\u2010]\d{4}|nvd|national\s*vuln|exploit-db|searchsploit)/i, skill: 'greyhatcc:cve', hint: 'CVE search and analysis' },

  // --- FINDINGS & CHAINING ---
  { p: 55, match: /(?:finding|log\s*vuln|document\s*bug|track\s*issue|add\s*finding)/i, skill: 'greyhatcc:findings', hint: 'Document and track security findings' },
  { p: 55, match: /(?:gadget|chain|combine|link\s*vuln|bug\s*a\s*bug\s*b|low\s*to\s*high)/i, skill: 'greyhatcc:gadgets', hint: 'Gadget inventory + vulnerability chaining analysis' },
  { p: 55, match: /(?:what\s*(?:have\s*I\s*)?tested|already\s*tested|skip\s*test|test\s*tracker|coverage|untested|gaps)/i, skill: 'greyhatcc:tested', hint: 'View/update tested endpoints tracker' },

  // --- REPORTING ---
  { p: 50, match: /(?:h1\s*report|hackerone\s*report|write\s*(?:a\s*)?report\s*(?:for\s*)?h1|submit\s*report|write\s*(?:a\s*)?h1)/i, skill: 'greyhatcc:h1-report', hint: 'Generate HackerOne-ready vulnerability report' },
  { p: 50, match: /(?:pentest\s*report|professional\s*report|ptes\s*report|executive\s*report)/i, skill: 'greyhatcc:report', hint: 'Full PTES/OWASP pentest report' },

  // --- WORKFLOW ---
  { p: 45, match: /(?:bug\s*bounty|bounty\s*hunt|bounty\s*workflow)/i, skill: 'greyhatcc:bounty', hint: 'End-to-end bug bounty workflow' },
  { p: 40, match: /(?:guide|reference|cheatsheet|methodology|howto|payload\s*list)/i, skill: 'greyhatcc:guides', hint: 'Curated reference library (HowToHunt, HackTricks, PayloadsAllTheThings)' },

  // --- DIAGNOSTICS ---
  { p: 10, match: /(?:greyhatcc\s*(?:broken|error|fix|debug|diagnos|doctor|health))/i, skill: 'greyhatcc:doctor', hint: 'Plugin diagnostics and health check' },
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

  // Check if top match is a MAGIC KEYWORD activation
  if (matches[0].skill === '__MAGIC_HUNT__') {
    console.log(JSON.stringify({
      'system-reminder': createMagicKeyword('hunt', 'HUNT', originalPrompt)
    }));
    return;
  }

  if (matches[0].skill === '__MAGIC_PROGRAM__') {
    console.log(JSON.stringify({
      'system-reminder': createMagicKeyword('program-research', 'PROGRAM', originalPrompt)
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
