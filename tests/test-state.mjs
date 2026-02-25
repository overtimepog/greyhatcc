#!/usr/bin/env node

/**
 * Unit tests for hunt-state.mjs
 * Tests: initHuntState, addFinding, addSurfaces (dedup), addGadgets (dedup),
 *        addSignals, updateCoverage, logIntelRun, getHuntSummary, isHuntActive
 */

import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const HUNT_STATE_DIR = join(process.cwd(), 'hunt-state');

// Remove all state files between tests
function cleanup() {
  const files = [
    'hunt.json', 'findings.json', 'surfaces.json',
    'gadgets.json', 'signals.json', 'coverage.json', 'intel-log.json',
  ];
  for (const f of files) {
    const p = join(HUNT_STATE_DIR, f);
    if (existsSync(p)) rmSync(p);
  }
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
    initHuntState, loadHuntState, saveHuntState,
    addFinding, loadFindings,
    addSurfaces, loadSurfaces,
    addGadgets, loadGadgets,
    addSignals, loadSignals,
    updateCoverage, loadCoverage,
    logIntelRun,
    isHuntActive, getHuntSummary,
  } = await import('../scripts/lib/hunt-state.mjs');

  // ── Test 1: initHuntState creates hunt.json with correct structure ─────────
  console.log('\n=== Test: initHuntState ===\n');
  cleanup();

  const scope = { domains: ['example.com'], wildcards: ['*.example.com'] };
  const hunt = initHuntState('test_program', scope);

  assert(typeof hunt.hunt_id === 'string' && hunt.hunt_id.length > 10, 'initHuntState returns object with hunt_id UUID');
  assert(hunt.program === 'test_program', 'initHuntState sets program');
  assert(hunt.scope === scope, 'initHuntState sets scope');
  assert(hunt.status === 'running', 'initHuntState sets status=running');
  assert(typeof hunt.started_at === 'string', 'initHuntState sets started_at');
  assert(typeof hunt.last_active === 'string', 'initHuntState sets last_active');
  assert(hunt.iteration === 0, 'initHuntState sets iteration=0');
  assert(Array.isArray(hunt.findings) && hunt.findings.length === 0, 'initHuntState has empty findings array');
  assert(Array.isArray(hunt.gadgets) && hunt.gadgets.length === 0, 'initHuntState has empty gadgets array');
  assert(Array.isArray(hunt.signals) && hunt.signals.length === 0, 'initHuntState has empty signals array');
  assert(Array.isArray(hunt.surfaces) && hunt.surfaces.length === 0, 'initHuntState has empty surfaces array');
  assert(typeof hunt.stats === 'object', 'initHuntState has stats object');
  assert(hunt.stats.findings_count === 0, 'initHuntState stats.findings_count=0');
  assert(hunt.stats.chains_found === 0, 'initHuntState stats.chains_found=0');

  // Verify it persists to disk
  const loaded = loadHuntState();
  assert(loaded !== null, 'hunt.json written to disk');
  assert(loaded.hunt_id === hunt.hunt_id, 'persisted hunt_id matches');
  assert(loaded.program === 'test_program', 'persisted program matches');

  // ── Test 2: isHuntActive ───────────────────────────────────────────────────
  console.log('\n=== Test: isHuntActive ===\n');

  assert(isHuntActive() === true, 'isHuntActive returns true when status=running');

  // Mark hunt as done and re-check
  saveHuntState({ ...loaded, status: 'done' });
  assert(isHuntActive() === false, 'isHuntActive returns false when status=done');

  // Restore to running
  saveHuntState({ ...loaded, status: 'running' });

  cleanup();
  assert(isHuntActive() === false, 'isHuntActive returns false when no hunt file');

  // ── Test 3: addFinding + loadFindings + getFindingById ────────────────────
  console.log('\n=== Test: addFinding + loadFindings ===\n');
  cleanup();
  initHuntState('test_program', scope);

  const f1 = addFinding({ title: 'XSS in search', severity: 'high', url: 'https://example.com/search' });
  assert(typeof f1.id === 'string' && f1.id.length > 10, 'addFinding auto-assigns UUID id');
  assert(f1.title === 'XSS in search', 'addFinding preserves title');
  assert(f1.severity === 'high', 'addFinding preserves severity');

  const f2 = addFinding({ id: 'custom-id-123', title: 'IDOR on profile', severity: 'critical' });
  assert(f2.id === 'custom-id-123', 'addFinding preserves explicit id');

  const findings = loadFindings();
  assert(findings.length === 2, 'loadFindings returns 2 findings after 2 adds');
  assert(findings[0].title === 'XSS in search', 'loadFindings first finding correct');
  assert(findings[1].id === 'custom-id-123', 'loadFindings second finding correct');

  // getFindingById equivalent: filter by id
  const byId = loadFindings().find(f => f.id === f1.id);
  assert(byId !== undefined, 'finding retrievable by id from loadFindings');
  assert(byId.title === 'XSS in search', 'retrieved finding has correct title');

  const missing = loadFindings().find(f => f.id === 'nonexistent');
  assert(missing === undefined, 'nonexistent id returns undefined');

  // ── Test 4: addSurfaces deduplication (same url+method ignored) ────────────
  console.log('\n=== Test: addSurfaces deduplication ===\n');
  cleanup();

  const initial = addSurfaces([
    { url: 'https://example.com/api/users', method: 'GET', params: [] },
    { url: 'https://example.com/api/users', method: 'POST', params: ['name'] },
    { url: 'https://example.com/api/items', method: 'GET', params: [] },
  ]);
  assert(initial.length === 3, 'addSurfaces adds 3 unique surfaces');

  // Add duplicates + one new
  const merged = addSurfaces([
    { url: 'https://example.com/api/users', method: 'GET', params: [] },  // dup
    { url: 'https://example.com/api/users', method: 'POST', params: ['name'] }, // dup
    { url: 'https://example.com/api/orders', method: 'DELETE', params: ['id'] }, // new
  ]);
  assert(merged.length === 4, 'addSurfaces deduplicates: 3 originals + 1 new = 4');

  const surfaces = loadSurfaces();
  assert(surfaces.length === 4, 'loadSurfaces returns deduplicated count of 4');

  // Same url, different method should NOT be deduplicated
  addSurfaces([{ url: 'https://example.com/api/orders', method: 'GET', params: [] }]);
  assert(loadSurfaces().length === 5, 'same url with different method is NOT a duplicate');

  // All-duplicate batch produces no change
  const beforeAllDup = loadSurfaces().length;
  addSurfaces([
    { url: 'https://example.com/api/users', method: 'GET', params: [] },
    { url: 'https://example.com/api/users', method: 'POST', params: ['name'] },
  ]);
  assert(loadSurfaces().length === beforeAllDup, 'all-duplicate batch adds nothing');

  // ── Test 5: addGadgets deduplication (same type+target ignored) ────────────
  console.log('\n=== Test: addGadgets deduplication ===\n');
  cleanup();

  const g1 = addGadgets([
    { type: 'open-redirect', target: 'https://example.com/redirect', notes: 'found in footer' },
    { type: 'self-xss', target: 'https://example.com/profile', notes: 'bio field' },
    { type: 'cors-misconfig', target: 'https://api.example.com', notes: 'wildcard origin' },
  ]);
  assert(g1.length === 3, 'addGadgets adds 3 unique gadgets');

  const g2 = addGadgets([
    { type: 'open-redirect', target: 'https://example.com/redirect', notes: 'duplicate' }, // dup
    { type: 'self-xss', target: 'https://example.com/profile', notes: 'duplicate' },       // dup
    { type: 'ssrf', target: 'https://example.com/fetch', notes: 'new gadget' },             // new
  ]);
  assert(g2.length === 4, 'addGadgets deduplicates: 3 originals + 1 new = 4');

  const gadgets = loadGadgets();
  assert(gadgets.length === 4, 'loadGadgets returns deduplicated count of 4');

  // Same type, different target should NOT be deduplicated
  addGadgets([{ type: 'open-redirect', target: 'https://example.com/other', notes: 'different target' }]);
  assert(loadGadgets().length === 5, 'same type with different target is NOT a duplicate');

  // Same target, different type should NOT be deduplicated
  addGadgets([{ type: 'csrf', target: 'https://example.com/redirect', notes: 'same target diff type' }]);
  assert(loadGadgets().length === 6, 'same target with different type is NOT a duplicate');

  // ── Test 6: addSignals + loadSignals (no dedup — append only) ─────────────
  console.log('\n=== Test: addSignals + loadSignals ===\n');
  cleanup();

  const s1 = addSignals([
    { type: 'tech-detection', value: 'WordPress 6.3', source: 'wappalyzer' },
    { type: 'header-leak', value: 'X-Powered-By: PHP/8.1', source: 'response-header' },
  ]);
  assert(s1.length === 2, 'addSignals returns 2 signals');

  // Add same signals again — signals are append-only, no dedup
  const s2 = addSignals([
    { type: 'tech-detection', value: 'WordPress 6.3', source: 'wappalyzer' },
  ]);
  assert(s2.length === 3, 'addSignals is append-only (no dedup): 2+1=3');

  const signals = loadSignals();
  assert(signals.length === 3, 'loadSignals returns all 3 appended signals');
  assert(signals[0].type === 'tech-detection', 'loadSignals first signal correct type');
  assert(signals[1].type === 'header-leak', 'loadSignals second signal correct type');
  assert(signals[2].value === 'WordPress 6.3', 'loadSignals third signal is the duplicate append');

  // ── Test 7: updateCoverage + loadCoverage ──────────────────────────────────
  console.log('\n=== Test: updateCoverage + loadCoverage ===\n');
  cleanup();

  // Initial coverage state
  const cov0 = loadCoverage();
  assert(typeof cov0.endpoints === 'object', 'loadCoverage default has endpoints object');
  assert(Array.isArray(cov0.covered), 'loadCoverage default has covered array');
  assert(Array.isArray(cov0.remaining), 'loadCoverage default has remaining array');

  // Test a new endpoint
  updateCoverage('/api/users', ['xss', 'sqli']);
  const cov1 = loadCoverage();
  assert(cov1.endpoints['/api/users'] !== undefined, 'updateCoverage creates endpoint entry');
  assert(cov1.endpoints['/api/users'].tested.includes('xss'), 'updateCoverage records xss as tested');
  assert(cov1.endpoints['/api/users'].tested.includes('sqli'), 'updateCoverage records sqli as tested');
  assert(cov1.endpoints['/api/users'].remaining.length === 0, 'updateCoverage remaining empty (no planned classes set)');
  assert(cov1.covered.includes('/api/users'), '/api/users in covered list (no remaining)');
  assert(!cov1.remaining.includes('/api/users'), '/api/users NOT in remaining list');

  // Add more vuln classes to same endpoint — no duplicates
  updateCoverage('/api/users', ['xss', 'idor']);
  const cov2 = loadCoverage();
  const testedClasses = cov2.endpoints['/api/users'].tested;
  const xssCount = testedClasses.filter(c => c === 'xss').length;
  assert(xssCount === 1, 'updateCoverage does not duplicate existing vuln class (xss)');
  assert(testedClasses.includes('idor'), 'updateCoverage adds new vuln class idor');
  assert(testedClasses.length === 3, 'updateCoverage endpoint has 3 unique tested classes');

  // Test a second endpoint
  updateCoverage('/api/admin', ['auth-bypass']);
  const cov3 = loadCoverage();
  assert(cov3.endpoints['/api/admin'] !== undefined, 'second endpoint /api/admin created');
  assert(cov3.covered.length === 2, 'both endpoints in covered list');

  // ── Test 8: logIntelRun ────────────────────────────────────────────────────
  console.log('\n=== Test: logIntelRun ===\n');
  cleanup();

  logIntelRun({ source: 'shodan', query: 'ssl:example.com', results_count: 42, notes: 'found staging server' });
  logIntelRun({ source: 'crt.sh', query: '%.example.com', results_count: 15, notes: 'cert transparency' });

  // Read raw file to verify
  const { readFileSync } = await import('fs');
  const logPath = join(HUNT_STATE_DIR, 'intel-log.json');
  assert(existsSync(logPath), 'intel-log.json created after logIntelRun');

  const log = JSON.parse(readFileSync(logPath, 'utf-8'));
  assert(Array.isArray(log), 'intel-log.json is a JSON array');
  assert(log.length === 2, 'intel log has 2 entries');
  assert(typeof log[0].timestamp === 'string', 'first entry has timestamp');
  assert(log[0].source === 'shodan', 'first entry source=shodan');
  assert(log[0].results_count === 42, 'first entry results_count=42');
  assert(log[1].source === 'crt.sh', 'second entry source=crt.sh');
  assert(log[1].notes === 'cert transparency', 'second entry notes correct');

  // Verify append behavior across calls
  logIntelRun({ source: 'github', query: 'org:example', results_count: 5, notes: 'third entry' });
  const log2 = JSON.parse(readFileSync(logPath, 'utf-8'));
  assert(log2.length === 3, 'logIntelRun appends (does not overwrite)');

  // ── Test 9: getHuntSummary returns all state ───────────────────────────────
  console.log('\n=== Test: getHuntSummary (getFullState equivalent) ===\n');
  cleanup();

  // No hunt — should return null
  const nullSummary = getHuntSummary();
  assert(nullSummary === null, 'getHuntSummary returns null when no hunt exists');

  // Initialize and populate state
  initHuntState('summary_test', { domains: ['test.com'] });
  addFinding({ title: 'RCE via SSTI', severity: 'critical' });
  addFinding({ title: 'IDOR user profiles', severity: 'high' });
  addSurfaces([
    { url: 'https://test.com/api/render', method: 'POST', params: ['template'] },
    { url: 'https://test.com/api/users', method: 'GET', params: ['id'] },
  ]);
  addGadgets([
    { type: 'open-redirect', target: 'https://test.com/go', notes: 'chain candidate' },
  ]);
  addSignals([
    { type: 'tech-detection', value: 'Jinja2', source: 'error-page' },
    { type: 'tech-detection', value: 'Flask/2.3', source: 'server-header' },
    { type: 'tech-detection', value: 'Python/3.11', source: 'error-page' },
  ]);
  updateCoverage('/api/render', ['ssti', 'sqli']);
  updateCoverage('/api/users', ['idor']);

  const summary = getHuntSummary();
  assert(summary !== null, 'getHuntSummary returns object when hunt exists');
  assert(typeof summary.hunt_id === 'string', 'summary has hunt_id');
  assert(summary.program === 'summary_test', 'summary has correct program');
  assert(summary.status === 'running', 'summary has status=running');
  assert(typeof summary.started_at === 'string', 'summary has started_at');
  assert(typeof summary.last_active === 'string', 'summary has last_active');
  assert(typeof summary.iteration === 'number', 'summary has iteration number');
  assert(typeof summary.counts === 'object', 'summary has counts object');
  assert(summary.counts.findings === 2, 'summary counts.findings=2');
  assert(summary.counts.surfaces === 2, 'summary counts.surfaces=2');
  assert(summary.counts.gadgets === 1, 'summary counts.gadgets=1');
  assert(summary.counts.signals === 3, 'summary counts.signals=3');
  assert(summary.counts.covered_endpoints === 2, 'summary counts.covered_endpoints=2');
  assert(summary.counts.remaining_endpoints === 0, 'summary counts.remaining_endpoints=0');
  assert(typeof summary.stats === 'object', 'summary has stats object');

  // ── Test 10: resetState — cleanup removes all files ────────────────────────
  console.log('\n=== Test: resetState (cleanup) ===\n');

  // Verify populated state before reset
  assert(loadFindings().length === 2, 'pre-reset: 2 findings exist');
  assert(loadSurfaces().length === 2, 'pre-reset: 2 surfaces exist');
  assert(loadGadgets().length === 1, 'pre-reset: 1 gadget exists');
  assert(loadSignals().length === 3, 'pre-reset: 3 signals exist');

  cleanup();

  assert(!existsSync(join(HUNT_STATE_DIR, 'hunt.json')), 'reset removes hunt.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'findings.json')), 'reset removes findings.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'surfaces.json')), 'reset removes surfaces.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'gadgets.json')), 'reset removes gadgets.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'signals.json')), 'reset removes signals.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'coverage.json')), 'reset removes coverage.json');
  assert(!existsSync(join(HUNT_STATE_DIR, 'intel-log.json')), 'reset removes intel-log.json');

  // After reset: all load functions return empty/null defaults
  assert(loadHuntState() === null, 'post-reset: loadHuntState returns null');
  assert(loadFindings().length === 0, 'post-reset: loadFindings returns empty array');
  assert(loadSurfaces().length === 0, 'post-reset: loadSurfaces returns empty array');
  assert(loadGadgets().length === 0, 'post-reset: loadGadgets returns empty array');
  assert(loadSignals().length === 0, 'post-reset: loadSignals returns empty array');
  assert(isHuntActive() === false, 'post-reset: isHuntActive returns false');
  assert(getHuntSummary() === null, 'post-reset: getHuntSummary returns null');

  // Final cleanup
  cleanup();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
