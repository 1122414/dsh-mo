import { dayAt, dayKey, metrics, settingsOf, type Settings } from './core.js';
import { connect, type DshContext, type Observation } from './adapter.js';
import { Tracker } from './tracker.js';
import { decode, empty, encode, STORE_KEY, type Saved } from './storage.js';
import { mountView } from './ui.js';

export function startApp(ctx: DshContext): () => void {
  const tracker = new Tracker();
  let saved: Saved = empty(), storageError = '', blocked = false;
  let leader = false, paused = false, disposed = false;
  let observation: Observation = { connected: false, signals: [], error: null };
  let adapter: ReturnType<typeof connect> | undefined;
  let release: (() => void) | undefined;
  let request: AbortController | undefined;
  let lastSave = 0;
  const load = () => {
    try { saved = decode(localStorage.getItem(STORE_KEY)); storageError = ''; blocked = false; }
    catch (e) { storageError = String(e); blocked = true; }
    tracker.restore(saved.intervals);
  };
  load();
  const persist = () => {
    if (!leader || blocked) return;
    saved.intervals = tracker.snapshot();
    try {
      const raw = encode(saved, Date.now());
      localStorage.setItem(STORE_KEY, raw);
      saved.savedAt = Date.now(); lastSave = saved.savedAt;
      storageError = '';
    } catch (e) { storageError = `无法保存，当前记录仅在内存中：${String(e)}`; }
  };
  const accept = (next: Observation) => {
    observation = next;
    if (!leader || paused || blocked || !saved.configured || !next.connected) tracker.disconnect();
    else tracker.observe(next.signals, Date.now());
  };
  const view = mountView(saved.settings, {
    save(value: Settings) {
      if (!leader) throw new Error('另一个标签页正在计量，或浏览器不支持安全的单写锁');
      if (blocked) throw new Error('本地数据不可读，请先导出原始数据再重置');
      const next = settingsOf(value);
      saved.settings = next; saved.configured = true;
      tracker.disconnect(); persist();
      if (adapter) accept(adapter.read());
      render();
    },
    pause() {
      if (!leader) { storageError = '请在主计量标签页暂停或恢复'; render(); return; }
      paused = !paused; tracker.disconnect(); persist();
      if (adapter) accept(adapter.read());
      render();
    },
    export() {
      let content: string;
      try { content = blocked ? localStorage.getItem(STORE_KEY) ?? '{}' : encode({ ...saved, intervals: tracker.snapshot() }, Date.now()); }
      catch { content = JSON.stringify(saved); }
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `dsh-mo-${dayKey(new Date())}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    reset() {
      if (!leader) { storageError = '请在主计量标签页重置'; render(); return; }
      if (!confirm('重置本浏览器的摸鱼记录与计薪设置？此操作不可恢复，请先导出。')) return;
      try {
        localStorage.removeItem(STORE_KEY); saved = empty(); tracker.restore([]);
        blocked = false; storageError = ''; view.setSettings(saved.settings); view.showSettings();
      } catch (e) { storageError = String(e); }
      render();
    },
  });
  function render(): void {
    const now = Date.now(), today = new Date(now);
    const all = tracker.snapshot(), m = metrics(today, saved.settings, all, now);
    const state = !leader ? '只读待机 · 等待本浏览器计量权'
      : blocked ? '存储异常 · 已停止计量'
      : !saved.configured ? '先设置薪资与班次 · 尚未计量'
      : paused ? '你已暂停计量 · Agent 不受影响'
      : !observation.connected ? '等待可靠状态 · 断线与未知时间不补算'
      : tracker.pendingCount && tracker.activeCount === tracker.pendingCount ? 'Agent 已开工 · 5 秒准备期'
      : tracker.activeCount ? `Agent 正在替你打工 · ${tracker.activeCount} 个会话`
      : observation.signals.some(s => s.status === 'waiting') ? 'Agent 正在等你 · 暂停计量' : 'Agent 空闲 · 等待下一轮';
    const history = Array.from({ length: 7 }, (_, i) => {
      const date = dayAt(today, -i), v = metrics(date, saved.settings, all, now);
      return { date: dayKey(date), seconds: v.paidSeconds, value: v.value };
    });
    view.render({ state, warning: [storageError, observation.error].filter(Boolean).join('\n'),
      configured: saved.configured, paused, active: tracker.activeCount,
      raw: m.rawSeconds, paid: m.paidSeconds, value: m.value,
      base: m.baseRate, effective: m.effectiveRate, increase: m.increase, history });
  }
  const stopLeader = () => {
    adapter?.dispose(); adapter = undefined;
    tracker.disconnect(); persist(); leader = false;
    release?.(); release = undefined;
    request?.abort(); request = undefined;
  };
  const acquire = () => {
    if (disposed || request) return;
    if (!navigator.locks) { storageError = '缺少 Web Locks；为防多页重复计薪，当前只读。请使用 localhost 或 HTTPS 上的新版浏览器。'; render(); return; }
    request = new AbortController();
    void navigator.locks.request(`${STORE_KEY}:writer`, { signal: request.signal }, async () => {
      if (disposed) return;
      const held = new Promise<void>(resolve => { release = resolve; });
      leader = true; load(); view.setSettings(saved.settings);
      try {
        adapter = connect(ctx, next => { accept(next); persist(); render(); });
      } catch (e) { observation = { connected: false, signals: [], error: String(e) }; }
      render();
      await held;
    }).catch(e => { if (!disposed && (e as Error).name !== 'AbortError') { storageError = String(e); render(); } });
  };
  const tick = () => {
    if (disposed) return;
    if (leader && adapter) accept(adapter.read());
    if (leader && Date.now() - lastSave >= 5000) persist();
    render();
  };
  const onStorage = (e: StorageEvent) => { if (!leader && (e.key === STORE_KEY || e.key === null)) { load(); view.setSettings(saved.settings); render(); } };
  const onHide = () => { stopLeader(); };
  const onShow = () => { acquire(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  const timer = setInterval(tick, 1000);
  acquire(); render();
  return () => {
    if (disposed) return;
    disposed = true; clearInterval(timer); stopLeader();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
    view.dispose();
  };
}
