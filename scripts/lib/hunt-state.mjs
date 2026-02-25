import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const CWD = process.cwd();
const STATE_DIR = join(CWD, 'hunt-state');

// ── File paths ─────────────────────────────────────────────────────────────

const PATHS = {
  hunt:      join(STATE_DIR, 'hunt.json'),
  findings:  join(STATE_DIR, 'findings.json'),
  surfaces:  join(STATE_DIR, 'surfaces.json'),
  gadgets:   join(STATE_DIR, 'gadgets.json'),
  signals:   join(STATE_DIR, 'signals.json'),
  coverage:  join(STATE_DIR, 'coverage.json'),
  intelLog:  join(STATE_DIR, 'intel-log.json'),
};

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Safely read and parse a JSON file.
 * Returns `fallback` if the file is missing, empty, or corrupt.
 */
function readJSON(filepath, fallback = null) {
  if (!existsSync(filepath)) return fallback;
  try {
    const raw = readFileSync(filepath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Write data as pretty-printed JSON. Ensures the parent directory exists.
 */
function writeJSON(filepath, data) {
  ensureHuntStateDir();
  writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ── Directory management ───────────────────────────────────────────────────

/**
 * Create the hunt-state/ directory tree if it doesn't already exist.
 * Subdirs: reports/, evidence/
 */
export function ensureHuntStateDir() {
  for (const dir of [STATE_DIR, join(STATE_DIR, 'reports'), join(STATE_DIR, 'evidence')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ── Hunt lifecycle ─────────────────────────────────────────────────────────

/**
 * Load the top-level HuntState from hunt.json.
 * Returns null if no hunt has been initialized.
 */
export function loadHuntState() {
  return readJSON(PATHS.hunt);
}

/**
 * Persist the HuntState. Automatically bumps `last_active`.
 */
export function saveHuntState(state) {
  writeJSON(PATHS.hunt, {
    ...state,
    last_active: new Date().toISOString(),
  });
}

/**
 * Initialize a brand-new hunt. Overwrites any existing state.
 *
 * @param {string} program - Bug bounty program handle (e.g. "acme_corp").
 * @param {object} scope   - Authorized scope definition.
 * @returns {object} The freshly created HuntState.
 */
export function initHuntState(program, scope) {
  const now = new Date().toISOString();
  const state = {
    hunt_id:      randomUUID(),
    program,
    scope,
    status:       'running',
    started_at:   now,
    last_active:  now,
    iteration:    0,
    findings:     [],
    gadgets:      [],
    signals:      [],
    surfaces:     [],
    stats: {
      items_queued:    0,
      items_completed: 0,
      items_failed:    0,
      escalations:     0,
      findings_count:  0,
      chains_found:    0,
    },
  };

  saveHuntState(state);
  return state;
}

// ── Findings ───────────────────────────────────────────────────────────────

/**
 * Load all findings from disk.
 * @returns {Array<object>}
 */
export function loadFindings() {
  return readJSON(PATHS.findings, []);
}

/**
 * Overwrite the findings file.
 */
export function saveFindings(findings) {
  writeJSON(PATHS.findings, findings);
}

/**
 * Append a single finding. Auto-assigns an id if missing.
 *
 * @param {object} finding - The finding object.
 * @returns {object} The finding with a guaranteed `id`.
 */
export function addFinding(finding) {
  const findings = loadFindings();
  if (!finding.id) finding.id = randomUUID();
  findings.push(finding);
  saveFindings(findings);
  return finding;
}

// ── Attack surfaces ────────────────────────────────────────────────────────

/**
 * Load all discovered attack surfaces.
 * @returns {Array<object>}
 */
export function loadSurfaces() {
  return readJSON(PATHS.surfaces, []);
}

/**
 * Overwrite the surfaces file.
 */
export function saveSurfaces(surfaces) {
  writeJSON(PATHS.surfaces, surfaces);
}

/**
 * Merge new surfaces into the existing set. Deduplicates by url+method.
 *
 * @param {Array<object>} newSurfaces - Surfaces to add.
 * @returns {Array<object>} The full merged surface list.
 */
export function addSurfaces(newSurfaces) {
  const existing = loadSurfaces();

  // Build a lookup key set from what we already have
  const seen = new Set(existing.map(s => `${s.url}::${s.method}`));

  for (const surface of newSurfaces) {
    const key = `${surface.url}::${surface.method}`;
    if (!seen.has(key)) {
      seen.add(key);
      existing.push(surface);
    }
  }

  saveSurfaces(existing);
  return existing;
}

// ── Gadgets (chainable low-severity primitives) ────────────────────────────

/**
 * Load the gadget inventory.
 * @returns {Array<object>}
 */
export function loadGadgets() {
  return readJSON(PATHS.gadgets, []);
}

/**
 * Overwrite the gadgets file.
 */
export function saveGadgets(gadgets) {
  writeJSON(PATHS.gadgets, gadgets);
}

/**
 * Merge new gadgets, deduplicating by type+target.
 *
 * @param {Array<object>} newGadgets
 * @returns {Array<object>} The full merged gadget list.
 */
export function addGadgets(newGadgets) {
  const existing = loadGadgets();
  const seen = new Set(existing.map(g => `${g.type}::${g.target}`));

  for (const gadget of newGadgets) {
    const key = `${gadget.type}::${gadget.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      existing.push(gadget);
    }
  }

  saveGadgets(existing);
  return existing;
}

// ── Signals (recon/intel observations) ─────────────────────────────────────

/**
 * Load all signals.
 * @returns {Array<object>}
 */
export function loadSignals() {
  return readJSON(PATHS.signals, []);
}

/**
 * Overwrite the signals file.
 */
export function saveSignals(signals) {
  writeJSON(PATHS.signals, signals);
}

/**
 * Append new signals. No dedup -- signals are append-only by design
 * since the same observation at different times is meaningful.
 *
 * @param {Array<object>} newSignals
 * @returns {Array<object>} The full signal list.
 */
export function addSignals(newSignals) {
  const existing = loadSignals();
  existing.push(...newSignals);
  saveSignals(existing);
  return existing;
}

// ── Coverage tracking ──────────────────────────────────────────────────────

/** Default empty coverage tracker. */
function defaultCoverage() {
  return {
    endpoints: {},   // { "/api/users": { tested: ["xss", "sqli"], remaining: ["idor"] } }
    covered: [],     // endpoints fully tested
    remaining: [],   // endpoints with gaps
  };
}

/**
 * Load the coverage tracker.
 * @returns {object}
 */
export function loadCoverage() {
  return readJSON(PATHS.coverage, defaultCoverage());
}

/**
 * Overwrite the coverage file.
 */
export function saveCoverage(coverage) {
  writeJSON(PATHS.coverage, coverage);
}

/**
 * Record that a set of vulnerability classes were tested against an endpoint.
 *
 * @param {string}        endpoint   - e.g. "/api/users"
 * @param {Array<string>} vulnClasses - e.g. ["xss", "sqli", "idor"]
 */
export function updateCoverage(endpoint, vulnClasses) {
  const coverage = loadCoverage();

  if (!coverage.endpoints[endpoint]) {
    coverage.endpoints[endpoint] = { tested: [], remaining: [] };
  }

  const entry = coverage.endpoints[endpoint];

  // Merge new vuln classes into tested, avoiding duplicates
  for (const vc of vulnClasses) {
    if (!entry.tested.includes(vc)) {
      entry.tested.push(vc);
    }
    // Remove from remaining if it was there
    entry.remaining = entry.remaining.filter(r => r !== vc);
  }

  // Rebuild the top-level covered/remaining lists
  coverage.covered = [];
  coverage.remaining = [];
  for (const [ep, data] of Object.entries(coverage.endpoints)) {
    if (data.remaining.length === 0 && data.tested.length > 0) {
      coverage.covered.push(ep);
    } else {
      coverage.remaining.push(ep);
    }
  }

  saveCoverage(coverage);
}

// ── Intel log ──────────────────────────────────────────────────────────────

/**
 * Append an intel analysis entry to the running log.
 * The log is a JSON array (not JSONL) for easy consumption.
 *
 * @param {object} analysis - The intel analysis record.
 */
export function logIntelRun(analysis) {
  const log = readJSON(PATHS.intelLog, []);
  log.push({
    timestamp: new Date().toISOString(),
    ...analysis,
  });
  writeJSON(PATHS.intelLog, log);
}

// ── Status queries ─────────────────────────────────────────────────────────

/**
 * Check whether an active hunt is in progress.
 * @returns {boolean}
 */
export function isHuntActive() {
  const state = loadHuntState();
  return state !== null && state.status === 'running';
}

/**
 * Build a concise status summary suitable for reporting or context injection.
 *
 * @returns {object|null} Summary object, or null if no hunt exists.
 */
export function getHuntSummary() {
  const state = loadHuntState();
  if (!state) return null;

  const findings  = loadFindings();
  const surfaces  = loadSurfaces();
  const gadgets   = loadGadgets();
  const signals   = loadSignals();
  const coverage  = loadCoverage();

  return {
    hunt_id:     state.hunt_id,
    program:     state.program,
    status:      state.status,
    started_at:  state.started_at,
    last_active: state.last_active,
    iteration:   state.iteration,
    counts: {
      findings:  findings.length,
      surfaces:  surfaces.length,
      gadgets:   gadgets.length,
      signals:   signals.length,
      covered_endpoints:   coverage.covered?.length ?? 0,
      remaining_endpoints: coverage.remaining?.length ?? 0,
    },
    stats: state.stats || {},
  };
}
