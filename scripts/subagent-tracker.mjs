import { readStdin } from './lib/stdin.mjs';
import { logAgentEvent } from './lib/agent-log.mjs';
import { getHuntState } from './lib/state.mjs';

/**
 * Subagent Tracker Hook
 *
 * Handles both SubagentStart and SubagentStop events.
 * Mode is determined by process.argv[2] ("start" or "stop").
 *
 * - start: logs agent spawn, injects hunt phase context if hunt is active
 * - stop: logs agent completion with duration
 */
async function main() {
  const input = await readStdin();
  const mode = process.argv[2];

  const agentName = input?.agent_name || input?.subagent_type || 'unknown';
  const model = input?.model || 'unknown';

  if (mode === 'start') {
    logAgentEvent('start', agentName, model, {
      task: input?.prompt?.slice(0, 200) || '',
    });

    const huntState = getHuntState();
    if (huntState.active) {
      const parts = [];
      parts.push(`[greyhatcc:hunt-loop] Active hunt context for subagent`);
      parts.push(`  Program: ${huntState.program || 'unknown'}`);
      parts.push(`  Phase: ${huntState.phase || 'unknown'}`);
      parts.push(`  Iteration: ${huntState.iteration || 0}`);
      if (huntState.completedPhases?.length > 0) {
        parts.push(`  Completed: ${huntState.completedPhases.join(', ')}`);
      }
      console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
    }
  } else if (mode === 'stop') {
    const durationMs = input?.duration_ms || input?.durationMs || 0;
    logAgentEvent('stop', agentName, model, {
      durationMs,
      exitReason: input?.exit_reason || input?.exitReason || 'completed',
    });
  }
}

main().catch(() => {});
