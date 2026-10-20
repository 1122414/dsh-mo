import { object } from './core.js';
import type { Signal } from './tracker.js';
export interface Source { getSnapshot(): unknown; subscribe(fn: () => void): () => void }
export interface DshContext {
  uiSession?: { sessionStatus?: Source };
  connection?: { generation?: Source };
  effect?(fn: () => () => void, label?: string): unknown;
}
export function sourceOf(value: unknown): Source {
  if (!object(value) || typeof value.getSnapshot !== 'function' || typeof value.subscribe !== 'function')
    throw new Error('DSH 状态接口不兼容：需要 uiSession.sessionStatus 与 connection.generation');
  return value as unknown as Source;
}
/** Current unified UI status, NOT list.running and NOT the durable question history. */
export function signalsOf(value: unknown): Signal[] {
  if (!(value instanceof Map)) throw new Error('DSH SessionStatusSnapshot 不是 Map，已暂停计量');
  const result: Signal[] = [];
  for (const [id, row] of value) {
    if (typeof id !== 'string' || !id || !object(row)) throw new Error('DSH 会话状态数据异常');
    result.push({ id, status: row.pendingInteraction != null ? 'waiting'
      : row.running === true ? 'running' : row.running === false ? 'idle' : 'unknown' });
  }
  return result;
}
export interface Observation { connected: boolean; signals: Signal[]; error: string | null }
/** No prompts, tool arguments, file paths, or answers are read or persisted. */
export function connect(ctx: DshContext, onChange: (o: Observation) => void) {
  const status = sourceOf(ctx.uiSession?.sessionStatus);
  const generation = sourceOf(ctx.connection?.generation);
  let lastGeneration = generation.getSnapshot();
  let fresh = lastGeneration != null;
  let disposed = false;
  const read = (): Observation => {
    try {
      const next = generation.getSnapshot();
      if (next !== lastGeneration) { fresh = false; lastGeneration = next; }
      if (next == null || !fresh) return { connected: false, signals: [], error: null };
      return { connected: true, signals: signalsOf(status.getSnapshot()), error: null };
    } catch (e) { return { connected: false, signals: [], error: String(e) }; }
  };
  const offStatus = status.subscribe(() => {
    // A post-reconnect status publication is required before stale data can earn again.
    lastGeneration = generation.getSnapshot();
    fresh = lastGeneration != null;
    if (!disposed) onChange(read());
  });
  let offGeneration: () => void;
  try { offGeneration = generation.subscribe(() => { if (!disposed) onChange(read()); }); }
  catch (e) { offStatus(); throw e; }
  onChange(read());
  return { read, dispose() { disposed = true; offStatus(); offGeneration(); } };
}
