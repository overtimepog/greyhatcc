// traffic-store.ts — In-memory storage for captured HTTP traffic entries

import type { TrafficEntry, TrafficSearchQuery, TrafficFilter } from './types.js';

// ── TrafficStore ─────────────────────────────────────────────────────────────

export class TrafficStore {
  private entries: Map<string, TrafficEntry[]>;
  private counters: Map<string, number>;
  private maxEntriesPerSession: number;
  private maxBodySize: number;

  constructor(config: { maxEntriesPerSession?: number; maxBodySize?: number } = {}) {
    this.entries = new Map();
    this.counters = new Map();
    this.maxEntriesPerSession = config.maxEntriesPerSession ?? 1000;
    this.maxBodySize = config.maxBodySize ?? 1024 * 1024; // 1 MB default
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ensureSession(sessionId: string): TrafficEntry[] {
    if (!this.entries.has(sessionId)) {
      this.entries.set(sessionId, []);
      this.counters.set(sessionId, 1);
    }
    return this.entries.get(sessionId)!;
  }

  private truncateBody(body: string | null): { body: string | null; truncated: boolean } {
    if (body === null) return { body: null, truncated: false };
    if (body.length <= this.maxBodySize) return { body, truncated: false };
    return { body: body.slice(0, this.maxBodySize), truncated: true };
  }

  private headersToString(headers: Record<string, string>): string {
    return Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  private matchesPattern(text: string, pattern: string, regex: boolean): boolean {
    if (regex) {
      try {
        return new RegExp(pattern, 'i').test(text);
      } catch {
        return false;
      }
    }
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  private entryMatchesSearch(entry: TrafficEntry, query: TrafficSearchQuery): boolean {
    const { pattern, regex = false, searchIn = 'all' } = query;

    const check = (text: string | null): boolean => {
      if (text === null) return false;
      return this.matchesPattern(text, pattern, regex);
    };

    switch (searchIn) {
      case 'url':
        return check(entry.url);

      case 'request_headers':
        return check(this.headersToString(entry.requestHeaders));

      case 'request_body':
        return check(entry.requestBody);

      case 'response_headers':
        return check(this.headersToString(entry.responseHeaders));

      case 'response_body':
        return check(entry.responseBody);

      case 'all':
      default: {
        const reqHeaderStr = this.headersToString(entry.requestHeaders);
        const resHeaderStr = this.headersToString(entry.responseHeaders);
        return (
          check(entry.url) ||
          check(reqHeaderStr) ||
          check(entry.requestBody) ||
          check(resHeaderStr) ||
          check(entry.responseBody)
        );
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  addEntry(sessionId: string, entry: Omit<TrafficEntry, 'id'>): number {
    const list = this.ensureSession(sessionId);
    const id = this.counters.get(sessionId)!;
    this.counters.set(sessionId, id + 1);

    // Truncate bodies if needed
    const { body: requestBody, truncated: _reqTruncated } = this.truncateBody(entry.requestBody);
    const { body: responseBody, truncated: responseBodyTruncated } = this.truncateBody(entry.responseBody);

    const newEntry: TrafficEntry = {
      ...entry,
      id,
      requestBody,
      responseBody,
      responseBodyTruncated: entry.responseBodyTruncated || responseBodyTruncated,
    };

    list.push(newEntry);

    // FIFO eviction when over limit
    while (list.length > this.maxEntriesPerSession) {
      list.shift();
    }

    return id;
  }

  getEntry(sessionId: string, entryId: number): TrafficEntry | undefined {
    const list = this.entries.get(sessionId);
    if (!list) return undefined;
    return list.find((e) => e.id === entryId);
  }

  search(sessionId: string, query: TrafficSearchQuery): TrafficEntry[] {
    const list = this.entries.get(sessionId);
    if (!list) return [];

    let results = list.filter((entry) => {
      // Filter by method
      if (query.method && entry.method.toUpperCase() !== query.method.toUpperCase()) {
        return false;
      }
      // Filter by status code
      if (query.statusCode !== undefined && entry.status !== query.statusCode) {
        return false;
      }
      // Filter by mime type (partial match)
      if (query.mimeType && !entry.mimeType.toLowerCase().includes(query.mimeType.toLowerCase())) {
        return false;
      }
      // Pattern match
      return this.entryMatchesSearch(entry, query);
    });

    if (query.limit !== undefined && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  getSessionEntries(sessionId: string, filter?: TrafficFilter): TrafficEntry[] {
    const list = this.entries.get(sessionId);
    if (!list) return [];

    let results = list.filter((entry) => {
      if (filter?.method && entry.method.toUpperCase() !== filter.method.toUpperCase()) {
        return false;
      }
      if (filter?.urlPattern) {
        try {
          if (!new RegExp(filter.urlPattern, 'i').test(entry.url)) return false;
        } catch {
          if (!entry.url.toLowerCase().includes(filter.urlPattern.toLowerCase())) return false;
        }
      }
      return true;
    });

    if (filter?.limit !== undefined && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  clearSession(sessionId: string): void {
    this.entries.delete(sessionId);
    this.counters.delete(sessionId);
  }

  getStats(sessionId: string): { count: number; totalBodyBytes: number } {
    const list = this.entries.get(sessionId);
    if (!list) return { count: 0, totalBodyBytes: 0 };

    let totalBodyBytes = 0;
    for (const entry of list) {
      if (entry.requestBody) totalBodyBytes += entry.requestBody.length;
      if (entry.responseBody) totalBodyBytes += entry.responseBody.length;
    }

    return { count: list.length, totalBodyBytes };
  }

  getMaxBodySize(): number {
    return this.maxBodySize;
  }
}
