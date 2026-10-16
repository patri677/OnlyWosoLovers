// JSON 文件是可迁移的数据备份；与浏览器本地缓存使用同一份人物和关系结构。
const exportJsonButton=document.getElementById('exportJson');
const importJsonButton=document.getElementById('importJson');
const importJsonFile=document.getElementById('importJsonFile');
exportJsonButton.onclick=()=>{
  const backup={format:'person-relationship-map',version:1,exportedAt:new Date().toISOString(),data};
  const date=new Date().toLocaleDateString('sv-SE');
  download(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}),`人物关系图谱-数据备份-${date}.json`);
};
importJsonButton.onclick=()=>{importJsonFile.value='';importJsonFile.click()};
function validateImportedData(input){
  return WosoGraph.validateGraph(input,types);
}
importJsonFile.onchange=async()=>{
  const file=importJsonFile.files?.[0];
  if(!file)return;
  try{
    if(file.size>50*1024*1024)throw Error('文件超过 50 MB，请检查是否选错文件');
    const imported=validateImportedData(JSON.parse(await file.text()));
    if(!confirm(`将导入 ${imported.nodes.length} 个人物、${imported.edges.length} 条关系。\n这会覆盖当前浏览器里的图谱；如需保留，请先取消并导出数据。\n\n确定继续吗？`))return;
    const previous=data;
    data=imported;selected=null;edgeMode=false;edgeStart=null;scale=1;pan={x:0,y:0};
    if(!await save()){data=previous;throw Error('浏览器存储空间不足，请先导出当前数据备份')}
    document.getElementById('drawer').classList.remove('open');
    if(typeof activeFilters!=='undefined')activeFilters=null;
    render();zoomFit.click();
    alert(`导入完成：${imported.nodes.length} 个人物、${imported.edges.length} 条关系。`);
  }catch(error){alert(`导入失败，原有数据未被覆盖：${error.message||error}`)}
  finally{importJsonFile.value=''}
};
