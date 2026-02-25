import { readScope } from './state.mjs';

/**
 * Check if a target (domain or IP) is within the authorized scope.
 * Returns { inScope: boolean, reason: string }
 */
export function checkScope(target) {
  const scope = readScope();
  if (!scope?.authorized) return { inScope: true, reason: 'No scope defined' };

  const domains = scope.authorized.domains || [];
  const ips = scope.authorized.ips || [];
  const urls = scope.authorized.urls || [];
  const excludedDomains = scope.excluded?.domains || [];

  // Check exclusions first
  for (const excl of excludedDomains) {
    if (excl.startsWith('*.')) {
      if (target.endsWith(excl.slice(1)) || target === excl.slice(2)) {
        return { inScope: false, reason: `Excluded by wildcard: ${excl}` };
      }
    } else if (target === excl || target.includes(excl)) {
      return { inScope: false, reason: `Explicitly excluded: ${excl}` };
    }
  }

  // Check authorized domains
  for (const domain of domains) {
    if (domain.startsWith('*.')) {
      if (target.endsWith(domain.slice(1)) || target === domain.slice(2)) {
        return { inScope: true, reason: `Matches wildcard: ${domain}` };
      }
    } else if (target === domain || target.includes(domain)) {
      return { inScope: true, reason: `Matches domain: ${domain}` };
    }
  }

  // Check authorized IPs
  for (const ip of ips) {
    if (target === ip) return { inScope: true, reason: `Matches IP: ${ip}` };
    if (ip.includes('/') && isIpInCidr(target, ip)) {
      return { inScope: true, reason: `In CIDR range: ${ip}` };
    }
  }

  // Check URLs
  for (const url of urls) {
    try {
      const urlObj = new URL(url.replace('*', 'WILDCARD'));
      if (target.includes(urlObj.hostname)) {
        return { inScope: true, reason: `Matches URL pattern: ${url}` };
      }
    } catch {}
  }

  // No match found
  if (domains.length === 0 && ips.length === 0 && urls.length === 0) {
    return { inScope: true, reason: 'Empty scope (no restrictions)' };
  }

  return { inScope: false, reason: `Not in authorized scope. Authorized: ${[...domains, ...ips].join(', ')}` };
}

/**
 * Check if a vulnerability type is excluded by the program.
 */
export function checkExclusion(vulnType, scope) {
  if (!scope?.excluded?.vulnTypes) return { excluded: false, reason: 'No vuln type exclusions defined' };

  const normalizedVuln = vulnType.toLowerCase();
  for (const exclusion of scope.excluded.vulnTypes) {
    if (normalizedVuln.includes(exclusion.toLowerCase())) {
      return { excluded: true, reason: `Vulnerability type excluded: ${exclusion}` };
    }
  }
  return { excluded: false, reason: 'Vulnerability type not on exclusion list' };
}

function isIpInCidr(ip, cidr) {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1) >>> 0;
    const ipNum = ip.split('.').reduce((acc, oct) => (acc * 256) + parseInt(oct), 0) >>> 0;
    const rangeNum = range.split('.').reduce((acc, oct) => (acc * 256) + parseInt(oct), 0) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Extract all domains/IPs from a string (command, URL, etc.)
 */
export function extractTargets(text) {
  const targets = new Set();

  // IPs
  const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
  let match;
  while ((match = ipRegex.exec(text)) !== null) {
    const ip = match[1];
    if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255' && ip !== '169.254.169.254') {
      targets.add(ip);
    }
  }

  // Domains from URLs
  const urlRegex = /https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g;
  while ((match = urlRegex.exec(text)) !== null) {
    targets.add(match[1]);
  }

  // Bare domains (after common tool names)
  const toolDomainRegex = /(?:nmap|curl|wget|nikto|gobuster|ffuf|sqlmap|nuclei|httpx|subfinder|dig|host|whois)\s+(?:-[^\s]+\s+)*(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9.]+\.[a-zA-Z]{2,})/g;
  while ((match = toolDomainRegex.exec(text)) !== null) {
    targets.add(match[1]);
  }

  return [...targets];
}
