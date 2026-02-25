import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { GreyhatConfig } from './types.js';

const DEFAULT_CONFIG: GreyhatConfig = {
  shodan: {},
  nvd: {},
  defaults: {
    reportFormat: 'ptes',
    severityThreshold: 'LOW',
    rateLimit: { requestsPerSecond: 10, burstSize: 20 },
  },
  directories: {
    recon: 'recon',
    findings: 'findings',
    reports: 'reports',
    evidence: 'evidence',
    exploits: 'exploits',
    scripts: 'scripts',
    notes: 'notes',
  },
  hackerone: {},
};

function loadJsonFile(path: string): Partial<GreyhatConfig> {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {}
  return {};
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig(): GreyhatConfig {
  let config = { ...DEFAULT_CONFIG };

  // Plugin-root config
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
  if (pluginRoot) {
    config = deepMerge(config, loadJsonFile(join(pluginRoot, 'config', 'greyhatcc.json')));
  }

  // Workspace config
  const cwd = process.cwd();
  config = deepMerge(config, loadJsonFile(join(cwd, '.greyhatcc', 'config.json')));

  // Environment variable overrides
  if (process.env.SHODAN_API_KEY) {
    config.shodan.apiKey = process.env.SHODAN_API_KEY;
  }
  if (process.env.NVD_API_KEY) {
    config.nvd.apiKey = process.env.NVD_API_KEY;
  }
  if (process.env.H1_API_TOKEN) {
    config.hackerone.apiToken = process.env.H1_API_TOKEN;
  }

  return config;
}
