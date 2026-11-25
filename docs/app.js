
'use strict';
const paths={
 device:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
 target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r=".8"/>',
 terminal:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
 layers:'<path d="m3 8 9-5 9 5-9 5zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
 book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14"/>',
 wrong:'<rect x="4" y="3" width="15" height="18" rx="2"/><path d="m9 9 5 5m0-5-5 5"/>',
 star:'<path d="M6 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15l-6-4z"/>',
 chart:'<path d="M4 20h16M6 16v-5m6 5V5m6 11V8"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
 check:'<path d="m4 12 5 5L20 6"/>',cross:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon=k=>`<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[k]}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let questions=[],chapters=[],hasBank=false;
const kinds={choice:'单选题',multi:'多选题',judge:'判断题',fill:'填空题',short:'简答题',code:'编程题'};
const tabs={practice:['练习台','terminal'],wrong:['错题本','wrong'],saved:['收藏夹','star'],notes:['知识点','book']};
const app=document.querySelector('#app');
let key,state;
function activateBank(bank){
 hasBank=Boolean(bank);
 questions=bank?bank.questions:[];
 chapters=bank?bank.chapters:[];
 key=bank?'tizhan-progress-'+bank.id:null;
 state={results:{},retrying:{},drafts:{},saved:{},place:{},filter:{}};
 if(key){try{Object.assign(state,JSON.parse(localStorage.getItem(key))||{})}catch{}}
 enter();
}
function persist(){if(!key)return;try{localStorage.setItem(key,JSON.stringify(state))}catch{document.querySelector('#saveInfo').textContent='浏览器存储不可用，本次进度仅在当前页面保留'}}
let tab,pool=[],index=0,page=0,summary=false;
const groupSize=20;
function enter(){
 tab=Object.hasOwn(tabs,location.hash.slice(1))?location.hash.slice(1):'practice';
 summary=false;buildPool();render();window.scrollTo(0,0);
}
function buildPool(){
 const filter=state.filter[tab]||'all';
 pool=questions.filter(q=>(filter==='all'||q.type===filter)&&(tab!=='wrong'||state.results[q.id]?.ok===false)&&(tab!=='saved'||state.saved[q.id]));
 index=Math.max(0,pool.findIndex(q=>q.id===state.place[tab]));page=Math.floor(index/groupSize);
}
function move(i){if(i<0||i>=pool.length)return;summary=false;index=i;page=Math.floor(i/groupSize);state.place[tab]=pool[i].id;persist();render();if(innerWidth<=740)document.querySelector('.columns').scrollIntoView({block:'start'})}
function nextQuestion(){
 if(index+1<pool.length){
  move(index+1);
  return;
 }
 summary=true;
 persist();
 render();
}
function head(label,k){return `<h2 class="headname">${icon(k)}${label}</h2>`}
function filterMenu(){
 const available=new Set(questions.map(q=>q.type));
 const options=[['all','全部题型'],...Object.entries(kinds).filter(([type])=>available.has(type))];
 return `<label class="select"><select aria-label="按题型筛选" id="filter">${options.map(([k,v])=>`<option value="${k}" ${state.filter[tab]===k?'selected':''}>${v}</option>`).join('')}</select></label>`}
function overview(){
 const grades=Object.values(state.results).filter(r=>typeof r.ok==='boolean');
 const total=grades.length,right=grades.filter(r=>r.ok).length,rate=Math.round(total*100/questions.length);
 const metrics=[['已答题目',total,'book','blue'],['待复习错题',total-right,'wrong','orange'],['正确率',total?Math.round(right*100/total)+'%':'—','target','green']];
 return `<section class="overview" aria-label="学习概览">
   <div class="completion metric"><span class="ring" style="--progress:${rate}%">${icon('chart')}</span><div><small>学习进度</small><b>${rate}<em>%</em></b></div></div>
   ${metrics.map(([label,value,k,color])=>`<div class="metric"><span class="metric-icon ${color}">${icon(k)}</span><div><small>${label}</small><b>${value}</b></div></div>`).join('')}
 </section>`;
}
function side(){
 if(!pool.length||tab==='notes')return '';
 const pages=Math.ceil(pool.length/groupSize);
 return `<aside class="side card"><div class="sidehead">${head('答题卡','grid')}<span class="subtle">共 ${pool.length} 题</span></div>
 <div class="grid">${pool.slice(page*groupSize,(page+1)*groupSize).map((q,j)=>{
   const i=page*groupSize+j,res=state.results[q.id];
   const status=i===index?'当前':typeof res?.ok==='boolean'?(res.ok?'答对':'答错'):'未答';
   return `<button data-jump="${i}" aria-label="第 ${i+1} 题，${status}" class="num ${i===index?'current':typeof res?.ok==='boolean'?(res.ok?'ok':'no'):''}">${i+1}</button>`;
 }).join('')}</div>
 <div class="legend">${[['current','当前'],['ok','答对'],['no','答错'],['','未答']].map(([k,v])=>`<span><i class="dot ${k}"></i>${v}</span>`).join('')}</div>
 ${pages>1?`<div class="batch"><button class="tiny" data-page="-1" ${page===0?'disabled':''}>上页</button><span class="subtle">${page+1} / ${pages}</span><button class="tiny" data-page="1" ${page+1===pages?'disabled':''}>下页</button></div>`:''}</aside>`;
}
function answerArea(q,r,d){
 if(q.options)return `<div class="options" role="group" aria-label="答案选项">${q.options.map((s,i)=>{
 const l='ABCDEFGH'[i],selected=(d||'').includes(l),good=r&&!q.selfReview&&q.answer.includes(l),bad=r&&!q.selfReview&&selected&&!good;
 return `<button class="option ${good?'good':bad?'bad':selected?'sel':''}" aria-pressed="${selected}" data-choice="${l}" ${r?'disabled':''}><span class="letter">${l}</span><span>${esc(s)}</span>${good?icon('check'):bad?icon('cross'):''}</button>`}).join('')}</div>`;
 if(q.type==='fill')return `<div class="fields">${q.blanks.map((_,i)=>`<label>第 ${i+1} 空<input data-blank="${i}" value="${esc(d?.[i])}" autocomplete="off" ${r?'readonly':''}></label>`).join('')}</div>`;
 return `<div class="fields"><label>我的${q.type==='code'?'代码':'回答'}<textarea id="written" class="${q.type==='code'?'coding':''}" placeholder="${q.type==='code'?'在这里写下 Java 代码…':'在这里写下你的回答…'}" ${r?'readonly':''}>${esc(d)}</textarea></label></div>`;
}
function feedback(q,r){
 if(!r)return '';
 const manual=q.selfReview||['short','code'].includes(q.type);
 const status=typeof r.ok==='boolean'?(r.ok?'回答正确':'已加入错题本'):(q.answer?'对照参考答案自评':'原文未提供答案，请自评');
 return `<section class="response" aria-live="polite"><strong>${status}</strong>${q.type==='code'?`<pre>${esc(q.answer)}</pre><p>${q.rubric?'评分要点：'+esc(q.rubric):''}</p><p>${q.pitfall?'易错点：'+esc(q.pitfall):''}</p>`:`<p>参考答案：${esc(q.type==='judge'&&!q.selfReview?q.options['ABCDEFGH'.indexOf(q.answer)]:q.answer||'原文未提供')}</p>`}${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${q.topic?`<p class="subtle">知识点 · ${esc(q.topic)}</p>`:''}${manual&&r.ok===null?'<div class="control"><button class="btn primary" data-grade="1">答对了</button><button class="btn" data-grade="0">需要复习</button></div>':''}</section>`;
}
function ready(q,d){if(q.type==='multi')return Boolean(d?.length);if(q.type==='fill')return q.blanks.every((_,i)=>d?.[i]?.trim());return true}
function card(){
 const title={practice:'顺序练习',wrong:'错题重练',saved:'收藏练习'}[tab];
 const heading=`<div class="cardhead">${head(title,tabs[tab][1])}${filterMenu()}</div>`;
 if(!pool.length)return `<section class="card">${heading}<div class="empty">${icon(tabs[tab][1])}<h3>${state.filter[tab]&&state.filter[tab]!=='all'?'该题型暂无题目':tab==='saved'?'还没有收藏的题目':'当前没有错题'}</h3><p>${tab==='saved'?'练习时点击「收藏」即可在这里重温。':'答错或自评需要复习的题目会显示在这里。'}</p><a class="btn" href="#practice">返回练习台</a></div></section>`;
 if(summary){
 const graded=pool.filter(q=>typeof state.results[q.id]?.ok==='boolean'),unfinished=pool.findIndex(q=>typeof state.results[q.id]?.ok!=='boolean');
 return `<section class="card">${heading}<div class="summary-result"><h3>练习小结</h3><p>本组共 ${pool.length} 题，已完成 ${graded.length} 题，答对 ${graded.filter(q=>state.results[q.id].ok).length} 题。</p><div class="control"><button class="btn primary" data-jump="${unfinished<0?0:unfinished}">${unfinished<0?'回顾本组':'继续未完成题目'}</button></div></div></section>`}
 const q=pool[index],r=state.retrying[q.id]?null:state.results[q.id],d=state.drafts[q.id],saved=Boolean(state.saved[q.id]);
 return `<section class="card">${heading}<div class="inside"><div class="qmeta"><div class="chips"><span class="qid">第 <b>${String(index+1).padStart(2,'0')}</b> 题</span><span class="chip">${kinds[q.type]}</span>${q.level?`<span class="chip level ${{中:'mid',难:'hard'}[q.level]||''}">${{易:'基础',中:'中等',难:'较难'}[q.level]}</span>`:''}</div><button class="bookmark ${saved?'on':''}" data-action="save" aria-pressed="${saved}">${icon('star')}${saved?'已收藏':'收藏'}</button></div><h3 class="question">${esc(q.title)}</h3>${q.requirements?`<p class="requirements">${esc(q.requirements.join('\n'))}</p>`:''}${answerArea(q,r,d)}${feedback(q,r)}</div><div class="actions"><div class="control"><button class="btn" data-jump="${index-1}" ${!index?'disabled':''}>上一题</button><button class="btn" data-action="next">${index===pool.length-1?'查看小结':'下一题'}</button></div>${r?'<button class="btn" data-action="retry">重新作答</button>':(q.type==='choice'||q.type==='judge')?'<span class="notice">点选即提交</span>':`<button id="submit" class="btn primary" data-action="submit" ${ready(q,d)?'':'disabled'}>${['short','code'].includes(q.type)?(q.answer?'查看参考答案':'完成并自评'):'提交答案'}</button>`}</div></section>`;
}
function render(){
 document.querySelector('nav').innerHTML=Object.entries(tabs).map(([k,[name,ic]])=>`<a href="#${k}" ${k===tab?'class="active" aria-current="page"':''}>${icon(ic)}${name}</a>`).join('');
 if(!hasBank){
  document.title='题栈';
  app.innerHTML=`<div class="page-title"><h1>还没有题库</h1><p>导入一份 Word 题库，就可以开始刷题。</p></div><section class="card"><div class="empty">${icon('book')}<h3>题库是空的</h3><p>支持 .doc 与 .docx，导入后自动识别题目、选项与参考答案。</p><button class="btn primary" data-action="import-bank">导入题库</button></div></section>`;
  return;
 }
 const chapterRows=(items,expand)=>items.map((c,i)=>`<details class="chapter" ${expand&&i===0?'open':''}><summary><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span>${esc(c.name)}</span></summary><ul>${c.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`).join('');
 const docs=Library.materials();
 const notes=tab==='notes'?`<section class="card chapters"><div class="cardhead">${head('章节目录','book')}<button class="btn" data-action="import-notes">导入复习资料</button></div>${chapterRows(chapters,true)}${docs.map(doc=>`<section class="material"><h3>${esc(doc.name)}</h3>${chapterRows(doc.chapters,false)}</section>`).join('')}${!chapters.length&&!docs.length?'<p class="no-notes">本题库暂无知识点，可从 Word 文档导入复习资料。</p>':''}</section>`:'';
 const totals={practice:questions.length,wrong:questions.filter(q=>state.results[q.id]?.ok===false).length,saved:questions.filter(q=>state.saved[q.id]).length};
 const captions={practice:`${questions.length} 道练习题 · ${new Set(questions.map(q=>q.type)).size} 种题型`,wrong:`${totals.wrong} 道题待复习`,saved:`已收藏 ${totals.saved} 道题`,notes:`${chapters.length} 章 · ${docs.length} 份导入资料`};
 document.title=tabs[tab][0]+' · 题栈';
 app.innerHTML=`<div class="page-title"><h1>${tabs[tab][0]}</h1><p>${captions[tab]}</p></div>${tab==='practice'?overview():''}<div class="columns ${tab==='notes'||!pool.length?'single':''}">${tab==='notes'?notes:card()}${side()}</div>`;
}
function normalize(s){return s.normalize('NFKC').trim().replace(/\s+/g,' ')}
function matches(q,i,s){
 const aliases={'分号（;）':[';','分号'],'一':['1','一次','1次'],'第一行':['首行','第1行','第一条语句'],'try…catch':['try...catch','try catch','try-catch','try/catch','catch'],'super(参数列表)':['super(参数列表);','super(参数)','super(...)']};
 const key=q.blanks[i];return [key,...(aliases[key]||[])].some(a=>normalize(a)===normalize(s));
}
app.addEventListener('change',e=>{if(e.target.id==='filter'){state.filter[tab]=e.target.value;summary=false;buildPool();persist();render()}});
app.addEventListener('input',e=>{
 const q=pool[index];if(!q)return;
 if(e.target.hasAttribute('data-blank')){const arr=state.drafts[q.id]||[];arr[Number(e.target.dataset.blank)]=e.target.value;state.drafts[q.id]=arr}
 else if(e.target.id==='written')state.drafts[q.id]=e.target.value;else return;
 persist();if(document.querySelector('#submit'))document.querySelector('#submit').disabled=!ready(q,state.drafts[q.id]);
});
app.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn||btn.disabled)return;
 const q=pool[index],data=btn.dataset;
 if('jump' in data){move(Number(data.jump));return}
 if('page' in data){page+=Number(data.page);render();return}
 if(data.action==='import-bank'){Library.openImport('bank');return}
 if(data.action==='import-notes'){Library.openImport('notes');return}
 if(!q)return;
 if('choice' in data){
  if(q.type==='multi'){
   const selected=new Set(state.drafts[q.id]||'');
   if(selected.has(data.choice))selected.delete(data.choice);else selected.add(data.choice);
   state.drafts[q.id]=[...selected].sort().join('');persist();render();return;
  }
  state.drafts[q.id]=data.choice;
  state.results[q.id]={ok:q.selfReview?null:data.choice===q.answer};
  delete state.retrying[q.id];
  if(q.selfReview){persist();render()}else nextQuestion();
  return;
 }
 if('grade' in data)state.results[q.id]={ok:data.grade==='1'};
 else switch(data.action){
 case 'save':state.saved[q.id]=!state.saved[q.id];if(tab==='saved'&&!state.saved[q.id]){pool.splice(index,1);index=Math.max(0,Math.min(index,pool.length-1));page=Math.floor(index/groupSize)}break;
 case 'next':nextQuestion();return;
 case 'retry':state.retrying[q.id]=true;delete state.drafts[q.id];break;
 case 'submit':{const d=state.drafts[q.id];if(!ready(q,d))return;
 delete state.retrying[q.id];state.results[q.id]={ok:q.selfReview?null:q.type==='multi'?d===q.answer:q.type==='fill'?q.blanks.every((_,i)=>matches(q,i,d[i])):null};break}
 default:return;
 }
 persist();render();
});
document.querySelectorAll('[data-icon]').forEach(n=>n.innerHTML=icon(n.dataset.icon));
window.addEventListener('hashchange',enter);
Library.init(activateBank);
