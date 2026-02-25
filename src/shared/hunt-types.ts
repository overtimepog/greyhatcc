/**
 * Canonical type definitions for the hunt architecture.
 * All interfaces for work items, surfaces, signals, findings, gadgets, and hunt state.
 */

// ---------------------------------------------------------------------------
// Work Items
// ---------------------------------------------------------------------------

/** Result produced by a completed WorkItem. */
export interface WorkItemResult {
  /** Whether the work item completed successfully. */
  success: boolean;
  /** Human-readable summary of what was accomplished. */
  summary: string;
  /** New attack surfaces discovered during execution. */
  new_surfaces: Surface[];
  /** Signals emitted that may amplify or inform other work. */
  signals: Signal[];
  /** Confirmed or candidate vulnerability findings. */
  findings: Finding[];
  /** Reusable exploit primitives (gadgets) discovered. */
  gadgets: Gadget[];
  /** Follow-on work items to enqueue. */
  new_work_items: Partial<WorkItem>[];
  /** Raw tool/command output for debugging. */
  raw_output: string;
  /** Total LLM tokens consumed during execution. */
  tokens_used: number;
  /** Wall-clock execution time in milliseconds. */
  duration_ms: number;
}

/** A discrete unit of work in the hunt pipeline. */
export interface WorkItem {
  /** Unique identifier (UUID v4). */
  id: string;
  /** High-level category of the work item. */
  type: "recon" | "test" | "exploit" | "validate" | "report";
  /** Finer-grained classification (e.g. "subdomain_enum", "sqli_test"). */
  subtype: string;
  /** The target URL, host, or resource this work item acts on. */
  target: string;
  /** Scheduling priority from 0 (lowest) to 100 (highest). */
  priority: number;
  /** Current lifecycle status. */
  status: "queued" | "active" | "done" | "failed" | "escalated";
  /** Which model tier should execute this work item. */
  model_tier: "haiku" | "sonnet" | "opus";
  /** Arbitrary context passed to the executor. */
  context: Record<string, any>;
  /** Parent work item ID, or null if this is a root item. */
  parent_id: string | null;
  /** IDs of child work items spawned from this item. */
  children_ids: string[];
  /** ISO 8601 timestamp when the work item was created. */
  created_at: string;
  /** ISO 8601 timestamp when execution started, or null. */
  started_at: string | null;
  /** ISO 8601 timestamp when execution finished, or null. */
  completed_at: string | null;
  /** Execution result, populated on completion. */
  result: WorkItemResult | null;
  /** Number of times this item was escalated to a higher model tier. */
  escalation_count: number;
  /** Number of retry attempts after failure. */
  retry_count: number;
  /** Freeform tags for filtering and categorization. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/** An attack surface discovered during reconnaissance or testing. */
export interface Surface {
  /** Unique identifier. */
  id: string;
  /** Classification of the surface type. */
  type:
    | "endpoint"
    | "subdomain"
    | "parameter"
    | "header"
    | "api_route"
    | "js_file"
    | "cloud_asset"
    | "service";
  /** Full URL or address of the surface. */
  url: string;
  /** HTTP method, if applicable. */
  method?: string;
  /** Parameter names accepted by this surface. */
  params?: string[];
  /** Detected technology stack components. */
  tech_stack?: string[];
  /** Whether authentication is required to access this surface. */
  auth_required?: boolean;
  /** Free-text notes about the surface. */
  notes: string;
  /** ID of the WorkItem that discovered this surface. */
  discovered_by: string;
  /** ISO 8601 timestamp of discovery. */
  discovered_at: string;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** A signal emitted by a work item that may inform or amplify other work. */
export interface Signal {
  /** Unique identifier. */
  id: string;
  /** Signal classification (e.g. "reflected_input", "error_disclosure"). */
  type: string;
  /** Human-readable description of the signal. */
  description: string;
  /** The target where the signal was observed. */
  target: string;
  /** Confidence level from 0.0 (speculative) to 1.0 (certain). */
  confidence: number;
  /** ID of a matching amplification rule, or null. */
  amplification_match: string | null;
  /** ID of the WorkItem that produced this signal. */
  source_work_item: string;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/** Gate checks that a finding must pass before being reported. */
export interface ValidationGates {
  /** Target is within the program's defined scope. */
  in_scope: boolean | null;
  /** Finding is not on the program's exclusion list. */
  not_excluded: boolean | null;
  /** Finding has not already been reported (deduplication). */
  not_duplicate: boolean | null;
  /** Proof of concept is reproducible. */
  proof_reproducible: boolean | null;
  /** Report quality meets submission standards. */
  quality_sufficient: boolean | null;
}

/** A vulnerability finding, from candidate through validated/reported. */
export interface Finding {
  /** Unique identifier. */
  id: string;
  /** Descriptive title following "[Vuln] in [Component] allows [Impact]" format. */
  title: string;
  /** Vulnerability classification (e.g. "xss", "sqli", "idor", "ssrf"). */
  vulnerability_type: string;
  /** Severity rating. */
  severity: "critical" | "high" | "medium" | "low" | "informational";
  /** Confidence level from 0.0 to 1.0. */
  confidence: number;
  /** The affected target URL or resource. */
  target: string;
  /** Step-by-step proof of concept for reproduction. */
  proof_of_concept: string;
  /** Business impact description. */
  impact: string;
  /** CVSS v3.1 base score, if calculated. */
  cvss_score?: number;
  /** CVSS v3.1 vector string, if calculated. */
  cvss_vector?: string;
  /** CWE identifier (e.g. "CWE-79"), if applicable. */
  cwe_id?: string;
  /** IDs of other findings in a vulnerability chain. */
  chain_ids: string[];
  /** Current lifecycle status of the finding. */
  status:
    | "candidate"
    | "confirmed"
    | "validated"
    | "reported"
    | "duplicate"
    | "rejected";
  /** Gate checks the finding must pass before reporting. */
  validation_gates: ValidationGates;
  /** Raw evidence artifacts (screenshots, response bodies, logs). */
  evidence: string[];
  /** ID of the WorkItem that discovered this finding. */
  discovered_by: string;
  /** ISO 8601 timestamp of discovery. */
  discovered_at: string;
  /** ISO 8601 timestamp when the finding was validated. */
  validated_at?: string;
}

// ---------------------------------------------------------------------------
// Gadgets
// ---------------------------------------------------------------------------

/** A reusable exploit primitive that can be chained with other gadgets. */
export interface Gadget {
  /** Unique identifier. */
  id: string;
  /** Gadget classification (e.g. "open_redirect", "self_xss", "ssrf_primitive"). */
  type: string;
  /** Human-readable description of what this gadget does. */
  description: string;
  /** The target where this gadget operates. */
  target: string;
  /** Capabilities this gadget provides (e.g. ["redirect_control", "cookie_injection"]). */
  provides: string[];
  /** Preconditions required to use this gadget (e.g. ["authenticated_session"]). */
  requires: string[];
  /** Proof that this gadget works (request/response, payload). */
  proof: string;
  /** ID of the WorkItem that discovered this gadget. */
  discovered_by: string;
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/** Program scope definition including targets, exclusions, and bounty table. */
export interface ScopeDefinition {
  /** Domains, IPs, and wildcards that are in scope. */
  in_scope: string[];
  /** Domains, IPs, and wildcards that are out of scope. */
  out_of_scope: string[];
  /** Bounty payout ranges keyed by severity (e.g. "critical": {min: 5000, max: 25000}). */
  bounty_table: Record<string, { min: number; max: number }>;
  /** Raw program policy text for reference. */
  program_policy: string;
  /** Specific vulnerability types or findings excluded by the program. */
  exclusions: string[];
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/** Tracks which endpoints and vulnerability classes have been tested. */
export interface CoverageTracker {
  /** Map of endpoint URL to array of vulnerability classes tested against it. */
  endpoints_tested: Record<string, string[]>;
  /** Vulnerability classes that have been covered. */
  vuln_classes_covered: string[];
  /** Vulnerability classes that still need testing. */
  vuln_classes_remaining: string[];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Aggregate statistics for a hunt session. */
export interface HuntStats {
  /** Total work items created. */
  work_items_total: number;
  /** Work items that completed successfully. */
  work_items_completed: number;
  /** Work items that failed. */
  work_items_failed: number;
  /** Total findings discovered (all statuses). */
  findings_total: number;
  /** Findings that passed validation. */
  findings_confirmed: number;
  /** Total LLM tokens consumed across all work items. */
  tokens_total: number;
  /** Estimated USD cost of LLM usage. */
  cost_estimate_usd: number;
  /** Total elapsed time in minutes since hunt started. */
  elapsed_minutes: number;
}

// ---------------------------------------------------------------------------
// Hunt State
// ---------------------------------------------------------------------------

/** Top-level state object for an active hunt session. */
export interface HuntState {
  /** Unique identifier for this hunt session. */
  hunt_id: string;
  /** Bug bounty program handle (e.g. HackerOne program name). */
  program: string;
  /** Program scope definition. */
  scope: ScopeDefinition;
  /** ISO 8601 timestamp when the hunt was started. */
  started_at: string;
  /** ISO 8601 timestamp of the most recent activity. */
  last_active: string;
  /** Current hunt status. */
  status: "running" | "paused" | "completed";
  /** Priority queue of work items. */
  queue: WorkItem[];
  /** All findings discovered during this hunt. */
  findings: Finding[];
  /** All attack surfaces discovered. */
  surfaces: Surface[];
  /** All gadgets (reusable exploit primitives) discovered. */
  gadgets: Gadget[];
  /** All signals emitted during the hunt. */
  signals: Signal[];
  /** Coverage tracking for endpoints and vulnerability classes. */
  coverage: CoverageTracker;
  /** Number of intelligence-gathering runs completed. */
  intel_runs: number;
  /** Aggregate hunt statistics. */
  stats: HuntStats;
}
