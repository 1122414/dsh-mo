/* DSH contract fixture, not a substitute for live-host integration testing. */
(() => {
  const source = value => ({ value, listeners: new Set(), getSnapshot(){return this.value;},
    subscribe(fn){this.listeners.add(fn);return () => this.listeners.delete(fn);},
    set(v){this.value=v;for(const fn of [...this.listeners])fn();} });
  const status = source(new Map()), generation = source({ id:'demo-1' });
  const cleanups=[];
  const ctx = { uiSession:{sessionStatus:status},connection:{generation},effect(fn){const off=fn();cleanups.push(off);return off;} };
  const update = () => { document.getElementById('console').textContent = JSON.stringify({connected:!!generation.value,sessions:[...status.value]},null,2); };
  const act = name => {
    if(name==='offline')generation.set(undefined);
    else if(name==='online'){generation.set({id:String(Date.now())});status.set(new Map(status.value));}
    else {const [id,kind]=name.split('-');const next=new Map(status.value);next.set(id,{running:kind!=='idle',pendingInteraction:kind==='wait'?{kind:'approval',sessionId:id,key:'demo-wait'}:undefined});status.set(next);}
    update();
  };
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));
  window.__ModuleLoader__={load({factory}){factory().apply(ctx);}};
  window.__moyuDemo={act,dispose(){for(const off of cleanups)off();},status,generation};
  update();
})();
