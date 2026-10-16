import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),source=read('src/view-export-layout.js');
const compiled=html.match(/<script data-source="graph-domain.ts">\n([\s\S]*?)\n<\/script>/)[1];
const label={style:{display:''},attributes:{},textContent:'好友',setAttribute(k,v){this.attributes[k]=Number(v)},getBBox(){return {x:this.attributes.x-20,y:this.attributes.y-10,width:40,height:12}}};
const line={attributes:{},getAttribute(k){return this.attributes[k]}};
let title=null,obstacles=[];
const group={style:{},querySelector:s=>s==='.edge-label'?label:s==='.edge'?line:title,appendChild:el=>title=el};
const context=vm.createContext({
 scale:1,stage:{getBoundingClientRect:()=>({left:0,top:0})},
 nodes:{querySelectorAll:()=>obstacles.map(rect=>({style:{},getBoundingClientRect:()=>rect}))},
 edges:{querySelectorAll:()=>[group]},document:{createElementNS:()=>({})},
});
vm.runInContext(compiled,context);
vm.runInContext(source.slice(source.indexOf('function placeRelationshipLabels()'),source.indexOf('const renderBeforeLabelPlacement=')),context);
for(const scale of [.1,.3,.7,1,2.2,.3]){
 context.scale=scale;
 const pan={x:125,y:-40};
 line.attributes={x1:20*scale+pan.x,y1:100*scale+pan.y,x2:420*scale+pan.x,y2:300*scale+pan.y};
 const midpoint={x:220*scale+pan.x,y:200*scale+pan.y};
 for(const crowded of [true,false]){
  obstacles=crowded?[{left:midpoint.x-45,right:midpoint.x+45,top:midpoint.y-30,bottom:midpoint.y+30}]:[];
  // The real view pass resets visibility before placing labels at each scale.
  label.style.display='';context.placeRelationshipLabels();
  assert(Math.abs(label.attributes.x-midpoint.x)<1e-8,'Zoom/collision must not move a label to another part of the line');
  assert(Math.abs(label.attributes.y-(midpoint.y-7*Math.min(1,2*scale)))<1e-8);
  assert.equal(label.style.display==='none',crowded,'Crowding changes visibility, never anchor position');
 }
}
assert(title?.textContent==='好友','Crowded labels retain the relationship tooltip');
const position=context.WosoGraph.relationshipLabelPosition;
assert.equal(position(0,0,100,100).x,position(100,100,0,0).x,'Reversing endpoints preserves the midpoint');
assert(source.slice(source.indexOf('exportPng.onclick=')).includes('WosoGraph.relationshipLabelPosition(line.x1,line.y1,line.x2,line.y2)'),'PNG output must share the fixed midpoint rule');
console.log('PASS: relationship labels retain the same midpoint through six zoom levels, collision changes and reverse endpoints; PNG shares the same anchor.');
