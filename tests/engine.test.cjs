const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
// 几何测试只替代字体测量；真实字体、图片与交互另在浏览器验收。
const ctx={font:'64px serif',measureText(text){const size=parseFloat(this.font);return{width:Array.from(text).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?.55:1)*size,0)};}};
test('工程往返后完整保留可编辑内容，不信任额外字段',()=>{
  const original=E.sample();original.source='一封尚未寄出的信';original.collectedWords=['一封','信'];
  const raw=JSON.parse(JSON.stringify(E.envelope(original)));raw.document.items[1].html='<script>bad</script>';
  assert.deepEqual(E.validate(raw),original);
});
test('拒绝未知版本、原型属性主题、重复 ID 和无效坐标',()=>{
  for(const change of [r=>r.version=2,r=>r.document.theme='toString',r=>r.document.items[1].id=r.document.items[0].id,r=>r.document.items[0].x=Infinity,r=>r.document.items[1].text='',r=>r.document.items[1].size=100000]){
    const r=E.envelope(E.sample());change(r);assert.throws(()=>E.validate(r));
  }
});
test('旋转和缩放后的纸片始终完整留在两种画布中',()=>{
  for(const ratio of ['portrait','square'])for(const rotation of [-179,-90,-45,0,37,90,179]){
    const d=E.blank();d.ratio=ratio;const item=E.textItem('今夜的风\n经过这座城\n我仍然在等一封信',-400,9000,140,rotation,'torn');d.items.push(item);E.fitAll(ctx,d);const m=E.measure(ctx,item),b=E.extents(item,m),size=E.dims(ratio);
    assert.ok(item.x-b.x>=17.9);assert.ok(item.x+b.x<=size.width-17.9);assert.ok(item.y-b.y>=17.9);assert.ok(item.y+b.y<=size.height-17.9);
  }
});
test('命中检测遵守旋转和图层顺序，留白不会误选',()=>{
  const d=E.blank(),bottom=E.textItem('下层',300,300,50,45),top=E.textItem('上层',300,300,50,-30);d.items=[bottom,top];
  assert.equal(E.hit(ctx,d,{x:300,y:300}).id,top.id);assert.equal(E.hit(ctx,d,{x:800,y:100}),null);
  const p=E.worldPoint(top,{x:20,y:10}),q=E.localPoint(top,p);assert.ok(Math.abs(q.x-20)<1e-8);assert.ok(Math.abs(q.y-10)<1e-8);
});
test('中英文、换行和组合字符都保留原文，并限制文本宽度',()=>{
  const item=E.textItem('风的来信\nA letter 👩‍🎨 é\n'+'春'.repeat(50),450,500,60);const m=E.measure(ctx,item);
  assert.equal(m.lines.join(''),'风的来信A letter 👩‍🎨 é'+'春'.repeat(50));assert.ok(m.w<=800);assert.ok(m.lines.includes('A letter 👩‍🎨 é'));
});
test('空白工程和词语包均满足导入约束，每个主题都有连接词',()=>{
  assert.deepEqual(E.validate(E.envelope(E.blank())),E.blank());for(const pack of Object.values(E.PACKS)){assert.ok(pack.words.length>=40);assert.ok(pack.words.includes('我'));assert.ok(pack.words.includes('把'));}
});
