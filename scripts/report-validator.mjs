import { readStdin } from './lib/stdin.mjs';
import { readScope, getFindings, getSubmissions, getActiveProgram } from './lib/state.mjs';
import { getRejectionRisk } from './lib/dupes.mjs';

/**
 * Report Validator Hook: PostToolUse on Write/Edit for report files.
 * Catches the most common report quality issues BEFORE they're finalized:
 *
 * 1. Asset name doesn't match scope
 * 2. Finding type is on exclusion list
 * 3. Missing PoC / Steps to Reproduce
 * 4. Duplicate of existing finding/submission
 * 5. Known commonly-rejected pattern
 * 6. Missing required headers in curl commands
 * 7. CVSS inflation (common rejection reason)
 */
async function main() {
  const input = await readStdin();
  const filePath = input?.tool_input?.file_path || '';
  const content = input?.tool_input?.content || input?.tool_input?.new_string || '';

  // Only validate report files
  if (!filePath.includes('/reports/') || !filePath.endsWith('.md')) return;
  if (!content || content.length < 100) return;

  const warnings = [];
  const errors = [];
  const scope = readScope();
  const program = getActiveProgram();

  // --- CHECK 1: Asset name matches scope ---
  const assetMatch = content.match(/\*\*Asset:\*\*\s*(.+)/i);
  if (assetMatch) {
    const reportAsset = assetMatch[1].trim();
    if (scope?.authorized?.domains?.length > 0) {
      const allDomains = scope.authorized.domains.flatMap(d =>
        d.startsWith('*.') ? [d, d.slice(2)] : [d]
      );
      const assetInScope = allDomains.some(d => {
        if (d.startsWith('*.')) return reportAsset.includes(d.slice(2));
        return reportAsset.includes(d);
      });
      if (!assetInScope) {
        errors.push(`ASSET NOT IN SCOPE: "${reportAsset}" doesn't match any authorized domain. Check scope.json.`);
      }
    }
  } else {
    warnings.push('Missing **Asset:** field. Every report MUST specify the exact asset from the program scope.');
  }

  // --- CHECK 2: Finding type on exclusion list ---
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) {
    const title = titleMatch[1];
    const { risk, matches } = getRejectionRisk(title);
    if (risk === 'BLOCK') {
      errors.push(`HIGH REJECTION RISK: "${matches[0].title}" — ${matches[0].advice}`);
    } else if (risk === 'WARN') {
      warnings.push(`REJECTION RISK: "${matches[0].title}" — ${matches[0].advice}`);
    }
  }

  // --- CHECK 3: Missing Steps to Reproduce ---
  if (!content.includes('Steps to Reproduce') && !content.includes('steps to reproduce')) {
    errors.push('Missing "Steps to Reproduce" section. Reports without copy-pasteable repro steps are ALWAYS rejected.');
  }

  // --- CHECK 4: Missing PoC evidence ---
  const hasCurl = /```(?:bash|sh)[\s\S]*?curl/i.test(content);
  const hasScript = /```(?:python|javascript|html|bash|sh)[\s\S]*?```/i.test(content);
  const hasEvidence = /evidence\/|screenshot|\.png|\.jpg/i.test(content);
  if (!hasCurl && !hasScript && !hasEvidence) {
    warnings.push('No PoC code, curl commands, or evidence references found. Theoretical reports are rejected as N/A.');
  }

  // --- CHECK 5: Required research headers in curl commands ---
  if (hasCurl) {
    const requiredHeaders = scope?.rules?.requiredHeaders || {};
    for (const [header, value] of Object.entries(requiredHeaders)) {
      if (!content.includes(header)) {
        errors.push(`Missing required header "${header}: ${value}" in curl commands. Triage can't reproduce without it.`);
      }
    }
    // Check for common program headers
    if (scope?.platform?.username && !content.includes('overtimedev') && !content.includes('HackerOne')) {
      warnings.push('No researcher identification header found in curl commands. Many programs require X-HackerOne-Research or similar.');
    }
  }

  // --- CHECK 6: CVSS sanity check ---
  const cvssMatch = content.match(/CVSS.*?(\d+\.\d+)/);
  if (cvssMatch) {
    const score = parseFloat(cvssMatch[1]);
    // Check for inflation signals
    if (score >= 9.0) {
      const hasRCE = /(?:remote.*code.*exec|rce|command.*inject|shell)/i.test(content);
      const hasFullATO = /(?:account.*takeover|ato|full.*access|admin.*access)/i.test(content);
      const hasDataBreach = /(?:mass.*data|all.*users|database.*dump|full.*dump)/i.test(content);
      if (!hasRCE && !hasFullATO && !hasDataBreach) {
        warnings.push(`CVSS ${score} is Critical-range but report doesn't demonstrate RCE, full ATO, or mass data breach. Triage teams frequently downgrade inflated scores.`);
      }
    }
  }

  // --- CHECK 7: Duplicate of existing finding ---
  if (program && titleMatch) {
    const title = titleMatch[1].toLowerCase();
    const findings = getFindings(program);
    const submissions = getSubmissions(program);

    for (const finding of findings) {
      if (finding.title && title.includes(finding.title.toLowerCase().slice(0, 30))) {
        warnings.push(`Possible duplicate of existing finding ${finding.id}: "${finding.title}". Run /greyhatcc:dedup first.`);
        break;
      }
    }

    for (const sub of submissions) {
      if (sub.title && title.includes(sub.title.toLowerCase().slice(0, 30))) {
        errors.push(`ALREADY SUBMITTED as ${sub.h1_report_id || sub.id} (status: ${sub.status}). Do NOT re-submit.`);
        break;
      }
    }
  }

  // --- CHECK 8: CVSS rationale exists ---
  if (content.includes('CVSS') && !content.includes('Rationale') && !content.includes('rationale')) {
    warnings.push('CVSS score found but no metric rationale table. Every CVSS metric needs written justification to avoid triage disputes.');
  }

  // --- Output ---
  const output = [];
  if (errors.length > 0) {
    output.push(`[greyhatcc:report-validator] ERRORS (${errors.length}):`);
    errors.forEach(e => output.push(`  ✗ ${e}`));
  }
  if (warnings.length > 0) {
    output.push(`[greyhatcc:report-validator] WARNINGS (${warnings.length}):`);
    warnings.forEach(w => output.push(`  ⚠ ${w}`));
  }

  if (output.length > 0) {
    output.push('');
    output.push('Fix these issues before submitting to HackerOne. Use /greyhatcc:validate for full validation.');
    console.log(JSON.stringify({ 'system-reminder': output.join('\n') }));
  }
}

main().catch(() => {});
