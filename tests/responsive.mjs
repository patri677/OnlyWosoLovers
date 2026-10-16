import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const executable=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('application/json'));
executable.forEach((m,i)=>new vm.Script(m[2],{filename:`inline-${i}.js`}));
assert(!html.includes('demoBtn.onclick'),'Saved HTML must initialize without the removed demo button');
const handlers=new Map(),frames=[];
const listen=(target,type,fn)=>{const key=target+':'+type;handlers.set(key,[...(handlers.get(key)||[]),fn])};
const dispatch=(target,type,event)=>handlers.get(target+':'+type)?.forEach(fn=>fn(event));
const stage={clientWidth:390,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(t,f)=>listen('stage',t,f),setPointerCapture(){},classList:{add(){},remove(){}}};
const menu={hidden:false,style:{}},wrap={querySelector:s=>s==='button'?{getBoundingClientRect:()=>({left:370,bottom:120})}:menu};
const toolbar={offsetHeight:100},properties={};
const root={style:{setProperty:(k,v)=>properties[k]=v}};
const context=vm.createContext({
 stage,innerWidth:390,innerHeight:740,MAX_ZOOM:2.2,scale:1,pan:{x:0,y:0},canvasGeometryFrame:0,
 data:{nodes:[{id:'a',x:0,y:0},{id:'b',x:100,y:100}]},
 viewNodeIds:()=>new Set(['a','b']),render(){},pos:n=>({x:n.x*11.96,y:n.y*7.61}),
 dropdownFilterBar:{querySelectorAll:()=>[wrap]},refreshDropdownFilters(){},
 zoomFit:{},zoomAt(){},scheduleCanvasGeometryUpdate(){},setSideOpen(){},
 cancelNodeDrag:null,blankPointerStart:null,performance:{now:()=>1000},
 requestAnimationFrame:fn=>(frames.push(fn),frames.length),
 ResizeObserver:class{observe(){}},matchMedia:()=>({matches:true,addEventListener(){}}),
 document:{createElement:()=>({}),head:{appendChild(){}},querySelector:s=>s==='.toolbar'?toolbar:s==='.stage-wrap'?root:{addEventListener(){}}},
 window:{addEventListener:(t,f)=>listen('window',t,f)},
});
const responsive=executable.find(m=>m[1].includes('data-source="responsive.js"'));
assert(responsive,'Responsive feature must be included in the standalone build');
vm.runInContext(responsive[2],context);
vm.runInContext('measureToolbar();fitGraphToScreen();positionFilterMenus()',context);
assert.equal(properties['--toolbar-height'],'124px');
assert(Number.parseFloat(menu.style.left)+Number.parseFloat(menu.style.width)<=382,'Menu must stay inside phone viewport');
const nodeCoordinates=JSON.stringify(context.data.nodes);
for(const [width,height] of [[390,600],[768,850],[844,270],[1440,900]]){
 stage.clientWidth=width;stage.clientHeight=height;
 vm.runInContext('fitGraphToScreen()',context);
 assert.equal(JSON.stringify(context.data.nodes),nodeCoordinates,'Resize must not modify manual positions');
 const a=context.pos(context.data.nodes[0]),b=context.pos(context.data.nodes[1]);
 const dx=(b.x-a.x)*context.scale,dy=(b.y-a.y)*context.scale;
 assert(Math.abs(dx/dy-1196/761)<1e-9,'Heart geometry must retain its aspect ratio');
 assert(a.x*context.scale+context.pan.x>=0&&b.x*context.scale+context.pan.x<=width);
 assert(a.y*context.scale+context.pan.y>=0&&b.y*context.scale+context.pan.y<=height);
}
stage.clientWidth=390;stage.clientHeight=600;context.scale=1;context.pan={x:0,y:0};
const pointer=(id,x,y)=>({button:0,pointerId:id,clientX:x,clientY:y,target:stage,preventDefault(){},stopImmediatePropagation(){}});
stage.closest=()=>null;
dispatch('stage','pointerdown',pointer(1,100,100));
dispatch('stage','pointerdown',pointer(2,200,100));
dispatch('window','pointermove',pointer(2,300,100));
assert.equal(context.scale,2,'Pinch distance should scale the camera');
assert.equal((200-context.pan.x)/context.scale,150,'Pinch midpoint must stay anchored in world coordinates');
dispatch('window','pointercancel',pointer(2,300,100));
dispatch('window','pointerup',pointer(1,100,100));
assert.equal(vm.runInContext('canvasPointers.size',context),0,'Cancelled gestures must release all pointers');
assert.equal(vm.runInContext('pinch',context),null);
console.log(`PASS: ${executable.length} scripts compile; saved-file initialization guard, four viewport fits, menu bounds, pinch anchoring and gesture cancellation.`);
