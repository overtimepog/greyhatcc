import { readStdin } from './lib/stdin.mjs';
import { readScope, getActiveProgram, getFindings } from './lib/state.mjs';
import { checkScope } from './lib/scope.mjs';
import { getRejectionRisk } from './lib/dupes.mjs';

/**
 * Enhanced Finding Tracker v2.0
 *
 * Improvements over v1:
 * - Auto-scope validation on detected findings
 * - Common dupe pattern matching
 * - Proof requirement hints
 * - Duplicate detection against existing findings
 * - Rejection risk assessment
 * - Actionable next-step suggestions
 */

const VULN_INDICATORS = [
  { pattern: /sql syntax|mysql|ORA-|PostgreSQL.*ERROR|microsoft.*odbc/i, type: 'SQL Injection', severity: 'HIGH' },
  { pattern: /<script>|javascript:|onerror=|onload=|alert\(/i, type: 'XSS Reflection', severity: 'MEDIUM' },
  { pattern: /\.\.\/|\.\.\\|path traversal|directory traversal/i, type: 'Path Traversal', severity: 'HIGH' },
  { pattern: /stack trace|at\s+\w+\.\w+\(|Traceback \(most recent/i, type: 'Stack Trace Disclosure', severity: 'INFO' },
  { pattern: /X-Powered-By:|Server:.*\/\d+\.\d+/i, type: 'Server Version Disclosure', severity: 'INFO' },
  { pattern: /Access-Control-Allow-Origin:\s*\*/i, type: 'Permissive CORS (wildcard)', severity: 'LOW' },
  { pattern: /Access-Control-Allow-Origin:\s*(?!null|\*)[^\s]+/i, type: 'CORS Origin Reflection', severity: 'MEDIUM' },
  { pattern: /admin.*200|dashboard.*200|panel.*200/i, type: 'Exposed Admin Panel', severity: 'MEDIUM' },
  { pattern: /\.env|\.git\/config|\.svn\/entries/i, type: 'Sensitive File Exposure', severity: 'HIGH' },
  { pattern: /BEGIN\s+(RSA|DSA|EC)\s+PRIVATE\s+KEY/i, type: 'Private Key Exposure', severity: 'CRITICAL' },
  { pattern: /phpinfo\(\)|<title>phpinfo/i, type: 'PHP Info Disclosure', severity: 'LOW' },
  { pattern: /{"errors":\[{"message":".*graphql/i, type: 'GraphQL Error Disclosure', severity: 'LOW' },
  { pattern: /introspection.*query|__schema|__type/i, type: 'GraphQL Introspection', severity: 'LOW' },
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}/i, type: 'JWT Token in Response', severity: 'INFO' },
  { pattern: /actuator|health.*status.*UP|beans.*context/i, type: 'Spring Boot Actuator', severity: 'LOW' },
  { pattern: /wp-json|wp-admin|wp-content/i, type: 'WordPress Detection', severity: 'INFO' },
  { pattern: /s3\.amazonaws\.com|storage\.googleapis\.com/i, type: 'Cloud Storage URL', severity: 'INFO' },
  { pattern: /AKIA[0-9A-Z]{16}/i, type: 'AWS Access Key Exposure', severity: 'CRITICAL' },
  { pattern: /internal.*server.*error.*500/i, type: 'Internal Server Error', severity: 'INFO' },
  { pattern: /unauthorized.*401|forbidden.*403/i, type: 'Auth Boundary Detected', severity: 'INFO' },
];

async function main() {
  const input = await readStdin();
  const output = input?.tool_output?.stdout || input?.tool_output?.output || '';
  const command = input?.tool_input?.command || '';
  if (!output || output.length < 10) return;

  const found = [];
  for (const { pattern, type, severity } of VULN_INDICATORS) {
    if (pattern.test(output)) {
      found.push({ type, severity });
    }
  }

  if (found.length === 0) return;

  const lines = [];

  // Extract target from command for scope check
  const urlMatch = command.match(/https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/);
  const target = urlMatch ? urlMatch[1] : null;

  // Scope check
  if (target) {
    const { inScope, reason } = checkScope(target);
    if (!inScope) {
      lines.push(`[greyhatcc] SCOPE WARNING: ${target} is NOT in scope (${reason}). Finding may be rejected.`);
    }
  }

  // Group by severity
  const critical = found.filter(f => f.severity === 'CRITICAL');
  const high = found.filter(f => f.severity === 'HIGH');
  const medium = found.filter(f => f.severity === 'MEDIUM');
  const low = found.filter(f => f.severity === 'LOW');
  const info = found.filter(f => f.severity === 'INFO');

  if (critical.length > 0) {
    lines.push(`[greyhatcc] CRITICAL FINDING: ${critical.map(f => f.type).join(', ')}`);
    lines.push('  >> Immediate action: /greyhatcc:findings add, then /greyhatcc:proof to verify');
  }
  if (high.length > 0) {
    lines.push(`[greyhatcc] HIGH finding: ${high.map(f => f.type).join(', ')}`);
    lines.push('  >> Log with /greyhatcc:findings, verify PoC, check /greyhatcc:dedup');
  }
  if (medium.length > 0) {
    lines.push(`[greyhatcc] MEDIUM finding: ${medium.map(f => f.type).join(', ')}`);
  }
  if (low.length > 0) {
    lines.push(`[greyhatcc] LOW finding: ${low.map(f => f.type).join(', ')}`);
    // Check rejection risk for low findings
    for (const f of low) {
      const { risk, matches } = getRejectionRisk(f.type);
      if (risk === 'BLOCK' || risk === 'WARN') {
        lines.push(`  >> REJECTION RISK for "${f.type}": ${matches[0].advice}`);
        if (matches[0].chainWith) {
          lines.push(`  >> Chain opportunity: ${matches[0].chainWith}`);
        }
      }
    }
  }
  if (info.length > 0) {
    lines.push(`[greyhatcc] INFO: ${info.map(f => f.type).join(', ')} — add to gadgets for chaining`);
  }

  // Dedup hint against existing findings (check both legacy and v7 hunt state)
  const program = getActiveProgram();
  if (program) {
    const existing = getFindings(program);
    for (const f of found) {
      const dupe = existing.find(e =>
        e.title && f.type && e.title.toLowerCase().includes(f.type.toLowerCase().slice(0, 15))
      );
      if (dupe) {
        lines.push(`  >> POSSIBLE DUPE of ${dupe.id}: "${dupe.title}". Run /greyhatcc:dedup before logging.`);
        break;
      }
    }
  }

  // Also check v7 hunt-state/findings.json if active
  const { existsSync: exists, readFileSync: readFile } = await import('fs');
  const { join: joinPath } = await import('path');
  const huntFindingsPath = joinPath(process.cwd(), 'hunt-state', 'findings.json');
  if (exists(huntFindingsPath)) {
    try {
      const huntFindings = JSON.parse(readFile(huntFindingsPath, 'utf-8'));
      for (const f of found) {
        const dupe = huntFindings.find(e =>
          e.title && f.type && e.title.toLowerCase().includes(f.type.toLowerCase().slice(0, 15))
        );
        if (dupe) {
          lines.push(`  >> POSSIBLE DUPE in hunt-state: "${dupe.title}" (${dupe.id}). Check hunt-state/findings.json.`);
          break;
        }
      }
    } catch {}
  }

  if (lines.length > 0) {
    console.log(JSON.stringify({ 'system-reminder': lines.join('\n') }));
  }
}

main().catch(() => {});
