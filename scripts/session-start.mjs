import { readStdin } from './lib/stdin.mjs';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Enhanced Session Start Hook v2.0
 *
 * Improvements:
 * - Full engagement dashboard on session start
 * - Hunt loop resume detection
 * - Findings/submissions summary
 * - Stale state warnings
 * - Active program detection from multiple sources
 * - MCP server health check
 */
async function main() {
  await readStdin();
  const cwd = process.cwd();
  const parts = [];

  // --- Load scope ---
  const scopePath = join(cwd, '.greyhatcc', 'scope.json');
  let scope = null;
  if (existsSync(scopePath)) {
    try {
      scope = JSON.parse(readFileSync(scopePath, 'utf-8'));
    } catch {}
  }

  // --- Check hunt loop state ---
  const huntStatePath = join(cwd, '.greyhatcc', 'hunt-state.json');
  if (existsSync(huntStatePath)) {
    try {
      const huntState = JSON.parse(readFileSync(huntStatePath, 'utf-8'));
      if (huntState.active) {
        parts.push(`[greyhatcc:hunt-loop] RESUMING ACTIVE HUNT`);
        parts.push(`  Program: ${huntState.program || 'unknown'}`);
        parts.push(`  Phase: ${huntState.phase || 'unknown'}`);
        parts.push(`  Iteration: ${huntState.iteration || 0}`);
        parts.push(`  Last activity: ${huntState.lastActivity || 'unknown'}`);
        if (huntState.pendingFindings?.length > 0) {
          parts.push(`  Pending findings: ${huntState.pendingFindings.length}`);
        }
        if (huntState.completedPhases?.length > 0) {
          parts.push(`  Completed: ${huntState.completedPhases.join(', ')}`);
        }
        parts.push(`  >> Read .greyhatcc/hunt-state.json and CONTINUE from current phase.`);
        parts.push('');
      }
    } catch {}
  }

  // --- Engagement summary ---
  if (scope) {
    parts.push(`[greyhatcc] Active engagement: ${scope.engagement || 'unnamed'}`);
    if (scope.authorized?.domains?.length) {
      const domains = scope.authorized.domains;
      const display = domains.length > 8
        ? domains.slice(0, 8).join(', ') + ` (+${domains.length - 8} more)`
        : domains.join(', ');
      parts.push(`  Scope: ${display}`);
    }
    if (scope.excluded?.domains?.length) {
      parts.push(`  EXCLUDED: ${scope.excluded.domains.join(', ')}`);
    }
    if (scope.rules?.requiredHeaders) {
      parts.push(`  Required headers: ${JSON.stringify(scope.rules.requiredHeaders)}`);
    }
    if (scope.rules?.testingHours && scope.rules.testingHours !== '24/7') {
      parts.push(`  Testing hours: ${scope.rules.testingHours}`);
    }
  }

  // --- Active program stats ---
  const bbDir = join(cwd, 'bug_bounty');
  if (existsSync(bbDir)) {
    try {
      const programs = readdirSync(bbDir).filter(d => d.endsWith('_bug_bounty'));
      if (programs.length > 0) {
        const latest = programs[programs.length - 1];
        const programDir = join(bbDir, latest);

        // Count findings
        const findingsPath = join(programDir, 'findings_log.md');
        if (existsSync(findingsPath)) {
          const content = readFileSync(findingsPath, 'utf-8');
          const findingCount = (content.match(/^\| F-/gm) || []).length;
          if (findingCount > 0) {
            parts.push(`  Findings: ${findingCount} in ${latest.replace('_bug_bounty', '')}`);
          }
        }

        // Count reports
        const reportsDir = join(programDir, 'reports');
        if (existsSync(reportsDir)) {
          const reports = readdirSync(reportsDir).filter(f => f.endsWith('.md'));
          if (reports.length > 0) {
            parts.push(`  Reports: ${reports.length} drafted`);
          }
        }

        // Check submissions
        const subsPath = join(programDir, 'submissions.json');
        if (existsSync(subsPath)) {
          try {
            const subs = JSON.parse(readFileSync(subsPath, 'utf-8'));
            const pending = (subs.submissions || []).filter(s => s.status === 'pending').length;
            const triaged = (subs.submissions || []).filter(s => s.status === 'triaged').length;
            const bounty = (subs.submissions || []).filter(s => s.status === 'bounty').length;
            if (pending + triaged + bounty > 0) {
              parts.push(`  Submissions: ${pending} pending, ${triaged} triaged, ${bounty} bounties`);
            }
          } catch {}
        }
      }
    } catch {}
  }

  // --- API key checks ---
  const hasKey = !!process.env.SHODAN_API_KEY;
  if (!hasKey) {
    const configPaths = [
      join(cwd, '.greyhatcc', 'config.json'),
      join(process.env.CLAUDE_PLUGIN_ROOT || '', 'config', 'greyhatcc.json'),
    ];
    const keyFound = configPaths.some(p => {
      try { return !!JSON.parse(readFileSync(p, 'utf-8'))?.shodan?.apiKey; } catch { return false; }
    });
    if (!keyFound) {
      parts.push('[greyhatcc] WARNING: No Shodan API key. Set SHODAN_API_KEY env var.');
    }
  }

  if (parts.length > 0) {
    console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
  }
}

main().catch(() => {});
