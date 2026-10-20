import { merge, seconds, type Interval } from './core.js';
export type Status = 'running' | 'waiting' | 'idle' | 'unknown';
export interface Signal { id: string; status: Status }
interface Run { eligible: number; cursor: number }
/**
 * Only confirmed observations accrue time. Long heartbeat gaps close at the LAST
 * observation: tab suspension/offline time is never retroactively invented.
 */
export class Tracker {
  private runs = new Map<string, Run>();
  private ledger: Interval[] = [];
  private last: number | undefined;
  private clockFloor: number | undefined;
  constructor(readonly thresholdMs = 5000, readonly maxGapMs = 15000) {
    if (!Number.isFinite(thresholdMs) || thresholdMs < 0 || !Number.isFinite(maxGapMs) || maxGapMs <= 0)
      throw new Error('Invalid timing configuration');
  }
  observe(signals: readonly Signal[], at: number): void {
    if (!Number.isFinite(at) || at < 0) return;
    if (this.last !== undefined && at < this.last) {
      this.clockFloor = Math.max(this.clockFloor ?? 0, this.last);
      this.runs.clear();
      return;
    }
    if (this.clockFloor !== undefined) {
      if (at < this.clockFloor) return;
      this.clockFloor = undefined;
      this.last = undefined;
    }
    if (this.last !== undefined && at - this.last <= this.maxGapMs) this.settle(at);
    else this.runs.clear();
    const wanted = new Set(signals.filter(s => s.status === 'running').map(s => s.id));
    for (const id of this.runs.keys()) if (!wanted.has(id)) this.runs.delete(id);
    for (const id of wanted) if (!this.runs.has(id)) this.runs.set(id, { eligible: at + this.thresholdMs, cursor: at + this.thresholdMs });
    this.last = at;
  }
  /** Stop at the last confirmed sample, not at an unobserved future timestamp. */
  disconnect(): void { this.runs.clear(); this.last = undefined; }
  restore(intervals: readonly Interval[]): void { this.disconnect(); this.ledger = merge(intervals); }
  snapshot(): Interval[] { return this.ledger.map(i => ({ ...i })); }
  get totalSeconds(): number { return seconds(this.ledger); }
  get activeCount(): number { return this.runs.size; }
  get pendingCount(): number { return [...this.runs.values()].filter(r => r.eligible > (this.last ?? 0)).length; }
  private settle(at: number): void {
    const extra: Interval[] = [];
    for (const run of this.runs.values()) {
      if (at > run.cursor) { extra.push({ start: run.cursor, end: at }); run.cursor = at; }
    }
    this.ledger = merge([...this.ledger, ...extra]);
  }
}
