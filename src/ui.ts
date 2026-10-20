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
:host{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17352f;font-size:13px;line-height:1.5;color-scheme:light}
*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #278671;outline-offset:2px}
.card{width:342px;max-width:calc(100vw - 24px);border:1px solid #cbdfd6;border-radius:22px;background:#f8fcf7;box-shadow:0 18px 65px #10372b24;overflow:hidden}
header{display:flex;gap:10px;align-items:center;padding:15px 18px;background:#e7f3e8;touch-action:none;cursor:grab}
.logo{width:30px;height:30px;border-radius:10px;background:#1c624e;color:white;display:grid;place-items:center;font-weight:800}
.title{flex:1}.title b{display:block;font-size:15px;letter-spacing:.02em}.title small{color:#557568;font-size:10px;letter-spacing:.14em}
button{border:1px solid #c9dfd3;border-radius:9px;padding:6px 10px;background:#fff;color:inherit}.icon{border:0;background:transparent;padding:3px 5px;font-size:18px}
main{padding:16px 19px 18px;max-height:75vh;overflow:auto}.status{font-size:11px;color:#4d7163;margin:0 0 14px}.status::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#4e9873;margin-right:6px}
.label{font-size:11px;color:#547b68}.amount{font-size:42px;letter-spacing:-1.5px;line-height:1.2;font-weight:760;font-variant-numeric:tabular-nums;margin:4px 0 12px}
.gain{background:#e1f0de;border:1px solid #cddfc7;border-radius:13px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:6px}.gain b{font-size:24px;font-variant-numeric:tabular-nums}.gain small{color:#557568;display:block}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin:16px 0}.grid b{display:block;font-size:17px;font-variant-numeric:tabular-nums}.note{font-size:10px;color:#6b7e71;margin:12px 0 0}.warning{font-size:11px;color:#895c1a;background:#fff4d8;padding:8px 10px;border-radius:9px;margin:10px 0;white-space:pre-wrap}
.actions{display:flex;gap:7px;margin-top:15px}.primary{background:#205e4b;color:white;border-color:#205e4b}.stretch{flex:1}
section[hidden],main[hidden],[hidden]{display:none!important}h3{font-size:14px;margin:0 0 10px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:block;font-size:11px;color:#466854}input[type=number],input[type=time]{width:100%;padding:8px;margin-top:4px;border:1px solid #c4d9ca;border-radius:8px;background:white;color:#193c2d}fieldset{border:0;padding:0;margin:10px 0}legend{font-size:11px;margin-bottom:5px}.days{display:flex;gap:8px;flex-wrap:wrap}.days label{display:flex;gap:2px;align-items:center}.error{color:#9c3027;font-size:12px;margin:8px 0}hr{border:0;border-top:1px solid #dce8dc;margin:17px 0}table{width:100%;font-size:11px;border-collapse:collapse}td,th{text-align:right;padding:5px 0;border-bottom:1px solid #e6eee4}td:first-child,th:first-child{text-align:left}.danger{color:#963d30;font-size:11px}.form-title{display:flex;align-items:center;justify-content:space-between}.collapsed{padding:9px 16px;background:#e7f3e8;border-radius:30px}
@media(prefers-color-scheme:dark){:host{color:#dce9dd;color-scheme:dark}.card{background:#1e3028;border-color:#3d5445}.title small,.label,.note,.status,.gain small{color:#adc4b2}header,.collapsed{background:#294533}.gain{background:#304d36;border-color:#496346}button{background:#314436;color:#e0ede0;border-color:#49634e}input[type=number],input[type=time]{background:#243b2c;color:#e0ede0;border-color:#55715e}label{color:#c0d7c7}.warning{background:#554829;color:#ffdfa9}hr,td,th{border-color:#3d5445}.error{color:#ffafa0}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="card">
<header><div class="logo">摸</div><div class="title"><b>自己给自己涨薪</b><small>MOYU METER · DSH</small></div><button class="icon" id="collapse" aria-label="折叠卡片">−</button></header>
<main>
<p class="status" id="state" role="status">准备连接 Agent…</p><div class="warning" id="warning" hidden></div>
<section id="home"><div class="label">今日带薪摸鱼 · 折合工资</div><div class="amount" id="value">¥0.00</div>
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
<fieldset><legend>每周工作日</legend><div class="days">${['日','一','二','三','四','五','六'].map((d,i) => `<label><input type="checkbox" name="weekday" value="${i}">${d}</label>`).join('')}</div></fieldset>
<div class="error" id="error" role="alert"></div><button class="primary" type="submit">保存并开始计量</button>
<p class="note">使用本机时区；首版不含法定节假日表、不支持跨夜班。调整设置会按新口径重算保留的记录。</p></form></section>
<section id="records" hidden><div class="form-title"><h3>最近 7 天</h3><button id="back2">返回</button></div><table><thead><tr><th>日期</th><th>带薪时长</th><th>折合工资</th></tr></thead><tbody id="rows"></tbody></table><div class="actions"><button id="export">导出 JSON</button><button class="danger" id="reset">重置记录与设置</button></div><p class="note">记录留存约 90 天；仅保存时间区间及计薪设置。不读取提示词、工具参数或对话内容。</p></section>
</main></div><button class="collapsed" id="reopen" hidden>摸鱼计量 · 展开</button>`;
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
  // A dedicated handle; buttons and form inputs never start a drag.
  const header = shadow.querySelector('header')!;
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  header.onpointerdown = e => {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = host.getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    header.setPointerCapture(e.pointerId);
  };
  const clamp = (left: number, top: number) => {
    host.style.right = 'auto'; host.style.bottom = 'auto';
    host.style.left = `${Math.max(8, Math.min(innerWidth - host.offsetWidth - 8, left))}px`;
    host.style.top = `${Math.max(8, Math.min(innerHeight - host.offsetHeight - 8, top))}px`;
  };
  header.onpointermove = e => { if (drag) clamp(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y); };
  header.onpointerup = header.onpointercancel = () => { drag = null; };
  const resized = () => { if (host.style.left) { const r = host.getBoundingClientRect(); clamp(r.left, r.top); } };
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
      get('reopen').textContent = `摸鱼 ${money(v.value)} · 展开`;
    },
    dispose() { window.removeEventListener('resize', resized); host.remove(); },
  };
}
