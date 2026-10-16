// Responsive camera and touch controls share the same fixed world coordinates.
const responsiveStyle=document.createElement('style');
responsiveStyle.textContent=`
.app{height:100vh;height:100dvh}.drawer{overflow-y:auto}.filter-dropdown-menu{position:fixed;z-index:30}
@media(max-width:900px){
 .top{padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right));padding-top:max(8px,env(safe-area-inset-top))}
 .stage{top:var(--toolbar-height,140px)}.toolbar{align-items:center}.toolbar .btn,.top .btn,.zoom .btn,.side-close{min-height:44px}
 .toolbar input,.side input,.side textarea,.filter-dropdown-search{font-size:16px}
 .filter-dropdown-trigger{min-height:44px}.zoom{bottom:max(8px,env(safe-area-inset-bottom))}
 .side,.drawer{padding-bottom:max(20px,env(safe-area-inset-bottom));overscroll-behavior:contain}
 .side .row{flex-wrap:wrap}.side .row>*{flex:1 1 90px}.filter-dropdown-actions .btn{min-height:44px}
}
@media(max-height:500px) and (max-width:900px){.toolbar{gap:4px}.toolbar .btn{min-height:36px;padding:5px 8px}.top{min-height:44px;padding-top:4px;padding-bottom:4px}.top .btn{min-height:36px}}
`;
document.head.appendChild(responsiveStyle);
const compactScreen=matchMedia('(max-width:900px)');
const toolbarElement=document.querySelector('.toolbar');
function measureToolbar(){document.querySelector('.stage-wrap').style.setProperty('--toolbar-height',(toolbarElement.offsetHeight+24)+'px')}
new ResizeObserver(measureToolbar).observe(toolbarElement);measureToolbar();
function positionFilterMenus(){
 dropdownFilterBar.querySelectorAll('.filter-dropdown').forEach(wrap=>{
  const menu=wrap.querySelector('.filter-dropdown-menu');if(menu.hidden)return;
  const rect=wrap.querySelector('button').getBoundingClientRect();
  const viewport=window.visualViewport,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
  const vx=viewport?.offsetLeft||0,vy=viewport?.offsetTop||0;
  const width=Math.min(320,w-16),top=Math.max(vy+8,Math.min(rect.bottom+7,vy+h-180));
  menu.style.width=width+'px';menu.style.left=Math.max(vx+8,Math.min(rect.left,vx+w-width-8))+'px';menu.style.top=top+'px';menu.style.maxHeight=Math.max(80,vy+h-top-8)+'px';
 });
}
const refreshMenusBeforePosition=refreshDropdownFilters;
refreshDropdownFilters=()=>{refreshMenusBeforePosition();positionFilterMenus()};
window.addEventListener('resize',positionFilterMenus);document.querySelector('.top').addEventListener('scroll',positionFilterMenus);
window.visualViewport?.addEventListener('resize',positionFilterMenus);
window.visualViewport?.addEventListener('scroll',positionFilterMenus);
let cameraAutoFit=true,lastCameraSize=null;
function fitGraphToScreen(){
 const ids=viewNodeIds(),points=data.nodes.filter(n=>ids.has(n.id)).map(pos);
 if(!points.length){scale=1;pan={x:stage.clientWidth/2,y:stage.clientHeight/2};return}
 const left=Math.min(...points.map(p=>p.x))-90,right=Math.max(...points.map(p=>p.x))+90;
 const top=Math.min(...points.map(p=>p.y))-70,bottom=Math.max(...points.map(p=>p.y))+120;
 scale=Math.max(.001,Math.min(1,(stage.clientWidth-24)/(right-left),(stage.clientHeight-24)/(bottom-top)));
 pan={x:stage.clientWidth/2-(left+right)/2*scale,y:stage.clientHeight/2-(top+bottom)/2*scale};
}
zoomFit.onclick=()=>{cameraAutoFit=true;fitGraphToScreen();render()};
const zoomBeforeCamera=zoomAt;
zoomAt=(factor,x,y)=>{cameraAutoFit=false;zoomBeforeCamera(factor,x,y)};
scheduleCanvasGeometryUpdate=()=>{
 if(canvasGeometryFrame)return;
 canvasGeometryFrame=requestAnimationFrame(()=>{
  canvasGeometryFrame=0;if(!stage.clientWidth||!stage.clientHeight)return;
  if(cameraAutoFit)fitGraphToScreen();
  else if(lastCameraSize){pan.x+=(stage.clientWidth-lastCameraSize.width)/2;pan.y+=(stage.clientHeight-lastCameraSize.height)/2}
  lastCameraSize={width:stage.clientWidth,height:stage.clientHeight};
  render();positionFilterMenus();
 });
};
compactScreen.addEventListener('change',event=>{setSideOpen(!event.matches);measureToolbar();scheduleCanvasGeometryUpdate()});
// Track pointer IDs so a second finger cannot overwrite an active single drag.
stage.onpointerdown=null;window.onpointermove=null;window.onpointerup=null;
const canvasPointers=new Map();let pinch=null,panPointer=null,suppressCanvasClickUntil=0;
function beginPinch(){
 const [a,b]=[...canvasPointers.values()],r=stage.getBoundingClientRect();
 const x=(a.x+b.x)/2-r.left,y=(a.y+b.y)/2-r.top;
 pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,worldX:(x-pan.x)/scale,worldY:(y-pan.y)/scale};
 panPointer=null;blankPointerStart=null;cancelNodeDrag?.();cameraAutoFit=false;
 suppressCanvasClickUntil=performance.now()+500;
}
stage.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('.zoom'))return;
 canvasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(canvasPointers.size>=2){beginPinch();e.preventDefault();e.stopImmediatePropagation();return}
 if(e.target===stage||e.target===edges||e.target===nodes){panPointer={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};stage.setPointerCapture(e.pointerId)}
},true);
window.addEventListener('pointermove',e=>{
 if(!canvasPointers.has(e.pointerId))return;
 canvasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&canvasPointers.size>=2){
  const [a,b]=[...canvasPointers.values()],r=stage.getBoundingClientRect();
  scale=Math.max(.001,Math.min(MAX_ZOOM,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));
  pan={x:(a.x+b.x)/2-r.left-pinch.worldX*scale,y:(a.y+b.y)/2-r.top-pinch.worldY*scale};
  suppressCanvasClickUntil=performance.now()+500;e.preventDefault();render();
 }else if(panPointer?.id===e.pointerId){
  const dx=e.clientX-panPointer.x,dy=e.clientY-panPointer.y;
  if(Math.hypot(dx,dy)<=4)return;
  cameraAutoFit=false;pan={x:panPointer.px+dx,y:panPointer.py+dy};
  blankPointerStart=null;suppressCanvasClickUntil=performance.now()+350;stage.classList.add('dragging');render();
 }
},{passive:false});
function endCanvasPointer(e){
 canvasPointers.delete(e.pointerId);if(panPointer?.id===e.pointerId)panPointer=null;
 if(pinch){suppressCanvasClickUntil=performance.now()+500;blankPointerStart=null;if(canvasPointers.size<2)pinch=null}
 if(!canvasPointers.size)stage.classList.remove('dragging');
}
window.addEventListener('pointerup',endCanvasPointer,true);
window.addEventListener('pointercancel',endCanvasPointer,true);
stage.addEventListener('click',e=>{if(performance.now()<suppressCanvasClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('blur',()=>{canvasPointers.clear();pinch=null;panPointer=null;blankPointerStart=null;cancelNodeDrag?.();stage.classList.remove('dragging')});
