import { readStdin } from './lib/stdin.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * PreCompact Hook: Hunt State Saver
 *
 * Saves hunt loop state before context window compaction.
 * This ensures the hunt loop can resume from exactly where it was
 * after context compaction occurs.
 *
 * Separate from pre-compact.mjs which handles general directives.
 * This hook specifically handles hunt-state/ persistence.
 */
async function main() {
  await readStdin();

  const cwd = process.cwd();
  const huntStateDir = join(cwd, 'hunt-state');

  // Check if a hunt is active
  const huntJsonPath = join(huntStateDir, 'hunt.json');
  if (!existsSync(huntJsonPath)) {
    // No active hunt — nothing to save
    return;
  }

  try {
    const huntState = JSON.parse(readFileSync(huntJsonPath, 'utf-8'));

    // Only act if hunt is running
    if (huntState.status !== 'running') {
      return;
    }

    // Write compaction marker so the loop knows context was compacted
    const marker = {
      compacted_at: new Date().toISOString(),
      reason: 'context_compaction',
      hunt_id: huntState.hunt_id,
      program: huntState.program,
      resume_instruction: 'Hunt was interrupted by context compaction. Load hunt-state/ and resume the loop. Do NOT restart from SEED.'
    };

    writeFileSync(
      join(huntStateDir, 'compaction-marker.json'),
      JSON.stringify(marker, null, 2)
    );

    // Update hunt state with compaction info
    huntState.last_active = new Date().toISOString();
    writeFileSync(huntJsonPath, JSON.stringify(huntState, null, 2));

    // Load queue stats for the resume message
    const queuePath = join(huntStateDir, 'queue.json');
    let queueStats = { queued: 0, active: 0, done: 0, failed: 0 };
    if (existsSync(queuePath)) {
      try {
        const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));
        queueStats = {
          queued: queue.filter(i => i.status === 'queued').length,
          active: queue.filter(i => i.status === 'active').length,
          done: queue.filter(i => i.status === 'done').length,
          failed: queue.filter(i => i.status === 'failed').length,
        };
      } catch {}
    }

    // Load findings count
    const findingsPath = join(huntStateDir, 'findings.json');
    let findingsCount = 0;
    if (existsSync(findingsPath)) {
      try {
        findingsCount = JSON.parse(readFileSync(findingsPath, 'utf-8')).length;
      } catch {}
    }

    const parts = [
      `[greyhatcc:hunt-loop] CONTEXT COMPACTED — HUNT STATE PRESERVED`,
      `Program: ${huntState.program}`,
      `Queue: ${queueStats.queued} queued, ${queueStats.active} active, ${queueStats.done} done, ${queueStats.failed} failed`,
      `Findings: ${findingsCount} total`,
      `Intel runs: ${huntState.intel_runs || 0}`,
      '',
      'RESUME: Load hunt-state/ files and continue the hunt loop from where it left off.',
      'Do NOT restart from SEED. The queue has pending work items.',
    ];

    console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
  } catch {}
}

main().catch(() => {});
