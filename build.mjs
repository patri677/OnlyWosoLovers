import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourceHtml = new URL('./index.html', import.meta.url);
const graphFile = new URL('./人物关系图谱-爱心图.json', import.meta.url);
const outputDir = new URL('./dist/', import.meta.url);
const outputHtml = new URL('./dist/index.html', import.meta.url);

const [html, graphText] = await Promise.all([
  readFile(sourceHtml, 'utf8'),
  readFile(graphFile, 'utf8'),
]);

const graph = JSON.parse(graphText);
if (graph.format !== 'person-relationship-map' || !Array.isArray(graph.data?.nodes) || !Array.isArray(graph.data?.edges)) {
  throw new Error('图谱 JSON 格式不正确：需要 data.nodes 和 data.edges。');
}

const nodeIds = new Set(graph.data.nodes.map((node) => node.id));
if (nodeIds.size !== graph.data.nodes.length || graph.data.nodes.some((node) => !node.id || !node.name)) {
  throw new Error('人物数据有重复 ID，或缺少 ID/姓名。');
}
if (graph.data.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
  throw new Error('存在指向不存在人物的关系，请先修复 JSON 数据。');
}

const snapshot = JSON.stringify({ data: graph.data }).replaceAll('<', '\\u003c');
const revision = createHash('sha256').update(JSON.stringify(graph.data)).digest('hex').slice(0, 12);
const snapshotTag = /<script\b(?=[^>]*\bid=["']snapshot-data["'])[^>]*>[\s\S]*?<\/script>/i;
if (!snapshotTag.test(html)) throw new Error('HTML 中找不到 snapshot-data 数据块。');

const deployedHtml = html.replace(snapshotTag, (tag) => {
  const openingTag = tag.slice(0, tag.indexOf('>'))
    .replace(/\sdata-storage-key=["'][^"']*["']/i, '') +
    ` data-storage-key="relationship-map-${revision}">`;
  return `${openingTag}${snapshot}</script>`;
});

await mkdir(outputDir, { recursive: true });
await writeFile(outputHtml, deployedHtml, 'utf8');
console.log(`Built dist/index.html from ${graph.data.nodes.length} people and ${graph.data.edges.length} relationships.`);
