// Reveal only the restored, fitted graph, never the default scale=1 view.
async function startApplication(){
  await restoreFromStorage();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  measureToolbar();
  if(focusId&&!data.nodes.some(person=>person.id===focusId)){focusId=null;searchInput.value=''}
  fitGraphToScreen();
  lastCameraSize={width:stage.clientWidth,height:stage.clientHeight};
  appReady=true;
  render();
  document.documentElement.classList.remove('graph-loading');
}
const applicationReady=startApplication();
