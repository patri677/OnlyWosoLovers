// 视图状态仅控制显示；人物、关系和坐标仍由 data 保存。
download=(blob,name)=>{const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)};
let focusId=null;
const searchWrap=document.createElement('div');
searchWrap.className='person-search';
searchWrap.innerHTML='<input id="personSearch" type="search" placeholder="搜索人物" aria-label="搜索人物" autocomplete="off"><div id="personResults" class="person-results" hidden></div>';
document.querySelector('.toolbar').appendChild(searchWrap);
const searchInput=searchWrap.querySelector('#personSearch');
const searchResults=searchWrap.querySelector('#personResults');
const viewStyles=document.createElement('style');
viewStyles.id='viewStyles';
viewStyles.textContent='.person-search{position:relative;width:190px}.person-search input{width:100%;background:#0c1427;border:1px solid #344466;color:#e9eefb;border-radius:8px;padding:9px 11px;outline:none}.person-results{position:absolute;top:42px;left:0;right:0;max-height:260px;overflow:auto;background:#11182c;border:1px solid #344466;border-radius:8px;box-shadow:0 12px 24px #0008}.person-results button{display:block;width:100%;background:transparent;border:0;color:#e9eefb;text-align:left;padding:9px 11px;cursor:pointer}.person-results button:hover{background:#243657}';
document.head.appendChild(viewStyles);
function shouldGlowPerson(person){
  if(focusId)return person.id===focusId;
  if(!activeFilters)return false;
  if(Array.isArray(activeFilters))return activeFilters.length>0;
  if(activeFilters.clubs?.length||activeFilters.countries?.length)return structuredPersonMatch(person);
  return activeFilters.relations?.length>0;
}
function applyCurrentView(){
  const visibleEdges=new Set(viewEdges().map(e=>e.id));
  const visibleNodes=viewNodeIds();
  [...edges.querySelectorAll('g')].forEach((g,i)=>{
    const hit=visibleEdges.has(data.edges[i]?.id),line=g.querySelector('.edge');
    g.style.display=hit?'':'none';
    g.style.filter='';
    if(line)line.style.filter=(hit&&(activeFilters||focusId))?'drop-shadow(0 0 5px #f8c66d) drop-shadow(0 0 10px #f8c66d)':'';
    const label=g.querySelector('.edge-label'),e=data.edges[i];
    if(label&&e){const first=data.edges.find(x=>visibleEdges.has(x.id)&&[x.source,x.target].sort().join('|')===[e.source,e.target].sort().join('|'));label.style.display=first?.id===e.id?'':'none'}
  });
  document.querySelectorAll('.node').forEach(el=>{
    const hit=visibleNodes.has(el.dataset.id),avatar=el.querySelector('.avatar');
    const person=data.nodes.find(n=>n.id===el.dataset.id);
    const glow=hit&&person&&shouldGlowPerson(person);
    el.style.display=hit?'':'none';el.style.filter='';
    if(avatar){avatar.style.boxShadow=glow?'0 0 0 4px #f8c66d44,0 0 12px #f8c66d88':'';avatar.style.borderColor=glow?'#f8c66d':''}
  });
}
render=()=>{if(focusId&&!data.nodes.some(n=>n.id===focusId)){focusId=null;searchInput.value=''}baseRender();applyCurrentView()};
function focusPerson(n){focusId=n.id;activeFilters=null;selected=null;searchInput.value=n.name||'';searchResults.hidden=true;drawer.classList.remove('open');render()}
function showSearchResults(){
  const term=searchInput.value.trim().toLocaleLowerCase();
  searchResults.replaceChildren();
  if(!term){searchResults.hidden=true;return}
  data.nodes.filter(n=>(n.name||'').toLocaleLowerCase().includes(term)).slice(0,12).forEach(n=>{
    const b=document.createElement('button');b.type='button';b.textContent=n.name||'未命名';
    b.onclick=()=>focusPerson(n);searchResults.appendChild(b)
  });
  searchResults.hidden=!searchResults.childElementCount;
}
searchInput.oninput=showSearchResults;
searchInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const first=data.nodes.find(n=>(n.name||'').toLocaleLowerCase().includes(searchInput.value.trim().toLocaleLowerCase()));if(searchInput.value.trim()&&first)focusPerson(first)}else if(e.key==='Escape')searchResults.hidden=true};
document.addEventListener('pointerdown',e=>{if(!searchWrap.contains(e.target))searchResults.hidden=true},true);
nodes.addEventListener('click',e=>{const el=e.target.closest('.node');if(!el||edgeMode||dragging)return;focusId=el.dataset.id;searchInput.value=''},true);
let blankPointerStart=null;
stage.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target!==stage&&e.target!==edges&&e.target!==nodes)return;
  blankPointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};
},true);
window.addEventListener('pointerup',e=>{
  const start=blankPointerStart;
  blankPointerStart=null;
  if(!start||e.pointerId!==start.id||Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)return;
  if(e.target!==stage&&e.target!==edges&&e.target!==nodes)return;
  focusId=null;selected=null;searchInput.value='';searchResults.hidden=true;drawer.classList.remove('open');render();
});
document.getElementById('closeDrawer').onclick=()=>{focusId=null;searchInput.value='';hideDrawer()};
function loadImageForExport(url){return new Promise(resolve=>{
  if(!url)return resolve(null);
  const im=new Image();let done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};
  const timer=setTimeout(()=>finish(null),5000);
  if(/^https?:/i.test(url))im.crossOrigin='anonymous';
  im.onload=()=>finish(im);im.onerror=()=>finish(null);im.src=url;
})}
exportPng.onclick=async()=>{
  const shownEdges=viewEdges(),shownNodes=data.nodes.filter(n=>viewNodeIds().has(n.id));
  if(!shownNodes.length){alert('当前视图没有可导出的人物');return}
  const points=shownNodes.map(n=>pos(n));
  const left=Math.min(...points.map(p=>p.x))-100,top=Math.min(...points.map(p=>p.y))-70;
  const w=Math.ceil(Math.max(...points.map(p=>p.x))+100-left);
  const h=Math.ceil(Math.max(...points.map(p=>p.y))+105-top);
  const ratio=Math.min(2,12000/w,12000/h,Math.sqrt(48000000/(w*h)));
  if(ratio<.25){alert('关系图范围过大，无法一次导出图片。请先筛选部分关系再导出。');return}
  const c=document.createElement('canvas');c.width=Math.ceil(w*ratio);c.height=Math.ceil(h*ratio);
  const ctx=c.getContext('2d');if(!ctx){alert('无法创建图片画布');return}
  ctx.scale(ratio,ratio);ctx.fillStyle='#0b1020';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;
  for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  const pairLabels=new Map();
  shownEdges.forEach(e=>{const key=[e.source,e.target].sort().join('|');const labels=pairLabels.get(key)||[];const label=e.label||types[e.type]||'关系';if(!labels.includes(label))labels.push(label);pairLabels.set(key,labels)});
  const pairLines=new Map();
  shownEdges.forEach(e=>{
    const a=data.nodes.find(n=>n.id===e.source),b=data.nodes.find(n=>n.id===e.target);if(!a||!b)return;
    const A=pos(a),B=pos(b),x1=A.x-left,y1=A.y-top,x2=B.x-left,y2=B.y-top;
    ctx.save();ctx.strokeStyle=relationColor(e);ctx.lineWidth=3;
    if(activeFilters||focusId){ctx.shadowColor='#f8c66d';ctx.shadowBlur=12}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();
    const key=[e.source,e.target].sort().join('|');
    if(!pairLines.has(key))pairLines.set(key,{x1,y1,x2,y2});
  });
  const occupied=shownNodes.map(n=>{
    const p=pos(n),x=p.x-left,y=p.y-top;
    return {left:x-76,right:x+76,top:y-43,bottom:y+115};
  });
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  ctx.fillStyle='#e9eefb';ctx.font='12px Microsoft YaHei';ctx.textAlign='center';
  pairLines.forEach((line,key)=>{
    const text=pairLabels.get(key).join('&');
    const textWidth=ctx.measureText(text).width;
    for(const t of [.5,.38,.62,.27,.73,.16,.84]){
      const x=line.x1+(line.x2-line.x1)*t;
      const y=line.y1+(line.y2-line.y1)*t-7;
      const box={left:x-textWidth/2-5,right:x+textWidth/2+5,top:y-15,bottom:y+4};
      if(!occupied.some(other=>overlaps(box,other))){ctx.fillText(text,x,y);occupied.push(box);break}
    }
  });
  const images=await Promise.all(shownNodes.map(n=>loadImageForExport(n.avatar)));
  shownNodes.forEach((n,i)=>{
    const p=pos(n),x=p.x-left,y=p.y-top;
    ctx.save();ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.clip();
    if(images[i])ctx.drawImage(images[i],x-32,y-32,64,64);else{ctx.fillStyle='#263657';ctx.fillRect(x-32,y-32,64,64)}
    const glow=shouldGlowPerson(n);
    ctx.restore();ctx.save();ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.lineWidth=3;ctx.strokeStyle=glow?'#f8c66d':'#87a8e8';
    if(glow){ctx.shadowColor='#f8c66d';ctx.shadowBlur=10}ctx.stroke();ctx.restore();
    ctx.fillStyle='#e9eefb';ctx.textAlign='center';ctx.font='bold 14px Microsoft YaHei';ctx.fillText(n.name||'未命名',x,y+52,130);
    ctx.fillStyle='#91a0bf';ctx.font='11px Microsoft YaHei';ctx.fillText(n.meta||'',x,y+69,130);
  });
  try{c.toBlob(blob=>{if(blob)download(blob,'人物关系图谱.png');else alert('图片导出失败')},'image/png')}catch(error){alert('图片导出失败：'+error.message)}
};
exportHtml.onclick=()=>{
  const copy=document.documentElement.cloneNode(true);
  copy.querySelector('#snapshot-data')?.remove();copy.querySelector('#viewStyles')?.remove();
  copy.querySelectorAll('body > :not(.app):not(script)').forEach(el=>el.remove());
  [...copy.querySelector('.toolbar').children].slice(2).forEach(el=>el.remove());
  copy.querySelector('#nodes').replaceChildren();copy.querySelector('#edges').replaceChildren();
  copy.querySelector('#editor').innerHTML='<div class="empty">点击“添加人物”开始，或点击画布中的人物编辑</div>';
  copy.querySelector('#profile').replaceChildren();copy.querySelector('#drawer').classList.remove('open');
  const snapshot=copy.ownerDocument.createElement('script');snapshot.id='snapshot-data';snapshot.type='application/json';
  snapshot.dataset.storageKey='relationship-map-snapshot-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  snapshot.textContent=JSON.stringify({data,view:{filters:activeFilters,focusId,search:searchInput.value}}).replace(/</g,'\\u003c');
  copy.querySelector('head').appendChild(snapshot);
  download(new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'}),'人物关系图谱-当前视图.html');
};
const mainPanel=document.querySelector('.main'),sidePanel=mainPanel.querySelector('.side');
// 缩放整个节点，而不只是改变节点坐标；否则缩小时头像和文字会堆叠。
const unscaledRenderNodes=renderNodes;
renderNodes=()=>{
  unscaledRenderNodes();
  const contentScale=Math.min(1,2*scale);
  nodes.querySelectorAll('.node').forEach(el=>el.style.setProperty('--node-scale',contentScale));
};
const unscaledRenderEdges=renderEdges;
renderEdges=()=>{
  unscaledRenderEdges();
  const contentScale=Math.min(1,2*scale);
  edges.querySelectorAll('g').forEach(group=>{
    const line=group.querySelector('.edge'),label=group.querySelector('.edge-label');
    if(line)line.style.strokeWidth=Math.max(1,3*scale)+'px';
    if(label){
      label.style.fontSize=12*contentScale+'px';
      label.style.strokeWidth=4*contentScale+'px';
    }
  });
};
let sideHeader=sidePanel.querySelector('.side-header');
if(!sideHeader){sideHeader=document.createElement('div');sideHeader.className='side-header';sidePanel.insertBefore(sideHeader,sidePanel.firstChild);sideHeader.appendChild(sidePanel.querySelector('h2'))}
let sideClose=sideHeader.querySelector('#sideClose');
if(!sideClose){sideClose=document.createElement('button');sideClose.id='sideClose';sideClose.className='btn side-close';sideClose.type='button';sideClose.setAttribute('aria-label','关闭编辑面板');sideClose.textContent='×';sideHeader.appendChild(sideClose)}
let sideToggle=document.getElementById('sideToggle');
if(!sideToggle){sideToggle=document.createElement('button');sideToggle.id='sideToggle';sideToggle.className='btn';sideToggle.type='button';sideToggle.textContent='编辑面板';document.querySelector('.top').insertBefore(sideToggle,document.getElementById('clearBtn'))}
function setSideOpen(open){mainPanel.classList.toggle('side-collapsed',!open);sideToggle.setAttribute('aria-expanded',String(open));sidePanel.setAttribute('aria-hidden',String(!open));scheduleCanvasGeometryUpdate()}
// 侧栏、窗口或设备方向变化都会改变画布尺寸；SVG 的 viewBox 与节点必须在同一帧更新。
let canvasGeometryFrame=0;
function scheduleCanvasGeometryUpdate(){
  if(canvasGeometryFrame)return;
  canvasGeometryFrame=requestAnimationFrame(()=>{
    canvasGeometryFrame=0;
    if(!stage.clientWidth||!stage.clientHeight)return;
    renderEdges();
    renderNodes();
    applyCurrentView();
    placeRelationshipLabels();
  });
}
function placeRelationshipLabels(){
  const stageRect=stage.getBoundingClientRect();
  const occupied=[...nodes.querySelectorAll('.node')].filter(el=>el.style.display!=='none').map(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left-stageRect.left-7,right:r.right-stageRect.left+7,top:r.top-stageRect.top-7,bottom:r.bottom-stageRect.top+7};
  });
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  edges.querySelectorAll('g').forEach(group=>{
    const label=group.querySelector('.edge-label'),line=group.querySelector('.edge');
    if(!label||!line||group.style.display==='none'||label.style.display==='none')return;
    const x1=Number(line.getAttribute('x1')),y1=Number(line.getAttribute('y1'));
    const x2=Number(line.getAttribute('x2')),y2=Number(line.getAttribute('y2'));
    const length=Math.hypot(x2-x1,y2-y1)||1;
    let placed=false;
    for(const t of [.5,.38,.62,.27,.73,.16,.84]){
      // Keep labels on the relationship line. Previously they were shifted
      // perpendicular to the edge to dodge nodes, which became conspicuous
      // as zoom changed and made labels appear detached in empty space.
      label.setAttribute('x',x1+(x2-x1)*t);
      label.setAttribute('y',y1+(y2-y1)*t-7*Math.min(1,2*scale));
      const r=label.getBBox();
      const box={left:r.x-5,right:r.x+r.width+5,top:r.y-4,bottom:r.y+r.height+4};
      if(!occupied.some(other=>overlaps(box,other))){occupied.push(box);placed=true;break}
    }
    if(!placed)label.style.display='none';
    if(!group.querySelector('title')){
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent=label.textContent;
      group.appendChild(title);
    }
  });
}
const renderBeforeLabelPlacement=render;
render=()=>{renderBeforeLabelPlacement();placeRelationshipLabels()};
new ResizeObserver(scheduleCanvasGeometryUpdate).observe(stage);
setSideOpen(!matchMedia('(max-width:900px)').matches);
sideToggle.onclick=()=>setSideOpen(mainPanel.classList.contains('side-collapsed'));
sideClose.onclick=()=>setSideOpen(false);
const previousAddNode=addNode.onclick;
addNode.onclick=e=>{previousAddNode(e);if(matchMedia('(max-width:900px)').matches)setSideOpen(true)};
const snapshotView=document.getElementById('snapshot-data');
if(snapshotView){try{const savedView=JSON.parse(snapshotView.textContent).view||{};activeFilters=Array.isArray(savedView.filters)?savedView.filters:null;focusId=data.nodes.some(n=>n.id===savedView.focusId)?savedView.focusId:null;searchInput.value=focusId?savedView.search||data.nodes.find(n=>n.id===focusId)?.name||'':''}catch(e){}}
restoreFromStorage();
scheduleCanvasGeometryUpdate();
