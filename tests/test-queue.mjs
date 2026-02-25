#!/usr/bin/env node

/**
 * Unit tests for hunt-queue.mjs
 * Tests: enqueue, dequeue, priority ordering, persistence, reprioritization, escalation
 */

import { rmSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Set up clean hunt-state directory for testing
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
  // Ensure hunt-state dir exists
  if (!existsSync(HUNT_STATE_DIR)) mkdirSync(HUNT_STATE_DIR, { recursive: true });

  const {
    loadQueue, saveQueue, enqueue, dequeue, complete, fail,
    escalate, reprioritize, stats, peek, filter
  } = await import('../scripts/lib/hunt-queue.mjs');

  console.log('\n=== Test: Queue Operations ===\n');

  // Test 1: Clean state
  cleanup();
  const emptyQueue = loadQueue();
  assert(Array.isArray(emptyQueue) && emptyQueue.length === 0, 'loadQueue returns empty array when no file');

  // Test 2: Enqueue items
  cleanup();
  const items = enqueue([
    { type: 'recon', subtype: 'subdomain-enum', target: 'example.com', priority: 60, model_tier: 'haiku' },
    { type: 'test', subtype: 'xss-test', target: 'https://example.com/search', priority: 50, model_tier: 'sonnet' },
    { type: 'recon', subtype: 'h1-research', target: 'example-program', priority: 70, model_tier: 'haiku' },
  ]);
  assert(items.length === 3, 'enqueue returns 3 items');
  assert(items[0].id && items[0].id.length > 10, 'enqueue auto-assigns UUID');
  assert(items[0].status === 'queued', 'enqueue sets status=queued');
  assert(items[0].created_at, 'enqueue sets created_at');
  assert(items[0].escalation_count === 0, 'enqueue sets escalation_count=0');
  assert(items[0].retry_count === 0, 'enqueue sets retry_count=0');
  assert(items[0].result === null, 'enqueue sets result=null');

  // Test 3: Persistence
  const persisted = loadQueue();
  assert(persisted.length === 3, 'queue persists to disk');

  // Test 4: Dequeue by priority
  const first = dequeue();
  assert(first !== null, 'dequeue returns an item');
  assert(first.priority === 70, 'dequeue returns highest priority item');
  assert(first.subtype === 'h1-research', 'dequeue returns h1-research (priority 70)');
  assert(first.status === 'active', 'dequeue sets status=active');
  assert(first.started_at !== null, 'dequeue sets started_at');

  // Test 5: Second dequeue
  const second = dequeue();
  assert(second.priority === 60, 'second dequeue returns priority 60');
  assert(second.subtype === 'subdomain-enum', 'second dequeue returns subdomain-enum');

  // Test 6: Complete
  complete(first.id, {
    success: true,
    summary: 'H1 research completed',
    new_surfaces: [],
    signals: [],
    findings: [],
    gadgets: [],
    new_work_items: [],
    raw_output: 'test',
    tokens_used: 100,
    duration_ms: 5000,
  });
  const afterComplete = loadQueue();
  const completedItem = afterComplete.find(i => i.id === first.id);
  assert(completedItem.status === 'done', 'complete sets status=done');
  assert(completedItem.completed_at !== null, 'complete sets completed_at');
  assert(completedItem.result.success === true, 'complete stores result');

  // Test 7: Fail
  fail(second.id, 'Tool unavailable');
  const afterFail = loadQueue();
  const failedItem = afterFail.find(i => i.id === second.id);
  assert(failedItem.status === 'failed', 'fail sets status=failed');
  assert(failedItem.retry_count === 1, 'fail increments retry_count');
  assert(failedItem.result.success === false, 'fail stores error result');

  // Test 8: Escalate
  const escalated = escalate(second.id);
  assert(escalated.model_tier === 'sonnet', 'escalate upgrades haiku→sonnet');
  assert(escalated.escalation_count === 1, 'escalate increments escalation_count');
  assert(escalated.status === 'queued', 'escalate re-queues item');

  // Test 9: Double escalate
  const escalated2 = escalate(second.id);
  assert(escalated2.model_tier === 'opus', 'second escalate upgrades sonnet→opus');
  assert(escalated2.escalation_count === 2, 'escalation_count is now 2');

  // Test 10: Stats
  const s = stats();
  assert(s.done === 1, 'stats: 1 done');
  assert(s.queued >= 1, 'stats: at least 1 queued');

  // Test 11: Peek
  const peeked = peek(2);
  assert(peeked.length <= 2, 'peek returns at most 2 items');
  assert(peeked.every(i => i.status === 'queued'), 'peek only returns queued items');

  // Test 12: Filter
  const recons = filter(i => i.type === 'recon');
  assert(recons.length >= 1, 'filter finds recon items');

  // Test 13: Reprioritize
  const thirdItem = loadQueue().find(i => i.subtype === 'xss-test');
  reprioritize([{ id: thirdItem.id, delta: 30, reason: 'signal amplification' }]);
  const afterReprioritize = loadQueue();
  const boosted = afterReprioritize.find(i => i.id === thirdItem.id);
  assert(boosted.priority === 80, 'reprioritize adds delta to priority');

  // Test 14: Priority clamping
  reprioritize([{ id: thirdItem.id, delta: 50, reason: 'test clamping' }]);
  const afterClamp = loadQueue();
  const clamped = afterClamp.find(i => i.id === thirdItem.id);
  assert(clamped.priority === 100, 'priority clamped at 100');

  reprioritize([{ id: thirdItem.id, delta: -200, reason: 'test lower clamp' }]);
  const afterLowerClamp = loadQueue();
  const lowerClamped = afterLowerClamp.find(i => i.id === thirdItem.id);
  assert(lowerClamped.priority === 0, 'priority clamped at 0');

  // Test 15: Complete with new_work_items (child spawning)
  cleanup();
  const parentItems = enqueue([
    { type: 'recon', subtype: 'tech-fingerprint', target: 'sub.example.com', priority: 55, model_tier: 'haiku' }
  ]);
  const parent = dequeue();
  complete(parent.id, {
    success: true,
    summary: 'Tech fingerprint done',
    new_surfaces: [],
    signals: [],
    findings: [],
    gadgets: [],
    new_work_items: [
      { type: 'test', subtype: 'wordpress-vulns', target: 'sub.example.com', priority: 50, model_tier: 'haiku', tags: ['wordpress'] }
    ],
    raw_output: '',
    tokens_used: 50,
    duration_ms: 3000,
  });
  const afterChildren = loadQueue();
  const child = afterChildren.find(i => i.subtype === 'wordpress-vulns');
  assert(child !== undefined, 'complete auto-enqueues new_work_items');
  assert(child.parent_id === parent.id, 'child has parent_id set');
  const updatedParent = afterChildren.find(i => i.id === parent.id);
  assert(updatedParent.children_ids.includes(child.id), 'parent has child in children_ids');

  // Cleanup
  cleanup();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
