import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CWD = process.cwd();
const STATE_DIR = join(CWD, '.greyhatcc');

export function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

export function readState(filename) {
  const path = join(STATE_DIR, filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeState(filename, data) {
  ensureStateDir();
  writeFileSync(join(STATE_DIR, filename), JSON.stringify(data, null, 2));
}

export function readScope() {
  return readState('scope.json');
}

export function getActiveProgram() {
  const scope = readScope();
  if (!scope?.engagement) return null;
  // Extract program name from engagement string
  const match = scope.engagement.match(/Bug Bounty\s*[-–—]\s*(.+)/i);
  if (match) return match[1].trim().toLowerCase().replace(/\s+/g, '_');
  return scope.engagement.toLowerCase().replace(/\s+/g, '_');
}

export function getProgramDir(program) {
  if (!program) program = getActiveProgram();
  if (!program) return null;
  const dir = join(CWD, 'bug_bounty', `${program}_bug_bounty`);
  return existsSync(dir) ? dir : null;
}

export function readProgramFile(program, filename) {
  const dir = getProgramDir(program);
  if (!dir) return null;
  const path = join(dir, filename);
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, 'utf-8');
    if (filename.endsWith('.json')) return JSON.parse(content);
    return content;
  } catch {
    return null;
  }
}

export function getHuntState() {
  return readState('hunt-state.json') || {
    active: false,
    phase: null,
    program: null,
    startedAt: null,
    lastActivity: null,
    iteration: 0,
    pendingFindings: [],
    blockers: [],
    completedPhases: [],
    verificationsPassed: 0,
    verificationsRequired: 3,
  };
}

export function setHuntState(state) {
  writeState('hunt-state.json', { ...state, lastActivity: new Date().toISOString() });
}

export function getFindings(program) {
  const findings = readProgramFile(program, 'findings_log.md');
  if (!findings) return [];
  // Parse markdown table rows
  const rows = findings.split('\n').filter(l => l.startsWith('| F-'));
  return rows.map(row => {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean);
    return {
      id: cols[0],
      date: cols[1],
      asset: cols[2],
      title: cols[3],
      severity: cols[4],
      status: cols[5],
    };
  });
}

export function getSubmissions(program) {
  const subs = readProgramFile(program, 'submissions.json');
  return subs?.submissions || [];
}

export function getGadgets(program) {
  const gadgets = readProgramFile(program, 'gadgets.json');
  return gadgets?.gadgets || [];
}

export function getTested(program) {
  const tested = readProgramFile(program, 'tested.json');
  return tested?.tested || [];
}
