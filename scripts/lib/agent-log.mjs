import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CWD = process.cwd();
const STATE_DIR = join(CWD, '.greyhatcc');
const LOG_FILE = join(STATE_DIR, 'agent-log.jsonl');

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

/**
 * Log an agent lifecycle event to agent-log.jsonl
 * @param {'start'|'stop'|'error'|'escalate'} event
 * @param {string} agentName - e.g. "recon-specialist-low"
 * @param {string} model - "haiku"|"sonnet"|"opus"
 * @param {object} metadata - Additional context (phase, task, duration, etc.)
 */
export function logAgentEvent(event, agentName, model, metadata = {}) {
  ensureStateDir();
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    agent: agentName,
    model,
    ...metadata,
  };
  appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

/**
 * Get all agents that have been started but not stopped
 * @returns {Array<object>} Active agent entries
 */
export function getActiveAgents() {
  if (!existsSync(LOG_FILE)) return [];
  const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const started = new Map();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.event === 'start') {
        started.set(entry.agent + ':' + entry.timestamp, entry);
      } else if (entry.event === 'stop') {
        // Remove matching start by agent name (most recent)
        for (const [key] of started) {
          if (key.startsWith(entry.agent + ':')) {
            started.delete(key);
            break;
          }
        }
      }
    } catch { /* skip malformed lines */ }
  }
  return Array.from(started.values());
}

/**
 * Get agent usage statistics
 * @returns {object} Stats by tier, agent name, and totals
 */
export function getAgentStats() {
  if (!existsSync(LOG_FILE)) return { total: 0, byModel: {}, byAgent: {}, avgDuration: {} };
  const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const stats = { total: 0, byModel: {}, byAgent: {}, durations: {} };

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.event === 'start') {
        stats.total++;
        stats.byModel[entry.model] = (stats.byModel[entry.model] || 0) + 1;
        stats.byAgent[entry.agent] = (stats.byAgent[entry.agent] || 0) + 1;
      }
      if (entry.event === 'stop' && entry.durationMs) {
        if (!stats.durations[entry.agent]) stats.durations[entry.agent] = [];
        stats.durations[entry.agent].push(entry.durationMs);
      }
    } catch { /* skip */ }
  }

  // Calculate average durations
  const avgDuration = {};
  for (const [agent, durations] of Object.entries(stats.durations)) {
    avgDuration[agent] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  return { total: stats.total, byModel: stats.byModel, byAgent: stats.byAgent, avgDuration };
}

/**
 * Get the full agent log as parsed entries
 * @param {number} limit - Max entries to return (0 = all)
 * @returns {Array<object>}
 */
export function getAgentLog(limit = 0) {
  if (!existsSync(LOG_FILE)) return [];
  const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch { /* skip */ }
  }
  if (limit > 0) return entries.slice(-limit);
  return entries;
}

/**
 * Write a session summary entry
 * @param {object} summary - Session summary data
 */
export function writeSessionSummary(summary) {
  const historyFile = join(STATE_DIR, 'session-history.jsonl');
  ensureStateDir();
  appendFileSync(historyFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...summary,
  }) + '\n');
}
