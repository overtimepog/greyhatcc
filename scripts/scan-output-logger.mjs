import { readStdin } from './lib/stdin.mjs';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SCAN_TOOLS = ['nmap', 'subfinder', 'nuclei', 'nikto', 'dirb', 'gobuster', 'ffuf', 'sqlmap', 'wfuzz', 'masscan', 'amass', 'httpx', 'katana', 'dnsx'];

async function main() {
  const input = await readStdin();
  const command = input?.tool_input?.command || '';
  const output = input?.tool_output?.stdout || input?.tool_output?.output || '';

  const isScanTool = SCAN_TOOLS.some(tool => command.includes(tool));
  if (!isScanTool || !command) return;

  const logDir = join(process.cwd(), '.greyhatcc');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const entry = {
    timestamp: new Date().toISOString(),
    command: command.slice(0, 500),
    output_preview: (output || '').slice(0, 500),
    exit_code: input?.tool_output?.exit_code ?? null,
  };

  appendFileSync(join(logDir, 'scan-log.jsonl'), JSON.stringify(entry) + '\n');
}

main().catch(() => {});
