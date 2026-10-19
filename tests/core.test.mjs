import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DEFAULTS, merge, seconds, intersect, settingsOf, windowsFor, workdays, metrics, dayKey, dayAt } = require('../.build/core.js');
const { Tracker } = require('../.build/tracker.js');
const { decode, encode, empty } = require('../.build/storage.js');
const { signalsOf, connect } = require('../.build/adapter.js');
const settings = { ...DEFAULTS, weekdays: [...DEFAULTS.weekdays] };
const monday = new Date(2026, 9, 19);
const time = (h, m = 0, day = 19) => new Date(2026, 9, day, h, m).getTime();
const signal = (id = 'a', status = 'running') => ({ id, status });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function source(value) { return { value, callbacks: new Set(), getSnapshot(){return this.value;},
  subscribe(fn){this.callbacks.add(fn);return ()=>this.callbacks.delete(fn);},
  set(v){this.value=v;for(const fn of [...this.callbacks])fn();} }; }

test('threshold: 4.999s and exactly 5s both count zero', () => {
  const t = new Tracker(); t.observe([signal()], 1000);
  t.observe([signal()], 5999); assert.equal(t.totalSeconds, 0);
  t.observe([signal()], 6000); assert.equal(t.totalSeconds, 0);
  t.observe([signal()], 7000); assert.equal(t.totalSeconds, 1);
});
test('65-second continuous run counts 60 seconds; heartbeats do not reset threshold', () => {
  const t = new Tracker();
  for(let at=0;at<=64000;at+=1000)t.observe([signal()],at);
  t.observe([signal('a','idle')],65000); assert.equal(t.totalSeconds,60);
  t.observe([],70000); assert.equal(t.totalSeconds,60);
});
test('short run is discarded', () => {
  const t = new Tracker();t.observe([signal()],0);t.observe([],4999);assert.equal(t.totalSeconds,0);
});
test('waiting pauses; resumed execution receives a new threshold', () => {
  const t = new Tracker();t.observe([signal()],0);t.observe([signal('a','waiting')],8000);
  t.observe([signal()],20000);t.observe([],30000);assert.equal(t.totalSeconds,8);
});
test('two parallel sessions count their union, not their sum', () => {
  const t=new Tracker(0);t.observe([signal()],0);t.observe([signal(),signal('b')],5000);
  t.observe([signal('b')],10000);t.observe([],15000);assert.equal(t.totalSeconds,15);
});
test('parallel eligibility belongs to each continuous session', () => {
  const t=new Tracker();t.observe([signal()],0);t.observe([signal(),signal('b')],3000);
  t.observe([signal('b')],7000);t.observe([],10000);assert.equal(t.totalSeconds,4);
});
test('duplicate timestamps are idempotent', () => {
  const t=new Tracker();t.observe([signal()],0);t.observe([signal()],8000);t.observe([signal()],8000);
  assert.equal(t.totalSeconds,3);
});
test('long sleep drops the unobserved gap and starts a new threshold', () => {
  const t=new Tracker();t.observe([signal()],0);t.observe([signal()],10000);t.observe([signal()],100000);
  assert.equal(t.totalSeconds,5);t.observe([],110000);assert.equal(t.totalSeconds,10);
});
test('disconnect never backfills a future timestamp', () => {
  const t=new Tracker();t.observe([signal()],0);t.observe([signal()],9000);t.disconnect();
  t.observe([signal()],50000);t.observe([],60000);assert.equal(t.totalSeconds,9);
});
test('clock rollback holds until prior wall-clock time is reached', () => {
  const t=new Tracker();t.observe([signal()],10000);t.observe([signal()],20000);
  t.observe([signal()],15000);t.observe([signal()],19000);assert.equal(t.totalSeconds,5);
  t.observe([signal()],20000);t.observe([],30000);assert.equal(t.totalSeconds,10);
});
test('restore contains only confirmed intervals, not a live session', () => {
  const t=new Tracker();t.restore([{start:5000,end:10000}]);assert.equal(t.activeCount,0);
  const a=t.snapshot();a[0].end=900000;assert.equal(t.totalSeconds,5);
});
test('invalid timing configuration is rejected', () => {
  assert.throws(()=>new Tracker(-1));assert.throws(()=>new Tracker(0,NaN));
});
test('invalid observation timestamps cannot mutate state', () => {
  const t=new Tracker();t.observe([signal()],NaN);t.observe([signal()],-1);assert.equal(t.activeCount,0);
});
test('interval union drops invalid segments and does not mutate caller data', () => {
  const a=[{start:5,end:15},{start:0,end:10},{start:15,end:20},{start:9,end:8}];
  assert.deepEqual(merge(a),[{start:0,end:20}]);assert.equal(a[0].start,5);
});
test('intersection excludes lunch and double overlaps', () => {
  assert.equal(seconds(intersect([{start:0,end:100}], [{start:10,end:20},{start:15,end:25}])),0.015);
});
test('8000/20/8 equals 50, two paid hours yield 100 and 33.33% uplift', () => {
  const m=metrics(monday,settings,[{start:time(9),end:time(11)}],time(18));
  assert.equal(m.baseRate,50);assert.equal(m.value,100);near(m.effectiveRate,400/6);near(m.increase,100/3);
});
test('cross-lunch interval counts 30 minutes, not 90', () => {
  const m=metrics(monday,settings,[{start:time(11,45),end:time(13,15)}],time(18));
  assert.equal(m.rawSeconds,5400);assert.equal(m.paidSeconds,1800);assert.equal(m.value,25);
});
test('after-hours are visible as raw time, but do not earn', () => {
  const m=metrics(monday,settings,[{start:time(19),end:time(20)}],time(21));
  assert.equal(m.rawSeconds,3600);assert.equal(m.paidSeconds,0);
});
test('weekend produces zero paid value', () => {
  const saturday=new Date(2026,9,17);assert.deepEqual(windowsFor(saturday,settings),[]);
});
test('future interval ends are cropped to now', () => {
  const m=metrics(monday,settings,[{start:time(9),end:time(11)}],time(10));assert.equal(m.paidSeconds,3600);
});
test('cross-day records are split in the local timezone', () => {
  const m=metrics(monday,settings,[{start:time(17),end:time(10,0,20)}],time(18,0,20));
  assert.equal(m.paidSeconds,3600);assert.equal(m.rawSeconds,7*3600);
});
test('full-day cap is JSON-safe, with null instead of Infinity', () => {
  const m=metrics(monday,settings,[{start:time(0),end:time(23)}],time(23));
  assert.equal(m.paidSeconds,28800);assert.equal(m.value,400);assert.equal(m.effectiveRate,null);assert.equal(m.increase,null);
  assert.equal(JSON.parse(JSON.stringify(m)).atLimit,true);
});
test('automatic workday counting uses configured weekdays', () => {
  assert.equal(workdays(monday,{...settings,monthDays:0}),22);
  assert.equal(workdays(monday,{...settings,monthDays:20}),20);
});
test('local date keys and next-day construction', () => {
  assert.equal(dayKey(monday),'2026-10-19');assert.equal(dayKey(dayAt(monday,1)),'2026-10-20');
});
for(const patch of [{monthlySalary:0},{monthlySalary:NaN},{monthDays:32},{monthDays:2.5},{start:'25:00'},{end:'08:00'},{lunchEnd:'19:00'},{weekdays:[]}]) {
  test(`invalid settings are rejected: ${JSON.stringify(patch)}`,()=>assert.throws(()=>settingsOf({...settings,...patch})));
}
test('storage validates schema and rejects damaged records rather than erasing', () => {
  assert.equal(decode(null).configured,false);
  assert.throws(()=>decode('{broken'));assert.throws(()=>decode('{"schema":2}'));
  assert.throws(()=>decode(JSON.stringify({...empty(),intervals:[{start:10,end:0}]})));
});
test('storage round-trip retains confirmed time and settings', () => {
  const x={...empty(),configured:true,intervals:[{start:5000,end:10000}]};
  const y=decode(encode(x,20000));assert.equal(y.configured,true);assert.deepEqual(y.intervals,x.intervals);
});
test('storage clips old history and future ends', () => {
  const now=100*86400000;const x={...empty(),intervals:[{start:0,end:now+1000}]};
  assert.deepEqual(decode(encode(x,now)).intervals,[{start:10*86400000,end:now}]);
});
test('adapter gives pending interaction precedence over running', () => {
  assert.deepEqual(signalsOf(new Map([['a',{running:true,pendingInteraction:{kind:'approval'}}]])),[signal('a','waiting')]);
});
test('adapter accepts ordinary running, idle, and unknown facts', () => {
  assert.deepEqual(signalsOf(new Map([['a',{running:true}],['b',{running:false}],['c',{}]])),[signal(),signal('b','idle'),signal('c','unknown')]);
});
test('adapter rejects invalid snapshots and absent APIs', () => {
  assert.throws(()=>signalsOf({byId:{}}));assert.throws(()=>signalsOf(new Map([['a',null]])));
  assert.throws(()=>connect({},()=>{}));
});
test('reconnect must receive a fresh status publication, and cleanup removes subscriptions', () => {
  const s=source(new Map([['a',{running:true}]])),g=source({id:'one'});let last;
  const adapter=connect({uiSession:{sessionStatus:s},connection:{generation:g}},o=>{last=o;});
  assert.equal(last.connected,true);g.set(undefined);assert.equal(last.connected,false);
  g.set({id:'two'});assert.equal(adapter.read().connected,false);
  s.set(new Map([['a',{running:false}]]));assert.equal(last.connected,true);assert.equal(last.signals[0].status,'idle');
  adapter.dispose();assert.equal(s.callbacks.size,0);assert.equal(g.callbacks.size,0);
});
test('malformed data yields a disconnected observation rather than guessed earnings', () => {
  const s=source(new Map()),g=source({});let last;
  const a=connect({uiSession:{sessionStatus:s},connection:{generation:g}},o=>{last=o;});
  s.set({bad:true});assert.equal(last.connected,false);assert.ok(last.error);a.dispose();
});
test('deterministic random interval union agrees with a discrete oracle', () => {
  let seed=42;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};
  for(let n=0;n<100;n++) {
    const list=Array.from({length:20},()=>{const start=rand()%100;return {start,end:start+rand()%30};});
    const occupied=new Set();for(const i of list)for(let x=i.start;x<i.end;x++)occupied.add(x);
    near(seconds(list),occupied.size/1000);
  }
});
