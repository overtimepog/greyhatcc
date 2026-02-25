import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const CWD = process.cwd();
const STATE_DIR = join(CWD, 'hunt-state');
const QUEUE_FILE = join(STATE_DIR, 'queue.json');

// ── Priority adjustment constants ──────────────────────────────────────────
// Use these when building work items to set meaningful initial priorities.
export const PRIORITY_ADJUSTMENTS = {
  SIGNAL_AMPLIFICATION:        +20,
  HIGH_BOUNTY_SCOPE:           +15,
  PARENT_HIGH_CONFIDENCE:      +15,  // parent finding confidence > 0.6
  CHAIN_OPPORTUNITY:           +25,
  NEEDS_VALIDATION:            +30,  // partial finding needs confirmation
  FAILED_ONCE:                 -10,
  FAILED_TWICE:                -25,
  LOW_CONFIDENCE_SIGNAL:       -15,  // signal confidence < 0.3
  DUPLICATE_RISK:              -20,
  COVERAGE_GAP:                +10,
};

const BASE_PRIORITY = 50;

// ── Internal helpers ───────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

/** Clamp a number between min and max (inclusive). */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ── Queue persistence ──────────────────────────────────────────────────────

/**
 * Load the work-item queue from disk.
 * Returns an empty array if the file is missing or corrupt.
 */
export function loadQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Persist the work-item array to hunt-state/queue.json.
 */
export function saveQueue(items) {
  ensureDir();
  writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2));
}

// ── Core queue operations ──────────────────────────────────────────────────

/**
 * Add new work items to the queue.
 *
 * @param {Array<object>} items - Partial work-item objects. At minimum each
 *   should include `type` and `target`. Missing fields are filled with
 *   sensible defaults.
 * @returns {Array<object>} The fully-populated WorkItem objects that were added.
 */
export function enqueue(items) {
  const queue = loadQueue();
  const now = new Date().toISOString();

  const added = items.map(partial => ({
    // Defaults (overridden by anything in `partial`)
    id:               randomUUID(),
    type:             'unknown',
    target:           null,
    priority:         BASE_PRIORITY,
    model_tier:       'haiku',
    parent_id:        null,
    context:          {},
    status:           'queued',
    escalation_count: 0,
    retry_count:      0,
    children_ids:     [],
    result:           null,
    created_at:       now,
    started_at:       null,
    completed_at:     null,
    // Caller overrides
    ...partial,
    // Force these regardless of caller input
    status:           'queued',
    escalation_count: partial.escalation_count ?? 0,
    retry_count:      partial.retry_count ?? 0,
    children_ids:     partial.children_ids ?? [],
    result:           null,
    started_at:       null,
    completed_at:     null,
    created_at:       now,
    id:               partial.id ?? randomUUID(),
  }));

  queue.push(...added);
  saveQueue(queue);
  return added;
}

/**
 * Pull the highest-priority queued item off the queue and mark it active.
 * Returns null when no queued work remains.
 */
export function dequeue() {
  const queue = loadQueue();

  // Sort candidates by priority descending, then by created_at ascending (FIFO tiebreak)
  const candidates = queue
    .filter(i => i.status === 'queued')
    .sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));

  if (candidates.length === 0) return null;

  const next = candidates[0];
  const item = queue.find(i => i.id === next.id);
  item.status = 'active';
  item.started_at = new Date().toISOString();

  saveQueue(queue);
  return item;
}

/**
 * Mark a work item as successfully completed.
 *
 * If `result.new_work_items` is present, each child gets its `parent_id`
 * set to this item's id, and the parent's `children_ids` is updated.
 *
 * @param {string} id     - Work item id.
 * @param {object} result - Outcome object (should include `success`, `summary`, etc.)
 */
export function complete(id, result) {
  const queue = loadQueue();
  const item = queue.find(i => i.id === id);
  if (!item) return;

  item.status = 'done';
  item.completed_at = new Date().toISOString();
  item.result = result;

  // Auto-parent any spawned child work items
  if (result?.new_work_items && Array.isArray(result.new_work_items)) {
    for (const child of result.new_work_items) {
      child.parent_id = id;
    }
    const added = enqueue(result.new_work_items);
    item.children_ids = added.map(c => c.id);

    // Re-load queue since enqueue() saved its own copy
    const freshQueue = loadQueue();
    const freshItem = freshQueue.find(i => i.id === id);
    freshItem.status = 'done';
    freshItem.completed_at = item.completed_at;
    freshItem.result = result;
    freshItem.children_ids = item.children_ids;
    saveQueue(freshQueue);
    return;
  }

  saveQueue(queue);
}

/**
 * Mark a work item as failed.
 *
 * @param {string} id    - Work item id.
 * @param {string} error - Human-readable error description.
 */
export function fail(id, error) {
  const queue = loadQueue();
  const item = queue.find(i => i.id === id);
  if (!item) return;

  item.status = 'failed';
  item.completed_at = new Date().toISOString();
  item.result = {
    success: false,
    summary: error,
    findings: [],
    new_work_items: [],
    signals: [],
    gadgets: [],
  };
  item.retry_count = (item.retry_count || 0) + 1;

  saveQueue(queue);
}

/**
 * Escalate a failed/stuck item to a higher model tier and re-queue it.
 *
 * Tier progression: haiku -> sonnet -> opus (caps at opus).
 *
 * @param {string} id - Work item id.
 * @returns {object|null} The updated item, or null if not found.
 */
export function escalate(id) {
  const queue = loadQueue();
  const item = queue.find(i => i.id === id);
  if (!item) return null;

  const TIER_ORDER = ['haiku', 'sonnet', 'opus'];
  const currentIdx = TIER_ORDER.indexOf(item.model_tier);
  const nextIdx = Math.min(currentIdx + 1, TIER_ORDER.length - 1);

  item.escalation_count = (item.escalation_count || 0) + 1;
  item.model_tier = TIER_ORDER[nextIdx];
  item.status = 'queued';
  item.started_at = null;
  item.completed_at = null;
  item.retry_count = (item.retry_count || 0) + 1;

  saveQueue(queue);
  return item;
}

/**
 * Batch-adjust priorities for multiple items.
 *
 * @param {Array<{id: string, delta: number, reason: string}>} adjustments
 */
export function reprioritize(adjustments) {
  const queue = loadQueue();

  for (const { id, delta } of adjustments) {
    const item = queue.find(i => i.id === id);
    if (!item) continue;
    item.priority = clamp((item.priority || BASE_PRIORITY) + delta, 0, 100);
  }

  saveQueue(queue);
}

// ── Read-only helpers ──────────────────────────────────────────────────────

/**
 * Return aggregate counts by status.
 */
export function stats() {
  const queue = loadQueue();
  const counts = { queued: 0, active: 0, done: 0, failed: 0 };
  for (const item of queue) {
    if (counts[item.status] !== undefined) {
      counts[item.status]++;
    }
  }
  return counts;
}

/**
 * Preview the top N queued items by priority without modifying them.
 *
 * @param {number} n - How many items to peek at.
 * @returns {Array<object>}
 */
export function peek(n = 5) {
  const queue = loadQueue();
  return queue
    .filter(i => i.status === 'queued')
    .sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))
    .slice(0, n);
}

/**
 * Return all items matching a predicate function.
 *
 * @param {function} predicateFn - Receives a work item, returns boolean.
 * @returns {Array<object>}
 */
export function filter(predicateFn) {
  return loadQueue().filter(predicateFn);
}
