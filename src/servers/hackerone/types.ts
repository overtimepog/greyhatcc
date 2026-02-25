// ── HackerOne API v1 Types (JSON:API format) ─────────────────────────

// ── Pagination ───────────────────────────────────────────────────────

export interface H1PaginationLinks {
  self?: string;
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

export interface H1PaginatedResponse<T> {
  data: T[];
  links?: H1PaginationLinks;
  meta?: {
    total_count?: number;
    page_count?: number;
    current_page?: number;
  };
  included?: any[];
}

export interface H1SingleResponse<T> {
  data: T;
}

// ── JSON:API Resource Wrapper ────────────────────────────────────────

export interface H1Resource<T> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, {
    data: { id: string; type: string } | Array<{ id: string; type: string }> | null;
  }>;
}

// ── Program ──────────────────────────────────────────────────────────

export interface H1ProgramAttributes {
  handle: string;
  name: string;
  currency: string;
  offers_bounties: boolean;
  state: string;
  submission_state: string;
  policy: string | null;
  profile_picture: string | null;
  bookmarked: boolean;
  allows_bounty_splitting: boolean;
  open_scope: boolean;
  fast_payments: boolean;
  gold_standard_safe_harbor: boolean;
  // Present when fetching as authenticated hacker
  number_of_reports_for_user?: number | null;
  bounty_earned_for_user?: number | null;
  // May be present on list endpoint
  started_accepting_at?: string | null;
  response_efficiency_percentage?: number | null;
  average_time_to_bounty_awarded?: number | null;
  average_time_to_first_program_response?: number | null;
  average_time_to_report_resolved?: number | null;
  minimum_bounty_table_value?: number | null;
  maximum_bounty_table_value?: number | null;
  total_bounties_paid?: number | null;
  resolved_report_count?: number | null;
  allows_disclosure?: boolean;
  about?: string | null;
  website?: string | null;
  profile?: {
    name?: string;
    about?: string;
    website?: string;
  } | null;
}

export type H1Program = H1Resource<H1ProgramAttributes>;

// ── Structured Scope ─────────────────────────────────────────────────

export interface H1StructuredScopeAttributes {
  asset_identifier: string;
  asset_type: 'URL' | 'CIDR' | 'DOMAIN' | 'WILDCARD' | 'API' | 'SOURCE_CODE' |
    'MOBILE_APPLICATION' | 'DOWNLOADABLE_EXECUTABLES' | 'HARDWARE' | 'OTHER' |
    'SMART_CONTRACT' | 'GOOGLE_PLAY_APP_ID' | 'APPLE_STORE_APP_ID' | 'TESTFLIGHT' |
    'WINDOWS_APP_STORE_APP_ID' | string;
  eligible_for_bounty: boolean;
  eligible_for_submission: boolean;
  max_severity: 'critical' | 'high' | 'medium' | 'low' | 'none' | null;
  instruction: string | null;
  confidentiality_requirement: 'none' | 'low' | 'medium' | 'high' | null;
  integrity_requirement: 'none' | 'low' | 'medium' | 'high' | null;
  availability_requirement: 'none' | 'low' | 'medium' | 'high' | null;
  created_at: string;
  updated_at: string;
  reference: string | null;
}

export type H1StructuredScope = H1Resource<H1StructuredScopeAttributes>;

// ── Hacktivity Item (GET /hackers/hacktivity) ────────────────────────

export interface H1HacktivityItemAttributes {
  title: string | null;
  substate: string | null;
  url: string | null;
  disclosed_at: string | null;
  cve_ids: string[];
  cwe: string | null;
  severity_rating: 'critical' | 'high' | 'medium' | 'low' | 'none' | null;
  votes: number;
  total_awarded_amount: string | null;
  submitted_at: string | null;
  disclosed: boolean;
}

export type H1HacktivityItem = H1Resource<H1HacktivityItemAttributes>;

// ── Weakness ─────────────────────────────────────────────────────────

export interface H1WeaknessAttributes {
  name: string;
  description: string;
  external_id: string;
  created_at: string;
}

export type H1Weakness = H1Resource<H1WeaknessAttributes>;

// ── Earnings ─────────────────────────────────────────────────────────

export interface H1EarningsAttributes {
  amount: string;
  bonus_amount: string | null;
  awarded_at: string;
  awarded_currency: string;
  bounty_table_id: string | null;
}

export type H1Earning = H1Resource<H1EarningsAttributes>;

// ── Report ───────────────────────────────────────────────────────────

export interface H1ReportAttributes {
  title: string;
  state: string;
  substate: string | null;
  severity_rating: 'critical' | 'high' | 'medium' | 'low' | 'none' | null;
  created_at: string;
  disclosed_at: string | null;
  vulnerability_information: string | null;
  url: string | null;
  cve_ids?: string[];
  weakness?: {
    id: number;
    name: string;
    external_id: string;
  } | null;
}

export type H1Report = H1Resource<H1ReportAttributes>;

// ── Parsed/Clean types returned by client methods ────────────────────

export interface ParsedProgram {
  id: string;
  handle: string;
  name: string;
  offers_bounties: boolean;
  state: string;
  submission_state: string;
  currency: string;
  policy: string | null;
  bookmarked: boolean;
  open_scope: boolean;
  fast_payments: boolean;
  gold_standard_safe_harbor: boolean;
  allows_bounty_splitting: boolean;
  number_of_reports_for_user: number | null;
  bounty_earned_for_user: number | null;
  started_accepting_at: string | null;
  response_efficiency_percentage: number | null;
  average_time_to_first_response: number | null;
  average_time_to_bounty_awarded: number | null;
  average_time_to_resolved: number | null;
  minimum_bounty: number | null;
  maximum_bounty: number | null;
  total_bounties_paid: number | null;
  resolved_report_count: number | null;
  allows_disclosure: boolean;
  website: string | null;
  about: string | null;
}

export interface ParsedScope {
  asset_identifier: string;
  asset_type: string;
  eligible_for_bounty: boolean;
  eligible_for_submission: boolean;
  max_severity: string | null;
  instruction: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedHacktivityItem {
  id: string;
  title: string | null;
  substate: string | null;
  url: string | null;
  disclosed_at: string | null;
  cve_ids: string[];
  cwe: string | null;
  severity_rating: string | null;
  votes: number;
  total_awarded_amount: string | null;
  submitted_at: string | null;
  disclosed: boolean;
  reporter_username: string | null;
  latest_activity: string | null;
  latest_activity_at: string | null;
  program_handle: string | null;
  summary: string | null;
}

export interface ParsedWeakness {
  id: string;
  name: string;
  description: string;
  external_id: string;
  created_at: string;
}

export interface ParsedEarning {
  amount: string;
  bonus_amount: string | null;
  awarded_at: string;
  currency: string;
}

export interface ParsedReport {
  id: string;
  title: string;
  state: string;
  substate: string | null;
  severity_rating: string | null;
  created_at: string;
  disclosed_at: string | null;
  url: string | null;
  cve_ids: string[];
}

export interface DupeCheckResult {
  handle: string;
  vuln_type: string;
  asset: string | null;
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';
  risk_score: number;
  matching_activities: Array<{
    title: string | null;
    severity: string | null;
    date: string | null;
    match_reason: string;
  }>;
  total_activities_checked: number;
  recommendation: string;
  warning?: string;
}

export interface ScopeSummary {
  handle: string;
  program_name: string;
  state: string;
  in_scope_count: number;
  out_of_scope_count: number;
  in_scope: Array<{
    asset: string;
    type: string;
    bounty_eligible: boolean;
    max_severity: string | null;
    instruction: string | null;
  }>;
  out_of_scope: Array<{
    asset: string;
    type: string;
  }>;
  bounty_range: {
    minimum: number | null;
    maximum: number | null;
  };
  offers_bounties: boolean;
  allows_disclosure: boolean;
}

export interface BountyTable {
  handle: string;
  program_name: string;
  offers_bounties: boolean;
  minimum_bounty: number | null;
  maximum_bounty: number | null;
  total_paid: number | null;
  currency: string;
  note: string;
}

export interface AuthStatus {
  authenticated: boolean;
  username: string;
  programs_accessible: number;
  message: string;
}
