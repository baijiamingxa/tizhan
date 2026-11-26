const Library = (function(){
'use strict';
let db,records=[],active=null,notify,mode='bank',owner,preview,busy=false,sequence=0,opener,pending=null,exporting=null;
const el=id=>document.getElementById(id);
const trash='<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 7V4.5h4V7M6.5 7l.9 12.5h9.2L17.5 7M10 10.5v6m4-6v6"/></svg>';
const down='<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>';
const banks=()=>records.filter(r=>r.kind==='bank');
const materials=()=>active?records.filter(r=>r.kind==='notes'&&String(r.bank)===String(active.id)):[];
function readAll(){return new Promise((resolve,reject)=>{
 const req=db.transaction('documents').objectStore('documents').getAll();
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
})}
function save(record){return new Promise((resolve,reject)=>{
 const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');let id;
 const all=store.index('name').getAll(record.name);
 all.onsuccess=()=>{
  const previous=all.result.find(r=>r.kind===record.kind&&r.bank===record.bank&&JSON.stringify(r.chapters)===JSON.stringify(record.chapters)&&JSON.stringify(r.questions)===JSON.stringify(record.questions));
  if(previous){id=previous.id;return}
  const add=store.add(record);add.onsuccess=()=>{id=add.result};
 };
 tx.oncomplete=()=>resolve(id);tx.onabort=()=>reject(tx.error||Error('保存失败'));
})}
function persistActive(){
 if(!db||!active)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(active);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('保存失败'));
 });
}
function reloadActive(){
 return readAll().then(all=>{
  const id=active&&active.id;
  records=all;
  active=records.find(r=>String(r.id)===String(id))||null;
  paint();notify(active);
 });
}
function activate(id){
 const list=banks();
 active=(id==null?null:list.find(r=>String(r.id)===String(id)))||list[0]||null;
 try{localStorage.setItem('tizhan-active-bank',active?String(active.id):'')}catch{}
 closeDrawer();paint();notify(active);
}
function paint(){
 el('currentBank').textContent=active?active.name:'还没有题库';
 el('importAnswers').disabled=!active;el('aiBank').disabled=!active;
 const list=banks();
 if(!list.length){el('bankList').innerHTML='<p class="bank-empty">还没有题库，导入后会显示在这里。</p>';return}
 el('bankList').innerHTML=list.map(b=>{
  const current=Boolean(active)&&String(b.id)===String(active.id);
  return `<div class="bank-row ${current?'selected':''}"><button class="bank-option" data-bank="${b.id}" aria-pressed="${current}"><span>${esc(b.name)}</span><small>${b.questions.length} 题</small></button><button class="bank-icon" data-export="${b.id}" aria-label="导出题库 ${esc(b.name)}">${down}</button><button class="bank-icon bank-del" data-delete="${b.id}" aria-label="删除题库 ${esc(b.name)}">${trash}</button></div>`;
 }).join('');
}
function closeDrawer(){document.body.classList.remove('banks-open');el('chooseBank').setAttribute('aria-expanded','false')}
function openDrawer(){
 if(innerWidth>740){el('bankList').querySelector('.selected')?.focus();return}
 document.body.classList.add('banks-open');el('chooseBank').setAttribute('aria-expanded','true');
 el('bankList').querySelector('.selected')?.focus();
}
function openImport(kind){
 if(kind!=='bank'&&!active)return;
 opener=document.activeElement;closeDrawer();mode=kind;owner=active;preview=null;busy=false;sequence++;
 el('importTitle').textContent=kind==='bank'?'导入题库':kind==='answers'?'导入答案':'导入复习资料';
 el('importHint').textContent=kind==='bank'?'选择带题号的 .doc 或 .docx 文档（最多 32 MB），预览题目后导入。'
  :kind==='answers'?`选择答案文档（最多 32 MB），将按题号把答案写入「${active.name}」。支持“1. B”或“1-5 ABCDA”。`
  :`选择文字版 Word 文档（最多 32 MB）。资料将保存到「${active.name}」的知识点页面。`;
 el('wordFile').value='';el('wordFile').disabled=false;el('previewBox').hidden=true;el('fileError').textContent='';
 el('nameBox').hidden=kind==='answers';el('confirmImport').disabled=true;el('importDialog').hidden=false;
 el('pickWord').focus();
}
function closeImport(){
 if(busy)return;
 sequence++;preview=null;el('importDialog').hidden=true;
 if(opener?.isConnected&&opener.offsetParent)opener.focus();else el('chooseBank').focus();
}
function openDelete(id){
 const bank=banks().find(r=>String(r.id)===String(id));
 if(!bank||busy)return;
 pending=bank;opener=document.activeElement;
 const notes=records.filter(r=>r.kind==='notes'&&String(r.bank)===String(bank.id)).length;
 el('deleteName').textContent=`「${bank.name}」`;
 el('deleteHint').textContent=`中的 ${bank.questions.length} 道题${notes?`、${notes} 份复习资料`:''}和练习记录会一并清除，删除后无法恢复。`;
 el('deleteDialog').hidden=false;
 el('cancelDelete').focus();
}
function closeDelete(){
 if(busy)return;
 pending=null;el('deleteDialog').hidden=true;
 if(opener?.isConnected&&opener.offsetParent)opener.focus();else el('chooseBank').focus();
}
function openExport(id){
 const bank=banks().find(r=>String(r.id)===String(id));
 if(!bank||busy)return;
 exporting=bank;opener=document.activeElement;
 el('exportHint').textContent=`「${bank.name}」共 ${bank.questions.length} 道题。导出为 Word 文档，可用本应用重新导入，也能直接用 Word 打开。`;
 el('exportDialog').hidden=false;el('exportAnswers').focus();
}
function closeExport(){
 if(busy)return;
 exporting=null;el('exportDialog').hidden=true;
 if(opener?.isConnected&&opener.offsetParent)opener.focus();else el('chooseBank').focus();
}
function exportBank(withAnswers){
 const bank=exporting;
 if(!bank||busy)return;
 busy=true;[el('exportAnswers'),el('exportPlain'),el('cancelExport')].forEach(n=>{n.disabled=true});
 try{
  const name=BankExport.save(bank,withAnswers);
  exporting=null;el('exportDialog').hidden=true;
  el('libraryStatus').textContent=`已导出「${bank.name}」（${withAnswers?'含答案':'无答案'}）：${name}`;
  const next=el('bankList').querySelector(`[data-export="${bank.id}"]`);
  (next&&next.offsetParent?next:el('chooseBank')).focus();
 }catch{el('exportHint').textContent='导出失败，请稍后重试。'}
 finally{busy=false;[el('exportAnswers'),el('exportPlain'),el('cancelExport')].forEach(n=>{n.disabled=false})}
}
async function remove(){
 const bank=pending;
 if(!bank||busy)return;
 if(!db){el('deleteHint').textContent='当前环境无法访问本地文档存储，请允许站点存储后重试。';return}
 busy=true;el('confirmDelete').disabled=true;el('cancelDelete').disabled=true;
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');
   const all=store.getAll();
   all.onsuccess=()=>all.result.forEach(r=>{
    if(String(r.id)===String(bank.id)||(r.kind==='notes'&&String(r.bank)===String(bank.id)))store.delete(r.id);
   });
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('删除失败'));
  });
  try{localStorage.removeItem('tizhan-progress-'+bank.id)}catch{}
  records=await readAll();
  pending=null;el('deleteDialog').hidden=true;
  const drawer=document.body.classList.contains('banks-open');
  if(active&&String(active.id)===String(bank.id))activate(null);else paint();
  if(drawer){document.body.classList.add('banks-open');el('chooseBank').setAttribute('aria-expanded','true')}
  const next=el('bankList').querySelector('.selected .bank-option');
  (next&&next.offsetParent?next:el('chooseBank')).focus();
  el('libraryStatus').textContent=`已删除题库「${bank.name}」`;
 }catch{el('deleteHint').textContent='删除失败，请稍后重试。'}
 finally{busy=false;el('confirmDelete').disabled=false;el('cancelDelete').disabled=false}
}
async function readPreview(file){
 const tick=++sequence;preview=null;el('confirmImport').disabled=true;el('previewBox').hidden=true;
 if(!file){el('fileError').textContent='';return}
 el('fileError').textContent='正在读取文档…';
 try{
  if(!/\.docx?$/i.test(file.name))throw Error('请选择 .doc 或 .docx 文件。');
  const name=file.name.replace(/\.docx?$/i,'');
  const lines=await readWordLines(file);
  if(tick!==sequence)return;
  if(mode==='answers'){
   const entries=WordImport.parseAnswers(lines);
   if(!entries.length)throw Error('没有识别到答案。请用“1. B”或“1-5 ABCDA”这样的格式。');
   const nums=new Set(active.questions.map((q,i)=>String(q.num||i+1)));
   const matched=entries.filter(e=>nums.has(String(e.n))).length;
   el('previewCount').textContent=`识别到 ${entries.length} 条答案 · 可匹配 ${matched} 道题`;
   el('previewSample').textContent=`示例：第 ${entries[0].n} 题 → ${entries[0].text}`;
   el('fileError').textContent=matched<entries.length?`${entries.length-matched} 条答案没有对应的题号，将被跳过。`:'';
   preview={entries};el('previewBox').hidden=false;el('confirmImport').disabled=false;
   return;
  }
  const value=mode==='bank'?WordImport.parseBank(lines,name):{name,chapters:WordImport.notesFrom(lines,name)};
  if(mode==='notes'&&!value.chapters.length)throw Error('文档中没有可读取的正文。扫描件请先识别为文字。');
  el('importName').value=name;el('nameLabel').textContent=mode==='bank'?'题库名称':'资料名称';
  const count=mode==='bank'?`${value.questions.length} 道题 · ${value.chapters.length} 章知识点`:`${value.chapters.length} 节 · ${value.chapters.reduce((n,c)=>n+c.notes.length,0)} 段正文`;
  el('previewCount').textContent=count;
  el('previewSample').textContent=mode==='bank'?'首题：'+value.questions[0].title:value.chapters[0].notes[0];
  el('fileError').textContent=value.manual?`${value.manual} 道题缺少可自动核对的答案，可使用「导入答案」或「AI 补全答案」。`:'';
  preview=value;el('previewBox').hidden=false;el('confirmImport').disabled=false;
 }catch(e){if(tick===sequence)el('fileError').textContent=e.message||'无法读取此文档，请检查文件格式。'}
}
function applyAnswers(entries){
 const byNum=new Map();
 active.questions.forEach((q,i)=>{const n=String(q.num||i+1);if(!byNum.has(n))byNum.set(n,q)});
 let applied=0;
 for(const entry of entries){
  const q=byNum.get(String(entry.n));
  if(q&&WordImport.applyAnswer(q,entry.text))applied++;
 }
 return applied;
}
async function commit(){
 if(!preview||busy)return;
 if(!db){el('fileError').textContent='当前环境无法使用本地文档存储，请允许站点存储后重试。';return}
 if(mode==='answers'){
  const bankName=active.name;
  busy=true;el('confirmImport').disabled=true;el('wordFile').disabled=true;el('pickWord').disabled=true;
  try{
   const applied=applyAnswers(preview.entries);
   await persistActive();await reloadActive();
   busy=false;closeImport();
   el('libraryStatus').textContent=`已为「${bankName}」更新 ${applied} 道题的答案`;
  }catch{el('fileError').textContent='保存失败，请检查可用存储空间后重试。'}
  finally{busy=false;el('wordFile').disabled=false;el('pickWord').disabled=false;el('confirmImport').disabled=!preview}
  return;
 }
 const name=el('importName').value.trim();
 if(!name)return;
 busy=true;el('confirmImport').disabled=true;el('wordFile').disabled=true;el('pickWord').disabled=true;
 try{
  const record={kind:mode,name,chapters:preview.chapters};
  if(mode==='bank')record.questions=preview.questions;else record.bank=owner.id;
  const id=await save(record);records=await readAll();
  busy=false;closeImport();
  if(mode==='bank'){
   activate(id);if(location.hash!=='#practice')location.hash='practice';
  }else{notify(active)}
  el('libraryStatus').textContent=mode==='bank'?`已打开题库「${name}」`:`已添加资料「${name}」`;
 }catch(e){el('fileError').textContent=e.name==='QuotaExceededError'?'设备存储空间不足，未能保存。':'保存失败，请检查可用存储空间后重试。'}
 finally{busy=false;el('wordFile').disabled=false;el('pickWord').disabled=false;el('confirmImport').disabled=!preview||!el('importName').value.trim()}
}
function aiConfig(){try{return JSON.parse(localStorage.getItem('tizhan-ai-config'))||{}}catch{return{}}}
function missingAnswers(){return active?active.questions.filter(q=>!q.answer||q.selfReview).length:0}
function openAI(){
 if(!active||busy)return;
 const cfg=aiConfig(),missing=missingAnswers();
 opener=document.activeElement;closeDrawer();
 el('aiBase').value=cfg.base||'https://api.openai.com/v1';
 el('aiModel').value=cfg.model||'gpt-4o-mini';
 el('aiKey').value=cfg.key||'';
 el('aiHint').textContent=`「${active.name}」有 ${missing} 道题缺少可判分的答案。写入前可先「测试连接」或「获取模型」；这里的配置也会用于「AI 讲题」。生成的答案会附带详细讲解。`;
 el('aiStatus').textContent=missing?'':'这个题库的题目都已经有答案了。';
 el('aiRun').disabled=!missing;
 el('aiDialog').hidden=false;el('aiBase').focus();
}
function closeAI(){
 if(busy)return;
 el('aiDialog').hidden=true;
 if(opener?.isConnected&&opener.offsetParent)opener.focus();else el('chooseBank').focus();
}
function aiMessage(q){
 const labels={choice:'单选题',multi:'多选题',judge:'判断题',fill:'填空题',short:'简答题',code:'编程题'};
 let text=`${labels[q.type]||'题目'}：${q.title}`;
 if(q.options&&q.options.length)text+='\n选项：'+q.options.map((o,i)=>'ABCDEFGH'[i]+'. '+o).join(' ');
 return text;
}
async function askAI(base,model,key,batch){
 const system='你是 Java 题库的答题助手。只输出一个 JSON 对象，键是题号，值是对象：{"answer":"答案","explanation":"详细解答","rubric":"评分要点"}。answer 规则：单选题填单个字母；多选题按字母顺序连写（如 "AC"）；判断题填 A（正确）或 B（错误）；填空题按空的顺序用分号分隔；简答题和编程题给出完整参考答案。explanation 用中文写清楚解题思路：选择题说明正确选项为什么对、其他选项错在哪；判断题说明判断依据；填空题逐空解释；简答与编程题给出关键步骤和原理，必要时给代码。rubric 只对简答和编程题给出评分要点，其他题省略。不要输出代码块标记或 JSON 以外的文字。';
 const user=batch.map(item=>item.n+'.\n'+aiMessage(item.q)).join('\n\n');
 let res;
 try{
  res=await fetch(base+'/chat/completions',{
   method:'POST',
   headers:{'content-type':'application/json',authorization:'Bearer '+key},
   body:JSON.stringify({model,temperature:0,messages:[{role:'system',content:system},{role:'user',content:user}]})
  });
 }catch{throw Error('无法连接接口，请检查网络、接口地址或设备联网权限')}
 if(!res.ok){
  throw Error(res.status===401||res.status===403?'API Key 无效或没有权限':res.status===404?'接口地址不正确，通常需要以 /v1 结尾':`接口返回 HTTP ${res.status}`);
 }
 const data=await res.json();
 const text=data?.choices?.[0]?.message?.content||'';
 const start=text.indexOf('{'),end=text.lastIndexOf('}');
 if(start<0||end<=start)throw Error('AI 没有返回可解析的答案。');
 return JSON.parse(text.slice(start,end+1));
}
function modelIds(data){
 const list=Array.isArray(data?.data)?data.data:Array.isArray(data?.models)?data.models:[];
 return list.map(item=>typeof item==='string'?item:item?.id||item?.name).filter(Boolean);
}
function showModels(ids){
 el('aiModels').innerHTML=ids.map(id=>`<option value="${esc(id)}"></option>`).join('');
 if(!el('aiModel').value.trim()&&ids[0])el('aiModel').value=ids[0];
}
function apiError(error,status){
 if(status===401||status===403)return 'API Key 无效或没有权限';
 if(status===404)return '接口地址不正确，通常需要以 /v1 结尾';
 if(status)return `接口返回 HTTP ${status}`;
 return error?.message==='Failed to fetch'||error instanceof TypeError?'无法访问接口，请检查网络、地址或设备联网权限':error?.message||'请求失败';
}
async function testConnection(){
 if(busy)return;
 const base=el('aiBase').value.trim().replace(/\/+$/,'');
 const key=el('aiKey').value.trim();
 if(!/^https?:\/\//i.test(base)||!key){el('aiStatus').textContent='请先填写接口地址和 API Key。';return}
 busy=true;el('aiTest').disabled=true;el('aiModels').disabled=true;el('aiRun').disabled=true;
 const started=performance.now();
 try{
  let res;
  try{res=await fetch(base+'/models',{headers:{authorization:'Bearer '+key}})}
  catch{throw Error('无法连接接口，请检查网络、接口地址或设备联网权限')}
  if(res.ok){
   const ids=modelIds(await res.json());
   if(ids.length)showModels(ids);
   el('aiStatus').textContent=`连接正常：耗时 ${Math.round(performance.now()-started)} ms，接口提供 ${ids.length} 个模型。`;
   return;
  }
  if(res.status===401||res.status===403)throw Error('API Key 无效或没有权限');
  const model=el('aiModel').value.trim()||'gpt-4o-mini';
  let ping;
  try{
   ping=await fetch(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model,temperature:0,max_tokens:8,messages:[{role:'user',content:'ping'}]})});
  }catch{throw Error('无法连接接口，请检查网络、接口地址或设备联网权限')}
  if(!ping.ok)throw Error(apiError(null,ping.status));
  el('aiStatus').textContent=`连接正常：耗时 ${Math.round(performance.now()-started)} ms，模型 ${model} 可调用。`;
 }catch(e){el('aiStatus').textContent='连接失败：'+apiError(e,e.status)}
 finally{busy=false;el('aiTest').disabled=false;el('aiModels').disabled=false;el('aiRun').disabled=!missingAnswers()}
}
async function listModels(){
 if(busy)return;
 const base=el('aiBase').value.trim().replace(/\/+$/,'');
 const key=el('aiKey').value.trim();
 if(!/^https?:\/\//i.test(base)||!key){el('aiStatus').textContent='请先填写接口地址和 API Key。';return}
 busy=true;el('aiTest').disabled=true;el('aiModels').disabled=true;el('aiRun').disabled=true;
 try{
  let res;
  try{res=await fetch(base+'/models',{headers:{authorization:'Bearer '+key}})}
  catch{throw Error('无法连接接口，请检查网络、接口地址或设备联网权限')}
  if(!res.ok)throw Error(apiError(null,res.status));
  const ids=modelIds(await res.json());
  if(!ids.length)throw Error('接口没有返回模型列表');
  showModels(ids);
  el('aiStatus').textContent=`已获取 ${ids.length} 个模型，点击模型输入框可下拉选择。`;
 }catch(e){el('aiStatus').textContent='获取模型失败：'+apiError(e,e.status)}
 finally{busy=false;el('aiTest').disabled=false;el('aiModels').disabled=false;el('aiRun').disabled=!missingAnswers()}
}
function answerText(q){
 if(!q.answer)return '';
 if(q.type==='fill'&&Array.isArray(q.blanks)&&q.blanks.length)return q.blanks.join('；');
 if(q.type==='judge')return (q.options&&q.options['ABCDEFGH'.indexOf(q.answer)])||q.answer;
 if(q.options&&(q.type==='choice'||q.type==='multi'))return [...q.answer].map(l=>q.options['ABCDEFGH'.indexOf(l)]?`${l}. ${q.options['ABCDEFGH'.indexOf(l)]}`:l).join('；');
 return q.answer;
}
function hasConfig(){
 const cfg=aiConfig();
 return Boolean(String(cfg.base||'').trim()&&String(cfg.key||'').trim());
}
function saveConfig(){
 const base=el('aiBase').value.trim().replace(/\/+$/,''),model=el('aiModel').value.trim(),key=el('aiKey').value.trim();
 if(!/^https?:\/\//i.test(base)||!model||!key){el('aiStatus').textContent='请先填写接口地址、模型和 API Key。';return}
 try{localStorage.setItem('tizhan-ai-config',JSON.stringify({base,model,key}))}catch{el('aiStatus').textContent='浏览器存储不可用，无法保存配置。';return}
 el('aiStatus').textContent='配置已保存，之后「AI 讲题」会直接复用。';
}
async function explain(q){
 if(!q)throw Error('没有选中题目');
 const cfg=aiConfig();
 const base=String(cfg.base||'').trim().replace(/\/+$/,'');
 const key=String(cfg.key||'').trim();
 const model=String(cfg.model||'').trim()||'gpt-4o-mini';
 if(!/^https?:\/\//i.test(base)||!key)throw Error('NO_CONFIG');
 const labels={choice:'单选题',multi:'多选题',judge:'判断题',fill:'填空题',short:'简答题',code:'编程题'};
 let user=`${labels[q.type]||'题目'}：${q.title}`;
 if(q.options&&q.options.length)user+='\n选项：\n'+q.options.map((o,i)=>'ABCDEFGH'[i]+'. '+o).join('\n');
 const answer=answerText(q);
 if(answer)user+=`\n参考答案：${answer}`;
 if(q.explanation)user+=`\n已有解析（可参考并补充）：${q.explanation}`;
 if(q.rubric)user+=`\n评分要点：${q.rubric}`;
 if(q.pitfall)user+=`\n易错点：${q.pitfall}`;
 const system='你是耐心的刷题辅导老师。请用中文讲清楚这道题为什么是这个答案，面向正在备考的学生。要求：先给出正确答案；再解释正确选项或答案的依据和原理；如果有多项选择，逐一说明其他选项错在哪里；最后指出易错点和记忆方法。不要只重复答案，不要输出 Markdown 代码块标记。结构清晰，分成几段。';
 let res;
 try{
  res=await fetch(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model,temperature:0.3,messages:[{role:'system',content:system},{role:'user',content:user}]})});
 }catch{throw Error('无法连接接口，请检查网络、接口地址或设备联网权限')}
 if(!res.ok)throw Error(apiError(null,res.status));
 const data=await res.json();
 const text=data?.choices?.[0]?.message?.content||'';
 if(!String(text).trim())throw Error('AI 没有返回讲解内容');
 return String(text).trim();
}
async function runAI(){ if(!active||busy)return;
 const base=el('aiBase').value.trim().replace(/\/+$/,'');
 const model=el('aiModel').value.trim();
 const key=el('aiKey').value.trim();
 if(!/^https?:\/\//i.test(base)||!model||!key){el('aiStatus').textContent='请填写可用的接口地址（http 或 https）、模型和 API Key。';return}
 try{localStorage.setItem('tizhan-ai-config',JSON.stringify({base,model,key}))}catch{}
 const targets=active.questions.map((q,i)=>({q,n:i+1})).filter(item=>!item.q.answer||item.q.selfReview);
 if(!targets.length){el('aiStatus').textContent='没有需要生成的题目。';return}
 busy=true;el('aiRun').disabled=true;el('aiCancel').disabled=true;el('aiTest').disabled=true;el('aiModels').disabled=true;
 [el('aiBase'),el('aiModel'),el('aiKey')].forEach(n=>{n.disabled=true});
 let applied=0,error='';
 try{
  for(let start=0;start<targets.length;start+=6){
   const batch=targets.slice(start,start+6);
   el('aiStatus').textContent=`正在生成第 ${start+1}–${Math.min(start+batch.length,targets.length)} 题，共 ${targets.length} 道…`;
   const answers=await askAI(base,model,key,batch);
   batch.forEach(item=>{
    const raw=answers[item.n];
    if(raw==null)return;
    const value=typeof raw==='object'?raw.answer??raw.result??raw.value:raw;
    const explanation=typeof raw==='object'?((raw.explanation??raw.analysis??raw.reason)||''):'';
    const rubric=typeof raw==='object'?((raw.rubric??raw.points??raw.scoring)||''):'';
    if(value==null||!WordImport.applyAnswer(item.q,String(value)))return;
    applied++;
    if(explanation)item.q.explanation=String(explanation).trim();
    if(rubric&&['short','code'].includes(item.q.type))item.q.rubric=String(rubric).trim();
   });
  }
  el('aiStatus').textContent='正在保存…';
  await persistActive();await reloadActive();
 }catch(e){error=e.message||'请求失败'}
 finally{
  busy=false;el('aiRun').disabled=false;el('aiCancel').disabled=false;el('aiTest').disabled=false;el('aiModels').disabled=false;
  [el('aiBase'),el('aiModel'),el('aiKey')].forEach(n=>{n.disabled=false});
 }
 if(error){
  if(applied){try{await persistActive();await reloadActive()}catch{}}
  el('aiStatus').textContent=`生成中断：${error}${applied?`（已保存 ${applied} 道）`:''}`;
 }else{
  el('aiStatus').textContent=`已为 ${applied} 道题写入答案与讲解${applied<targets.length?`，${targets.length-applied} 道未能识别`:''}。`;
 }
}
async function init(callback){
 notify=callback;paint();
 el('chooseBank').onclick=()=>document.body.classList.contains('banks-open')?closeDrawer():openDrawer();
 el('bankList').onclick=e=>{
  const exp=e.target.closest('[data-export]');
  if(exp){openExport(exp.dataset.export);return}
  const del=e.target.closest('[data-delete]');
  if(del){openDelete(del.dataset.delete);return}
  const button=e.target.closest('[data-bank]');if(button)activate(button.dataset.bank);
 };
 el('dismissBanks').onclick=()=>{closeDrawer();el('chooseBank').focus()};
 el('drawerClose').onclick=el('dismissBanks').onclick;
 el('importBank').onclick=()=>openImport('bank');
 el('importAnswers').onclick=()=>openImport('answers');
 el('aiBank').onclick=openAI;
 el('pickWord').onclick=()=>el('wordFile').click();
 el('wordFile').onchange=e=>readPreview(e.target.files[0]);
 el('importName').oninput=()=>{el('confirmImport').disabled=!preview||!el('importName').value.trim()};
 el('cancelImport').onclick=closeImport;el('confirmImport').onclick=commit;
 el('importDialog').onclick=e=>{if(e.target===el('importDialog'))closeImport()};
 el('cancelDelete').onclick=closeDelete;el('confirmDelete').onclick=remove;
 el('deleteDialog').onclick=e=>{if(e.target===el('deleteDialog'))closeDelete()};
 el('aiCancel').onclick=closeAI;el('aiRun').onclick=runAI;
 el('aiTest').onclick=testConnection;el('aiModels').onclick=listModels;el('aiSave').onclick=saveConfig;
 el('aiDialog').onclick=e=>{if(e.target===el('aiDialog'))closeAI()};
 el('aiKey').onkeydown=e=>{if(e.key==='Enter')runAI()};
 el('aiForget').onclick=()=>{
  try{localStorage.removeItem('tizhan-ai-config')}catch{}
  el('aiKey').value='';el('aiStatus').textContent='已清除本机保存的 Key。';el('aiKey').focus();
 };
 el('cancelExport').onclick=closeExport;
 el('exportPlain').onclick=()=>exportBank(false);el('exportAnswers').onclick=()=>exportBank(true);
 el('exportDialog').onclick=e=>{if(e.target===el('exportDialog'))closeExport()};
 document.addEventListener('keydown',e=>{
  const dialog=!el('importDialog').hidden?el('importDialog'):!el('deleteDialog').hidden?el('deleteDialog'):!el('exportDialog').hidden?el('exportDialog'):!el('aiDialog').hidden?el('aiDialog'):document.body.classList.contains('banks-open')?el('bankPanel'):null;
  if(!dialog)return;
  if(e.key==='Escape'){
   if(dialog===el('deleteDialog'))closeDelete();
   else if(dialog===el('exportDialog'))closeExport();
   else if(dialog===el('importDialog'))closeImport();
   else if(dialog===el('aiDialog'))closeAI();
   else el('dismissBanks').click();
   return;
  }
  if(e.key!=='Tab')return;
  const buttons=Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')).filter(n=>n.offsetParent!==null);
  if(e.shiftKey&&document.activeElement===buttons[0]){buttons[buttons.length-1]?.focus();e.preventDefault()}
  if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){buttons[0]?.focus();e.preventDefault()}
 });
 try{
  db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('tizhan-word-library',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('documents',{keyPath:'id',autoIncrement:true}).createIndex('name','name');
   req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  });
  records=await readAll();
  let last;try{last=localStorage.getItem('tizhan-active-bank')}catch{}
  activate(last);
 }catch{activate(null);el('libraryStatus').textContent='当前环境无法保存导入的文档。'}
}
function dismiss(){
 if(typeof window.TizhanDismiss==='function'&&window.TizhanDismiss())return true;
 if(!el('aiDialog').hidden){closeAI();return true}
 if(!el('exportDialog').hidden){closeExport();return true}
 if(!el('deleteDialog').hidden){closeDelete();return true}
 if(!el('importDialog').hidden){closeImport();return true}
 if(document.body.classList.contains('banks-open')){el('dismissBanks').click();return true}
 return false;
}
return {init,materials,openImport,dismiss,openAI,explain,hasConfig};
})();
