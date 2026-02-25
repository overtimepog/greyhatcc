import { readStdin } from './lib/stdin.mjs';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Enhanced PreCompact Hook: Write handoff bundle before context compaction.
 *
 * Replaces the old pre-compact.mjs with a cleaner, artifact-first approach.
 * Writes both the system-reminder for context injection AND durable handoff files.
 */
async function main() {
  await readStdin();
  const cwd = process.cwd();
  const huntDir = join(cwd, 'hunt-state');
  const huntPath = join(huntDir, 'hunt.json');

  // Only activate for running hunts
  if (!existsSync(huntPath)) return;

  let huntState;
  try {
    huntState = JSON.parse(readFileSync(huntPath, 'utf-8'));
  } catch { return; }

  if (huntState.status !== 'running') return;

  // Gather state summaries
  const stage = readCurrentStageRaw(huntDir);
  const queueHead = readQueueHead(huntDir);
  const queueStats = readQueueStats(huntDir);
  const findingsCount = readFindingsCount(huntDir);
  const recentDecisions = readRecentDecisions(huntDir, 5);

  // Write handoff bundle (durable artifact)
  const bundleLines = [
    '# Hunt Handoff Bundle',
    '',
    `Written: ${new Date().toISOString()}`,
    `Reason: context compaction`,
    '',
    `## Stage: ${stage || 'unknown'}`,
    `Program: ${huntState.program || 'unknown'}`,
    `Hunt ID: ${huntState.hunt_id || 'unknown'}`,
    `Queue: ${queueStats.queued} queued / ${queueStats.done} done / ${queueStats.failed} failed`,
    `Findings: ${findingsCount} total`,
    '',
    '## Resume Instructions',
    '',
    '1. Run /greyhatcc:hunt --resume',
    '2. Dispatcher reads hunt-state/ files for full state',
    `3. Stage controller: stages/${stage || 'unknown'}.md`,
    '',
    '## Queue Head',
    '',
  ];
  for (const item of queueHead) {
    bundleLines.push(`- [P${item.priority}] ${item.type}/${item.subtype} → ${item.target} (${item.id})`);
  }
  if (queueHead.length === 0) bundleLines.push('Queue empty.');
  if (recentDecisions.length > 0) {
    bundleLines.push('', '## Recent Decisions', '');
    for (const d of recentDecisions) bundleLines.push(d);
  }
  writeFileSync(join(huntDir, 'handoff-bundle.md'), bundleLines.join('\n'));

  // Write compaction marker
  writeFileSync(join(huntDir, 'compaction-marker.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    stage,
    queued: queueStats.queued,
    findings: findingsCount,
  }));

  // Update hunt state
  huntState.last_active = new Date().toISOString();
  huntState.compaction_count = (huntState.compaction_count || 0) + 1;
  writeFileSync(huntPath, JSON.stringify(huntState, null, 2));

  // Emit system-reminder for context injection
  const parts = [
    `[greyhatcc:hunt-loop] ACTIVE HUNT — CONTEXT COMPACTED. THE HUNTER DOESN'T SLEEP.`,
    `Program: ${huntState.program || 'unknown'}`,
    `Stage: ${stage || 'unknown'}`,
    `Queue: ${queueStats.queued} queued / ${queueStats.done} done`,
    `Findings: ${findingsCount} total`,
    '',
    'RESUME: Run /greyhatcc:hunt --resume. State is in hunt-state/. Read hunt-state/handoff-bundle.md for full context.',
  ];

  console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
}

// --- Helpers (inline to avoid import issues in hooks) ---

function readCurrentStageRaw(huntDir) {
  const p = join(huntDir, 'current-stage.md');
  if (!existsSync(p)) return null;
  const content = readFileSync(p, 'utf-8');
  const match = content.match(/^# Current Stage: (.+)$/m);
  return match ? match[1].trim() : null;
}

function readQueueHead(huntDir, n = 5) {
  const p = join(huntDir, 'queue.json');
  if (!existsSync(p)) return [];
  try {
    const queue = JSON.parse(readFileSync(p, 'utf-8'));
    return queue
      .filter(i => i.status === 'queued')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, n)
      .map(i => ({ id: i.id, type: i.type, subtype: i.subtype, target: i.target, priority: i.priority }));
  } catch { return []; }
}

function readQueueStats(huntDir) {
  const p = join(huntDir, 'queue.json');
  if (!existsSync(p)) return { queued: 0, done: 0, failed: 0 };
  try {
    const queue = JSON.parse(readFileSync(p, 'utf-8'));
    return {
      queued: queue.filter(i => i.status === 'queued').length,
      done: queue.filter(i => i.status === 'done').length,
      failed: queue.filter(i => i.status === 'failed').length,
    };
  } catch { return { queued: 0, done: 0, failed: 0 }; }
}

function readFindingsCount(huntDir) {
  const p = join(huntDir, 'findings.json');
  if (!existsSync(p)) return 0;
  try { return JSON.parse(readFileSync(p, 'utf-8')).length; } catch { return 0; }
}

function readRecentDecisions(huntDir, n = 5) {
  const p = join(huntDir, 'decision-log.md');
  if (!existsSync(p)) return [];
  const content = readFileSync(p, 'utf-8');
  return content.trim().split('\n').filter(l => l.startsWith('- ')).slice(-n);
}

main().catch(() => {});
