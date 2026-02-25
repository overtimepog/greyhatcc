#!/usr/bin/env node

/**
 * Unit tests for model escalation and priority logic in hunt-queue.mjs
 * Tests: escalate, reprioritize, enqueue, dequeue, complete, fail interactions
 */

import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const HUNT_STATE_DIR = join(process.cwd(), 'hunt-state');

function cleanup() {
  const queuePath = join(HUNT_STATE_DIR, 'queue.json');
  if (existsSync(queuePath)) rmSync(queuePath);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

async function runTests() {
  if (!existsSync(HUNT_STATE_DIR)) mkdirSync(HUNT_STATE_DIR, { recursive: true });

  const {
    loadQueue, enqueue, dequeue, complete, fail, escalate, reprioritize,
  } = await import('../scripts/lib/hunt-queue.mjs');

  // ── Group 1: Model escalation path ────────────────────────────────────────
  console.log('\n=== Test Group 1: Model Escalation Path ===\n');
  cleanup();

  const [haikuItem] = enqueue([
    { type: 'test', target: 'example.com', model_tier: 'haiku' },
  ]);

  // haiku -> sonnet
  const afterFirst = escalate(haikuItem.id);
  assert(afterFirst !== null, 'escalate returns the updated item');
  assert(afterFirst.model_tier === 'sonnet', 'escalation path: haiku → sonnet');
  assert(afterFirst.escalation_count === 1, 'escalation_count is 1 after first escalation');
  assert(afterFirst.status === 'queued', 'escalation resets status to queued');

  // sonnet -> opus
  const afterSecond = escalate(haikuItem.id);
  assert(afterSecond.model_tier === 'opus', 'escalation path: sonnet → opus');
  assert(afterSecond.escalation_count === 2, 'escalation_count is 2 after second escalation');
  assert(afterSecond.status === 'queued', 'escalation resets status to queued again');

  // ── Group 2: Opus is the ceiling ───────────────────────────────────────────
  console.log('\n=== Test Group 2: Opus is the Ceiling ===\n');
  cleanup();

  const [opusItem] = enqueue([
    { type: 'test', target: 'example.com', model_tier: 'opus' },
  ]);

  const opusEscalated = escalate(opusItem.id);
  assert(opusEscalated.model_tier === 'opus', 'escalating opus stays at opus');
  assert(opusEscalated.escalation_count === 1, 'escalation_count still increments even at ceiling');
  assert(opusEscalated.status === 'queued', 'escalating opus resets status to queued');

  // Escalate again to confirm it stays at opus
  const opusEscalated2 = escalate(opusItem.id);
  assert(opusEscalated2.model_tier === 'opus', 'escalating opus again stays at opus');
  assert(opusEscalated2.escalation_count === 2, 'escalation_count is 2 after two escalations from opus');

  // ── Group 3: Escalation resets status and increments escalation_count ──────
  console.log('\n=== Test Group 3: Escalation State Transitions ===\n');
  cleanup();

  const [statusItem] = enqueue([
    { type: 'test', target: 'example.com', model_tier: 'haiku' },
  ]);

  // Make item active
  const active = dequeue();
  assert(active.id === statusItem.id, 'dequeued the expected item');
  assert(active.status === 'active', 'item is active after dequeue');

  // Escalate while active
  const escalatedActive = escalate(active.id);
  assert(escalatedActive.status === 'queued', 'escalation resets active → queued');
  assert(escalatedActive.started_at === null, 'escalation clears started_at');
  assert(escalatedActive.completed_at === null, 'escalation clears completed_at');

  // Fail and escalate — item is now at sonnet (escalated from haiku above)
  const dequeued2 = dequeue();
  assert(dequeued2.model_tier === 'sonnet', 'item re-dequeued at sonnet tier after earlier escalation');
  fail(dequeued2.id, 'timeout error');
  const afterFail = loadQueue().find(i => i.id === dequeued2.id);
  assert(afterFail.status === 'failed', 'item is failed after fail()');

  const escalatedFailed = escalate(dequeued2.id);
  assert(escalatedFailed.status === 'queued', 'escalation resets failed → queued');
  assert(escalatedFailed.model_tier === 'opus', 'failed sonnet item escalates to opus');
  assert(escalatedFailed.escalation_count === 2, 'escalation_count increments each time regardless of prior status');

  // ── Group 4: Failed items can be escalated and re-dequeued ─────────────────
  console.log('\n=== Test Group 4: Failed Items Re-entry via Escalation ===\n');
  cleanup();

  const [failItem] = enqueue([
    { type: 'test', target: 'example.com', model_tier: 'haiku', priority: 60 },
  ]);

  // Dequeue, fail, escalate, re-dequeue
  dequeue(); // marks active
  fail(failItem.id, 'tool crashed');

  const queueAfterFail = loadQueue();
  const failedEntry = queueAfterFail.find(i => i.id === failItem.id);
  assert(failedEntry.status === 'failed', 'item is failed before escalation');

  escalate(failItem.id);

  const requeued = dequeue();
  assert(requeued !== null, 'escalated failed item can be dequeued again');
  assert(requeued.id === failItem.id, 'dequeued item is the escalated failed item');
  assert(requeued.model_tier === 'sonnet', 're-dequeued item has upgraded model tier');
  assert(requeued.status === 'active', 're-dequeued item becomes active');

  // ── Group 5: Priority adjustments via reprioritize ─────────────────────────
  console.log('\n=== Test Group 5: Priority Adjustments ===\n');
  cleanup();

  const [itemA, itemB] = enqueue([
    { type: 'test', target: 'a.com', priority: 50 },
    { type: 'test', target: 'b.com', priority: 50 },
  ]);

  // Positive delta
  reprioritize([{ id: itemA.id, delta: 20, reason: 'chain opportunity' }]);
  const afterBoost = loadQueue();
  const boostedA = afterBoost.find(i => i.id === itemA.id);
  assert(boostedA.priority === 70, 'positive delta raises priority by exact amount');

  // Negative delta
  reprioritize([{ id: itemB.id, delta: -15, reason: 'low confidence signal' }]);
  const afterDrop = loadQueue();
  const droppedB = afterDrop.find(i => i.id === itemB.id);
  assert(droppedB.priority === 35, 'negative delta lowers priority by exact amount');

  // ── Group 6: Priority clamping ─────────────────────────────────────────────
  console.log('\n=== Test Group 6: Priority Clamping ===\n');
  cleanup();

  const [clampItem] = enqueue([
    { type: 'test', target: 'clamp.com', priority: 90 },
  ]);

  // Clamp at 100
  reprioritize([{ id: clampItem.id, delta: 50, reason: 'test upper clamp' }]);
  const afterUpperClamp = loadQueue().find(i => i.id === clampItem.id);
  assert(afterUpperClamp.priority === 100, 'priority clamped at 100 (upper bound)');

  // Clamp at 0
  reprioritize([{ id: clampItem.id, delta: -200, reason: 'test lower clamp' }]);
  const afterLowerClamp = loadQueue().find(i => i.id === clampItem.id);
  assert(afterLowerClamp.priority === 0, 'priority clamped at 0 (lower bound)');

  // Exact boundary: delta that lands exactly at 100
  reprioritize([{ id: clampItem.id, delta: 100, reason: 'exact boundary' }]);
  const atExact100 = loadQueue().find(i => i.id === clampItem.id);
  assert(atExact100.priority === 100, 'priority exactly at 100 is allowed');

  // Exact boundary: delta that lands exactly at 0 from 100
  reprioritize([{ id: clampItem.id, delta: -100, reason: 'exact lower boundary' }]);
  const atExact0 = loadQueue().find(i => i.id === clampItem.id);
  assert(atExact0.priority === 0, 'priority exactly at 0 is allowed');

  // ── Group 7: Batch reprioritize ────────────────────────────────────────────
  console.log('\n=== Test Group 7: Batch Reprioritize ===\n');
  cleanup();

  const [b1, b2, b3] = enqueue([
    { type: 'test', target: 'b1.com', priority: 50 },
    { type: 'test', target: 'b2.com', priority: 50 },
    { type: 'test', target: 'b3.com', priority: 50 },
  ]);

  reprioritize([
    { id: b1.id, delta: +25, reason: 'batch boost 1' },
    { id: b2.id, delta: -10, reason: 'batch drop 2' },
    { id: b3.id, delta: +5,  reason: 'batch small boost 3' },
  ]);

  const afterBatch = loadQueue();
  const rb1 = afterBatch.find(i => i.id === b1.id);
  const rb2 = afterBatch.find(i => i.id === b2.id);
  const rb3 = afterBatch.find(i => i.id === b3.id);

  assert(rb1.priority === 75, 'batch reprioritize: b1 priority is 75');
  assert(rb2.priority === 40, 'batch reprioritize: b2 priority is 40');
  assert(rb3.priority === 55, 'batch reprioritize: b3 priority is 55');

  // All three were updated in a single reprioritize call
  assert(
    rb1.priority !== rb2.priority && rb2.priority !== rb3.priority,
    'batch reprioritize applies all deltas independently'
  );

  // ── Group 8: Dequeue returns highest priority queued item ──────────────────
  console.log('\n=== Test Group 8: Dequeue Priority Ordering ===\n');
  cleanup();

  enqueue([
    { type: 'test', target: 'low.com',  priority: 20, model_tier: 'haiku' },
    { type: 'test', target: 'high.com', priority: 90, model_tier: 'haiku' },
    { type: 'test', target: 'mid.com',  priority: 55, model_tier: 'haiku' },
  ]);

  const d1 = dequeue();
  assert(d1.target === 'high.com', 'dequeue returns highest priority item first (90)');
  assert(d1.priority === 90, 'dequeued item has priority 90');

  const d2 = dequeue();
  assert(d2.target === 'mid.com', 'dequeue returns next highest priority (55)');
  assert(d2.priority === 55, 'dequeued item has priority 55');

  const d3 = dequeue();
  assert(d3.target === 'low.com', 'dequeue returns lowest priority last (20)');
  assert(d3.priority === 20, 'dequeued item has priority 20');

  const d4 = dequeue();
  assert(d4 === null, 'dequeue returns null when no queued items remain');

  // ── Group 9: Dequeue skips non-queued statuses ─────────────────────────────
  console.log('\n=== Test Group 9: Dequeue Skips Non-Queued Statuses ===\n');
  cleanup();

  const [activeItem, doneItem, failedItem, queuedItem] = enqueue([
    { type: 'test', target: 'active.com',  priority: 80 },
    { type: 'test', target: 'done.com',    priority: 75 },
    { type: 'test', target: 'failed.com',  priority: 70 },
    { type: 'test', target: 'queued.com',  priority: 60 },
  ]);

  // Move three items to non-queued states by manipulating via queue ops
  // active.com: dequeue to make active
  dequeue(); // activeItem becomes active (highest priority 80)

  // done.com: dequeue and complete
  dequeue(); // doneItem becomes active (priority 75)
  complete(doneItem.id, {
    success: true,
    summary: 'done',
    findings: [],
    signals: [],
    gadgets: [],
    new_work_items: [],
  });

  // failed.com: dequeue and fail
  dequeue(); // failedItem becomes active (priority 70)
  fail(failedItem.id, 'deliberate failure');

  // Now only queued.com (priority 60) should be dequeued next
  const nextQueued = dequeue();
  assert(nextQueued !== null, 'dequeue finds the remaining queued item');
  assert(nextQueued.id === queuedItem.id, 'dequeue returns the only queued item, skipping active/done/failed');
  assert(nextQueued.target === 'queued.com', 'dequeue skipped active, done, and failed items');

  const afterAll = dequeue();
  assert(afterAll === null, 'dequeue returns null after all eligible items consumed');

  // Verify statuses of skipped items were not disturbed
  const finalQueue = loadQueue();
  const stillActive = finalQueue.find(i => i.id === activeItem.id);
  const stillDone   = finalQueue.find(i => i.id === doneItem.id);
  const stillFailed = finalQueue.find(i => i.id === failedItem.id);
  assert(stillActive.status === 'active', 'active item status unchanged by subsequent dequeue');
  assert(stillDone.status   === 'done',   'done item status unchanged by subsequent dequeue');
  assert(stillFailed.status === 'failed', 'failed item status unchanged by subsequent dequeue');

  // ── Group 10: Complete with new_work_items spawns children ────────────────
  console.log('\n=== Test Group 10: Child Spawning via complete() ===\n');
  cleanup();

  const [parent] = enqueue([
    { type: 'recon', target: 'parent.com', priority: 55, model_tier: 'sonnet' },
  ]);

  dequeue(); // activate parent

  complete(parent.id, {
    success: true,
    summary: 'recon done',
    findings: [],
    signals: [],
    gadgets: [],
    new_work_items: [
      { type: 'exploit', target: 'child-a.com', priority: 65, model_tier: 'haiku' },
      { type: 'exploit', target: 'child-b.com', priority: 70, model_tier: 'opus'  },
    ],
  });

  const afterComplete = loadQueue();
  const updatedParent = afterComplete.find(i => i.id === parent.id);
  assert(updatedParent.status === 'done', 'parent is done after complete()');
  assert(updatedParent.children_ids.length === 2, 'parent has 2 children_ids');

  const childA = afterComplete.find(i => i.target === 'child-a.com');
  const childB = afterComplete.find(i => i.target === 'child-b.com');

  assert(childA !== undefined, 'child-a was enqueued');
  assert(childB !== undefined, 'child-b was enqueued');
  assert(childA.parent_id === parent.id, 'child-a has correct parent_id');
  assert(childB.parent_id === parent.id, 'child-b has correct parent_id');
  assert(updatedParent.children_ids.includes(childA.id), 'parent.children_ids includes child-a id');
  assert(updatedParent.children_ids.includes(childB.id), 'parent.children_ids includes child-b id');

  // ── Group 11: Children inherit no properties from parent ──────────────────
  console.log('\n=== Test Group 11: Child Isolation (No Property Inheritance) ===\n');
  cleanup();

  const [parentItem] = enqueue([
    {
      type:       'recon',
      target:     'parent.com',
      priority:   99,
      model_tier: 'opus',
      context:    { secret: 'parent-secret', depth: 3 },
    },
  ]);

  dequeue();

  complete(parentItem.id, {
    success: true,
    summary: 'parent done',
    findings: [],
    signals: [],
    gadgets: [],
    new_work_items: [
      { type: 'test', target: 'child.com', priority: 40, model_tier: 'haiku' },
    ],
  });

  const inheritQueue = loadQueue();
  const child = inheritQueue.find(i => i.target === 'child.com');

  assert(child.parent_id === parentItem.id, 'child has parent_id link to parent');
  assert(child.priority === 40, 'child uses its own specified priority, not parent priority (99)');
  assert(child.model_tier === 'haiku', 'child uses its own model_tier, not parent model_tier (opus)');
  assert(child.type === 'test', 'child uses its own type, not parent type (recon)');

  // Context is not inherited — child gets its own default empty context
  assert(
    child.context && child.context.secret === undefined,
    'child does not inherit parent context.secret'
  );
  assert(
    child.context && child.context.depth === undefined,
    'child does not inherit parent context.depth'
  );

  // Child has its own independent lifecycle fields
  assert(child.status === 'queued',           'child starts with status queued');
  assert(child.escalation_count === 0,        'child starts with escalation_count 0');
  assert(child.retry_count === 0,             'child starts with retry_count 0');
  assert(child.result === null,               'child starts with result null');
  assert(child.started_at === null,           'child starts with started_at null');
  assert(child.completed_at === null,         'child starts with completed_at null');
  assert(child.children_ids !== undefined && child.children_ids.length === 0,
    'child starts with empty children_ids');

  // Final cleanup
  cleanup();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
