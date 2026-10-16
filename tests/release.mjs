// Release audit: actual page adapters with controlled browser/storage failures.
// These checks deliberately fail when a release requirement is not satisfied.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const core=read('src/core.js'),transfer=read('src/data-transfer.js');
const compiled=read('index.html').match(/<script data-source="graph-domain.ts">\n([\s\S]*?)\n<\/script>/)[1];
const cases=[];const test=(name,run)=>cases.push({name,run});
const plain=x=>JSON.parse(JSON.stringify(x));
const person=id=>({id,name:id,meta:'英格兰/阿森纳',intro:'',avatar:'',x:10,y:20});
const graph=()=>({nodes:[person('old')],edges:[]});
const backup=(data=graph())=>({format:'person-relationship-map',version:1,data});
function adapter(options={}){
 const elements={exportJson:{},importJson:{},importJsonFile:{value:'chosen'},drawer:{classList:{remove(){}}}};
 const downloads=[],alerts=[];let saves=0,renders=0,fits=0;
 const c=vm.createContext({Blob,Date,JSON,types:{friend:'好友'},data:graph(),selected:'old',edgeMode:true,edgeStart:'old',scale:.5,pan:{x:20,y:30},
  activeFilters:{clubs:['阿森纳'],countries:[],relations:[]},focusId:'old',searchInput:{value:'old'},
  document:{getElementById:id=>elements[id]},download:(blob,name)=>downloads.push({blob,name}),
  alert:text=>alerts.push(text),confirm:()=>options.confirm!==false,
  save:async()=>{saves++;if(options.rejectSave)throw Error('transaction failed');return options.save!==false},
  render(){renders++},zoomFit:{click(){fits++}}});
 vm.runInContext(compiled,c);vm.runInContext(transfer,c);
 const importFile=async(text,size=String(text).length)=>{elements.importJsonFile.files=[{size,text:async()=>text}];await elements.importJsonFile.onchange()};
 return {c,elements,downloads,alerts,importFile,counts:()=>({saves,renders,fits})};
}
test('JSON export/import round trip preserves graph and explicit fields',async()=>{
 const a=adapter();a.c.data.nodes[0].country='英格兰';a.elements.exportJson.onclick();
 const text=await a.downloads[0].blob.text();assert.equal(JSON.parse(text).format,'person-relationship-map');
 const b=adapter();await b.importFile(text);assert.deepEqual(plain(b.c.data),plain(a.c.data));assert.equal(b.counts().fits,1);
});
for(const [name,text,size] of [
 ['invalid JSON','{',2],['wrong backup version',JSON.stringify({...backup(),version:2}),1],
 ['dangling edge',JSON.stringify(backup({nodes:[person('old')],edges:[{id:'e',source:'old',target:'missing',type:'friend'}]})),1],
 ['duplicate person ID',JSON.stringify(backup({nodes:[person('old'),person('old')],edges:[]})),1],
 ['oversize file',JSON.stringify(backup()),51*1024*1024],
 ['unsupported avatar protocol',JSON.stringify(backup({nodes:[{...person('old'),avatar:'javascript:alert(1)'}],edges:[]})),1]
])test('Import rejects '+name+' without data loss',async()=>{
 const a=adapter(),before=plain(a.c.data);await a.importFile(text,size);assert.deepEqual(plain(a.c.data),before);assert.equal(a.counts().saves,0);assert(a.alerts.some(x=>x.includes('导入失败')));assert.equal(a.elements.importJsonFile.value,'');
});
test('Cancelled import does not save or change current view',async()=>{
 const a=adapter({confirm:false});await a.importFile(JSON.stringify(backup({nodes:[person('new')],edges:[]})));
 assert.equal(a.c.selected,'old');assert.equal(a.c.scale,.5);assert.equal(a.counts().saves,0);
});
test('Import storage quota failure retains graph',async()=>{
 const a=adapter({save:false}),before=plain(a.c.data);await a.importFile(JSON.stringify(backup({nodes:[person('new')],edges:[]})));assert.deepEqual(plain(a.c.data),before);assert(a.alerts.some(x=>x.includes('导入失败')));
});
test('Import storage failure also retains selection, camera and edge operation',async()=>{
 const a=adapter({save:false});await a.importFile(JSON.stringify(backup()));
 assert.equal(a.c.selected,'old');assert.equal(a.c.scale,.5);assert.equal(a.c.edgeMode,true);assert.equal(a.c.edgeStart,'old');assert.deepEqual(plain(a.c.pan),{x:20,y:30});
});
test('Unexpected storage rejection rolls back imported graph',async()=>{
 const a=adapter({rejectSave:true}),before=plain(a.c.data);await a.importFile(JSON.stringify(backup({nodes:[person('new')],edges:[]})));assert.deepEqual(plain(a.c.data),before);
});
test('Successful import clears prior person focus even if ID still exists',async()=>{
 const a=adapter();await a.importFile(JSON.stringify(backup()));assert.equal(a.c.focusId,null);assert.equal(a.c.searchInput.value,'');assert.equal(a.c.activeFilters,null);
});
// Execute the real storage implementation, not a replacement algorithm.
function storage({quota=false,stored}={}){
 const warnings=[],writes=[];
 const c=vm.createContext({KEY:'test',data:graph(),selected:'old',appReady:false,window:{},
  types:{},
  localStorage:{setItem:(k,v)=>{if(quota)throw Error('quota');writes.push(JSON.parse(v))}},
  alert:t=>warnings.push(t),render(){},scheduleCanvasGeometryUpdate(){}});
 vm.runInContext(compiled,c);vm.runInContext(core.slice(core.indexOf('let storageDbPromise='),core.indexOf('function uid(')),c);
 if(stored!==undefined)vm.runInContext('openStorageDb=()=>Promise.resolve(testDb)',Object.assign(c,{testDb:{transaction:()=>({objectStore:()=>({get:()=>{const request={};queueMicrotask(()=>{request.result=stored;request.onsuccess()});return request}})})}}));
 return {c,warnings,writes};
}
test('IndexedDB unavailable falls back to localStorage',async()=>{const a=storage();assert.equal(await a.c.save(),true);assert.equal(a.writes.length,1)});
test('Both storage methods unavailable return failure and warn only once',async()=>{const a=storage({quota:true});assert.equal(await a.c.save(),false);assert.equal(await a.c.save(),false);assert.equal(a.warnings.length,1)});
test('Corrupted cached graph is ignored rather than replacing valid embedded graph',async()=>{
 const a=storage({stored:{nodes:[{id:'broken'}],edges:[]}});await a.c.restoreFromStorage();assert.equal(a.c.data.nodes[0].id,'old');
});
test('Late cache restoration cannot overwrite a user edit',async()=>{const a=storage({stored:{nodes:[person('cached')],edges:[]}});await a.c.save();await a.c.restoreFromStorage();assert.equal(a.c.data.nodes[0].id,'old')});
for(const [name,cached,expected] of [['malformed JSON','{','embedded'],['invalid graph',JSON.stringify({nodes:[{id:'broken'}],edges:[]}),'embedded'],['valid graph',JSON.stringify({nodes:[person('cached')],edges:[]}),'cached']])test('Initial localStorage load: '+name,()=>{
 const a=adapter();Object.assign(a.c,{KEY:'test',types:{},sample:graph(),console:{warn(){}},localStorage:{getItem:()=>cached},document:{getElementById:()=>({textContent:JSON.stringify({data:{nodes:[person('embedded')],edges:[]}})})}});
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function load()')),a.c);
 assert.equal(a.c.load().nodes[0].id,expected);
});
test('Imported avatar cannot inject HTML attributes into node rendering',()=>{
 const malicious={...person('old'),avatar:'https://example.invalid/" onerror="alert(1)'};
 const a=adapter();assert.throws(()=>a.c.WosoGraph.validateGraph(backup({nodes:[malicious],edges:[]})),/头像/);
 // Defense in depth: direct editor input must be safe even before saving.
 const validated={nodes:[malicious],edges:[]};
 const elements=[];Object.assign(a.c,{data:validated,selected:null,scale:1,pan:{x:0,y:0},pos:()=>({x:0,y:0}),
  esc:v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
  nodes:{appendChild:el=>elements.push(el)},document:{createElement:()=>({style:{},dataset:{}})}});
 a.c.attr=a.c.esc;
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function renderNodes()')),a.c);a.c.renderNodes();
 assert(!elements[0].innerHTML.includes(' onerror="alert(1)'),'Avatar must be assigned safely or escaped, not interpolated as raw HTML');
});
test('Profile avatar and relationship IDs are escaped in HTML attributes',()=>{
 const a=adapter(),malicious=person('old');malicious.avatar='https://example.invalid/" onerror="alert(1)';
 const escape=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 Object.assign(a.c,{data:{nodes:[malicious,person('other')],edges:[{id:'e" onclick="alert(1)',source:'old',target:'other',type:'friend'}]},types:{friend:'好友'},colors:{friend:'gold'},esc:escape,attr:escape,
  drawer:{classList:{add(){}}},profile:{innerHTML:''},editor:{innerHTML:'',querySelector:()=>({})},nodeRels:{innerHTML:'',querySelectorAll:()=>[]}});
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function openDrawer(')),a.c);a.c.openDrawer(malicious);
 assert(!a.c.profile.innerHTML.includes(' onerror="alert(1)'));
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function renderEditor(')),a.c);a.c.renderEditor();
 assert(!a.c.nodeRels.innerHTML.includes(' onclick="alert(1)'));
});
test('Documentation links and reorganized source paths exist',()=>{
 for(const file of ['README.md','CONTRIBUTING.md',...readdirSync(new URL('docs/',root)).filter(f=>f.endsWith('.md')).map(f=>'docs/'+f)]){
  for(const m of read(file).matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(m[1]))assert(existsSync(new URL(path.posix.join(path.posix.dirname(file),m[1].split('#')[0]),root)),file+': '+m[1]);
 }
 assert(existsSync(new URL('data/人物关系图谱-爱心图.json',root)));
});
const view=read('src/view-export-layout.js');
function pngAdapter(options={}){
 const base=adapter(),calls=[],downloads=[],alerts=[];
 const ctx={scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},save(){},restore(){},arc(){},clip(){},drawImage(){},setTransform(){},measureText:t=>({width:t.length*7}),fillText:(...args)=>calls.push(args)};
 const canvas={getContext:()=>options.noContext?null:ctx,toBlob(fn){if(options.tainted)throw Error('SecurityError');fn(options.noBlob?null:new Blob(['png fixture']))}};
 const nodes=options.empty?[]:[{...person('a'),x:10,y:10},{...person('b'),x:80,y:80}];
 const edges=options.empty?[]:[{id:'e',source:'a',target:'b',type:'friend',label:'好友'}];
 Object.assign(base.c,{exportPng:{},data:{nodes,edges},focusId:null,activeFilters:null,
  document:{createElement:()=>canvas},pos:n=>({x:n.x*(options.huge?1e9:10),y:n.y*(options.huge?1e9:10)}),
  viewEdges:()=>edges,viewNodeIds:()=>new Set(nodes.map(n=>n.id)),relationColor:()=> 'gold',
  shouldGlowPerson:()=>false,loadImageForExport:async()=>null,alert:t=>alerts.push(t),download:(blob,name)=>downloads.push({blob,name})});
 vm.runInContext(view.slice(view.indexOf('function authorWatermarkLayout('),view.indexOf('exportHtml.onclick=')),base.c);
 return {...base,canvas,calls,downloads,alerts};
}
test('PNG export integrates filtering, failed avatar fallback, labels and watermark',async()=>{
 const a=pngAdapter();await a.c.exportPng.onclick();assert.equal(a.downloads.length,1);assert(a.calls.some(x=>x[0]==='a'));assert(a.calls.some(x=>x[0]==='b'));assert.equal(a.calls.at(-1)[0],'patri677原创');assert(a.canvas.width<=12000&&a.canvas.height<=12000);assert(a.canvas.width*a.canvas.height<=48000000);
});
for(const [name,options] of [['empty view',{empty:true}],['unavailable canvas',{noContext:true}],['encoding failure',{noBlob:true}],['cross-origin tainted canvas',{tainted:true}],['oversize layout',{huge:true}]])test('PNG export handles '+name,async()=>{
 const a=pngAdapter(options);await a.c.exportPng.onclick();assert.equal(a.downloads.length,0);assert(a.alerts.length>0);
});
for(const outcome of ['load','error','timeout'])test('Avatar export '+outcome+' always settles',async()=>{
 let image,timer;
 const c=vm.createContext({Image:function(){image=this},setTimeout:fn=>{timer=fn;return 1},clearTimeout(){}});
 vm.runInContext(view.slice(view.indexOf('function loadImageForExport('),view.indexOf('function authorWatermarkLayout(')),c);
 const pending=c.loadImageForExport('https://example.invalid/avatar.png');
 assert.equal(image.crossOrigin,'anonymous');
 if(outcome==='load')image.onload();else if(outcome==='error')image.onerror();else timer();
 assert.equal(await pending,outcome==='load'?image:null);
});
test('100/1000-node data/filter smoke benchmark',()=>{
 const a=adapter();for(const count of [100,1000]){
  const nodes=Array.from({length:count},(_,i)=>person('p'+i));const edges=nodes.slice(1).map((_,i)=>({id:'e'+i,source:'p'+i,target:'p'+(i+1),type:'friend'}));
  const start=performance.now();a.c.WosoGraph.validateGraph({nodes,edges});const hits=edges.filter(e=>a.c.WosoGraph.edgeMatches(e,nodes,{clubs:['阿森纳'],countries:[],relations:['friend']}));
  assert.equal(hits.length,edges.length);console.log(`  BENCH ${count} nodes: ${(performance.now()-start).toFixed(1)} ms (rules only; not browser rendering)`);
 }
});
test('Official graph lifecycle: import, real editor save, export, reload, PNG and HTML snapshot',async()=>{
 const official=JSON.parse(read('data/人物关系图谱-爱心图.json'));
 const a=adapter();await a.importFile(JSON.stringify(official));
 const id=a.c.data.nodes[0].id,position=plain({x:a.c.data.nodes[0].x,y:a.c.data.nodes[0].y});
 const fields={fName:{value:'发布验收临时姓名'},fAvatar:{value:a.c.data.nodes[0].avatar},fMeta:{value:a.c.data.nodes[0].meta},fIntro:{value:'测试 </script><script>alert(1)</script> & "内容"'},saveNode:{},deleteNode:{}};
 Object.assign(a.c,{selected:id,esc:v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),attr:v=>String(v??'').replace(/"/g,'&quot;'),colors:{},
  editor:{innerHTML:'',querySelector:selector=>fields[selector.slice(1)]},nodeRels:{innerHTML:'',querySelectorAll:()=>[]},openDrawer(){}});
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function renderEditor(')),a.c);a.c.renderEditor();fields.saveNode.onclick();
 assert.equal(a.c.data.nodes[0].name,'发布验收临时姓名');
 a.elements.exportJson.onclick();const jsonText=await a.downloads.at(-1).blob.text();
 const b=pngAdapter();await b.importFile(jsonText);assert.equal(b.c.data.nodes.length,60);assert.equal(b.c.data.edges.length,95);
 assert.deepEqual(plain({x:b.c.data.nodes[0].x,y:b.c.data.nodes[0].y}),position);
 assert.deepEqual(plain(b.c.data),plain(a.c.data),'Export and reimport preserve edited graph');
 const reloaded=adapter();Object.assign(reloaded.c,{KEY:'snapshot',sample:graph(),localStorage:{getItem:()=>JSON.stringify(b.c.data)}});
 vm.runInContext(core.split('\n').find(x=>x.startsWith('function load()')),reloaded.c);assert.deepEqual(plain(reloaded.c.load()),plain(b.c.data));
 b.c.viewEdges=()=>b.c.data.edges;b.c.viewNodeIds=()=>new Set(b.c.data.nodes.map(n=>n.id));await b.c.exportPng.onclick();assert.equal(b.downloads.at(-1).name,'人物关系图谱.png');
 let savedSnapshot;const element={remove(){},removeAttribute(){},replaceChildren(){},classList:{remove(){}}};
 const copy={classList:{add(){}},querySelector:s=>s==='.toolbar'?{children:[{},{}]}:s==='head'?{appendChild:el=>{savedSnapshot=el.textContent}}:element,
  querySelectorAll:()=>[],ownerDocument:{createElement:()=>({dataset:{}})},get outerHTML(){return '<html><head><script id="snapshot-data" type="application/json">'+savedSnapshot+'</script></head></html>'}};
 Object.assign(b.c,{exportHtml:{},document:{documentElement:{cloneNode:()=>copy}},searchInput:{value:''},focusId:null,activeFilters:null});
 vm.runInContext(view.slice(view.indexOf('exportHtml.onclick='),view.indexOf('const mainPanel=')),b.c);b.c.exportHtml.onclick();
 const html=await b.downloads.at(-1).blob.text();assert(!html.includes('<script>alert(1)</script>'),'HTML snapshot must neutralize closing-script text');
 const snapshot=JSON.parse(savedSnapshot);assert.deepEqual(plain(b.c.WosoGraph.validateGraph(snapshot.data)),plain(b.c.data));
 // Read the generated snapshot through the real offline loader in a fresh context.
 Object.assign(reloaded.c,{localStorage:{getItem:()=>null},document:{getElementById:()=>({textContent:savedSnapshot})}});
 assert.deepEqual(plain(reloaded.c.load()),plain(b.c.data),'Offline reopen retains the edited graph');
 assert.equal(JSON.parse(read('data/人物关系图谱-爱心图.json')).data.nodes[0].name,official.data.nodes[0].name,'Tests never modify official data');
});
let failed=0;
for(const {name,run} of cases){try{await run();console.log('PASS: '+name)}catch(e){failed++;console.error('FAIL: '+name+'\n  '+e.message)}}
console.log(`Release audit: ${cases.length-failed}/${cases.length} passed; ${failed} failed.`);
if(failed)process.exitCode=1;
