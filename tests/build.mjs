import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('src/manifest.json'));
const graph=JSON.parse(read('data/人物关系图谱-爱心图.json')).data;
const snapshot=html=>{
  const match=html.match(/<script\b(?=[^>]*id="snapshot-data")([^>]*)>([\s\S]*?)<\/script>/);
  assert(match,'Standalone page must contain graph data');
  return {data:JSON.parse(match[2]).data,key:match[1].match(/data-storage-key="([^"]+)"/)[1]};
};
for(const path of ['index.html','dist/index.html']){
 const html=read(path),saved=snapshot(html);
 assert.deepEqual(saved.data,graph,'Build must retain every person, relationship, avatar and coordinate');
 const scripts=[...html.matchAll(/<script data-source="([^"]+)">\n([\s\S]*?)\n<\/script>/g)];
 assert.deepEqual(scripts.map(m=>m[1]),manifest.scripts,'Feature scripts must load in declared order');
 scripts.forEach(m=>new vm.Script(m[2],{filename:m[1]}));
 assert(!/<script[^>]+\bsrc=/.test(html),'Saved page must not depend on external script files');
 assert(!html.includes('<!-- APP_'),'All build placeholders must be resolved');
 assert(!html.includes('id="demoBtn"'),'Removed sample button must not reappear');
 assert.equal(scripts.at(-1)[1],'bootstrap.js','Initialization must happen after all feature definitions');
 if(path==='index.html')assert.equal(saved.key,manifest.localStorageKey,'Local browser storage key must be preserved');
 else assert.match(saved.key,/^relationship-map-[a-f0-9]{12}$/);
}
const normalize=html=>html.replace(/data-storage-key="[^"]+"/,'data-storage-key="KEY"');
assert.equal(normalize(read('index.html')),normalize(read('dist/index.html')),'Local and deployed builds must contain identical code and graph data');
console.log(`PASS: standalone local and deploy builds preserve ${graph.nodes.length} people, ${graph.edges.length} relationships, all coordinates, storage keys and feature load order.`);
