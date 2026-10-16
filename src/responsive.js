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
// One composited scene replaces per-edge updates while a finger is moving.
let graphScene=document.getElementById('graphScene');
if(!graphScene){
 graphScene=document.createElement('div');graphScene.id='graphScene';
 stage.insertBefore(graphScene,edges);graphScene.append(edges,nodes);
}
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
let cameraAutoFit=true,lastCameraSize=null,geometryPending=false;
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
 if(!appReady)return;
 if(canvasGeometryFrame)return;
 canvasGeometryFrame=requestAnimationFrame(()=>{
  canvasGeometryFrame=0;if(!stage.clientWidth||!stage.clientHeight)return;
  if(canvasPointers.size){geometryPending=true;return}
  geometryPending=false;
  if(cameraAutoFit)fitGraphToScreen();
  else if(lastCameraSize){pan.x+=(stage.clientWidth-lastCameraSize.width)/2;pan.y+=(stage.clientHeight-lastCameraSize.height)/2}
  lastCameraSize={width:stage.clientWidth,height:stage.clientHeight};
  clearPanPreview();render();positionFilterMenus();
 });
};
compactScreen.addEventListener('change',event=>{if(event.matches)setSideOpen(false);measureToolbar();scheduleCanvasGeometryUpdate()});
// Track pointer IDs so a second finger cannot overwrite an active single drag.
const canvasPointers=new Map();let pinch=null,panPointer=null,suppressCanvasClickUntil=0;
let panPreviewFrame=0,previewCamera=null;
function clearPanPreview(){
 if(panPreviewFrame){cancelAnimationFrame(panPreviewFrame);panPreviewFrame=0}
 graphScene.style.transform='';graphScene.style.willChange='';previewCamera=null;
}
function finishPanPreview(){
 if(!previewCamera){clearPanPreview();return}
 const original=previewCamera,ratio=scale/original.scale;
 const dx=pan.x-original.x*ratio,dy=pan.y-original.y*ratio;
 const contentScale=Math.min(1,2*scale),oldContentScale=Math.min(1,2*original.scale);
 const people=new Map(data.nodes.map(person=>[person.id,person]));
 // Keep the existing elements and image decodes. No editor/menu rebuilding.
 nodes.querySelectorAll('.node').forEach(el=>{
  const person=people.get(el.dataset.id);if(!person)return;
  const point=pos(person);el.style.left=point.x*scale+pan.x+'px';el.style.top=point.y*scale+pan.y+'px';el.style.setProperty('--node-scale',contentScale);
 });
 edges.querySelectorAll('g').forEach(group=>{
  const line=group.querySelector('.edge'),label=group.querySelector('.edge-label');
  if(line){for(const attr of ['x1','x2'])line.setAttribute(attr,Number(line.getAttribute(attr))*ratio+dx);for(const attr of ['y1','y2'])line.setAttribute(attr,Number(line.getAttribute(attr))*ratio+dy);line.style.strokeWidth=Math.max(1,3*scale)+'px'}
  if(label){label.setAttribute('x',Number(label.getAttribute('x'))*ratio+dx);label.setAttribute('y',Number(label.getAttribute('y'))*ratio+dy+7*(oldContentScale*ratio-contentScale));label.style.fontSize=12*contentScale+'px';label.style.strokeWidth=4*contentScale+'px'}
 });
 clearPanPreview();
 if(ratio!==1){applyCurrentView();placeRelationshipLabels()}
}
function schedulePanPreview(){
 if(!previewCamera)previewCamera={scale:pinch?.scale||scale,x:panPointer?.px??pinch?.panX??pan.x,y:panPointer?.py??pinch?.panY??pan.y};
 graphScene.style.willChange='transform';
 if(panPreviewFrame)return;
 panPreviewFrame=requestAnimationFrame(()=>{
  panPreviewFrame=0;if(!previewCamera)return;
  const ratio=scale/previewCamera.scale,dx=pan.x-previewCamera.x*ratio,dy=pan.y-previewCamera.y*ratio;
  graphScene.style.transform=`translate3d(${dx}px,${dy}px,0) scale(${ratio})`;
 });
}
function beginPinch(){
 finishPanPreview();
 const [a,b]=[...canvasPointers.values()],r=stage.getBoundingClientRect();
 const x=(a.x+b.x)/2-r.left,y=(a.y+b.y)/2-r.top;
 pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,panX:pan.x,panY:pan.y,worldX:(x-pan.x)/scale,worldY:(y-pan.y)/scale,rect:r};
 panPointer=null;blankPointerStart=null;cancelNodeDrag?.();cameraAutoFit=false;
 suppressCanvasClickUntil=performance.now()+500;
}
stage.addEventListener('pointerdown',e=>{
 if(!appReady||e.button!==0||e.target.closest('.zoom'))return;
 canvasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(canvasPointers.size>=2){beginPinch();e.preventDefault();e.stopImmediatePropagation();return}
 // A drag may start on an SVG line or label too; a stationary click still
 // reaches its relationship action. Capture only after crossing the threshold.
 if(!e.target.closest('.node')){
  panPointer={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};e.preventDefault();
 }
},true);
stage.addEventListener('dragstart',e=>e.preventDefault());
stage.addEventListener('selectstart',e=>e.preventDefault());
window.addEventListener('pointermove',e=>{
 if(!canvasPointers.has(e.pointerId))return;
 if(e.pointerType==='mouse'&&e.buttons===0){endCanvasPointer(e);return}
 canvasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&canvasPointers.size>=2){
  const [a,b]=[...canvasPointers.values()],r=pinch.rect;
  scale=Math.max(.001,Math.min(MAX_ZOOM,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));
  pan={x:(a.x+b.x)/2-r.left-pinch.worldX*scale,y:(a.y+b.y)/2-r.top-pinch.worldY*scale};
  suppressCanvasClickUntil=performance.now()+500;e.preventDefault();schedulePanPreview();
 }else if(panPointer?.id===e.pointerId){
  const dx=e.clientX-panPointer.x,dy=e.clientY-panPointer.y;
  if(!panPointer.moved&&Math.hypot(dx,dy)<=4)return;
  if(!panPointer.moved){panPointer.moved=true;stage.setPointerCapture(e.pointerId)}
  cameraAutoFit=false;pan={x:panPointer.px+dx,y:panPointer.py+dy};
  blankPointerStart=null;suppressCanvasClickUntil=performance.now()+350;stage.classList.add('dragging');e.preventDefault();schedulePanPreview();
 }
},{passive:false});
function endCanvasPointer(e){
 if(!canvasPointers.has(e.pointerId))return;
 if(panPointer?.id===e.pointerId){finishPanPreview();panPointer=null}
 canvasPointers.delete(e.pointerId);
 if(e.type==='pointercancel'||e.type==='lostpointercapture')blankPointerStart=null;
 if(pinch){suppressCanvasClickUntil=performance.now()+500;blankPointerStart=null;if(canvasPointers.size<2){finishPanPreview();pinch=null}}
 if(!canvasPointers.size){stage.classList.remove('dragging');if(geometryPending)scheduleCanvasGeometryUpdate()}
}
window.addEventListener('pointerup',endCanvasPointer,true);
window.addEventListener('pointercancel',endCanvasPointer,true);
stage.addEventListener('lostpointercapture',endCanvasPointer);
stage.addEventListener('click',e=>{if(performance.now()<suppressCanvasClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('blur',()=>{finishPanPreview();canvasPointers.clear();pinch=null;panPointer=null;blankPointerStart=null;cancelNodeDrag?.();stage.classList.remove('dragging')});
const renderBeforeGesturePreview=render;
render=()=>{clearPanPreview();renderBeforeGesturePreview()};
