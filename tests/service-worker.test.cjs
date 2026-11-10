const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ORIGIN='https://www.bakerhub.app';
const source=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');

// A small stand-in for the worker's world: Cache Storage, fetch and events.
function world({online=true,redirectRoot=false}={}) {
  const stores=new Map();
  const key=r=>typeof r==='string'?new URL(r,ORIGIN).href:r.url;
  const open=async name=>{
    if(!stores.has(name)) stores.set(name,new Map());
    const store=stores.get(name);
    return {
      match:async r=>store.get(key(r)),
      put:async(r,response)=>{store.set(key(r),response);},
      keys:async()=>[...store.keys()].map(url=>({url})),
      delete:async r=>store.delete(key(r)),
    };
  };
  const fetched=[];
  const response=(url,extra={})=>({ok:true,status:200,type:'basic',redirected:false,url,body:'net:'+url,clone(){return this;},...extra});
  const listeners={};
  const context={
    URL, Promise, setTimeout, clearTimeout, Array, Math, Boolean,
    Request:function(url,init){return {url,method:(init&&init.method)||'GET',mode:'cors',headers:new Map()};},
    Response:{redirect:(to,status)=>({redirectTo:to,status})},
    caches:{open,keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},
    fetch:async request=>{
      const url=key(request); fetched.push(url);
      if(!online) throw new TypeError('offline');
      if(redirectRoot && url===ORIGIN+'/') return response(ORIGIN+'/fr',{redirected:true});
      return response(url);
    },
  };
  context.self={location:{origin:ORIGIN},addEventListener:(name,fn)=>{listeners[name]=fn;},
    skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(source,context);
  const request=(url,{method='GET',mode='cors',headers={}}={})=>({url:new URL(url,ORIGIN).href,method,mode,headers:new Map(Object.entries(headers))});
  const dispatch=async(name,event={})=>{
    const waits=[]; let answer;
    listeners[name]({...event,waitUntil:p=>waits.push(p),respondWith:p=>{answer=p;}});
    const result=answer===undefined?undefined:await answer;
    await Promise.all(waits);
    return {handled:answer!==undefined,result};
  };
  return {stores,fetched,request,dispatch,open,setOnline:v=>{online=v;},context};
}

test('server routes, sign-in, Supabase and writes are never intercepted',async()=>{
  const w=world();
  const untouched=[
    w.request('/api/flour-scan',{method:'POST'}),
    w.request('/api/flour-scan'),
    w.request('/api/maestro?x=1'),
    w.request('/auth/callback?code=abc',{mode:'navigate'}),
    w.request('/auth/callback'),
    w.request('https://mguwsdonfsyioyelseuf.supabase.co/rest/v1/bake_events'),
    w.request('https://mguwsdonfsyioyelseuf.supabase.co/storage/v1/object/public/photos/a.webp'),
    w.request('/logo.png',{method:'POST'}),
    w.request('/',{method:'POST',mode:'navigate'}),
    w.request('/fr?_rsc=abc'),                 // server-component payload, not a navigation
    w.request('/about',{mode:'navigate'}),     // only the two shells are kept
    w.request('/_next/data/x.json'),
    w.request('/api/images/photo.png'),        // an image extension does not override /api
  ];
  for(const r of untouched) {
    const {handled}=await w.dispatch('fetch',{request:r});
    assert.equal(handled,false,r.method+' '+r.url);
  }
  assert.equal(w.fetched.length,0);
  assert.equal([...w.stores.values()].reduce((n,s)=>n+s.size,0),0);
});

test('the shell is network first and falls back to the saved copy offline',async()=>{
  const w=world();
  const first=await w.dispatch('fetch',{request:w.request('/fr',{mode:'navigate'})});
  assert.equal(first.result.body,'net:'+ORIGIN+'/fr');
  const second=await w.dispatch('fetch',{request:w.request('/fr',{mode:'navigate'})});
  assert.equal(second.result.body,'net:'+ORIGIN+'/fr');
  assert.equal(w.fetched.length,2,'network is asked every time while online');
  w.setOnline(false);
  const offline=await w.dispatch('fetch',{request:w.request('/fr?make=pizza',{mode:'navigate'})});
  assert.equal(offline.result.body,'net:'+ORIGIN+'/fr');
  // "/" was never stored (it redirects for a French baker): go to the saved shell.
  const root=await w.dispatch('fetch',{request:w.request('/',{mode:'navigate'})});
  assert.equal(root.result.redirectTo,'/fr');
});

test('offline with nothing saved fails like a normal request',async()=>{
  const w=world({online:false});
  await assert.rejects(w.dispatch('fetch',{request:w.request('/',{mode:'navigate'})}),/offline/);
});

test('redirected shells and query-string shells are not stored',async()=>{
  const w=world({redirectRoot:true});
  await w.dispatch('fetch',{request:w.request('/',{mode:'navigate'})});
  await w.dispatch('fetch',{request:w.request('/fr?code=abc',{mode:'navigate'})});
  assert.equal([...w.stores.values()].reduce((n,s)=>n+s.size,0),0);
});

test('build files are cache first; fonts and images are served from cache and refreshed',async()=>{
  const w=world();
  const chunk=()=>w.request('/_next/static/chunks/app.js');
  await w.dispatch('fetch',{request:chunk()});
  await w.dispatch('fetch',{request:chunk()});
  assert.equal(w.fetched.filter(u=>u.endsWith('app.js')).length,1);
  const image=()=>w.request('/images/approved/bread/levain.webp');
  await w.dispatch('fetch',{request:image()});
  const again=await w.dispatch('fetch',{request:image()});
  assert.equal(again.handled,true);
  assert.equal(w.fetched.filter(u=>u.endsWith('levain.webp')).length,2);
  w.setOnline(false);
  const offline=await w.dispatch('fetch',{request:image()});
  assert.match(offline.result.body,/levain\.webp/);
});

test('activation removes caches from earlier versions only',async()=>{
  const w=world();
  await w.open('bh-shell-v0'); await w.open('bh-static-v0'); await w.open('someone-else');
  await w.dispatch('fetch',{request:w.request('/_next/static/chunks/app.js')});
  await w.dispatch('activate');
  const names=[...w.stores.keys()].sort();
  assert.ok(!names.includes('bh-shell-v0') && !names.includes('bh-static-v0'));
  assert.ok(names.includes('someone-else'));
  assert.ok(names.some(n=>/^bh-static-v\d+$/.test(n)));
});

test('warming keeps the same exclusions as live requests',async()=>{
  const w=world();
  await w.dispatch('message',{data:{type:'bh-warm',urls:[
    '/fr', ORIGIN+'/_next/static/chunks/app.js', ORIGIN+'/api/flour-scan', ORIGIN+'/auth/callback',
    'https://mguwsdonfsyioyelseuf.supabase.co/rest/v1/bake_events', ORIGIN+'/oven_stone.webp',
  ]}});
  const kept=[...w.stores.values()].flatMap(s=>[...s.keys()]).sort();
  assert.deepEqual(kept,[ORIGIN+'/_next/static/chunks/app.js',ORIGIN+'/fr',ORIGIN+'/oven_stone.webp']);
  assert.ok(!w.fetched.some(u=>/\/api\/|\/auth\/|supabase/.test(u)));
});

test('the worker is registered from the layout, in production only',()=>{
  const component=fs.readFileSync(path.join(__dirname,'../app/components/ServiceWorkerRegistration.tsx'),'utf8');
  assert.match(component,/process\.env\.NODE_ENV !== 'production'\) return/);
  assert.match(component,/register\('\/sw\.js'/);
  const layout=fs.readFileSync(path.join(__dirname,'../app/[locale]/layout.tsx'),'utf8');
  assert.match(layout,/<ServiceWorkerRegistration \/>/);
});
