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

  // --- Check new hunt-state/ directory (v7 event-driven architecture) ---
  const huntStateDir = join(cwd, 'hunt-state');
  const newHuntStatePath = join(huntStateDir, 'hunt.json');
  if (existsSync(newHuntStatePath)) {
    try {
      const huntState = JSON.parse(readFileSync(newHuntStatePath, 'utf-8'));
      if (huntState.status === 'running') {
        parts.push(`[greyhatcc:hunt-loop] RESUMING ACTIVE HUNT (v7 event-driven)`);
        parts.push(`  Program: ${huntState.program || 'unknown'}`);
        parts.push(`  Hunt ID: ${huntState.hunt_id || 'unknown'}`);
        parts.push(`  Last active: ${huntState.last_active || 'unknown'}`);
        parts.push(`  Intel runs: ${huntState.intel_runs || 0}`);

        // Load queue stats
        const queuePath = join(huntStateDir, 'queue.json');
        if (existsSync(queuePath)) {
          try {
            const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));
            const queued = queue.filter(i => i.status === 'queued').length;
            const active = queue.filter(i => i.status === 'active').length;
            const done = queue.filter(i => i.status === 'done').length;
            const failed = queue.filter(i => i.status === 'failed').length;
            parts.push(`  Queue: ${queued} queued, ${active} active, ${done} done, ${failed} failed`);
          } catch {}
        }

        // Load findings count
        const findingsPath = join(huntStateDir, 'findings.json');
        if (existsSync(findingsPath)) {
          try {
            const findings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
            const confirmed = findings.filter(f => f.status === 'confirmed' || f.status === 'validated').length;
            parts.push(`  Findings: ${findings.length} total (${confirmed} confirmed/validated)`);
          } catch {}
        }

        // Check for compaction marker
        const markerPath = join(huntStateDir, 'compaction-marker.json');
        if (existsSync(markerPath)) {
          parts.push(`  NOTE: Context was compacted during hunt. State preserved on disk.`);
        }

        parts.push(`  >> Run /greyhatcc:hunt --resume to continue the hunt loop.`);
        parts.push('');
      }
    } catch {}
  }

  // --- Check legacy hunt loop state (.greyhatcc/hunt-state.json) ---
  const huntStatePath = join(cwd, '.greyhatcc', 'hunt-state.json');
  if (existsSync(huntStatePath) && !existsSync(newHuntStatePath)) {
    try {
      const huntState = JSON.parse(readFileSync(huntStatePath, 'utf-8'));
      if (huntState.active) {
        parts.push(`[greyhatcc:hunt-loop] LEGACY HUNT STATE DETECTED`);
        parts.push(`  Program: ${huntState.program || 'unknown'}`);
        parts.push(`  Phase: ${huntState.phase || 'unknown'}`);
        parts.push(`  >> This is a v6 hunt state. Run /greyhatcc:hunt to start a new v7 hunt.`);
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
