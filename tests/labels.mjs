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
vm.runInContext(source.slice(source.indexOf('function authorWatermarkLayout('),source.indexOf('exportPng.onclick=')),context);
for(const [width,height] of [[400,300],[4000,3000],[7521,6383]]){
 const calls=[];
 const ctx={save(){calls.push('save')},restore(){calls.push('restore')},setTransform(...args){calls.push(args)},fillText(...args){calls.push(args)}};
 context.drawAuthorWatermark(ctx,width,height);
 assert.equal(calls[0],'save');assert.deepEqual(calls[1],[1,0,0,1,0,0]);
 const {fontSize,padding}=context.authorWatermarkLayout(width,height);
 assert.equal(fontSize,2*Math.max(18,Math.round(Math.min(width,height)*.018)),'Watermark font is twice the previous size');
 assert.deepEqual(calls[2],['patri677原创',width-padding,height-padding]);assert.equal(calls[3],'restore');
 assert.equal(ctx.globalAlpha,.7);assert(ctx.font.startsWith('600 '+fontSize+'px'));
 calls.length=0;context.drawAuthorWatermark(ctx,width,height,height-70);
 assert.deepEqual(calls[2],['patri677原创',width-padding,height-70],'Watermark bottom follows the lowest node instead of the canvas edge');
 if(width===7521)assert(fontSize>=110,'Full-size chart needs a legible proportional watermark');
}
assert(source.indexOf('drawAuthorWatermark(ctx,c.width,c.height,watermarkBottom)')<source.indexOf('c.toBlob('),'Watermark is painted before PNG encoding');
assert(source.includes('c.height=Math.ceil(h*ratio);'),'No extra watermark footer is added');
console.log('PASS: proportional watermark supports bottom alignment with the lowest node.');
let watermarkElement=null;
const watermarkContext=vm.createContext({document:{getElementById:()=>watermarkElement,createElement:()=>({}),querySelector:()=>({appendChild:el=>{watermarkElement=el}})}});
const watermarkInit=source.slice(source.indexOf("if(!document.getElementById('authorWatermark'))"),source.indexOf('// 缩放整个节点'));
vm.runInContext(watermarkInit,watermarkContext);
assert.equal(watermarkElement.textContent,'patri677原创');
const firstWatermark=watermarkElement;vm.runInContext(watermarkInit,watermarkContext);
assert.equal(watermarkElement,firstWatermark,'Reopened HTML must not duplicate the saved watermark');
console.log('PASS: HTML watermark is created in the app and reused when reopening saved HTML.');
