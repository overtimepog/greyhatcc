import { readStdin } from './lib/stdin.mjs';
import { getHuntState, setHuntState, readScope, getFindings, getActiveProgram } from './lib/state.mjs';

/**
 * PreCompact Hook: Save critical state before context window compression.
 * Inspired by OMC's PreCompact directive persistence.
 *
 * This ensures the hunt loop, current phase, pending findings, and blockers
 * survive context compaction and can be resumed seamlessly.
 */
async function main() {
  await readStdin();

  const huntState = getHuntState();
  const scope = readScope();
  const program = getActiveProgram();

  const parts = [];

  // Persist legacy hunt loop state (.greyhatcc/hunt-state.json)
  if (huntState.active) {
    setHuntState({
      ...huntState,
      lastCompactedAt: new Date().toISOString(),
      compactionCount: (huntState.compactionCount || 0) + 1,
    });

    parts.push(`[greyhatcc:hunt-loop] ACTIVE LEGACY HUNT — THE HUNTER DOESN'T SLEEP.`);
    parts.push(`Program: ${huntState.program || program || 'unknown'}`);
    parts.push(`Phase: ${huntState.phase || 'unknown'}`);
    parts.push(`Iteration: ${huntState.iteration || 0}`);

    if (huntState.currentTarget) {
      parts.push(`Current target: ${huntState.currentTarget}`);
    }

    if (huntState.pendingFindings?.length > 0) {
      parts.push(`Pending findings (${huntState.pendingFindings.length}): ${huntState.pendingFindings.map(f => f.title || f).join(', ')}`);
    }

    if (huntState.blockers?.length > 0) {
      parts.push(`Blockers: ${huntState.blockers.join(', ')}`);
    }

    parts.push('');
    parts.push('RESUME: Continue the hunt loop from the current phase. Read .greyhatcc/hunt-state.json for full state.');
  }

  // Persist new v7 hunt-state/ directory (event-driven architecture)
  const { existsSync: exists, readFileSync: readFile } = await import('fs');
  const { join: joinPath } = await import('path');
  const huntStateDir = joinPath(process.cwd(), 'hunt-state');
  const v7HuntPath = joinPath(huntStateDir, 'hunt.json');
  if (exists(v7HuntPath)) {
    try {
      const v7State = JSON.parse(readFile(v7HuntPath, 'utf-8'));
      if (v7State.status === 'running') {
        parts.push(`[greyhatcc:hunt-loop] ACTIVE v7 HUNT — EVENT-DRIVEN LOOP PRESERVING STATE.`);
        parts.push(`Program: ${v7State.program}`);
        parts.push(`Hunt ID: ${v7State.hunt_id}`);
        parts.push(`Intel runs: ${v7State.intel_runs || 0}`);

        const queuePath = joinPath(huntStateDir, 'queue.json');
        if (exists(queuePath)) {
          try {
            const queue = JSON.parse(readFile(queuePath, 'utf-8'));
            const queued = queue.filter(i => i.status === 'queued').length;
            parts.push(`Queue: ${queued} items waiting`);
          } catch {}
        }

        parts.push('');
        parts.push('RESUME: Run /greyhatcc:hunt --resume. State is persisted in hunt-state/ directory. Do NOT restart from SEED.');
      }
    } catch {}
  }

  // Always persist scope context
  if (scope?.engagement) {
    parts.push(`[greyhatcc] Active engagement: ${scope.engagement}`);
    if (scope.authorized?.domains?.length) {
      parts.push(`Scope: ${scope.authorized.domains.slice(0, 10).join(', ')}${scope.authorized.domains.length > 10 ? ` (+${scope.authorized.domains.length - 10} more)` : ''}`);
    }
    if (scope.rules?.requiredHeaders) {
      parts.push(`Required headers: ${JSON.stringify(scope.rules.requiredHeaders)}`);
    }
  }

  // Persist findings summary
  if (program) {
    const findings = getFindings(program);
    if (findings.length > 0) {
      parts.push(`Findings so far: ${findings.length} (${findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length} high+)`);
    }
  }

  if (parts.length > 0) {
    console.log(JSON.stringify({
      'system-reminder': parts.join('\n')
    }));
  }
}

main().catch(() => {});
