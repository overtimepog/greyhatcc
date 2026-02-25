import { readStdin } from './lib/stdin.mjs';
import { checkScope, extractTargets } from './lib/scope.mjs';
import { readScope } from './lib/state.mjs';

/**
 * Permission Request Hook (Bash)
 *
 * Checks if the command targets are within the authorized scope.
 * - In-scope or no targets detected: allow (exit 0, no output)
 * - Out-of-scope target detected: output a system-reminder warning
 */
async function main() {
  const input = await readStdin();
  const command = input?.tool_input?.command || input?.input?.command || '';
  if (!command) return;

  const scope = readScope();
  if (!scope?.authorized) return;

  const targets = extractTargets(command);
  if (targets.length === 0) return;

  const outOfScope = [];
  for (const target of targets) {
    const result = checkScope(target);
    if (!result.inScope) {
      outOfScope.push({ target, reason: result.reason });
    }
  }

  if (outOfScope.length > 0) {
    const targetList = outOfScope.map(o => `${o.target} (${o.reason})`).join(', ');
    console.log(JSON.stringify({
      'system-reminder': `[greyhatcc] WARNING: Permission requested for command with out-of-scope target(s): ${targetList}. Verify authorization before approving.`
    }));
  }
}

main().catch(() => {});
