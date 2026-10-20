/** Pure time accounting. All intervals are half-open [start, end), in epoch milliseconds. */
export interface Interval { start: number; end: number }
export interface Settings {
  monthlySalary: number;
  /** 0 = count this month's configured weekdays; otherwise explicit company workday count. */
  monthDays: number;
  start: string;
  end: string;
  lunchStart: string;
  lunchEnd: string;
  lunch: boolean;
  weekdays: number[];
}
export const DEFAULTS: Settings = {
  monthlySalary: 8000, monthDays: 20, start: '09:00', end: '18:00',
  lunchStart: '12:00', lunchEnd: '13:00', lunch: true, weekdays: [1, 2, 3, 4, 5],
};
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validInterval(value: unknown): value is Interval {
  return object(value) && typeof value.start === 'number' && typeof value.end === 'number'
    && Number.isFinite(value.start) && Number.isFinite(value.end)
    && value.start >= 0 && value.end > value.start;
}
export function merge(intervals: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const item of intervals.filter(validInterval).map(i => ({ ...i })).sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
    else result.push(item);
  }
  return result;
}
export function seconds(intervals: readonly Interval[]): number {
  return merge(intervals).reduce((n, i) => n + (i.end - i.start) / 1000, 0);
}
export function intersect(intervals: readonly Interval[], windows: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const a of merge(intervals)) for (const b of merge(windows)) {
    const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
    if (end > start) result.push({ start, end });
  }
  return merge(result);
}
export function minutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('时间格式应为 HH:mm');
  const parts = value.split(':').map(Number);
  return parts[0]! * 60 + parts[1]!;
}
export function settingsOf(value: unknown): Settings {
  if (!object(value)) throw new Error('设置不是有效对象');
  const v = value;
  if (typeof v.monthlySalary !== 'number' || !Number.isFinite(v.monthlySalary) || v.monthlySalary <= 0 || v.monthlySalary > 1e9)
    throw new Error('月薪应大于 0 且不超过 10 亿');
  if (typeof v.monthDays !== 'number' || !Number.isInteger(v.monthDays) || v.monthDays < 0 || v.monthDays > 31)
    throw new Error('工作日应为 1–31；填 0 按本月星期配置计算');
  for (const key of ['start', 'end', 'lunchStart', 'lunchEnd']) {
    if (typeof v[key] !== 'string') throw new Error('请填写完整时间');
    minutes(v[key]);
  }
  if (typeof v.lunch !== 'boolean' || !Array.isArray(v.weekdays) || !v.weekdays.length
    || !v.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('请选择每周工作日');
  const s: Settings = {
    monthlySalary: v.monthlySalary, monthDays: v.monthDays,
    start: v.start as string, end: v.end as string,
    lunchStart: v.lunchStart as string, lunchEnd: v.lunchEnd as string,
    lunch: v.lunch, weekdays: [...new Set(v.weekdays as number[])].sort(),
  };
  if (minutes(s.end) <= minutes(s.start)) throw new Error('首版仅支持当日班次，下班须晚于上班');
  if (s.lunch && (minutes(s.lunchStart) < minutes(s.start) || minutes(s.lunchEnd) > minutes(s.end)
    || minutes(s.lunchStart) >= minutes(s.lunchEnd))) throw new Error('午休需完整位于班次内');
  if (plannedHours(s) <= 0) throw new Error('每日工作时间必须大于 0');
  return s;
}
export function plannedHours(s: Settings): number {
  return (minutes(s.end) - minutes(s.start) - (s.lunch ? minutes(s.lunchEnd) - minutes(s.lunchStart) : 0)) / 60;
}
/** Browser-local timezone, deliberately not UTC slicing. DST is handled by Date construction. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dayAt(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}
function timeAt(date: Date, time: string): number {
  const n = minutes(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(n / 60), n % 60).getTime();
}
export function windowsFor(date: Date, s: Settings): Interval[] {
  if (!s.weekdays.includes(date.getDay())) return [];
  return s.lunch
    ? [{ start: timeAt(date, s.start), end: timeAt(date, s.lunchStart) }, { start: timeAt(date, s.lunchEnd), end: timeAt(date, s.end) }].filter(validInterval)
    : [{ start: timeAt(date, s.start), end: timeAt(date, s.end) }];
}
export function workdays(date: Date, s: Settings): number {
  if (s.monthDays) return s.monthDays;
  let count = 0;
  for (let n = 1; n <= new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); n++) {
    if (s.weekdays.includes(new Date(date.getFullYear(), date.getMonth(), n).getDay())) count++;
  }
  return count;
}
export function metrics(date: Date, settings: Settings, intervals: readonly Interval[], now: number) {
  const s = settingsOf(settings);
  const hours = plannedHours(s), days = workdays(date, s);
  const dayPay = days > 0 ? s.monthlySalary / days : 0;
  const baseRate = dayPay / hours;
  const confirmed = intervals.map(i => ({ start: i.start, end: Math.min(i.end, now) }));
  const rawSeconds = seconds(intersect(confirmed, [{ start: dayAt(date).getTime(), end: dayAt(date, 1).getTime() }]));
  const paidSeconds = Math.min(hours * 3600, seconds(intersect(confirmed, windowsFor(date, s))));
  const remaining = hours - paidSeconds / 3600;
  const effectiveRate = remaining > 1e-9 ? dayPay / remaining : null;
  return {
    rawSeconds, paidSeconds, baseRate, value: paidSeconds / 3600 * baseRate,
    effectiveRate, increase: effectiveRate === null ? null : (effectiveRate / baseRate - 1) * 100,
    atLimit: effectiveRate === null,
  };
}
