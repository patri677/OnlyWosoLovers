// 关系标签按具体语义着色；旧数据的 type 即使是“其他”，也会根据 label 正确归类。
Object.assign(types,{engaged:'现任（订婚）',curQuestion:'现任？',exQuestion:'前任？'});
Object.assign(colors,{engaged:'#a78bfa',curQuestion:'#f59e0b',exQuestion:'#38bdf8'});
function relationKeyList(edge){
  return WosoGraph.relationKeys(edge);
}
function relationColor(edge){
  const label=String(edge.label||'').normalize('NFKC').replace(/[\s]/g,'');
  if(/现任[（(]已婚[）)]/.test(label))return colors.married;
  if(/现任[（(]订婚[）)]/.test(label))return colors.engaged;
  if(/前任[?？]/.test(label))return colors.exQuestion;
  if(/现任[?？]/.test(label))return colors.curQuestion;
  const key=relationKeyList(edge)[0];return colors[key]||colors[edge.type]||colors.other;
}
function personFacets(person){
  return WosoGraph.personFacets(person);
}
function ensureFilterState(){
  activeFilters=WosoGraph.normalizeFilters(activeFilters);
}
ensureFilterState();
function cloneStructuredFilters(value){return value?{relations:[...value.relations],clubs:[...value.clubs],countries:[...value.countries]}:{relations:[],clubs:[],countries:[]}}
let draftFilterState=cloneStructuredFilters(activeFilters);
function hasStructuredFilters(){return !!activeFilters&&(activeFilters.relations.length>0||activeFilters.clubs.length>0||activeFilters.countries.length>0)}
function structuredRelationMatch(edge){return WosoGraph.relationMatches(edge,activeFilters)}
function structuredPersonMatch(person){
  return WosoGraph.personMatches(person,activeFilters);
}
function structuredEdgeMatch(edge){
  return WosoGraph.edgeMatches(edge,data.nodes,activeFilters);
}
// 三个独立下拉菜单：俱乐部、国家/地区、关系；各菜单多选且可同时生效。
const dropdownFilterBar=document.createElement('div');dropdownFilterBar.className='filter-dropdown-bar';
const dropdownFilterDefs=[['clubs','俱乐部'],['countries','国家'],['relations','关系']];
dropdownFilterDefs.forEach(([key,title])=>{
  const wrap=document.createElement('div');wrap.className='filter-dropdown';wrap.dataset.filterKey=key;
  wrap.innerHTML=`<button class="btn filter-dropdown-trigger" type="button" aria-expanded="false">${title} ▾</button><div class="filter-dropdown-menu" hidden></div>`;
  dropdownFilterBar.appendChild(wrap);
});
searchWrap.after(dropdownFilterBar);
const dropdownStyles=document.createElement('style');dropdownStyles.textContent='.filter-dropdown-bar{display:flex;gap:7px;align-items:center}.filter-dropdown{position:relative}.filter-dropdown-trigger{white-space:nowrap}.filter-dropdown-trigger[aria-expanded="true"],.filter-dropdown-trigger.has-selection{border-color:#70a7ff;color:#dbeafe}.filter-dropdown-menu{position:absolute;z-index:12;top:calc(100% + 7px);left:0;width:min(320px,82vw);max-height:min(70vh,420px);overflow:auto;background:#11182c;border:1px solid #53688f;border-radius:10px;padding:9px;box-shadow:0 15px 35px #0009}.filter-dropdown-menu[hidden]{display:none}.filter-dropdown-search{width:100%;background:#0c1427;border:1px solid #30405f;color:#e9eefb;border-radius:7px;padding:8px;margin:0 0 7px;outline:none}.filter-dropdown-all,.filter-dropdown-clear{width:100%;text-align:left;background:#18223a;color:#e9eefb;border:0;border-radius:6px;padding:8px;margin-bottom:5px;cursor:pointer}.filter-dropdown-clear{color:#91a0bf}.filter-dropdown-option{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;cursor:pointer}.filter-dropdown-option:hover{background:#1a2743}.filter-dropdown-option input{accent-color:#635bff;width:16px;height:16px}.filter-dropdown-option .filter-check{visibility:hidden;margin-left:auto;color:#70a7ff}.filter-dropdown-option input:checked~.filter-check{visibility:visible}.filter-dropdown-empty{padding:8px;color:#91a0bf;font-size:12px}.filter-dropdown-actions{position:sticky;bottom:-9px;display:flex;justify-content:flex-end;gap:8px;padding:9px 0 0;margin-top:7px;background:#11182c;border-top:1px solid #30405f}.filter-dropdown-actions .btn{min-width:68px}@media(max-width:900px){.filter-dropdown-bar{gap:4px}.filter-dropdown-trigger{padding:7px 8px;font-size:12px}}';document.head.appendChild(dropdownStyles);
function selectedFilterValues(key){return draftFilterState?.[key]||[]}
function optionsForFilter(key){
  const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  if(key==='relations')return Object.entries(types);
  if(key==='countries')return unique(data.nodes.map(n=>personFacets(n).country)).map(value=>[value,value]);
  return unique(data.nodes.map(n=>personFacets(n).club)).map(value=>[value,value]);
}
function refreshDropdownFilters(){
  dropdownFilterBar.querySelectorAll('.filter-dropdown').forEach(wrap=>{
    const key=wrap.dataset.filterKey,title=dropdownFilterDefs.find(x=>x[0]===key)[1],menu=wrap.querySelector('.filter-dropdown-menu'),button=wrap.querySelector('.filter-dropdown-trigger');
    const wasOpen=!menu.hidden,searchValue=menu.querySelector('.filter-dropdown-search')?.value||'',chosen=selectedFilterValues(key),options=optionsForFilter(key);
    button.textContent=`${title}${chosen.length?` (${chosen.length})`:''} ▾`;button.classList.toggle('has-selection',chosen.length>0);button.setAttribute('aria-expanded',String(wasOpen));
    menu.replaceChildren();
    const search=document.createElement('input');search.className='filter-dropdown-search';search.type='search';search.placeholder=`搜索${title}…`;search.value=searchValue;menu.appendChild(search);
    const all=document.createElement('button');all.className='filter-dropdown-all';all.type='button';all.textContent=`${chosen.length?'☐':'☑'} 全部球员`;all.onclick=()=>changeDropdownFilter(key,[]);menu.appendChild(all);
    const clear=document.createElement('button');clear.className='filter-dropdown-clear';clear.type='button';clear.textContent=`清除此${title}筛选`;clear.onclick=()=>changeDropdownFilter(key,[]);menu.appendChild(clear);
    const list=document.createElement('div');list.className='filter-dropdown-options';menu.appendChild(list);
    if(!options.length){const empty=document.createElement('div');empty.className='filter-dropdown-empty';empty.textContent=`图谱中暂无${title}选项`;list.appendChild(empty)}
    options.forEach(([value,label])=>{
      const row=document.createElement('label');row.className='filter-dropdown-option';row.dataset.search=String(label).toLocaleLowerCase();
      const input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=chosen.includes(value);input.onchange=()=>{
        const next=[...selectedFilterValues(key)];if(input.checked&&!next.includes(value))next.push(value);if(!input.checked){const index=next.indexOf(value);if(index>=0)next.splice(index,1)}changeDropdownFilter(key,next);
      };
      const text=document.createElement('span');text.textContent=label;const check=document.createElement('span');check.className='filter-check';check.textContent='✓';row.append(input,text,check);list.appendChild(row);
    });
    const actions=document.createElement('div');actions.className='filter-dropdown-actions';
    const cancel=document.createElement('button');cancel.className='btn';cancel.type='button';cancel.textContent='取消';cancel.onclick=cancelDropdownFilters;
    const apply=document.createElement('button');apply.className='btn primary';apply.type='button';apply.textContent='确定';apply.onclick=applyDropdownFilters;actions.append(cancel,apply);menu.appendChild(actions);
    search.oninput=()=>{const term=search.value.trim().toLocaleLowerCase();list.querySelectorAll('.filter-dropdown-option').forEach(row=>row.hidden=!row.dataset.search.includes(term))};
    search.oninput();menu.hidden=!wasOpen;
  });
}
function changeDropdownFilter(key,values){
  draftFilterState[key]=values;refreshDropdownFilters();
}
function closeDropdownMenus(){dropdownFilterBar.querySelectorAll('.filter-dropdown-menu').forEach(menu=>{menu.hidden=true;menu.parentElement.querySelector('.filter-dropdown-trigger').setAttribute('aria-expanded','false')})}
function applyDropdownFilters(){
  activeFilters=cloneStructuredFilters(draftFilterState);
  if(!activeFilters.relations.length&&!activeFilters.clubs.length&&!activeFilters.countries.length)activeFilters=null;
  draftFilterState=cloneStructuredFilters(activeFilters);focusId=null;searchInput.value='';closeDropdownMenus();render();
  if(hasStructuredFilters()&&!viewNodeIds().size)alert('没有找到符合条件的人物或关系，请调整筛选条件。');
}
function cancelDropdownFilters(){draftFilterState=cloneStructuredFilters(activeFilters);closeDropdownMenus();refreshDropdownFilters()}
dropdownFilterBar.querySelectorAll('.filter-dropdown').forEach(wrap=>wrap.querySelector('.filter-dropdown-trigger').onclick=()=>{
  const menu=wrap.querySelector('.filter-dropdown-menu'),open=menu.hidden;
  dropdownFilterBar.querySelectorAll('.filter-dropdown-menu').forEach(other=>other.hidden=true);
  if(open){menu.hidden=false;wrap.querySelector('.filter-dropdown-trigger').setAttribute('aria-expanded','true')}
  refreshDropdownFilters();
});
const clearFiltersButton=document.createElement('button');clearFiltersButton.className='btn';clearFiltersButton.type='button';clearFiltersButton.textContent='清除筛选';clearFiltersButton.title='清除俱乐部、国家和关系筛选，恢复完整图谱';clearFiltersButton.onclick=()=>{activeFilters=null;draftFilterState=cloneStructuredFilters(null);focusId=null;searchInput.value='';closeDropdownMenus();render()};dropdownFilterBar.after(clearFiltersButton);
document.addEventListener('pointerdown',event=>{if(!dropdownFilterBar.contains(event.target))cancelDropdownFilters()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dropdownFilterBar.querySelector('.filter-dropdown-menu:not([hidden])'))cancelDropdownFilters()});
function viewEdges(){return data.edges.filter(e=>structuredEdgeMatch(e)&&(!focusId||e.source===focusId||e.target===focusId))}
function viewNodeIds(){
  if(!hasStructuredFilters()&&!focusId)return new Set(data.nodes.map(n=>n.id));
  const ids=new Set();if(focusId)ids.add(focusId);
  viewEdges().forEach(e=>{ids.add(e.source);ids.add(e.target)});
  if(hasStructuredFilters()&&!activeFilters.relations.length)data.nodes.filter(structuredPersonMatch).forEach(n=>ids.add(n.id));
  return ids;
}
visibleNodesForExport=n=>viewNodeIds().has(n.id);
const previousStructuredRender=render;
render=()=>{previousStructuredRender();applyCurrentView();refreshDropdownFilters()};
renderLegend=()=>{legend.innerHTML=Object.keys(types).map(k=>`<div class="tag"><i class="dot" style="background:${colors[k]||colors.other}"></i>${types[k]}</div>`).join('')};
// 给人物编辑器增加明确的国家和俱乐部字段；旧资料仍可由“国家/俱乐部”自动解析。
function enrichPersonEditor(){
  const n=data.nodes.find(x=>x.id===selected),meta=editor.querySelector('#fMeta'),saveButton=editor.querySelector('#saveNode');
  if(!n||!meta||!saveButton||editor.querySelector('#filterCountryField'))return;
  const facets=personFacets(n),fields=document.createElement('div');
  fields.innerHTML='<div class="field" id="filterCountryField"><label>国家 / 地区（筛选用）</label><input id="fCountry" placeholder="例如：英格兰"></div><div class="field" id="filterClubField"><label>俱乐部（筛选用）</label><input id="fClub" placeholder="例如：切尔西"></div>';
  meta.parentElement.after(fields);fields.querySelector('#fCountry').value=facets.country;fields.querySelector('#fClub').value=facets.club;
  const original=saveButton.onclick;
  saveButton.onclick=()=>{n.country=fields.querySelector('#fCountry').value.trim();n.club=fields.querySelector('#fClub').value.trim();original()};
}
const structuredEditorObserver=new MutationObserver(enrichPersonEditor);structuredEditorObserver.observe(editor,{childList:true,subtree:true});enrichPersonEditor();
function addStructuredRelationOptions(){
  const select=document.getElementById('relationSelect');if(!select)return;
  for(const key of ['engaged','curQuestion','exQuestion'])if(!select.querySelector(`[value="${key}"]`)){const option=document.createElement('option');option.value=key;option.textContent=types[key];select.appendChild(option)}
}
new MutationObserver(addStructuredRelationOptions).observe(document.body,{childList:true,subtree:true});addStructuredRelationOptions();
// 新版导出的独立 HTML 继续保留全部筛选条件；旧版数组格式也可正常读取。
const structuredSnapshot=document.getElementById('snapshot-data');
if(structuredSnapshot){try{const saved=JSON.parse(structuredSnapshot.textContent).view||{};if(saved.filters&&typeof saved.filters==='object'&&!Array.isArray(saved.filters))activeFilters=saved.filters;ensureFilterState();draftFilterState=cloneStructuredFilters(activeFilters)}catch{}}
const exportHtmlWithFilters=exportHtml.onclick;
exportHtml.onclick=()=>exportHtmlWithFilters();
