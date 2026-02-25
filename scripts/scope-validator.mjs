import { readStdin } from './lib/stdin.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function extractTargets(command) {
  const targets = new Set();
  // Extract IPs
  const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
  let match;
  while ((match = ipRegex.exec(command)) !== null) {
    const ip = match[1];
    if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
      targets.add(ip);
    }
  }
  // Extract domains from common pentest tools
  const toolPatterns = [
    /nmap\s+(?:-[^\s]+\s+)*([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /curl\s+(?:-[^\s]+\s+)*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /wget\s+(?:-[^\s]+\s+)*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /nikto\s+(?:-[^\s]+\s+)*-h\s+(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /gobuster.*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /ffuf.*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /sqlmap.*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
    /nuclei.*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g,
  ];
  for (const pattern of toolPatterns) {
    while ((match = pattern.exec(command)) !== null) {
      targets.add(match[1]);
    }
  }
  return [...targets];
}

function ipInCidr(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1) >>> 0;
  const ipNum = ip.split('.').reduce((acc, oct) => (acc * 256) + parseInt(oct), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, oct) => (acc * 256) + parseInt(oct), 0) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function isInScope(target, scope) {
  if (!scope?.authorized) return true;
  const domains = scope.authorized.domains || [];
  const ips = scope.authorized.ips || [];
  const excluded = scope.excluded?.domains || [];

  for (const excl of excluded) {
    if (excl.startsWith('*.')) {
      if (target.endsWith(excl.slice(1)) || target === excl.slice(2)) return false;
    } else if (target === excl) return false;
  }

  for (const domain of domains) {
    if (domain.startsWith('*.')) {
      if (target.endsWith(domain.slice(1)) || target === domain.slice(2)) return true;
    } else if (target === domain) return true;
  }
  for (const ip of ips) {
    if (target === ip) return true;
    if (ip.includes('/')) {
      if (ipInCidr(target, ip)) return true;
    }
  }
  return domains.length === 0 && ips.length === 0;
}

async function main() {
  const input = await readStdin();
  const command = input?.tool_input?.command || '';
  if (!command) return;

  // Check v7 hunt-state scope first, then legacy .greyhatcc scope
  const cwd = process.cwd();
  const v7HuntPath = join(cwd, 'hunt-state', 'hunt.json');
  const scopePath = join(cwd, '.greyhatcc', 'scope.json');

  let scope = null;
  if (existsSync(v7HuntPath)) {
    try {
      const huntState = JSON.parse(readFileSync(v7HuntPath, 'utf-8'));
      if (huntState.scope) {
        // Convert v7 scope format to legacy format for isInScope
        scope = {
          authorized: {
            domains: huntState.scope.in_scope || [],
            ips: [],
          },
          excluded: {
            domains: huntState.scope.out_of_scope || [],
          },
        };
      }
    } catch {}
  }
  if (!scope && existsSync(scopePath)) {
    try {
      scope = JSON.parse(readFileSync(scopePath, 'utf-8'));
    } catch {}
  }
  if (!scope) return;

  try {
    const targets = extractTargets(command);
    const outOfScope = targets.filter(t => !isInScope(t, scope));

    if (outOfScope.length > 0) {
      console.log(JSON.stringify({
        'system-reminder': `[greyhatcc] WARNING: Target(s) NOT in authorized scope: ${outOfScope.join(', ')}. Verify authorization before proceeding.`
      }));
    }
  } catch {}
}

main().catch(() => {});
