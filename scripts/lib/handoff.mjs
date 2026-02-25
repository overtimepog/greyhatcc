import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CWD = process.cwd();
const HUNT_DIR = join(CWD, 'hunt-state');

function ensureDir() {
  if (!existsSync(HUNT_DIR)) mkdirSync(HUNT_DIR, { recursive: true });
}

/**
 * Write the current-stage.md handoff artifact.
 * Human-readable file the dispatcher reads on resume.
 * @param {string} stage - Stage name (e.g. "hunt-recon")
 * @param {object} context - Optional context (program, items remaining, etc.)
 */
export function writeCurrentStage(stage, context = {}) {
  ensureDir();
  const lines = [
    `# Current Stage: ${stage}`,
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
  ];
  if (context.program) lines.push(`Program: ${context.program}`);
  if (context.queued != null) lines.push(`Queue: ${context.queued} items waiting`);
  if (context.findings != null) lines.push(`Findings: ${context.findings} total`);
  if (context.note) lines.push('', `Note: ${context.note}`);
  lines.push('', `Next: read stages/${stage}.md for stage instructions`);
  writeFileSync(join(HUNT_DIR, 'current-stage.md'), lines.join('\n'));
}

/**
 * Read the current stage from current-stage.md
 * @returns {string|null} Stage name or null if not set
 */
export function readCurrentStage() {
  const p = join(HUNT_DIR, 'current-stage.md');
  if (!existsSync(p)) return null;
  const content = readFileSync(p, 'utf-8');
  const match = content.match(/^# Current Stage: (.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Write next-actions.md — queue head and upcoming work.
 * @param {Array<object>} items - Top N queue items (compact: id, type, target, priority)
 * @param {object} stats - Queue stats
 */
export function writeNextActions(items, stats = {}) {
  ensureDir();
  const lines = [
    '# Next Actions',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    `Queue: ${stats.queued || '?'} queued / ${stats.done || '?'} done / ${stats.failed || '?'} failed`,
    '',
    '## Up Next',
    '',
  ];
  if (items.length === 0) {
    lines.push('Queue empty — ready for finalize.');
  } else {
    for (const item of items.slice(0, 10)) {
      lines.push(`- [P${item.priority || '?'}] ${item.type}/${item.subtype || '?'} → ${item.target || 'unknown'} (${item.id || '?'})`);
    }
    if (items.length > 10) {
      lines.push(`- ... and ${items.length - 10} more`);
    }
  }
  writeFileSync(join(HUNT_DIR, 'next-actions.md'), lines.join('\n'));
}

/**
 * Read next-actions.md content.
 * @returns {string|null}
 */
export function readNextActions() {
  const p = join(HUNT_DIR, 'next-actions.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

/**
 * Write the full handoff bundle used by pre-compact hook.
 * Combines current-stage + next-actions + recent decisions into one block.
 * @param {object} bundle - { stage, queueHead, stats, recentDecisions, findings }
 * @returns {string} The formatted bundle text
 */
export function writeHandoffBundle(bundle) {
  ensureDir();
  const lines = [
    '# Hunt Handoff Bundle',
    '',
    `Written: ${new Date().toISOString()}`,
    `Reason: context compaction`,
    '',
    `## Stage: ${bundle.stage || 'unknown'}`,
    '',
    `Program: ${bundle.program || 'unknown'}`,
    `Queue: ${bundle.stats?.queued || '?'} queued / ${bundle.stats?.done || '?'} done`,
    `Findings: ${bundle.stats?.findings || '?'} total`,
    '',
    '## Resume Instructions',
    '',
    `1. Run /greyhatcc:hunt --resume`,
    `2. Dispatcher reads hunt-state/ files for full state`,
    `3. Stage controller: stages/${bundle.stage || 'unknown'}.md`,
    '',
    '## Queue Head',
    '',
  ];
  if (bundle.queueHead?.length > 0) {
    for (const item of bundle.queueHead.slice(0, 5)) {
      lines.push(`- [P${item.priority}] ${item.type}/${item.subtype} → ${item.target}`);
    }
  } else {
    lines.push('Queue empty.');
  }
  if (bundle.recentDecisions?.length > 0) {
    lines.push('', '## Recent Decisions (last 5)', '');
    for (const d of bundle.recentDecisions.slice(-5)) {
      lines.push(`- ${d}`);
    }
  }
  const text = lines.join('\n');
  writeFileSync(join(HUNT_DIR, 'handoff-bundle.md'), text);
  return text;
}

/**
 * Read the handoff bundle.
 * @returns {string|null}
 */
export function readHandoffBundle() {
  const p = join(HUNT_DIR, 'handoff-bundle.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}
