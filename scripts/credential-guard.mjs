import { readStdin } from './lib/stdin.mjs';

const CREDENTIAL_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g },
  { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g },
  { name: 'GitLab Token', pattern: /glpat-[0-9a-zA-Z\-_]{20}/g },
  { name: 'Slack Token', pattern: /xox[bpors]-[0-9a-zA-Z\-]{10,}/g },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"][0-9a-zA-Z]{20,}['"]/g },
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
  { name: 'OpenAI Key', pattern: /sk-[a-zA-Z0-9]{32,}/g },
];

async function main() {
  const input = await readStdin();
  const content = input?.tool_input?.content || input?.tool_input?.new_string || '';
  if (!content) return;

  const found = [];
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      found.push(name);
    }
  }

  if (found.length > 0) {
    console.log(JSON.stringify({
      'system-reminder': `[greyhatcc] WARNING: Potential credentials detected in file content: ${found.join(', ')}. Verify these are not real secrets before committing.`
    }));
  }
}

main().catch(() => {});
