import { plannedHours, type Settings } from './core.js';
export interface ViewState {
  state: string; warning: string; configured: boolean; paused: boolean; active: number;
  raw: number; paid: number; value: number; base: number; effective: number | null; increase: number | null;
  history: { date: string; seconds: number; value: number }[];
}
export const duration = (n: number) => {
  const s = Math.max(0, Math.floor(n));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const money = (n: number) => `¥${n.toFixed(2)}`;
export function mountView(settings: Settings, actions: {
  save(s: Settings): void; pause(): void; export(): void; reset(): void;
}) {
  const host = document.createElement('aside');
  host.id = 'dsh-mo-widget';
  host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:1000;max-width:calc(100vw - 24px)';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
:host{font-family:ui-monospace,Consolas,"Noto Sans SC",sans-serif;color:#082d78;font-size:13px;line-height:1.45}
*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;color:inherit}
.card{width:520px;max-width:calc(100vw - 18px);padding:10px;border:4px solid #082d78;border-radius:16px;background:#d8f3ff;box-shadow:0 0 0 4px #8db9f6,0 9px 0 #5d83cf,0 18px 32px #082d7833}
header{display:flex;align-items:center;gap:9px;padding:5px 8px 10px;user-select:none}
.grip{width:30px;height:30px;display:grid;grid-template-columns:repeat(3,5px);grid-template-rows:repeat(3,5px);gap:3px;align-content:center;justify-content:center;background:#e8f8ff;border:2px solid #082d78;box-shadow:3px 3px 0 #6da2eb;border-radius:4px;cursor:grab;touch-action:none;flex:none}
.grip i{width:5px;height:5px;background:#1767df;border-radius:1px}.brand{flex:1;font-weight:1000;font-size:18px;letter-spacing:2px}
header button,button:not(.primary){border:2px solid #082d78;background:#f5fcff;box-shadow:2px 3px 0 #789fe0;border-radius:5px;padding:5px 9px;font-weight:900;color:#082d78}
.scene{height:175px;position:relative;overflow:hidden;border:3px solid #082d78;border-radius:10px;background:linear-gradient(#57c7ff 0%,#a9ecff 63%,#eafcff 64%,#58c9f3 65%,#1673d9 100%);margin-bottom:12px}
.scene:after{content:"";position:absolute;bottom:0;left:0;right:0;height:30px;background:repeating-linear-gradient(0deg,#1675db 0 8px,#42b9f5 8px 15px,#dffaff 15px 20px)}
.mascot{position:absolute;width:245px;height:168px;left:50%;bottom:4px;transform:translateX(-50%);z-index:1;filter:drop-shadow(3px 4px 0 #0a3b91)}
.bubble{position:absolute;right:14px;top:14px;padding:7px 10px;background:#fff7d4;border:3px solid #082d78;border-radius:7px;font-weight:1000;font-size:16px;z-index:2;box-shadow:3px 3px 0 #e8b82d}
.label{font-size:11px;color:#2755a0;font-weight:900}.amount{font-size:36px;line-height:1.15;font-weight:1000;color:#082d78;margin:4px 0 10px}
.gain{background:#e1fff4;border:3px solid #1767c9;border-radius:7px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:6px;box-shadow:inset 0 -5px 0 #c7f1e4,3px 4px 0 #8ab4ed}.gain b{font-size:22px}.gain small{color:#2755a0;display:block}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.grid>div{background:#f7fdff;border:3px solid #1767c9;border-radius:7px;box-shadow:inset 0 -5px 0 #d1edff,3px 4px 0 #8ab4ed;padding:9px}.grid b{display:block;font-size:17px;color:#082d78}
.note{text-align:center;color:#2755a0;font-size:10px;font-weight:800;margin:10px 0 2px}.warning{font-size:11px;color:#7e3a13;background:#fff1c7;padding:7px 9px;border:2px solid #d49b25;margin:7px 0;white-space:pre-wrap}
.actions{display:flex;gap:8px;margin-top:14px}.primary{background:linear-gradient(#ffec7a,#ffc82d);color:#082d78;border:3px solid #082d78;border-radius:8px;padding:10px 18px;font-weight:1000;font-size:18px;box-shadow:0 5px 0 #9b6e17}.stretch{flex:1}
section[hidden],[hidden]{display:none!important}h3{font-size:14px;margin:0 0 10px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:block;font-size:11px;color:#2755a0;font-weight:800}
input[type=number],input[type=time]{width:100%;padding:8px;margin-top:4px;border:2px solid #7299d5;border-radius:4px;background:white;color:#092d79}
fieldset{border:0;padding:0;margin:10px 0}legend{font-size:11px;margin-bottom:5px}.days{display:flex;gap:8px;flex-wrap:wrap}.days label{display:flex;gap:2px;align-items:center}.error{color:#9c3027;font-size:12px;margin:8px 0}
.form-title{display:flex;align-items:center;justify-content:space-between}table{width:100%;font-size:11px;border-collapse:collapse}td,th{text-align:right;padding:5px;border-bottom:1px solid #9ab8e9}td:first-child,th:first-child{text-align:left}.danger{color:#a22}
.collapsed{display:flex;align-items:center;gap:9px;min-height:54px;padding:7px 13px 7px 8px;background:linear-gradient(#fff,#e0f7ff);border:3px solid #082d78;border-radius:8px;box-shadow:0 4px 0 #6d9be1,0 8px 18px #092d7933;font-weight:1000;touch-action:none}
.collapsed .grip{width:32px;height:32px}.collapsed strong{font-size:16px}
@media(max-width:540px){.card{width:calc(100vw - 18px);padding:7px}.scene{height:150px}.mascot{width:210px;height:145px}.amount{font-size:30px}}
@media(prefers-color-scheme:dark){.card{filter:brightness(.92) saturate(1.08)}}
</style>
<div class="card">
<header><span class="grip" id="drag-expanded" title="拖动窗口"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><div class="brand">🐋 DSH · 摸鱼助手</div><button id="collapse" aria-label="折叠卡片">−</button><button id="close" aria-label="折叠卡片">×</button></header>
<main>
<p class="status" id="state" role="status">准备连接 Agent…</p><div class="warning" id="warning" hidden></div>
<section id="home"><div class="scene"><span class="bubble">摸鱼助手</span><svg class="mascot" viewBox="0 0 320 220" aria-label="蓝发鲸鱼少女像素角色"><g stroke="#092d79" stroke-width="8" stroke-linejoin="round"><path fill="#607ac0" d="M42 150 12 125 25 94 65 109 90 145 240 145 270 102 304 118 290 153 255 182 80 184Z"/><path fill="#1d55c6" d="M60 170 58 104 90 52 145 28 204 44 250 94 247 160 210 190 94 190Z"/><path fill="#f6f5ff" d="M62 82 66 47 104 19 133 29 155 8 184 25 211 15 246 54 250 82 220 70 191 49 143 49 100 70Z"/><path fill="#f4d5d0" d="M102 112 124 88 178 83 211 109 218 143 192 170 132 171 100 148Z"/><path fill="#50c8f3" d="M80 116 64 151 83 172 105 146Z"/><path fill="#50c8f3" d="M218 112 247 138 233 171 210 151Z"/><path fill="#082d79" d="M119 119 133 109 147 118 145 135 128 139Z"/><path fill="#082d79" d="M174 119 188 109 202 119 200 136 183 139Z"/><path fill="#fff" stroke="none" d="M126 118h8v8h-8zM182 118h8v8h-8z"/><path fill="#ed8c91" stroke="none" d="M149 147h25v10h-25z"/><path fill="#f8fbff" d="M108 173 87 185 95 209 130 211 155 197 181 210 216 199 220 180 196 168 165 184 137 180Z"/></g></svg></div><div class="label">今日带薪摸鱼 · 折合工资</div><div class="amount" id="value">¥0.00</div>
<div class="gain"><div><small>今日折算有效时薪</small><b id="effective">¥50.00</b><small id="base">基础时薪 ¥50.00/h</small></div><b id="increase">+0.00%</b></div>
<div class="grid"><div><span class="label">带薪摸鱼时间</span><b id="paid">00:00:00</b></div><div><span class="label">含非工作时段</span><b id="raw">00:00:00</b></div></div>
<div class="actions"><button class="primary stretch" id="pause">暂停计量</button><button id="settings">设置</button><button id="history">记录</button></div>
<p class="note">连续自主运行 5 秒后计量 · 并发时间只算一次。<br>这里是时间折算，不代表公司实际加薪。</p></section>
<section id="config" hidden><div class="form-title"><h3>薪资与工作时间</h3><button id="back">返回</button></div>
<form id="form"><div class="form-grid">
<label>月薪（人民币）<input name="monthlySalary" type="number" min="0.01" max="1000000000" step="0.01" required></label>
<label>月工作日（0 = 自动）<input name="monthDays" type="number" min="0" max="31" step="1" required></label>
<label>上班<input name="start" type="time" required></label><label>下班<input name="end" type="time" required></label>
<label>午休开始<input name="lunchStart" type="time" required></label><label>午休结束<input name="lunchEnd" type="time" required></label>
</div><fieldset><label><input name="lunch" type="checkbox"> 扣除午休</label></fieldset>
<fieldset><legend>每周工作日</legend><div class="days">${['日', '一', '二', '三', '四', '五', '六'].map((d, i) => `<label><input type="checkbox" name="weekday" value="${i}">${d}</label>`).join('')}</div></fieldset>
<div class="error" id="error" role="alert"></div><button class="primary" type="submit">保存并开始计量</button>
<p class="note">使用本机时区；首版不含法定节假日表、不支持跨夜班。调整设置会按新口径重算保留的记录。</p></form></section>
<section id="records" hidden><div class="form-title"><h3>最近 7 天</h3><button id="back2">返回</button></div><table><thead><tr><th>日期</th><th>带薪时长</th><th>折合工资</th></tr></thead><tbody id="rows"></tbody></table><div class="actions"><button id="export">导出 JSON</button><button class="danger" id="reset">重置记录与设置</button></div><p class="note">记录留存约 90 天；仅保存时间区间及计薪设置。不读取提示词、工具参数或对话内容。</p></section>
</main></div><button class="collapsed" id="reopen" hidden><span class="grip" id="drag-collapsed" title="拖动小窗"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><strong id="mini-value">摸鱼 ¥0.00</strong> · 展开</button>`;
  document.body.append(host);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => shadow.getElementById(id) as T;
  const form = get<HTMLFormElement>('form');
  const fill = (s: Settings) => {
    for (const key of ['monthlySalary', 'monthDays', 'start', 'end', 'lunchStart', 'lunchEnd'] as const)
      (form.elements.namedItem(key) as HTMLInputElement).value = String(s[key]);
    (form.elements.namedItem('lunch') as HTMLInputElement).checked = s.lunch;
    shadow.querySelectorAll<HTMLInputElement>('[name=weekday]').forEach(e => { e.checked = s.weekdays.includes(Number(e.value)); });
  };
  fill(settings);
  const page = (id: string) => ['home', 'config', 'records'].forEach(p => { get(p).hidden = p !== id; });
  get('settings').onclick = () => { page('config'); };
  get('history').onclick = () => { page('records'); };
  get('back').onclick = get('back2').onclick = () => page('home');
  get('pause').onclick = actions.pause;
  get('export').onclick = actions.export;
  get('reset').onclick = actions.reset;
  const card = shadow.querySelector<HTMLElement>('.card')!;
  get('collapse').onclick = () => { card.hidden = true; get('reopen').hidden = false; };
  get('reopen').onclick = () => { card.hidden = false; get('reopen').hidden = true; };
  get('drag-collapsed').addEventListener('click', e => e.stopPropagation());
  form.onsubmit = event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      actions.save({ monthlySalary: Number(data.get('monthlySalary')), monthDays: Number(data.get('monthDays')),
        start: String(data.get('start')), end: String(data.get('end')), lunchStart: String(data.get('lunchStart')),
        lunchEnd: String(data.get('lunchEnd')), lunch: data.get('lunch') !== null,
        weekdays: data.getAll('weekday').map(Number) });
      get('error').textContent = ''; page('home');
    } catch (e) { get('error').textContent = e instanceof Error ? e.message : String(e); }
  };
  // Both the expanded grip and the collapsed grip are draggable.
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  const clamp = (left: number, top: number) => {
    host.style.right = 'auto'; host.style.bottom = 'auto';
    host.style.left = Math.max(8, Math.min(innerWidth - host.offsetWidth - 8, left)) + 'px';
    host.style.top = Math.max(8, Math.min(innerHeight - host.offsetHeight - 8, top)) + 'px';
  };
  for (const handle of [get('drag-expanded'), get('drag-collapsed')]) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if (drag) clamp(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
    });
    const stop = () => { drag = null; };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }
  get('close').onclick = () => { card.hidden = true; get('reopen').hidden = false; };
  const resized = () => {
    if (host.style.left) {
      const r = host.getBoundingClientRect();
      clamp(r.left, r.top);
    }
  };
  window.addEventListener('resize', resized);
  return {
    setSettings: fill,
    showSettings: () => page('config'),
    render(v: ViewState) {
      get('state').textContent = v.state;
      get('warning').textContent = v.warning; get('warning').hidden = !v.warning;
      get('value').textContent = money(v.value);
      get('effective').textContent = v.effective === null ? '已达工时上限' : money(v.effective);
      get('base').textContent = `基础时薪 ${money(v.base)}/h`;
      get('increase').textContent = v.increase === null ? '—' : `+${v.increase.toFixed(2)}%`;
      get('paid').textContent = duration(v.paid); get('raw').textContent = duration(v.raw);
      get('pause').textContent = v.paused ? '恢复计量' : '暂停计量';
      const rows = get('rows'); rows.replaceChildren();
      for (const row of v.history) {
        const tr = document.createElement('tr');
        for (const text of [row.date, duration(row.seconds), money(row.value)]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
        rows.append(tr);
      }
      get('mini-value').textContent = `摸鱼 ${money(v.value)}`;
    },
    dispose() { window.removeEventListener('resize', resized); host.remove(); },
  };
}
