import { readStdin } from './lib/stdin.mjs';
import { getHuntState, setHuntState } from './lib/state.mjs';

/**
 * Hunt Persist Hook (Stop / Ctrl+C)
 *
 * Marks the hunt as interrupted so the next session can resume.
 * Outputs resume instructions as a system-reminder.
 */
async function main() {
  await readStdin();

  const huntState = getHuntState();
  if (!huntState.active) return;

  setHuntState({ ...huntState, interrupted: true });

  const parts = [];
  parts.push(`[greyhatcc:hunt-loop] Hunt interrupted (Ctrl+C / stop)`);
  parts.push(`  Program: ${huntState.program || 'unknown'}`);
  parts.push(`  Phase: ${huntState.phase || 'unknown'}`);
  parts.push(`  Iteration: ${huntState.iteration || 0}`);
  parts.push(`  >> Hunt state saved. Run "hunt" in next session to resume from phase: ${huntState.phase}`);

  console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
}

main().catch(() => {});
