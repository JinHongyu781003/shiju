/* 拾句共享画布引擎：编辑预览和高清导出使用相同的绘制路径。 */
(function (root) {
  'use strict';
  const FONTS = {
    serif: '"Noto Serif CJK SC", "Songti SC", "SimSun", "STSong", serif',
    sans: '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif'
  };
  const THEMES = {
    letter: { name:'信纸', bg:'#f5f0e4', ink:'#393a31', accent:'#985042', papers:['#eee8d8','#fcf7ec','#e9e2cf'], tape:'#d4c09a', grain:'#756b56', signature:'#8c816f' },
    news: { name:'剪报', bg:'#dbd8cd', ink:'#30332c', accent:'#994638', papers:['#f2eee3','#d0cbbc','#e7e2d4'], tape:'#b1b3a0', grain:'#524b3c', signature:'#766f60' },
    night: { name:'散场', bg:'#303a3c', ink:'#33362f', accent:'#98473c', papers:['#e7dfcc','#f4ecdc','#d1c7af'], tape:'#9b9477', grain:'#e4d4b7', signature:'#b7b4a0' }
  };
  const PACKS = {
    letter:{name:'没有寄出的信',description:'有些话，换一种排列就说得出口。',words:['把','今晚的风','折进','一封','没有地址的','信','你','我','我们','后来','还没','来得及','说出口','的','话','在','窗边','等','一场','缓慢的','重逢','仍然','想念','远处','也','只是','轻轻地','经过','你的名字','一页','空白','收好','月亮','如果','从前','已经','寄往','春天','没有','回答','和','就','留在','心里']},
    rain:{name:'夜行与雨',description:'借一点夜色，写下白天没来得及的。',words:['雨','正在','经过','这座城','我','沿着','路灯','慢慢地','走','夜晚','把','影子','还给','长街','一把伞','一扇窗','没说完的','故事','忽然','亮起','又','安静下来','风','在','衣角','停留','像','一封','迟到的','信','你','远方','潮湿的','梦','醒着','等','最后一班车','以后','月光','和','也','没有','回头','仍然']},
    theatre:{name:'散场以后',description:'灯光暗下去，故事还可以接着写。',words:['散场以后','灯光','缓缓','暗下来','你','我','我们','还在','最后一排','等','一句','没有说完的','台词','掌声','落在','空椅子上','幕布','把','夜晚','分成','两半','主角','转身','离开','而','故事','仍然','继续','一束光','照见','沉默','最后','那场','告别','像','一封信','的','和','也','没有','终于','重逢','此刻','谢幕']},
    journey:{name:'去远方',description:'留一点空白，给尚未抵达的地方。',words:['出发','之前','我','把','故乡','装进','口袋','一张','车票','带着','风','去','远方','你','在','另一座城','等','春天','沿途','山川','缓慢地','后退','而','我们','终于','学会','告别','一条','不知名的路','通往','明天','所有','未完成的','梦','也','没有','地图','只好','跟着','月亮','走','和','再次','相遇']}
  };
  const LIMITS = {items:120,text:120,source:12000,words:240,file:2*1024*1024};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dims=ratio=>({width:900,height:ratio==='square'?900:1200});
  let counter=0;
  const uid=()=>`p-${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  const cleanText=s=>String(s).replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  function textItem(text,x,y,size=64,rotation=0,paper='clean',ink='normal') {
    return {id:uid(),kind:'text',text:cleanText(text).slice(0,LIMITS.text),x,y,size,rotation,paper,ink,font:'serif',shade:counter%3};
  }
  function decoration(kind,x,y) {
    return {id:uid(),kind,x,y,rotation:kind==='tape'?-12:0,w:kind==='tape'?160:kind==='underline'?230:110,h:kind==='tape'?42:kind==='underline'?18:110};
  }
  function blank() { return {title:'无题拼贴',theme:'letter',ratio:'portrait',author:'',pack:'letter',source:'',collectedWords:[],items:[]}; }
  function sample() {
    const d=blank();d.title='今晚的风';d.author='一个收集词语的人';
    d.items=[decoration('tape',235,246),textItem('把',230,355,62,-5,'bare'),textItem('今晚的风',485,360,78,2,'torn'),textItem('折进',335,520,67,-3,'clean'),textItem('一封',545,605,54,5,'clean'),textItem('没有地址的',430,748,65,-1,'bare'),decoration('underline',421,805),textItem('信',655,887,103,7,'torn','accent'),decoration('stamp',664,224)];
    d.items[8].rotation=-8;return d;
  }
  const validNumber=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  function validate(raw) {
    if(!raw||typeof raw!=='object'||raw.format!=='shiju-project'||raw.version!==1||!raw.document) throw new Error('这不是拾句 1.0 工程文件。请导入由“保存工程”生成的 JSON 文件。');
    const d=raw.document;
    if(!Object.hasOwn(THEMES,d.theme)||!['portrait','square'].includes(d.ratio)||typeof d.title!=='string'||d.title.length>40||typeof d.author!=='string'||d.author.length>24||typeof d.source!=='string'||d.source.length>LIMITS.source||!Object.hasOwn(PACKS,d.pack)||!Array.isArray(d.items)||d.items.length>LIMITS.items||!Array.isArray(d.collectedWords)||d.collectedWords.length>LIMITS.words) throw new Error('工程的画布设置或内容不完整，原作品没有被修改。');
    const out={title:cleanText(d.title),theme:d.theme,ratio:d.ratio,author:cleanText(d.author),pack:d.pack,source:cleanText(d.source),collectedWords:[],items:[]};
    for(const word of d.collectedWords){if(typeof word!=='string'||!word.trim()||word.length>LIMITS.text)throw new Error('工程包含不支持的词语。');out.collectedWords.push(cleanText(word));}
    const ids=new Set();
    for(const item of d.items){
      if(!item||typeof item!=='object'||typeof item.id!=='string'||item.id.length>100||ids.has(item.id)||!['text','tape','underline','stamp'].includes(item.kind)||!validNumber(item.x,-10000,10000)||!validNumber(item.y,-10000,10000)||!validNumber(item.rotation,-180,180))throw new Error('工程包含无效的纸片数据。');
      ids.add(item.id);const x={id:item.id,kind:item.kind,x:item.x,y:item.y,rotation:item.rotation};
      if(item.kind==='text'){
        if(typeof item.text!=='string'||!item.text.trim()||item.text.length>LIMITS.text||!validNumber(item.size,20,140)||!['clean','torn','bare'].includes(item.paper)||!['normal','accent'].includes(item.ink)||!['serif','sans'].includes(item.font))throw new Error('工程包含无效的文字或样式。');
        Object.assign(x,{text:cleanText(item.text),size:item.size,paper:item.paper,ink:item.ink,font:item.font,shade:validNumber(item.shade,0,2)?Math.floor(item.shade):hash(item.id)%3});
      }else{
        if(!validNumber(item.w,20,850)||!validNumber(item.h,6,850))throw new Error('工程包含无效的装饰尺寸。');Object.assign(x,{w:item.w,h:item.h});
      }out.items.push(x);
    }return out;
  }
  function envelope(d){return {format:'shiju-project',version:1,savedAt:new Date().toISOString(),document:d};}
  const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
  const chars=s=>segmenter?Array.from(segmenter.segment(s),x=>x.segment):Array.from(s);
  function font(item){return `${item.size}px ${FONTS[item.font]||FONTS.serif}`;}
  function measure(ctx,item,width=900) {
    if(item.kind!=='text')return {w:item.w,h:item.h,lines:[]};
    ctx.font=font(item);const padX=item.paper==='bare'?4:Math.round(item.size*.21+11),padY=item.paper==='bare'?4:Math.round(item.size*.15+8);
    const maxWidth=width-100-padX*2,lines=[];
    for(const paragraph of item.text.split('\n')){
      let line='';for(const ch of chars(paragraph)){if(line&&ctx.measureText(line+ch).width>maxWidth){lines.push(line);line=ch;}else line+=ch;}lines.push(line);
    }
    const lineHeight=item.size*1.32,contentWidth=Math.max(1,...lines.map(s=>ctx.measureText(s).width));
    return {w:Math.ceil(contentWidth+padX*2),h:Math.ceil(lines.length*lineHeight+padY*2),lines,padX,padY,lineHeight};
  }
  function extents(item,m){const a=item.rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return{x:(m.w*c+m.h*s)/2,y:(m.w*s+m.h*c)/2};}
  function fit(ctx,item,d){
    const {width,height}=dims(d.ratio);let m=measure(ctx,item,width),b=extents(item,m);
    for(let n=0;n<12&&(b.x*2>width-36||b.y*2>height-36);n++){
      const scale=Math.min((width-38)/(b.x*2),(height-38)/(b.y*2))*.98;
      if(item.kind==='text')item.size=clamp(item.size*scale,20,140);else{item.w=Math.max(20,item.w*scale);item.h=Math.max(6,item.h*scale);}
      m=measure(ctx,item,width);b=extents(item,m);
    }
    item.x=clamp(item.x,18+b.x,width-18-b.x);item.y=clamp(item.y,18+b.y,height-18-b.y);return m;
  }
  function fitAll(ctx,d){for(const item of d.items)fit(ctx,item,d);return d;}
  function localPoint(item,p){const a=-item.rotation*Math.PI/180,dx=p.x-item.x,dy=p.y-item.y;return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};}
  function worldPoint(item,p){const a=item.rotation*Math.PI/180;return{x:item.x+p.x*Math.cos(a)-p.y*Math.sin(a),y:item.y+p.x*Math.sin(a)+p.y*Math.cos(a)};}
  function hit(ctx,d,p){for(let n=d.items.length-1;n>=0;n--){const item=d.items[n],m=measure(ctx,item),q=localPoint(item,p);if(Math.abs(q.x)<=m.w/2+6&&Math.abs(q.y)<=m.h/2+6)return item;}return null;}
  const backgrounds=new Map();
  function background(d){
    const {width,height}=dims(d.ratio),key=d.theme+d.ratio;if(backgrounds.has(key))return backgrounds.get(key);
    const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d'),theme=THEMES[d.theme];ctx.fillStyle=theme.bg;ctx.fillRect(0,0,width,height);
    let seed=9127;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};ctx.fillStyle=theme.grain;
    for(let n=0;n<21000;n++){ctx.globalAlpha=.015+rnd()*.045;const x=rnd()*width,y=rnd()*height;ctx.fillRect(x,y,rnd()*1.8+.3,rnd()*.9+.3);}ctx.globalAlpha=1;
    if(d.theme==='news'){ctx.strokeStyle=theme.grain;ctx.globalAlpha=.035;ctx.lineWidth=.7;for(let x=34;x<width;x+=88){for(let y=35;y<height;y+=10){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+55+(y%3)*3,y);ctx.stroke();}}ctx.globalAlpha=1;}
    backgrounds.set(key,c);return c;
  }
  function hash(s){let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);}
  function paperPath(ctx,w,h,torn,seed){
    ctx.beginPath();if(!torn){ctx.rect(-w/2,-h/2,w,h);return;}
    const jitter=n=>Math.sin(n*17.3+seed)*2.6;ctx.moveTo(-w/2,-h/2);let n=0;
    for(let x=-w/2;x<w/2;x+=12)ctx.lineTo(x,-h/2+jitter(n++));for(let y=-h/2;y<h/2;y+=10)ctx.lineTo(w/2+jitter(n++),y);
    for(let x=w/2;x>-w/2;x-=12)ctx.lineTo(x,h/2+jitter(n++));for(let y=h/2;y>-h/2;y-=10)ctx.lineTo(-w/2+jitter(n++),y);ctx.closePath();
  }
  function drawItem(ctx,item,d){
    const theme=THEMES[d.theme],m=measure(ctx,item);ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation*Math.PI/180);
    if(item.kind==='text'){
      if(item.paper!=='bare'){
        ctx.shadowColor='#201b1422';ctx.shadowBlur=6;ctx.shadowOffsetY=3;ctx.shadowOffsetX=1;paperPath(ctx,m.w,m.h,item.paper==='torn',hash(item.id));ctx.fillStyle=theme.papers[item.shade??hash(item.id)%theme.papers.length];ctx.fill();ctx.shadowColor='transparent';
        ctx.strokeStyle='#6a5b4410';ctx.lineWidth=.8;ctx.stroke();
      }
      ctx.font=font(item);ctx.fillStyle=item.ink==='accent'?theme.accent:(item.paper==='bare'&&d.theme==='night'?'#e9e1cf':theme.ink);ctx.textBaseline='middle';ctx.textAlign='left';
      m.lines.forEach((line,i)=>ctx.fillText(line,-m.w/2+m.padX,-m.h/2+m.padY+(i+.5)*m.lineHeight));
    }else if(item.kind==='tape'){
      ctx.globalAlpha=.68;ctx.fillStyle=theme.tape;paperPath(ctx,m.w,m.h,true,hash(item.id));ctx.fill();ctx.globalAlpha=.13;ctx.strokeStyle=theme.grain;ctx.lineWidth=.7;for(let x=-m.w/2+5;x<m.w/2;x+=7){ctx.beginPath();ctx.moveTo(x,-m.h/2);ctx.lineTo(x+6,m.h/2);ctx.stroke();}
    }else if(item.kind==='underline'){
      ctx.strokeStyle=d.theme==='night'?'#c4bca8':theme.accent;ctx.lineWidth=Math.max(2,m.h*.18);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-m.w/2,-m.h*.1);ctx.bezierCurveTo(-m.w*.12,m.h*.3,m.w*.15,-m.h*.25,m.w/2,m.h*.05);ctx.stroke();ctx.globalAlpha=.45;ctx.lineWidth=Math.max(1,m.h*.07);ctx.beginPath();ctx.moveTo(-m.w*.42,m.h*.3);ctx.lineTo(m.w*.4,m.h*.37);ctx.stroke();
    }else if(item.kind==='stamp'){
      const color=d.theme==='night'?'#c3836d':theme.accent;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=.8;ctx.lineWidth=2.5;ctx.strokeRect(-m.w/2+5,-m.h/2+5,m.w-10,m.h-10);ctx.lineWidth=.9;ctx.strokeRect(-m.w/2+10,-m.h/2+10,m.w-20,m.h-20);ctx.textBaseline='middle';ctx.textAlign='center';ctx.font=`${Math.min(m.w,m.h)*.27}px ${FONTS.serif}`;ctx.fillText('此 刻',0,-m.h*.15);ctx.fillText('留 存',0,m.h*.17);
    }ctx.restore();return m;
  }
  function handles(ctx,item,screenScale=1){
    const m=measure(ctx,item),gap=28/screenScale;let r={x:0,y:-m.h/2-gap};if(worldPoint(item,r).y<16/screenScale)r={x:0,y:m.h/2+gap};return {m,rotate:r,resize:{x:m.w/2,y:m.h/2}};
  }
  function render(ctx,d,options={}){
    const {width,height}=dims(d.ratio);ctx.clearRect(0,0,width,height);ctx.drawImage(background(d),0,0);for(const item of d.items)drawItem(ctx,item,d);
    if(d.author.trim()){const theme=THEMES[d.theme];ctx.fillStyle=theme.signature;ctx.font=`17px ${FONTS.serif}`;ctx.textBaseline='middle';ctx.textAlign='right';ctx.fillText(d.author,width-57,height-63);ctx.strokeStyle=theme.signature;ctx.globalAlpha=.5;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(width-95,height-88);ctx.lineTo(width-57,height-88);ctx.stroke();ctx.globalAlpha=1;}
    const s=options.scale||1;
    if(options.guides){ctx.save();ctx.strokeStyle='#54766b';ctx.lineWidth=1/s;ctx.setLineDash([5/s,5/s]);if(options.guides.x){ctx.beginPath();ctx.moveTo(width/2,0);ctx.lineTo(width/2,height);ctx.stroke();}if(options.guides.y){ctx.beginPath();ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);ctx.stroke();}ctx.restore();}
    const item=d.items.find(x=>x.id===options.selected);if(item){const h=handles(ctx,item,s);ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation*Math.PI/180);ctx.strokeStyle=d.theme==='night'?'#bfd7ca':'#59766a';ctx.fillStyle=d.theme==='night'?'#e9eddf':'#fffef8';ctx.lineWidth=1.2/s;ctx.setLineDash([4/s,3/s]);ctx.strokeRect(-h.m.w/2-3,-h.m.h/2-3,h.m.w+6,h.m.h+6);ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(0,h.rotate.y<0?-h.m.h/2:h.m.h/2);ctx.lineTo(h.rotate.x,h.rotate.y);ctx.stroke();for(const p of [h.rotate,h.resize]){ctx.beginPath();ctx.arc(p.x,p.y,5/s,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();}
  }
  const api={FONTS,THEMES,PACKS,LIMITS,clamp,dims,uid,cleanText,textItem,decoration,blank,sample,validate,envelope,measure,fit,fitAll,extents,localPoint,worldPoint,hit,handles,render};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Shiju=api;
})(typeof globalThis!=='undefined'?globalThis:this);
