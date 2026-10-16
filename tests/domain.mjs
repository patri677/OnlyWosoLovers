import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const compiled=html.match(/<script data-source="graph-domain.ts">\n([\s\S]*?)\n<\/script>/);
assert(compiled,'Standalone page must contain the compiled typed graph rules');
const context=vm.createContext({});
vm.runInContext(compiled[1],context);
const domain=context.WosoGraph;
const plain=value=>JSON.parse(JSON.stringify(value));
const person=(id,country,club)=>({id,name:id,meta:country+'/'+club,country,club,intro:'',avatar:'',x:12.5,y:-42});
const a=person('a','英格兰','阿森纳'),b=person('b','西班牙','切尔西'),c=person('c','苏格兰','阿森纳');
const edge={id:'e',source:'a',target:'b',type:'friend',label:'好友'};
const filters=(values={})=>({relations:[],clubs:[],countries:[],...values});
const graph={nodes:[a,b,c],edges:[edge]};
assert.deepEqual(plain(domain.validateGraph({format:'person-relationship-map',version:1,data:graph})),graph,'JSON round trip must retain explicit facets, negative coordinates and relationships');
assert.deepEqual(plain(domain.personFacets({...a,country:undefined,club:undefined,meta:'英格兰(C)/阿森纳（C）'})),{country:'英格兰',club:'阿森纳'});
assert(domain.personMatches(a,filters({clubs:['阿森纳','切尔西']})),'Multiple clubs use OR');
assert(domain.personMatches(b,filters({clubs:['阿森纳','切尔西']})));
assert(!domain.personMatches(a,filters({clubs:['阿森纳'],countries:['西班牙']})),'Club and country use AND on the same person');
assert(!domain.edgeMatches(edge,graph.nodes,filters({clubs:['阿森纳'],countries:['西班牙']})),'Different endpoints cannot separately satisfy country and club');
assert(domain.edgeMatches(edge,graph.nodes,filters({clubs:['阿森纳'],relations:['friend']})));
assert(!domain.edgeMatches(edge,graph.nodes,filters({clubs:['阿森纳'],relations:['ex']})));
for(const [label,key] of [['现任（已婚）','married'],['现任(订婚)','engaged'],['现任？','curQuestion'],['前任?','exQuestion']]){
 const relation={...edge,type:'other',label};
 assert(domain.relationMatches(relation,filters({relations:[key]})),`Specific category must match ${label}`);
 assert(domain.relationMatches(relation,filters({relations:[key==='exQuestion'?'ex':'cur']})),`Broad category must also match ${label}`);
}
assert(!domain.relationMatches({...edge,label:'前俱乐部队友'},filters({relations:['club']})),'Former club teammates must not become current teammates');
assert(domain.relationMatches({...edge,label:'国家队队友&俱乐部队友'},filters({relations:['nt']})));
assert(domain.relationMatches({...edge,label:'国家队队友&俱乐部队友'},filters({relations:['club']})));
assert.deepEqual(plain(domain.normalizeFilters(['cur','cur',7,null])),filters({relations:['cur']}),'Old saved filter arrays remain supported');
assert.equal(domain.normalizeFilters({clubs:[null,17]}),null);
for(const [input,error] of [
 [{...graph,nodes:[a,a]},/ID/],
 [{...graph,nodes:[{...a,x:Infinity},b,c]},/位置/],
 [{...graph,nodes:[{...a,club:12},b,c]},/club/],
 [{...graph,nodes:[{...a,avatar:'javascript:alert(1)'},b,c]},/头像/],
 [{...graph,edges:[edge,edge]},/ID/],
 [{...graph,edges:[{...edge,target:'missing'}]},/不存在/],
 [{format:'person-relationship-map',version:999,data:graph},/版本/],
 [{nodes:new Array(10001).fill(a),edges:[]},/数据量/],
])assert.throws(()=>domain.validateGraph(input),error);
// Exercise the actual page adapters, including counterpart visibility and glow.
context.activeFilters=filters({clubs:['阿森纳']});context.focusId=null;context.data=graph;
context.structuredEdgeMatch=e=>domain.edgeMatches(e,graph.nodes,context.activeFilters);
context.structuredPersonMatch=p=>domain.personMatches(p,context.activeFilters);
context.hasStructuredFilters=()=>!!domain.normalizeFilters(context.activeFilters);
const viewCode=read('src/filters.js');
vm.runInContext(viewCode.slice(viewCode.indexOf('function viewEdges()'),viewCode.indexOf('visibleNodesForExport=')),context);
const glowCode=read('src/view-export-layout.js');
vm.runInContext(glowCode.slice(glowCode.indexOf('function shouldGlowPerson('),glowCode.indexOf('function applyCurrentView(')),context);
assert(context.viewNodeIds().has('b'),'The connected non-Arsenal person remains visible');
assert(context.shouldGlowPerson(a));assert(!context.shouldGlowPerson(b),'The connected non-Arsenal person does not glow');
context.activeFilters=filters({clubs:['阿森纳'],countries:['西班牙']});
assert.equal(context.viewNodeIds().size,0,'An empty combined filter has no visible data');
const official=JSON.parse(read('data/人物关系图谱-爱心图.json'));
assert.equal(domain.validateGraph(official).nodes.length,official.data.nodes.length);
console.log('PASS: typed validation, JSON facets/coordinates, combined filter semantics, married/engaged/question categories, legacy filters and counterpart visibility/highlighting.');
