import { readStdin } from './lib/stdin.mjs';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Recovery Loader: SessionStart hook that reconstructs context after compaction.
 *
 * Checks for compaction-marker.json. If found, loads the handoff bundle and
 * injects a system-reminder with full recovery context. Then cleans up the marker.
 */
async function main() {
  await readStdin();
  const cwd = process.cwd();
  const huntDir = join(cwd, 'hunt-state');
  const markerPath = join(huntDir, 'compaction-marker.json');

  // Only activate if compaction happened
  if (!existsSync(markerPath)) return;

  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf-8'));
  } catch { return; }

  const parts = [];
  parts.push(`[greyhatcc:recovery] Context was compacted at ${marker.timestamp}. Recovering hunt state.`);

  // Load handoff bundle (primary recovery artifact)
  const bundlePath = join(huntDir, 'handoff-bundle.md');
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, 'utf-8');
    // Extract key info from bundle (first 30 lines max)
    const bundleLines = bundle.split('\n').slice(0, 30);
    parts.push('');
    parts.push('--- HANDOFF BUNDLE ---');
    parts.push(...bundleLines);
    parts.push('--- END BUNDLE ---');
  }

  // Load current stage
  const stagePath = join(huntDir, 'current-stage.md');
  if (existsSync(stagePath)) {
    const stageContent = readFileSync(stagePath, 'utf-8');
    const stageMatch = stageContent.match(/^# Current Stage: (.+)$/m);
    if (stageMatch) {
      parts.push('');
      parts.push(`Current stage: ${stageMatch[1].trim()}`);
      parts.push(`Stage controller: stages/${stageMatch[1].trim()}.md`);
    }
  }

  // Load next actions
  const actionsPath = join(huntDir, 'next-actions.md');
  if (existsSync(actionsPath)) {
    const actions = readFileSync(actionsPath, 'utf-8');
    const actionLines = actions.split('\n').filter(l => l.startsWith('- ')).slice(0, 5);
    if (actionLines.length > 0) {
      parts.push('');
      parts.push('Next actions:');
      parts.push(...actionLines);
    }
  }

  // Load recent decisions (last 5)
  const decisionPath = join(huntDir, 'decision-log.md');
  if (existsSync(decisionPath)) {
    const decisions = readFileSync(decisionPath, 'utf-8');
    const decLines = decisions.split('\n').filter(l => l.startsWith('- ')).slice(-5);
    if (decLines.length > 0) {
      parts.push('');
      parts.push('Recent decisions:');
      parts.push(...decLines);
    }
  }

  parts.push('');
  parts.push('RESUME: Run /greyhatcc:hunt --resume to continue. All state is on disk in hunt-state/.');

  // Clean up compaction marker (one-shot recovery)
  try { unlinkSync(markerPath); } catch {}

  console.log(JSON.stringify({ 'system-reminder': parts.join('\n') }));
}

main().catch(() => {});
