const KEY=document.getElementById('snapshot-data')?.dataset.storageKey||'relationship-map-v1';
const types={ex:'前任',cur:'现任',married:'现任（已婚）',nt:'国家队队友',club:'俱乐部队友',formerClub:'前俱乐部队友',friend:'好友',family:'家人',other:'其他'};
const colors={ex:'#fb7185',cur:'#f472b6',married:'#f97316',nt:'#60a5fa',club:'#34d399',formerClub:'#2dd4bf',friend:'#fbbf24',family:'#c084fc',other:'#94a3b8'};
const sample={nodes:[{id:'a',name:'林夏',meta:'国家队',intro:'前锋，国家队核心球员。',avatar:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',x:28,y:38},{id:'b',name:'苏菲',meta:'星辰俱乐部',intro:'中场，擅长组织进攻。',avatar:'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200',x:55,y:27},{id:'c',name:'艾米',meta:'海湾俱乐部',intro:'门将，反应敏捷。',avatar:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',x:73,y:57},{id:'d',name:'诺拉',meta:'国家队',intro:'边锋，速度出色。',avatar:'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',x:34,y:70}],edges:[{id:'e1',source:'a',target:'b',type:'friend',label:'好友'},{id:'e2',source:'a',target:'d',type:'nt',label:'国家队队友'},{id:'e3',source:'b',target:'c',type:'club',label:'俱乐部队友'}]};
let data=load(), selected=null, edgeMode=false, edgeStart=null, scale=1, pan={x:0,y:0}, dragging=null, movingCanvas=null;
function load(){try{const saved=localStorage.getItem(KEY);if(saved)return JSON.parse(saved)}catch(e){}try{const snapshot=document.getElementById('snapshot-data');if(snapshot)return JSON.parse(snapshot.textContent).data}catch(e){}return sample}
let storageDbPromise=null,localEditsSinceOpen=false,storageWarningShown=false;
function storageWarning(){if(!storageWarningShown){storageWarningShown=true;alert('浏览器未能保存图谱。请立即点击“导出数据”备份，避免刷新后丢失本次修改。')}}
function openStorageDb(){
  if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB unavailable'));
  if(!storageDbPromise)storageDbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('relationship-map-data',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('graphs');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return storageDbPromise;
}
function save(){
  localEditsSinceOpen=true;
  const snapshot=JSON.parse(JSON.stringify(data));
  return openStorageDb().then(db=>new Promise((resolve,reject)=>{
    const transaction=db.transaction('graphs','readwrite');
    transaction.objectStore('graphs').put(snapshot,KEY);
    transaction.oncomplete=resolve;
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  })).then(()=>true).catch(()=>{try{localStorage.setItem(KEY,JSON.stringify(snapshot));return true}catch(error){storageWarning();return false}});
}
function restoreFromStorage(){
  return openStorageDb().then(db=>new Promise((resolve,reject)=>{
    const request=db.transaction('graphs','readonly').objectStore('graphs').get(KEY);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  })).then(stored=>{
    if(!stored||localEditsSinceOpen||!Array.isArray(stored.nodes)||!Array.isArray(stored.edges))return;
    data=stored;selected=null;render();scheduleCanvasGeometryUpdate();
  }).catch(()=>{});
}
function uid(p){return p+Math.random().toString(36).slice(2,8)}
function render(){renderEdges();renderNodes();renderEditor();renderLegend()}
// Legacy percentages are interpreted against one fixed reference canvas.
// Resizing changes the camera, never the manually arranged graph geometry.
const WORLD_WIDTH=1196,WORLD_HEIGHT=761;
function pos(n){return {x:n.x/100*WORLD_WIDTH,y:n.y/100*WORLD_HEIGHT}}
function renderNodes(){nodes.innerHTML='';data.nodes.forEach(n=>{let el=document.createElement('div');el.className='node'+(selected===n.id?' selected':'');let p=pos(n);el.style.left=p.x*scale+pan.x+'px';el.style.top=p.y*scale+pan.y+'px';el.dataset.id=n.id;el.innerHTML=`<img class="avatar" src="${n.avatar||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23263657%22/%3E%3Ctext x=%2232%22 y=%2238%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2228%22%3E人%3C/text%3E%3C/svg%3E'}"/><div class="node-name">${esc(n.name||'未命名')}</div><div class="node-meta">${esc(n.meta||'')}</div>`;el.onpointerdown=e=>startNode(e,n);el.onclick=e=>{if(!dragging){selected=n.id;if(edgeMode){if(!edgeStart)edgeStart=n.id;else if(edgeStart!==n.id){addRelation(edgeStart,n.id);edgeStart=null;edgeMode=false}}else openDrawer(n);render()}};nodes.appendChild(el)})}
function renderEdges(){let s=edges,w=stage.clientWidth,h=stage.clientHeight;s.setAttribute('viewBox',`0 0 ${w} ${h}`);s.innerHTML='';data.edges.forEach(e=>{let a=data.nodes.find(n=>n.id===e.source),b=data.nodes.find(n=>n.id===e.target);if(!a||!b)return;let A=pos(a),B=pos(b),x1=A.x*scale+pan.x,y1=A.y*scale+pan.y,x2=B.x*scale+pan.x,y2=B.y*scale+pan.y;let same=data.edges.filter(x=>(x.source===e.source&&x.target===e.target)||(x.source===e.target&&x.target===e.source));let label=same.map(x=>x.label||types[x.type]||'关系').filter((v,i,a)=>a.indexOf(v)===i).join('&');let g=document.createElementNS('http://www.w3.org/2000/svg','g');g.innerHTML=`<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${relationColor(e)}"/><text class="edge-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-7}" text-anchor="middle">${esc(label)}</text>`;g.onclick=()=>showEdgeActions(e);s.appendChild(g)})}
function showEdgeActions(e){let mask=document.createElement('div');mask.style='position:fixed;inset:0;background:#0008;z-index:18;display:grid;place-items:center';mask.innerHTML='<div style="background:#11182c;border:1px solid #344466;border-radius:12px;padding:18px;color:#e9eefb;width:min(92vw,360px)"><h2 style="margin:0 0 14px">关系操作</h2><div style="display:flex;flex-direction:column;gap:9px"><button class="btn primary" id="edgeEdit">编辑关系</button><button class="btn danger" id="edgeDelete">删除关系</button><button class="btn" id="edgeCancel">取消</button></div></div>';document.body.appendChild(mask);mask.querySelector('#edgeCancel').onclick=()=>mask.remove();mask.querySelector('#edgeDelete').onclick=()=>{data.edges=data.edges.filter(x=>x.id!==e.id);save();mask.remove();render()};mask.querySelector('#edgeEdit').onclick=()=>{mask.remove();editEdge(e)}}
function editEdge(e){let mask=document.createElement('div');mask.style='position:fixed;inset:0;background:#000b;z-index:19;display:grid;place-items:center;padding:16px';let pair=data.edges.filter(x=>(x.source===e.source&&x.target===e.target)||(x.source===e.target&&x.target===e.source));mask.innerHTML='<div style="background:#11182c;border:1px solid #344466;border-radius:12px;padding:18px;color:#e9eefb;width:min(92vw,420px)"><h2 style="margin:0 0 8px">编辑关系</h2><div style="color:#91a0bf;font-size:12px;margin-bottom:10px">点击关系名称即可勾选或取消，右侧会显示勾选标记。</div><div id="editChoices" style="display:flex;flex-direction:column;gap:7px;max-height:300px;overflow:auto">'+Object.entries(types).map(([k,v])=>{let old=pair.find(x=>x.type===k);return '<label style="display:flex;align-items:center;gap:9px;padding:9px;border:1px solid #30405f;border-radius:7px;cursor:pointer"><input type="checkbox" value="'+k+'" '+(old?'checked':'')+'><span>'+v+'</span><span style="margin-left:auto;color:#70a7ff;font-size:18px">✓</span></label>'}).join('')+'</div><input id="editCustom" placeholder="其他关系名称" style="display:none;width:100%;margin-top:8px;background:#0c1427;color:#e9eefb;border:1px solid #30405f;border-radius:7px;padding:8px"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="editCancel">取消</button><button class="btn primary" id="editOk">保存修改</button></div></div>';document.body.appendChild(mask);let choices=mask.querySelector('#editChoices'),custom=mask.querySelector('#editCustom');choices.querySelectorAll('input').forEach(c=>c.onchange=()=>{custom.style.display=choices.querySelector('input[value="other"]').checked?'block':'none'});custom.value=(pair.find(x=>x.type==='other')||{}).label||'';custom.style.display=choices.querySelector('input[value="other"]').checked?'block':'none';mask.querySelector('#editCancel').onclick=()=>mask.remove();mask.querySelector('#editOk').onclick=()=>{let chosen=[...choices.querySelectorAll('input:checked')].map(x=>x.value);if(!chosen.length){alert('请至少选择一种关系');return}if(chosen.includes('other')&&!custom.value.trim()){alert('请填写自定义关系');return}data.edges=data.edges.filter(x=>!pair.includes(x));chosen.forEach(t=>data.edges.push({id:uid('e'),source:e.source,target:e.target,type:t,label:t==='other'?custom.value.trim():types[t]}));save();mask.remove();render()}}
function renderEditor(){let n=data.nodes.find(x=>x.id===selected);if(!n){editor.innerHTML='<div class="empty">点击“添加人物”开始，或点击画布中的人物编辑</div>';return}editor.innerHTML=`<div class="field"><label>姓名</label><input id="fName" value="${attr(n.name)}"></div><div class="field"><label>头像 URL（可选）</label><input id="fAvatar" value="${attr(n.avatar||'')}"></div><div class="field"><label>身份 / 俱乐部</label><input id="fMeta" value="${attr(n.meta||'')}"></div><div class="field"><label>人物简介</label><textarea id="fIntro">${esc(n.intro||'')}</textarea></div><div class="row"><button class="btn primary" id="saveNode">保存人物</button><button class="btn danger" id="deleteNode">删除人物</button></div><div class="section"><h2>相关关系</h2><div id="nodeRels"></div></div>`;editor.querySelector('#saveNode').onclick=()=>{n.name=editor.querySelector('#fName').value;n.avatar=editor.querySelector('#fAvatar').value;n.meta=editor.querySelector('#fMeta').value;n.intro=editor.querySelector('#fIntro').value;save();render();openDrawer(n)};editor.querySelector('#deleteNode').onclick=()=>{if(confirm('删除人物及其所有关系？')){data.nodes=data.nodes.filter(x=>x.id!==n.id);data.edges=data.edges.filter(e=>e.source!==n.id&&e.target!==n.id);selected=null;save();render();closeDrawer()}};let rels=data.edges.filter(e=>e.source===n.id||e.target===n.id);nodeRels.innerHTML=rels.length?rels.map(e=>{let other=data.nodes.find(x=>x.id===(e.source===n.id?e.target:e.source));return `<div class="rel" data-e="${e.id}"><b>${esc(other?.name||'未知')}</b> · <span style="color:${colors[e.type]}">${esc(e.label||types[e.type])}</span><br><small>点击删除关系</small></div>`}).join(''):'<div class="sub">暂无关系</div>';nodeRels.querySelectorAll('.rel').forEach(x=>x.onclick=()=>{data.edges=data.edges.filter(e=>e.id!==x.dataset.e);save();render()})}
function renderLegend(){legend.innerHTML=Object.keys(types).map(k=>`<div class="tag"><i class="dot" style="background:${colors[k]}"></i>${types[k]}</div>`).join('')}
function openDrawer(n){drawer.classList.add('open');let rels=data.edges.filter(e=>e.source===n.id||e.target===n.id);profile.innerHTML=`<div class="profile"><img src="${n.avatar||''}" onerror="this.style.display='none'"><h2>${esc(n.name)}</h2><p>${esc(n.meta||'')}</p></div><p>${esc(n.intro||'暂无简介')}</p><div class="section"><h2>关系</h2>${rels.length?rels.map(e=>{let o=data.nodes.find(x=>x.id===(e.source===n.id?e.target:e.source));return `<div class="rel"><b>${esc(o?.name||'未知')}</b><br><span style="color:${colors[e.type]}">${esc(e.label||types[e.type])}</span></div>`}).join(''):'<div class="sub">暂无关系</div>'}</div>`}
function hideDrawer(){document.getElementById('drawer').classList.remove('open');selected=null;render()}
function addRelation(a,b){
  const mask=document.createElement('div');
  mask.style='position:fixed;inset:0;background:#000b;z-index:15;display:grid;place-items:center;padding:16px';
  mask.innerHTML='<div style="background:#11182c;border:1px solid #344466;border-radius:12px;padding:18px;color:#e9eefb;width:min(92vw,420px)"><h2 style="margin:0 0 8px">选择关系</h2><div style="color:#91a0bf;font-size:12px;margin-bottom:10px">按住 Ctrl 或 Cmd 可选多个关系</div><select id="relationSelect" multiple size="7" style="width:100%;background:#0c1427;color:#e9eefb;border:1px solid #30405f;border-radius:7px;padding:8px"><option value="ex">前任</option><option value="cur">现任</option><option value="nt">国家队队友</option><option value="club">俱乐部队友</option><option value="friend">好友</option><option value="family">家人</option><option value="other">其他</option></select><input id="customRelation" placeholder="选择“其他”后填写自定义关系" style="display:none;width:100%;margin-top:8px;background:#0c1427;color:#e9eefb;border:1px solid #30405f;border-radius:7px;padding:8px"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="relationCancel">取消</button><button class="btn primary" id="relationOk">确认添加</button></div></div>';
  document.body.appendChild(mask);
  const select=mask.querySelector('#relationSelect'),custom=mask.querySelector('#customRelation'),confirmButton=mask.querySelector('#relationOk');
  select.onchange=()=>{custom.style.display=[...select.selectedOptions].some(o=>o.value==='other')?'block':'none'};
  mask.querySelector('#relationCancel').onclick=()=>mask.remove();
  confirmButton.onclick=()=>{
    const selectedTypes=[...select.selectedOptions].map(o=>o.value);
    if(!selectedTypes.length){alert('请至少选择一种关系');return}
    if(selectedTypes.includes('other')&&!custom.value.trim()){alert('请填写自定义关系');return}
    if(!data.nodes.some(n=>n.id===a)||!data.nodes.some(n=>n.id===b)){alert('人物已发生变化，请重新选择关系两端');mask.remove();return}
    confirmButton.disabled=true;
    const added=selectedTypes.map(t=>({id:uid('e'),source:a,target:b,type:t,label:t==='other'?custom.value.trim():types[t]}));
    try{
      data.edges.push(...added);
      save();
      mask.remove();render();
    }catch(error){data.edges=data.edges.filter(e=>!added.includes(e));confirmButton.disabled=false;alert('添加关系失败：'+(error.message||error))}
  };
}
let cancelNodeDrag=null;
function startNode(e,n){
  if(e.button!==0||e.isPrimary===false)return;
  e.stopPropagation();dragging=false;
  const el=e.currentTarget,id=e.pointerId,startX=e.clientX,startY=e.clientY,ox=n.x,oy=n.y;
  const move=ev=>{if(ev.pointerId!==id)return;if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>4)dragging=true;if(!dragging)return;n.x=ox+(ev.clientX-startX)/WORLD_WIDTH*100/scale;n.y=oy+(ev.clientY-startY)/WORLD_HEIGHT*100/scale;const p=pos(n);el.style.left=p.x*scale+pan.x+'px';el.style.top=p.y*scale+pan.y+'px';edges.style.visibility='hidden'};
  const up=ev=>{if(ev&&ev.pointerId!==id)return;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);cancelNodeDrag=null;edges.style.visibility='visible';if(dragging){save();render()}};
  cancelNodeDrag=()=>up();window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
}
 const MIN_ZOOM=.001,MAX_ZOOM=2.2;
 function zoomAt(factor,anchorX,anchorY){
   const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,scale*factor));
   if(next===scale)return;
   pan.x=anchorX-(anchorX-pan.x)*next/scale;
   pan.y=anchorY-(anchorY-pan.y)*next/scale;
   scale=next;
   render();
 }
 stage.onwheel=e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoomAt(e.deltaY<0?1.1:.9,e.clientX-r.left,e.clientY-r.top)};stage.onpointerdown=e=>{if(e.target!==stage&&e.target!==edges)return;movingCanvas={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};stage.classList.add('dragging');e.preventDefault()};window.onpointermove=e=>{if(movingCanvas){pan.x=movingCanvas.px+e.clientX-movingCanvas.x;pan.y=movingCanvas.py+e.clientY-movingCanvas.y;render()}};window.onpointerup=()=>{movingCanvas=null;stage.classList.remove('dragging')};
 addNode.onclick=()=>{let n={id:uid('n'),name:'新人物',meta:'',intro:'',avatar:'',x:(stage.clientWidth/2-pan.x)/scale/WORLD_WIDTH*100,y:(stage.clientHeight/2-pan.y)/scale/WORLD_HEIGHT*100};data.nodes.push(n);selected=n.id;save();render()};addEdge.onclick=()=>{edgeMode=true;edgeStart=null;alert('请依次点击关系两端的人物节点')};document.getElementById('closeDrawer').onclick=hideDrawer;zoomIn.onclick=()=>zoomAt(1.2,stage.clientWidth/2,stage.clientHeight/2);zoomOut.onclick=()=>zoomAt(1/1.2,stage.clientWidth/2,stage.clientHeight/2);zoomFit.onclick=()=>{scale=1;pan={x:0,y:0};render()};clearBtn.onclick=()=>{if(confirm('清空全部人物和关系？')){data={nodes:[],edges:[]};selected=null;save();render()}};
exportHtml.onclick=()=>{let blob=new Blob(['<!doctype html>\n'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});download(blob,'人物关系图谱.html')};exportPng.onclick=async()=>{let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${stage.clientWidth}" height="${stage.clientHeight}"><rect width="100%" height="100%" fill="#0b1020"/>${edges.innerHTML}</svg>`;let b=new Blob([svg],{type:'image/svg+xml'});download(b,'人物关系图谱.svg')};function download(b,n){let a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function attr(v){return esc(v).replace(/`/g,'&#96;')}
