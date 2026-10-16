import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
assert(/<html[^>]+class="graph-loading"/.test(html),'Initial graph must be hidden until fitted');
const exportSource=read('src/view-export-layout.js');
assert(exportSource.includes("copy.classList.add('graph-loading')"),'Saved HTML must use the same guarded startup');
assert(!/^restoreFromStorage\(\);/m.test(exportSource),'Storage restore must be owned by bootstrap');
let restore,restored=false;const frames=[],renders=[],events=[];
const context=vm.createContext({
 appReady:false,focusId:null,searchInput:{value:''},scale:1,pan:{x:0,y:0},lastCameraSize:null,
 data:{nodes:[{id:'snapshot'}]},stage:{clientWidth:390,clientHeight:600},
 restoreFromStorage:()=>new Promise(resolve=>{restore=()=>{restored=true;context.data={nodes:[{id:'local-edit'}]};resolve()}}),
 requestAnimationFrame:fn=>{frames.push(fn);return frames.length},
 measureToolbar:()=>events.push('measure'),
 fitGraphToScreen:()=>{assert(restored);events.push('fit');context.scale=.25;context.pan={x:20,y:30}},
 render:()=>{assert(context.appReady);renders.push({id:context.data.nodes[0].id,scale:context.scale})},
 document:{documentElement:{classList:{remove:name=>{assert.equal(name,'graph-loading');assert.equal(renders.length,1);events.push('reveal')}}}},
});
vm.runInContext(read('src/bootstrap.js'),context);
assert.equal(renders.length,0,'No default-scale frame before IndexedDB restore');
restore();await new Promise(setImmediate);
assert.equal(renders.length,0,'Data restoration alone must not reveal an unfitted graph');
assert.equal(frames.length,1);frames.shift()();
await vm.runInContext('applicationReady',context);
assert.deepEqual(renders,[{id:'local-edit',scale:.25}],'The first displayed frame must use restored data and the fitted camera');
assert.deepEqual(events,['measure','fit','reveal']);
// Real storage restoration must not schedule an early render behind bootstrap.
let storedRequest;let storageRenders=0,storageSchedules=0;
const stored={nodes:[{id:'restored',name:'Restored',x:10,y:20}],edges:[]};
const storageContext=vm.createContext({
 KEY:'test',appReady:false,localEditsSinceOpen:false,data:{nodes:[],edges:[]},selected:'old',
 openStorageDb:()=>Promise.resolve({transaction:()=>({objectStore:()=>({get:()=>{storedRequest={result:stored};return storedRequest}})})}),
 render:()=>storageRenders++,scheduleCanvasGeometryUpdate:()=>storageSchedules++,
});
const core=read('src/core.js');
vm.runInContext(html.match(/<script data-source="graph-domain.ts">\n([\s\S]*?)\n<\/script>/)[1],storageContext);
storageContext.types={};
vm.runInContext(core.slice(core.indexOf('function restoreFromStorage()'),core.indexOf('function uid(')),storageContext);
for(const ready of [false,true]){
 storageContext.appReady=ready;
 const pending=vm.runInContext('restoreFromStorage()',storageContext);
 await new Promise(setImmediate);storedRequest.onsuccess();await pending;
 assert.equal(storageRenders,ready?1:0);assert.equal(storageSchedules,ready?1:0);
}
console.log('PASS: delayed local restore produces no default-scale frame; first render is fitted and saved HTML uses guarded startup.');
