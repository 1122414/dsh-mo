import { DEFAULTS, merge, object, settingsOf, validInterval, type Interval, type Settings } from './core.js';
export const STORE_KEY = 'dsh-mo:v1';
export interface Saved { schema: 1; settings: Settings; configured: boolean; intervals: Interval[]; savedAt: number }
export function empty(): Saved {
  return { schema: 1, settings: { ...DEFAULTS, weekdays: [...DEFAULTS.weekdays] }, configured: false, intervals: [], savedAt: 0 };
}
export function decode(raw: string | null): Saved {
  if (raw === null) return empty();
  if (raw.length > 5_000_000) throw new Error('本地数据过大；请先导出备份后重置');
  const v: unknown = JSON.parse(raw);
  if (!object(v) || v.schema !== 1 || typeof v.configured !== 'boolean' || !Array.isArray(v.intervals)
    || !v.intervals.every(validInterval) || typeof v.savedAt !== 'number' || !Number.isFinite(v.savedAt) || v.savedAt < 0)
    throw new Error('本地数据版本不支持或已损坏；保留原数据并停止写入');
  return { schema: 1, settings: settingsOf(v.settings), configured: v.configured, intervals: merge(v.intervals), savedAt: v.savedAt };
}
export function encode(saved: Saved, now: number): string {
  const cutoff = now - 90 * 86400000;
  const intervals = merge(saved.intervals.map(i => ({ start: Math.max(i.start, cutoff), end: Math.min(i.end, now) })));
  return JSON.stringify({ ...saved, settings: settingsOf(saved.settings), intervals, savedAt: now });
}
