import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// Type errors stop the build before any existing output is replaced.
const projectRoot=fileURLToPath(new URL('./',import.meta.url));
const config=ts.readConfigFile(fileURLToPath(new URL('./tsconfig.json',import.meta.url)),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,projectRoot);
const program=ts.createProgram(parsed.fileNames,parsed.options);
const diagnostics=[...(config.error?[config.error]:[]),...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length)throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:name=>name,getCurrentDirectory:()=>projectRoot,getNewLine:()=> '\n'}));

const sourceHtml = new URL('./src/index.template.html', import.meta.url);
const graphFile = new URL('./data/人物关系图谱-爱心图.json', import.meta.url);
const outputDir = new URL('./dist/', import.meta.url);
const outputHtml = new URL('./dist/index.html', import.meta.url);

const [template, css, manifestText, graphText] = await Promise.all([
  readFile(sourceHtml, 'utf8'),
  readFile(new URL('./src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('./src/manifest.json', import.meta.url), 'utf8'),
  readFile(graphFile, 'utf8'),
]);
const manifest=JSON.parse(manifestText);
if(!Array.isArray(manifest.scripts)||new Set(manifest.scripts).size!==manifest.scripts.length)throw Error('脚本清单无效或重复');
const compiledScripts=await Promise.all(manifest.scripts.map(async name=>{
  if(!/^[a-z][a-z-]*\.(?:js|ts)$/.test(name))throw Error('脚本路径无效：'+name);
  const source=await readFile(new URL('./src/'+name,import.meta.url),'utf8');
  if(name.endsWith('.ts')&&!program.getSourceFile(fileURLToPath(new URL('./src/'+name,import.meta.url))))throw Error('TypeScript 文件未纳入类型检查：'+name);
  const code=name.endsWith('.ts')?ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,alwaysStrict:true}}).outputText:source;
  new vm.Script(code,{filename:'src/'+name});
  return {name,code};
}));
const scriptTags=compiledScripts.map(({name,code})=>`<script data-source="${name}">\n${code.replace(/<\/script/gi,'<\\/script')}\n</script>`);

const graph = JSON.parse(graphText);
if (graph.format !== 'person-relationship-map' || !Array.isArray(graph.data?.nodes) || !Array.isArray(graph.data?.edges)) {
  throw new Error('图谱 JSON 格式不正确：需要 data.nodes 和 data.edges。');
}
const domain=compiledScripts.find(script=>script.name==='graph-domain.ts');
if(!domain)throw Error('构建缺少共享图谱规则');
const domainContext={};
vm.runInNewContext(domain.code,domainContext);
domainContext.WosoGraph.validateGraph(graph);

const nodeIds = new Set(graph.data.nodes.map((node) => node.id));
if (nodeIds.size !== graph.data.nodes.length || graph.data.nodes.some((node) => !node.id || !node.name)) {
  throw new Error('人物数据有重复 ID，或缺少 ID/姓名。');
}
if (graph.data.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
  throw new Error('存在指向不存在人物的关系，请先修复 JSON 数据。');
}

const snapshot = JSON.stringify({ data: graph.data }).replaceAll('<', '\\u003c');
const revision = createHash('sha256').update(JSON.stringify(graph.data)).digest('hex').slice(0, 12);
for(const marker of ['APP_STYLES','GRAPH_DATA','APP_SCRIPTS']){
  if(template.split(`<!-- ${marker} -->`).length!==2)throw Error('模板标记缺失或重复：'+marker);
}
if(!/^[a-zA-Z0-9-]+$/.test(manifest.localStorageKey))throw Error('本地存储键无效');
function assemble(storageKey){
  return template
    .replace('<!-- APP_STYLES -->',()=>`<style>\n${css}\n</style>`)
    .replace('<!-- GRAPH_DATA -->',()=>`<script id="snapshot-data" type="application/json" data-storage-key="${storageKey}">${snapshot}</script>`)
    .replace('<!-- APP_SCRIPTS -->',()=>scriptTags.join('\n'));
}
const deployedHtml=assemble(`relationship-map-${revision}`);

await mkdir(outputDir, { recursive: true });
await writeFile(outputHtml, deployedHtml, 'utf8');
// Retain the original local storage key for users who double-click index.html.
await writeFile(new URL('./index.html',import.meta.url),assemble(manifest.localStorageKey),'utf8');
console.log(`Built index.html and dist/index.html from ${manifest.scripts.length} source scripts, ${graph.data.nodes.length} people and ${graph.data.edges.length} relationships.`);
