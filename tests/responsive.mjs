import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const executable=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('application/json'));
executable.forEach((m,i)=>new vm.Script(m[2],{filename:`inline-${i}.js`}));
assert(!html.includes('demoBtn.onclick'),'Saved HTML must initialize without the removed demo button');
const handlers=new Map(),frames=[],cancelledFrames=new Set();let frameId=0,renderCount=0;
const flushFrames=()=>{for(const [id,fn] of frames.splice(0))if(!cancelledFrames.has(id))fn()};
const listen=(target,type,fn)=>{const key=target+':'+type;handlers.set(key,[...(handlers.get(key)||[]),fn])};
const dispatch=(target,type,event)=>handlers.get(target+':'+type)?.forEach(fn=>fn(event));
const stage={clientWidth:390,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(t,f)=>listen('stage',t,f),setPointerCapture(){},classList:{add(){},remove(){}}};
const menu={hidden:false,style:{}},wrap={querySelector:s=>s==='button'?{getBoundingClientRect:()=>({left:370,bottom:120})}:menu};
const toolbar={offsetHeight:100},properties={};
const root={style:{setProperty:(k,v)=>properties[k]=v}};
let geometryWrites=0;
const geometry=attributes=>({attributes,style:{},getAttribute(k){return this.attributes[k]},setAttribute(k,v){geometryWrites++;this.attributes[k]=v}});
const line=geometry({x1:0,y1:0,x2:100,y2:100}),label=geometry({x:50,y:43});
const previewGroup={querySelector:s=>s==='.edge'?line:label};
const scene={style:{}};
const renderedNodes=['a','b'].map(id=>({dataset:{id},style:{setProperty(){}}}));
const previewNodes={style:{},querySelectorAll:()=>renderedNodes};
const context=vm.createContext({
 stage,nodes:previewNodes,edges:{querySelectorAll:()=>[previewGroup]},appReady:true,innerWidth:390,innerHeight:740,MAX_ZOOM:2.2,scale:1,pan:{x:0,y:0},canvasGeometryFrame:0,
 data:{nodes:[{id:'a',x:0,y:0},{id:'b',x:100,y:100}]},
 viewNodeIds:()=>new Set(['a','b']),render(){renderCount++},pos:n=>({x:n.x*11.96,y:n.y*7.61}),
 dropdownFilterBar:{querySelectorAll:()=>[wrap]},refreshDropdownFilters(){},
 applyCurrentView(){},placeRelationshipLabels(){},
 zoomFit:{},zoomAt(){},scheduleCanvasGeometryUpdate(){},setSideOpen(){},
 cancelNodeDrag:null,blankPointerStart:null,performance:{now:()=>1000},
 requestAnimationFrame:fn=>{const id=++frameId;frames.push([id,fn]);return id},cancelAnimationFrame:id=>cancelledFrames.add(id),
 ResizeObserver:class{observe(){}},matchMedia:()=>({matches:true,addEventListener(){}}),
 document:{getElementById:()=>scene,createElement:()=>({}),head:{appendChild(){}},querySelector:s=>s==='.toolbar'?toolbar:s==='.stage-wrap'?root:{addEventListener(){}}},
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
const beforePinch=renderCount,writesBeforePinch=geometryWrites;
dispatch('window','pointermove',pointer(2,300,100));
dispatch('window','pointermove',pointer(2,300,100));
assert.equal(context.scale,2,'Pinch distance should scale the camera');
assert.equal((200-context.pan.x)/context.scale,150,'Pinch midpoint must stay anchored in world coordinates');
assert.equal(renderCount,beforePinch,'Pinching must not rebuild the graph');
assert.equal(geometryWrites,writesBeforePinch,'Pinching must not change individual SVG elements during pointer moves');
assert.equal(frames.length,1);flushFrames();
assert.equal(scene.style.transform,'translate3d(-100px,-100px,0) scale(2)');
dispatch('window','pointercancel',pointer(2,300,100));
dispatch('window','pointerup',pointer(1,100,100));
assert.equal(vm.runInContext('canvasPointers.size',context),0,'Cancelled gestures must release all pointers');
assert.equal(vm.runInContext('pinch',context),null);
assert.equal(scene.style.transform,'');assert.equal(line.attributes.x2,100,'Committed line geometry must match the pinch transform');
// Dragging SVG text must pan the graph without native drag images or per-move rebuilding.
const lineTarget={closest:()=>null};
context.scale=1;context.pan={x:0,y:0};const beforePan=renderCount;
dispatch('stage','pointerdown',{...pointer(3,20,30),target:lineTarget});
dispatch('window','pointermove',pointer(3,70,80));
dispatch('window','pointermove',pointer(3,90,100));
assert.equal(renderCount,beforePan,'Pointer moves must not rebuild nodes');
assert.equal(frames.length,1,'Multiple pointer moves should share one preview frame');
flushFrames();
assert.equal(scene.style.transform,'translate3d(70px,70px,0) scale(1)');
dispatch('window','pointerup',pointer(3,90,100));
assert.equal(renderCount,beforePan,'Panning must retain all existing nodes even on release');
assert.equal(scene.style.transform,'');
assert.equal(JSON.stringify(context.data.nodes),nodeCoordinates,'Panning must not change any node coordinate');
let prevented=false;
dispatch('stage','dragstart',{preventDefault(){prevented=true}});
assert(prevented,'Native HTML dragging must be disabled');
// Losing pointer capture before pointerup cannot leave a preview or stuck gesture.
dispatch('stage','pointerdown',pointer(4,10,10));dispatch('window','pointermove',pointer(4,40,50));
dispatch('stage','lostpointercapture',{...pointer(4,40,50),type:'lostpointercapture'});flushFrames();
assert.equal(scene.style.transform,'');assert.equal(vm.runInContext('canvasPointers.size',context),0);
assert.equal(vm.runInContext('panPointer',context),null);
const originalPan={...context.pan};
dispatch('stage','pointerdown',pointer(5,10,10));dispatch('window','pointermove',pointer(5,80,80));
dispatch('window','pointermove',pointer(5,10,10));flushFrames();
assert.equal(context.pan.x,originalPan.x);assert.equal(context.pan.y,originalPan.y,'Returning to the start must remove the entire displacement');
dispatch('window','pointerup',pointer(5,10,10));
const beforeBurst=renderCount,beforeBurstWrites=geometryWrites;
dispatch('stage','pointerdown',pointer(6,0,0));
for(let i=1;i<=120;i++)dispatch('window','pointermove',pointer(6,i,i/2));
assert.equal(frames.length,1,'120 move events must coalesce into one scene frame');
assert.equal(geometryWrites,beforeBurstWrites,'No per-edge mutations are allowed during a move burst');
flushFrames();assert.equal(scene.style.transform,'translate3d(120px,60px,0) scale(1)');
stage.clientHeight=550;
vm.runInContext('scheduleCanvasGeometryUpdate()',context);flushFrames();
assert.equal(renderCount,beforeBurst,'Mobile viewport resizing must not interrupt an active gesture');
assert.equal(vm.runInContext('geometryPending',context),true);
dispatch('window','pointerup',pointer(6,120,60));flushFrames();
assert.equal(renderCount,beforeBurst+1,'Deferred viewport changes are applied once after fingers lift');
assert.equal(scene.style.transform,'');assert.equal(vm.runInContext('geometryPending',context),false);
console.log(`PASS: ${executable.length} scripts compile; four viewport fits, menu bounds, pinch anchoring, single-layer gestures, 120-event coalescing, deferred viewport resize and pointer cleanup.`);
