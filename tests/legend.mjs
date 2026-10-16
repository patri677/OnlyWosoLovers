import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('src/legend-filters.js'),filters=read('src/filters.js');
const types={ex:'前任',cur:'现任',friend:'好友'},colors={ex:'red',cur:'pink',friend:'gold'};
const buttons=Object.keys(types).map(key=>({dataset:{relation:key},attrs:{},style:{setProperty(k,v){this[k]=v}},dot:{style:{}},name:{},setAttribute(k,v){this.attrs[k]=v},querySelector(s){return s==='.dot'?this.dot:this.name}}));
const title={},all={setAttribute(k,v){this[k]=v}};
let renders=0,alerts=0;
const c=vm.createContext({types,colors,activeFilters:null,draftFilterState:null,focusId:'selected',searchInput:{value:'abc'},
 relationLegendElement:{querySelectorAll:()=>buttons},relationPalette:{querySelector:s=>s==='#relationPaletteTitle'?title:all},
 closeDropdownMenus(){},render(){renders++},hasStructuredFilters(){return !!c.activeFilters},viewNodeIds(){return new Set(['one'])},alert(){alerts++}});
vm.runInContext(filters.match(/function cloneStructuredFilters\(value\)\{[^\n]+/)[0],c);
vm.runInContext(filters.slice(filters.indexOf('function applyDropdownFilters()'),filters.indexOf('function cancelDropdownFilters()')),c);
vm.runInContext(source.slice(source.indexOf('function toggleLegendRelation('),source.indexOf("relationLegendElement.addEventListener")),c);
vm.runInContext(source.slice(source.indexOf('renderLegend=()=>')),c);
c.activeFilters={relations:[],clubs:['阿森纳'],countries:['英格兰']};
c.toggleLegendRelation('cur');c.toggleLegendRelation('ex');c.renderLegend();
assert.deepEqual(Array.from(c.activeFilters.relations),['cur','ex']);
assert.deepEqual(Array.from(c.activeFilters.clubs),['阿森纳']);
assert.deepEqual(Array.from(c.activeFilters.countries),['英格兰']);
assert.equal(buttons[0].attrs['aria-pressed'],'true');
assert.equal(buttons[2].attrs['aria-pressed'],'false');
assert.equal(buttons[1].dot.style.background,'pink');
assert(title.textContent.includes('2'));
c.toggleLegendRelation('cur');assert.deepEqual(Array.from(c.activeFilters.relations),['ex']);
c.toggleLegendRelation(null);c.renderLegend();assert.equal(all['aria-pressed'],'true');
assert.equal(c.activeFilters.clubs[0],'阿森纳','All relationships retains club filter');
c.draftFilterState={relations:['friend'],clubs:[],countries:[]};c.applyDropdownFilters();c.renderLegend();
assert.equal(buttons[2].attrs['aria-pressed'],'true','Dropdown changes synchronize the legend');
c.toggleLegendRelation('friend');c.renderLegend();assert.equal(c.activeFilters,null);
const before=renders;c.toggleLegendRelation('invalid');assert.equal(renders,before);assert.equal(alerts,0);
console.log('Legend filters: multi-selection, dropdown synchronization, colors, and combined conditions passed.');
const layout=read('src/view-export-layout.js');
let collapsed=false,scheduled=0;
const panelContext=vm.createContext({data:{nodes:[{id:'a'},{id:'b'}]},selected:null,
 mainPanel:{classList:{contains:()=>collapsed,toggle:(name,value)=>{collapsed=value}}},
 sideToggle:{setAttribute(){}},sidePanel:{setAttribute(){}},scheduleCanvasGeometryUpdate(){scheduled++},renderEditor(){}});
vm.runInContext(layout.slice(layout.indexOf('function setSideOpen('),layout.indexOf('function setSideOpen(')+layout.slice(layout.indexOf('function setSideOpen(')).indexOf('\n};')+3),panelContext);
panelContext.renderEditor();assert(collapsed,'No selection hides the empty panel');
const count=scheduled;panelContext.renderEditor();assert.equal(scheduled,count,'Hidden panel must not schedule endless resize renders');
panelContext.selected='a';panelContext.renderEditor();assert(collapsed,'Selecting a person does not open the editor');
panelContext.setSideOpen(true);panelContext.renderEditor();assert(!collapsed,'Explicit editing opens the panel and survives renders');
panelContext.setSideOpen(false);panelContext.renderEditor();assert(collapsed,'Explicit close persists across renders');
panelContext.selected='b';panelContext.renderEditor();assert(collapsed,'Selecting another person returns to viewing mode');
panelContext.data.nodes=[];panelContext.renderEditor();assert(collapsed,'Deleting the selected person hides the editor');
console.log('Editor panel: selection, close, removal, and stable resize checks passed.');
