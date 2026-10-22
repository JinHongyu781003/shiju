(function () {
  'use strict';
  const E=window.Shiju,$=id=>document.getElementById(id);
  const canvas=$('poem-canvas'),ctx=canvas.getContext('2d'),dialog=$('app-dialog');
  const STORE='shiju.document.v1',BACKUP='shiju.backup.v1';
  let doc=E.sample(),selected=null,history=[],historyIndex=-1,saveTimer,toastTimer,sourceSelection='',drag=null,frame=0,exportURL=null,downloadTimer=null;
  let startupMessage='',restored=false,lastSavedSnapshot=null;
  try {
    const data=localStorage.getItem(STORE);
    if(data){try{doc=E.validate(JSON.parse(data));restored=true;}catch(error){const fallback=localStorage.getItem(BACKUP);if(fallback){doc=E.validate(JSON.parse(fallback));restored=true;startupMessage='上次存档异常，已恢复最近一次有效备份。';}else{startupMessage='上次存档无法读取，已打开示例；损坏的存档尚未覆盖。';}}}
  } catch(error){startupMessage='浏览器暂时无法读取本机存档。完成后可以保存工程。';}
  E.fitAll(ctx,doc);
  if(restored)lastSavedSnapshot=JSON.stringify(doc);
  function snapshot(){return JSON.stringify(doc);}
  function current(){return doc.items.find(item=>item.id===selected)||null;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
  function savedState(ok,message){const status=$('save-status');status.classList.toggle('failed',!ok);status.replaceChildren();const dot=document.createElement('i');status.append(dot,document.createTextNode(message));}
  function persist(){
    clearTimeout(saveTimer);
    const signature=snapshot();if(signature===lastSavedSnapshot){savedState(true,'已保存在本机');return;}
    try {const old=localStorage.getItem(STORE),next=JSON.stringify(E.envelope(doc));if(old){try{E.validate(JSON.parse(old));localStorage.setItem(BACKUP,old);}catch(error){/* 保留已有有效备份。 */}}localStorage.setItem(STORE,next);lastSavedSnapshot=signature;savedState(true,'已保存在本机');}
    catch(error){savedState(false,'未能保存 · 请存工程');}
  }
  function scheduleSave(){savedState(true,'正在保存…');clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
  function pushHistory(){
    const next=snapshot();if(history[historyIndex]===next){syncHistory();return;}
    history.splice(historyIndex+1);history.push(next);if(history.length>70)history.shift();historyIndex=history.length-1;syncHistory();updateAria();scheduleSave();
  }
  function updateAria(){canvas.setAttribute('aria-label',`拼贴画布，${doc.items.length} 张纸片。${doc.items.filter(x=>x.kind==='text').map(x=>x.text).join('，')}。可在纸片清单中选择，使用方向键移动。`);}
  function finalizeDraft(){E.fitAll(ctx,doc);pushHistory();}
  function syncHistory(){$('undo-button').disabled=historyIndex<=0;$('redo-button').disabled=historyIndex>=history.length-1;}
  function undo(){finalizeDraft();if(historyIndex<=0)return;doc=JSON.parse(history[--historyIndex]);if(!doc.items.some(x=>x.id===selected))selected=null;renderAll();scheduleSave();}
  function redo(){if(historyIndex>=history.length-1)return;doc=JSON.parse(history[++historyIndex]);if(!doc.items.some(x=>x.id===selected))selected=null;renderAll();scheduleSave();}
  function apply(action){finalizeDraft();action();E.fitAll(ctx,doc);pushHistory();renderAll();}
  function screenScale(){return Math.max(.05,canvas.getBoundingClientRect().width/900);}
  function draw(){
    const {width,height}=E.dims(doc.ratio),dpr=Math.min(window.devicePixelRatio||1,2),pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    ctx.setTransform(dpr,0,0,dpr,0,0);E.render(ctx,doc,{selected,scale:screenScale(),guides:drag?.guides});
  }
  function queueDraw(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function renderWords(container,words){
    container.replaceChildren();if(!words.length){const p=document.createElement('p');p.className='empty-note';p.textContent='词语会留在这里，等你重新安排。';container.append(p);return;}
    for(const word of words){const button=document.createElement('button');button.type='button';button.className='word-chip';button.textContent=word;button.draggable=true;button.setAttribute('aria-label',`加入画布：${word}`);button.addEventListener('click',()=>addText(word));button.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-shiju-word',word);event.dataTransfer.effectAllowed='copy';});container.append(button);}
  }
  function renderPacks(){$('word-pack').value=doc.pack;$('pack-description').textContent=E.PACKS[doc.pack].description;renderWords($('pack-words'),E.PACKS[doc.pack].words);}
  function renderCollected(){renderWords($('cut-words'),doc.collectedWords);$('cut-count').textContent=doc.collectedWords.length;$('clear-bank-button').hidden=!doc.collectedWords.length;}
  function renderLayers(){
    const list=$('layers-list');list.replaceChildren();$('item-count').textContent=doc.items.length;
    if(!doc.items.length){const p=document.createElement('p');p.className='no-layers';p.textContent='点选左侧词语，开始第一张纸片。';list.append(p);}
    for(const item of [...doc.items].reverse()){
      const button=document.createElement('button');button.type='button';button.className='layer-row';button.textContent=item.kind==='text'?item.text.replace(/\n/g,' / '):({tape:'装饰 · 胶带',underline:'装饰 · 划线',stamp:'装饰 · 此刻留存'}[item.kind]);button.setAttribute('aria-pressed',String(item.id===selected));button.addEventListener('click',()=>selectItem(item.id));list.append(button);
    }
  }
  function pressed(selector,key,value){document.querySelectorAll(selector).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[key]===value)));}
  function renderInspector(){
    const item=current();$('inspector').hidden=!item;$('overall-settings').hidden=!!item;
    if(item){
      $('settings-title').textContent=item.kind==='text'?'编辑这张纸片':'摆放这一点装饰';$('selected-label').textContent=item.kind==='text'?'正在编辑文字':'正在编辑装饰';$('text-controls').hidden=item.kind!=='text';
      if(item.kind==='text'){$('item-text').value=item.text;$('item-font').value=item.font;$('item-size').value=item.size;$('item-size-value').value=Math.round(item.size);pressed('[data-paper]','paper',item.paper);pressed('[data-ink]','ink',item.ink);}
      $('item-rotation').value=item.rotation;$('item-rotation-value').value=`${Math.round(item.rotation)}°`;$('item-x').value=Math.round(item.x);$('item-y').value=Math.round(item.y);
    }else{$('settings-title').textContent='纸张与气氛';}
  }
  function renderAll(){
    $('project-name').value=doc.title;$('author-name').value=doc.author;
    if($('source-text').value!==doc.source){$('source-text').value=doc.source;sourceSelection='';updateCutSelection();}
    pressed('[data-theme]','theme',doc.theme);pressed('[data-ratio]','ratio',doc.ratio);
    const {width,height}=E.dims(doc.ratio);$('canvas-wrap').style.aspectRatio=`${width}/${height}`;$('canvas-size').textContent=`${doc.ratio==='square'?'1:1':'3:4'} · ${width} × ${height}`;$('export-note').textContent=`PNG · ${width*2} × ${height*2} · 无水印`;
    updateAria();
    renderPacks();renderCollected();renderLayers();renderInspector();syncHistory();draw();
  }
  function selectItem(id){finalizeDraft();selected=id;renderInspector();renderLayers();draw();}
  function newSpot(){const {width,height}=E.dims(doc.ratio),n=doc.items.length;return{x:width/2+((n%5)-2)*22,y:height/2+((n%7)-3)*22};}
  function addText(text,position){
    text=E.cleanText(text).trim();if(!text)return;if(text.length>E.LIMITS.text){toast(`每张纸片最多 ${E.LIMITS.text} 字，可以分成几张来拼。`);return;}
    if(doc.items.length>=E.LIMITS.items){toast('纸片已经很多了。请先删去一些，或另存一张作品。');return;}
    const point=position||newSpot();apply(()=>{const item=E.textItem(text,point.x,point.y,text.length>14?44:60,(doc.items.length%5-2)*1.5,doc.theme==='news'?'torn':'clean');doc.items.push(item);selected=item.id;});toast(`「${text.length>12?text.slice(0,12)+'…':text}」已放上画布`);
  }
  function addDecoration(kind){if(doc.items.length>=E.LIMITS.items){toast('请先减少一些纸片。');return;}const p=newSpot();apply(()=>{const item=E.decoration(kind,p.x,p.y);doc.items.push(item);selected=item.id;});toast('装饰已加入，可拖动、旋转或缩放。');}
  function removeSelected(){if(!current())return;apply(()=>{doc.items=doc.items.filter(x=>x.id!==selected);selected=null;});}
  function duplicate(){const item=current();if(!item)return;if(doc.items.length>=E.LIMITS.items){toast('请先减少一些纸片。');return;}apply(()=>{const copy={...item,id:E.uid(),x:item.x+24,y:item.y+24};doc.items.push(copy);selected=copy.id;});}
  function closeDialog(){if(dialog.open)dialog.close();}
  function openDialog(html){closeDialog();$('dialog-content').innerHTML=html;dialog.showModal();}
  function confirmAction(title,message,buttonText,action){
    openDialog('<p class="dialog-eyebrow">A FRESH PAGE</p><h2 id="dialog-title"></h2><p id="dialog-message"></p><div class="dialog-actions"><button type="button" class="button" id="confirm-cancel">先留着</button><button type="button" class="button button-ink" id="confirm-yes"></button></div>');
    $('dialog-title').textContent=title;$('dialog-message').textContent=message;$('confirm-yes').textContent=buttonText;$('confirm-cancel').addEventListener('click',closeDialog);$('confirm-yes').addEventListener('click',()=>{closeDialog();action();});$('confirm-cancel').focus();
  }
  function showHelp(){
    openDialog('<p class="dialog-eyebrow">WORDS FIND THEIR WAY</p><h2 id="dialog-title">给词语一次新的相遇。</h2><ol><li>点选主题词语，或者粘贴自己的文章，选中文字后剪成纸片。</li><li>在画布上拖动排列。点选纸片后，可编辑文字、字形、边缘与颜色。</li><li>拖动上方圆点旋转，右下角圆点缩放。也可以使用右侧的精确控制。</li><li>点击纸片以外的地方，设置整张纸的气氛、比例和落款。</li><li>完成后导出高清图片；保存工程，可在其他设备上继续编辑。</li></ol><p>电脑快捷键：<span class="dialog-key">Ctrl / ⌘ + Z</span> 撤销，<span class="dialog-key">Shift + Z</span> 重做。选中纸片后用方向键微调，按住 Shift 每次移动 10 格。</p><p>手机上可直接拖动纸片；选中后向下滑动，可找到编辑工具。所有文字只保存在你的浏览器中，本机记录可能随浏览器清理而消失，重要作品请保存工程。</p><div class="dialog-actions"><button type="button" class="button button-ink" id="help-done">开始拼贴</button></div>');$('help-done').addEventListener('click',closeDialog);
  }
  function filename(extension){return (doc.title.trim()||'拾句作品').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,60)+extension;}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function saveProject(){finalizeDraft();persist();download(new Blob([JSON.stringify(E.envelope(doc),null,2)],{type:'application/json;charset=utf-8'}),filename('.shiju.json'));toast('工程已生成。导入后每张纸片仍可编辑。');}
  async function exportImage(){
    if(!doc.items.some(x=>x.kind==='text')){toast('先放上几个词，再把这张诗保存下来。');return;}
    finalizeDraft();persist();const button=$('export-button');button.disabled=true;button.textContent='正在生成图片…';
    try{
      if(document.fonts?.ready)await document.fonts.ready;const {width,height}=E.dims(doc.ratio),out=document.createElement('canvas');out.width=width*2;out.height=height*2;const outCtx=out.getContext('2d');outCtx.scale(2,2);E.render(outCtx,doc);
      const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败，请重试。')),'image/png'));
      const title=doc.title;openDialog('<p class="dialog-eyebrow">A POEM, TO KEEP</p><h2 id="dialog-title">这一刻，可以留下了。</h2><p id="image-detail"></p><img class="export-preview" id="export-preview" alt="导出的拼贴诗预览"><p class="export-fallback">手机若没有出现下载提示，可以长按图片保存。</p><div class="dialog-actions"><button type="button" class="button" id="export-back">继续创作</button><button type="button" class="button button-rust" id="download-image">下载高清 PNG</button></div>');
      exportURL=URL.createObjectURL(blob);$('export-preview').src=exportURL;$('export-preview').alt=`${title||'无题拼贴'}，导出图片预览`;$('image-detail').textContent=`${title||'无题拼贴'} · ${width*2} × ${height*2} 像素 · 无水印`;$('export-back').addEventListener('click',closeDialog);$('download-image').addEventListener('click',()=>{download(blob,filename('.png'));toast('图片已生成；也可以长按预览图保存。');});
    }catch(error){toast(error.message||'暂时无法导出图片，请先保存工程。');}
    finally{button.disabled=false;button.replaceChildren(document.createTextNode('导出高清图片 '));const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');button.append(arrow);}
  }
  async function importProject(file){
    if(!file)return;if(file.size>E.LIMITS.file){toast('文件超过 2 MB，请选择拾句导出的工程文件。');return;}
    let incoming;
    try{incoming=E.validate(JSON.parse(await file.text()));E.fitAll(ctx,incoming);}catch(error){toast(error instanceof SyntaxError?'文件内容无法读取，请选择有效的拾句工程。':error.message);return;}
    const activate=()=>apply(()=>{doc=incoming;selected=null;sourceSelection='';});
    if(doc.items.length)confirmAction('接着写另一张诗？','导入会替换当前画布。可以先取消并保存当前工程；导入之后也可以撤销。','导入工程',()=>{activate();toast('工程已恢复，每张纸片都可以继续编辑。');});else{activate();toast('工程已导入。');}
  }
  function updateCutSelection(){
    const area=$('source-text'),start=area.selectionStart,end=area.selectionEnd;sourceSelection=E.cleanText(area.value.slice(start,end)).trim();
    $('cut-button').disabled=!sourceSelection||sourceSelection.length>E.LIMITS.text;
    $('selection-label').textContent=sourceSelection?sourceSelection.length>E.LIMITS.text?`选了 ${sourceSelection.length} 字，请缩短到 ${E.LIMITS.text} 字以内`:`已选 ${sourceSelection.length} 字`:'选中想留下的词句';
  }
  function switchTab(which){
    for(const key of ['packs','source']){const active=key===which;$(`tab-${key}`).setAttribute('aria-selected',String(active));$(`tab-${key}`).tabIndex=active?0:-1;$(`panel-${key}`).hidden=!active;}
  }
  $('tab-packs').addEventListener('click',()=>switchTab('packs'));$('tab-source').addEventListener('click',()=>switchTab('source'));
  document.querySelector('.tabs').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const key=event.key==='Home'?'packs':event.key==='End'?'source':document.activeElement.id==='tab-packs'?'source':'packs';switchTab(key);$(`tab-${key}`).focus();}});
  $('word-pack').addEventListener('change',event=>apply(()=>{doc.pack=event.target.value;}));
  $('source-text').addEventListener('input',event=>{doc.source=event.target.value;updateCutSelection();scheduleSave();});$('source-text').addEventListener('change',pushHistory);
  for(const event of ['select','keyup','mouseup','touchend'])$('source-text').addEventListener(event,updateCutSelection);
  $('cut-button').addEventListener('pointerdown',event=>event.preventDefault());
  $('cut-button').addEventListener('click',()=>{if(!sourceSelection||sourceSelection.length>E.LIMITS.text)return;if(doc.collectedWords.length>=E.LIMITS.words){toast('词语盘已满，请先清空词盘或保存工程。');return;}const word=sourceSelection;apply(()=>doc.collectedWords.push(word));toast('已收入词语盘，点它就能放上画布。');});
  $('clear-bank-button').addEventListener('click',()=>confirmAction('清空剪下来的词？','只清空词语盘，画布和原文会保留。这个操作也能撤销。','清空词盘',()=>apply(()=>{doc.collectedWords=[];})));
  $('quick-form').addEventListener('submit',event=>{event.preventDefault();const text=$('quick-text').value.trim();if(!text){$('quick-text').focus();return;}addText(text);$('quick-text').value='';});
  document.querySelectorAll('[data-decoration]').forEach(button=>button.addEventListener('click',()=>addDecoration(button.dataset.decoration)));
  $('project-name').addEventListener('input',event=>{doc.title=event.target.value;scheduleSave();});$('project-name').addEventListener('change',pushHistory);
  $('author-name').addEventListener('input',event=>{doc.author=event.target.value;queueDraw();scheduleSave();});$('author-name').addEventListener('change',pushHistory);
  document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>apply(()=>{doc.theme=button.dataset.theme;})));
  document.querySelectorAll('[data-ratio]').forEach(button=>button.addEventListener('click',()=>{if(doc.ratio===button.dataset.ratio)return;apply(()=>{const before=E.dims(doc.ratio);doc.ratio=button.dataset.ratio;const after=E.dims(doc.ratio);for(const item of doc.items){item.x*=after.width/before.width;item.y*=after.height/before.height;}});toast('已调整比例，纸片仍保留在画布内；可以撤销。');}));
  $('item-text').addEventListener('input',event=>{const item=current();if(!item||item.kind!=='text')return;const text=E.cleanText(event.target.value);if(text.trim()){item.text=text;E.fit(ctx,item,doc);queueDraw();scheduleSave();}});
  $('item-text').addEventListener('change',()=>{const item=current();if(!item)return;if(!$('item-text').value.trim()){$('item-text').value=item.text;toast('空纸片没有文字。若想移除它，请点击“删除”。');}pushHistory();renderLayers();});
  $('item-font').addEventListener('change',event=>apply(()=>{const item=current();if(item?.kind==='text')item.font=event.target.value;}));
  for(const [id,key] of [['item-size','size'],['item-rotation','rotation']]){
    $(id).addEventListener('input',event=>{const item=current();if(!item)return;item[key]=Number(event.target.value);E.fit(ctx,item,doc);$(`${id}-value`).value=key==='size'?Math.round(item.size):`${Math.round(item.rotation)}°`;$('item-x').value=Math.round(item.x);$('item-y').value=Math.round(item.y);queueDraw();scheduleSave();});
    $(id).addEventListener('change',()=>{pushHistory();renderInspector();});
  }
  for(const key of ['x','y'])$(`item-${key}`).addEventListener('change',event=>{const value=Number(event.target.value);if(!Number.isFinite(value)){renderInspector();return;}apply(()=>{const item=current();if(item)item[key]=value;});});
  document.querySelectorAll('[data-paper]').forEach(button=>button.addEventListener('click',()=>apply(()=>{const item=current();if(item?.kind==='text')item.paper=button.dataset.paper;})));
  document.querySelectorAll('[data-ink]').forEach(button=>button.addEventListener('click',()=>apply(()=>{const item=current();if(item?.kind==='text')item.ink=button.dataset.ink;})));
  $('deselect-button').addEventListener('click',()=>selectItem(null));$('delete-button').addEventListener('click',removeSelected);$('duplicate-button').addEventListener('click',duplicate);
  $('front-button').addEventListener('click',()=>apply(()=>{const item=current();if(item){doc.items=doc.items.filter(x=>x!==item);doc.items.push(item);}}));
  $('back-button').addEventListener('click',()=>apply(()=>{const item=current();if(item){doc.items=doc.items.filter(x=>x!==item);doc.items.unshift(item);}}));
  $('layers-toggle').addEventListener('click',()=>{const expanded=$('layers-toggle').getAttribute('aria-expanded')==='true';$('layers-toggle').setAttribute('aria-expanded',String(!expanded));$('layers-list').hidden=expanded;});
  $('undo-button').addEventListener('click',undo);$('redo-button').addEventListener('click',redo);$('help-button').addEventListener('click',showHelp);$('dialog-close').addEventListener('click',closeDialog);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
  dialog.addEventListener('close',()=>{if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}});
  $('new-button').addEventListener('click',()=>confirmAction('留一张新的空白。','当前作品可以先保存工程。新建后也可以通过“撤销”找回来。','开始新作品',()=>apply(()=>{doc=E.blank();selected=null;sourceSelection='';})));
  $('sample-button').addEventListener('click',()=>confirmAction('看看一张诗怎样开始。','示例会替换当前画布，之后可以撤销。重要作品请先保存工程。','打开示例',()=>apply(()=>{doc=E.sample();selected=null;})));
  $('clear-button').addEventListener('click',()=>{if(!doc.items.length){toast('画布已经是空白的。');return;}confirmAction('给这张纸重新留白？','清除所有文字纸片和装饰，纸张、原文和落款会保留。这个操作可以撤销。','清空画布',()=>apply(()=>{doc.items=[];selected=null;}));});
  $('save-project-button').addEventListener('click',saveProject);$('export-button').addEventListener('click',exportImage);$('import-project-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';importProject(file);});
  $('mobile-export').addEventListener('click',exportImage);
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{const target={canvas:'.canvas-panel',words:'.word-panel',settings:'.settings-panel'}[button.dataset.jump];document.querySelector(target).scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
  function point(event){const r=canvas.getBoundingClientRect(),{width,height}=E.dims(doc.ratio);return{x:(event.clientX-r.left)*width/r.width,y:(event.clientY-r.top)*height/r.height};}
  canvas.addEventListener('dragover',event=>{if(Array.from(event.dataTransfer.types).includes('application/x-shiju-word')){event.preventDefault();event.dataTransfer.dropEffect='copy';$('canvas-wrap').classList.add('is-dropping');}});
  canvas.addEventListener('dragleave',()=>$('canvas-wrap').classList.remove('is-dropping'));
  canvas.addEventListener('drop',event=>{const word=event.dataTransfer.getData('application/x-shiju-word');$('canvas-wrap').classList.remove('is-dropping');if(word){event.preventDefault();addText(word,point(event));}});
  function handleAt(item,p){if(!item)return null;const h=E.handles(ctx,item,screenScale()),q=E.localPoint(item,p),radius=(eventCoarse()?23:13)/screenScale();for(const name of ['rotate','resize'])if(Math.hypot(q.x-h[name].x,q.y-h[name].y)<=radius)return name;return null;}
  function eventCoarse(){return window.matchMedia('(pointer: coarse)').matches;}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;finalizeDraft();const p=point(event);let item=current(),mode=handleAt(item,p);
    if(!mode){item=E.hit(ctx,doc,p);mode='move';}selected=item?.id||null;renderInspector();renderLayers();
    if(item){drag={pointer:event.pointerId,mode,start:p,original:{...item},id:item.id,guides:{x:false,y:false}};canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';event.preventDefault();canvas.focus({preventScroll:true});}draw();
  });
  canvas.addEventListener('pointermove',event=>{
    const p=point(event);if(!drag){const item=current(),handle=handleAt(item,p);canvas.style.cursor=handle==='rotate'?'crosshair':handle==='resize'?'nwse-resize':E.hit(ctx,doc,p)?'grab':'default';return;}
    if(event.pointerId!==drag.pointer)return;const item=doc.items.find(x=>x.id===drag.id),o=drag.original;if(!item)return;
    if(drag.mode==='move'){item.x=o.x+p.x-drag.start.x;item.y=o.y+p.y-drag.start.y;const {width,height}=E.dims(doc.ratio);drag.guides={x:Math.abs(item.x-width/2)<8,y:Math.abs(item.y-height/2)<8};if(drag.guides.x)item.x=width/2;if(drag.guides.y)item.y=height/2;}
    else if(drag.mode==='rotate'){const before=Math.atan2(drag.start.y-o.y,drag.start.x-o.x),now=Math.atan2(p.y-o.y,p.x-o.x);item.rotation=((o.rotation+(now-before)*180/Math.PI+540)%360)-180;if(event.shiftKey)item.rotation=Math.round(item.rotation/15)*15;}
    else {const before=Math.hypot(drag.start.x-o.x,drag.start.y-o.y),now=Math.hypot(p.x-o.x,p.y-o.y),factor=E.clamp(now/Math.max(1,before),.15,5);if(item.kind==='text')item.size=E.clamp(o.size*factor,20,140);else{item.w=E.clamp(o.w*factor,20,850);item.h=E.clamp(o.h*factor,6,850);}}
    E.fit(ctx,item,doc);queueDraw();event.preventDefault();
  });
  function finishDrag(event,cancelled){
    if(!drag||event.pointerId!==drag.pointer)return;const old=drag,item=doc.items.find(x=>x.id===drag.id);drag=null;if(cancelled&&item)Object.assign(item,old.original);if(canvas.hasPointerCapture(old.pointer))canvas.releasePointerCapture(old.pointer);canvas.style.cursor='grab';if(!cancelled)pushHistory();renderInspector();renderLayers();draw();
  }
  canvas.addEventListener('pointerup',event=>finishDrag(event,false));canvas.addEventListener('pointercancel',event=>finishDrag(event,true));canvas.addEventListener('lostpointercapture',event=>{if(drag)finishDrag(event,true);});
  canvas.addEventListener('dblclick',event=>{const item=E.hit(ctx,doc,point(event));if(item?.kind==='text'){selectItem(item.id);$('item-text').focus();$('item-text').select();}});
  document.addEventListener('keydown',event=>{
    if(dialog.open)return;const editing=event.target instanceof HTMLElement&&(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable),mod=event.ctrlKey||event.metaKey;
    if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();saveProject();return;}if(editing)return;
    if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}if(mod&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
    if(event.key==='Escape'){selectItem(null);return;}if((event.key==='Delete'||event.key==='Backspace')&&current()){event.preventDefault();removeSelected();return;}
    if(mod&&event.key.toLowerCase()==='d'&&current()){event.preventDefault();duplicate();return;}
    if(event.target===canvas&&current()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=event.shiftKey?10:1;apply(()=>{const item=current();item.x+=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;item.y+=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;});}
  });
  window.addEventListener('pagehide',persist);window.addEventListener('resize',queueDraw);if(window.ResizeObserver)new ResizeObserver(queueDraw).observe($('canvas-wrap'));
  history=[snapshot()];historyIndex=0;renderAll();
  if(!startupMessage)persist();else{savedState(false,'请保存工程备份');toast(startupMessage);}
  if(restored&&!startupMessage)toast('上次的词语还在。接着写吧。');
})();
