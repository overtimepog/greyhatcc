import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CWD = process.cwd();
const HUNT_DIR = join(CWD, 'hunt-state');
const LOG_PATH = join(HUNT_DIR, 'decision-log.md');

function ensureDir() {
  if (!existsSync(HUNT_DIR)) mkdirSync(HUNT_DIR, { recursive: true });
}

/**
 * Append a decision entry to the audit log.
 * Format: timestamp | action | reason
 * @param {string} action - What was done (e.g. "dispatched xss-worker to example.com/login")
 * @param {string} reason - Why (e.g. "signal: reflected-input on search param")
 * @param {object} meta - Optional metadata (item_id, worker, model, etc.)
 */
export function logDecision(action, reason, meta = {}) {
  ensureDir();
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const metaStr = meta.item_id ? ` [${meta.item_id}]` : '';
  const modelStr = meta.model ? ` (${meta.model})` : '';
  const line = `- ${ts}${metaStr}${modelStr} ${action} — ${reason}\n`;
  appendFileSync(LOG_PATH, line);
}

/**
 * Read the last N lines from the decision log.
 * @param {number} n - Number of lines to return (0 = all)
 * @returns {string[]}
 */
export function readRecentDecisions(n = 20) {
  if (!existsSync(LOG_PATH)) return [];
  const content = readFileSync(LOG_PATH, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.startsWith('- '));
  if (n <= 0) return lines;
  return lines.slice(-n);
}

/**
 * Initialize the decision log with a header.
 * Called once at hunt start.
 * @param {string} program - Program handle
 */
export function initDecisionLog(program) {
  ensureDir();
  const header = [
    '# Decision Log',
    '',
    `Hunt: ${program}`,
    `Started: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ].join('\n');
  appendFileSync(LOG_PATH, header);
}

/**
 * Log a stage transition.
 * @param {string} from - Previous stage
 * @param {string} to - Next stage
 * @param {string} reason - Why the transition happened
 */
export function logStageTransition(from, to, reason) {
  logDecision(`STAGE: ${from} → ${to}`, reason);
}

/**
 * Log an intel analysis run.
 * @param {number} newItems - Number of new work items generated
 * @param {number} chainsFound - Number of chains discovered
 * @param {string[]} highlights - Key intel findings (1-2 words each)
 */
export function logIntelRun(newItems, chainsFound, highlights = []) {
  const hl = highlights.length > 0 ? ` highlights: ${highlights.join(', ')}` : '';
  logDecision(`INTEL: +${newItems} items, ${chainsFound} chains${hl}`, 'periodic intel analysis');
}
