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

  // Persist hunt loop state
  if (huntState.active) {
    // Update the hunt state file with a compaction marker
    setHuntState({
      ...huntState,
      lastCompactedAt: new Date().toISOString(),
      compactionCount: (huntState.compactionCount || 0) + 1,
    });

    parts.push(`[greyhatcc:hunt-loop] ACTIVE HUNT — THE HUNTER DOESN'T SLEEP.`);
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

    const completedPhases = huntState.completedPhases || [];
    if (completedPhases.length > 0) {
      parts.push(`Completed phases: ${completedPhases.join(', ')}`);
    }

    parts.push(`Verifications: ${huntState.verificationsPassed || 0}/${huntState.verificationsRequired || 3}`);
    parts.push('');
    parts.push('RESUME INSTRUCTIONS: Continue the hunt loop from the current phase. Do NOT restart from Phase 0. Read .greyhatcc/hunt-state.json for full state.');
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
