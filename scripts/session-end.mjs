import { readStdin } from './lib/stdin.mjs';
import { getAgentStats, writeSessionSummary } from './lib/agent-log.mjs';
import { getHuntState, getFindings, getActiveProgram } from './lib/state.mjs';

/**
 * Session End Hook
 *
 * Writes a session summary to .greyhatcc/session-history.jsonl
 * including agent stats, hunt phase, and findings count.
 */
async function main() {
  await readStdin();

  const agentStats = getAgentStats();
  const huntState = getHuntState();
  const program = getActiveProgram();
  const findings = getFindings(program);

  writeSessionSummary({
    agentStats,
    huntPhase: huntState.active ? huntState.phase : null,
    huntProgram: huntState.program || program || null,
    findingsCount: findings.length,
  });
}

main().catch(() => {});
