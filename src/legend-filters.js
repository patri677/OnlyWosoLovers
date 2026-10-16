// The legend uses the same applied filters as the relationship dropdown.
const relationLegendElement=document.getElementById('legend');
const oldLegendSection=relationLegendElement.closest('.section');
let relationPalette=document.getElementById('relationPalette');
if(!relationPalette){
  relationPalette=document.createElement('div');relationPalette.id='relationPalette';relationPalette.className='relation-palette';
  relationPalette.innerHTML='<span id="relationPaletteTitle" class="sr-only">关系筛选</span><button class="btn legend-all" type="button" title="清除关系筛选">全部</button>';
  document.querySelector('.stage-wrap').appendChild(relationPalette);
}
relationPalette.appendChild(relationLegendElement);
relationPalette.setAttribute('role','group');relationPalette.setAttribute('aria-label','关系颜色筛选，可多选');
oldLegendSection?.remove();
function toggleLegendRelation(key){
  const next=cloneStructuredFilters(activeFilters);
  if(key===null)next.relations=[];
  else if(Object.prototype.hasOwnProperty.call(types,key)){
    next.relations=next.relations.includes(key)?next.relations.filter(value=>value!==key):[...next.relations,key];
  }else return;
  // Palette clicks apply immediately. Pending dropdown edits are discarded,
  // while already applied club/country selections remain intact.
  draftFilterState=next;applyDropdownFilters();
}
relationLegendElement.addEventListener('click',event=>{
  const button=event.target.closest('button[data-relation]');
  if(button&&relationLegendElement.contains(button))toggleLegendRelation(button.dataset.relation);
});
relationPalette.querySelector('.legend-all').onclick=()=>toggleLegendRelation(null);
renderLegend=()=>{
  const chosen=activeFilters?.relations||[],keys=Object.keys(types);
  let buttons=[...relationLegendElement.querySelectorAll('button[data-relation]')];
  if(buttons.length!==keys.length||buttons.some((button,index)=>button.dataset.relation!==keys[index])){
    relationLegendElement.replaceChildren();buttons=keys.map(key=>{
      const button=document.createElement('button');button.type='button';button.className='legend-filter';button.dataset.relation=key;
      const dot=document.createElement('i');dot.className='dot';dot.setAttribute('aria-hidden','true');
      const name=document.createElement('span');name.className='legend-name';
      const check=document.createElement('span');check.className='legend-check';check.textContent='✓';check.setAttribute('aria-hidden','true');
      button.append(dot,name,check);relationLegendElement.appendChild(button);return button;
    });
  }
  buttons.forEach(button=>{
    const key=button.dataset.relation,selected=chosen.includes(key),color=colors[key]||colors.other;
    button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',types[key]);
    button.title=(selected?'取消筛选：':'筛选：')+types[key];button.style.setProperty('--relation-color',color);
    button.querySelector('.dot').style.background=color;button.querySelector('.legend-name').textContent=types[key];
  });
  relationPalette.querySelector('#relationPaletteTitle').textContent='关系图例 / 筛选'+(chosen.length?'（已选 '+chosen.length+'）':'');
  relationPalette.querySelector('.legend-all').setAttribute('aria-pressed',String(!chosen.length));
};
