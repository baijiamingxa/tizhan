'use strict';
const paths={
 device:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
 target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r=".8"/>',
 terminal:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
 layers:'<path d="m3 8 9-5 9 5-9 5zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
 refresh:'<path d="M20 11a8 8 0 1 1-2.3-5.6"/><path d="M20 4v6h-6"/>',
 book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14"/>',
 wrong:'<rect x="4" y="3" width="15" height="18" rx="2"/><path d="m9 9 5 5m0-5-5 5"/>',
 star:'<path d="M6 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15l-6-4z"/>',
 chart:'<path d="M4 20h16M6 16v-5m6 5V5m6 11V8"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
 check:'<path d="m4 12 5 5L20 6"/>',cross:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon=k=>`<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[k]}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let questions=[],chapters=[],hasBank=false;
const kinds={choice:'单选题',multi:'多选题',judge:'判断题',fill:'填空题',short:'简答题',code:'编程题'};
const tabs={practice:['练习台','terminal'],wrong:['错题本','wrong'],saved:['收藏夹','star'],exam:['模拟考','clock'],notes:['知识点','book']};
const app=document.querySelector('#app');
let key,state;
let tab,pool=[],index=0,page=0,summary=false;
let mode='normal',recite={},query='',searchHits=[];
let exam=null,examError='',examTimer=null;
const groupSize=20;
function activateBank(bank){
 clearExamTimer();
 exam=null;examError='';
 hasBank=Boolean(bank);
 questions=bank?bank.questions:[];
 chapters=bank?bank.chapters:[];
 key=bank?'tizhan-progress-'+bank.id:null;
 state={results:{},retrying:{},drafts:{},saved:{},place:{},filter:{},streak:{},log:[]};
 if(key){try{Object.assign(state,JSON.parse(localStorage.getItem(key))||{})}catch{}}
 if(!Array.isArray(state.log))state.log=[];
 if(!state.streak||typeof state.streak!=='object')state.streak={};
 mode='normal';recite={};query='';searchHits=[];
 enter();
}
function persist(){if(!key)return;try{localStorage.setItem(key,JSON.stringify(state))}catch{document.querySelector('#saveInfo').textContent='浏览器存储不可用，本次进度仅在当前页面保留'}}
function enter(){
 tab=Object.hasOwn(tabs,location.hash.slice(1))?location.hash.slice(1):'practice';
 summary=false;buildPool();render();window.scrollTo(0,0);
}
function buildPool(){
 const filter=state.filter[tab]||'all';
 pool=tab==='notes'||tab==='exam'?[]:questions.filter(q=>(filter==='all'||q.type===filter)&&(tab!=='wrong'||state.results[q.id]?.ok===false)&&(tab!=='saved'||state.saved[q.id]));
 if(tab==='wrong')pool.forEach(q=>{state.retrying[q.id]=true});
 index=Math.max(0,pool.findIndex(q=>q.id===state.place[tab]));page=Math.floor(index/groupSize);
}
function move(i){
 if(i<0||i>=pool.length)return;
 summary=false;recite={};
 index=i;page=Math.floor(i/groupSize);state.place[tab]=pool[i].id;
 persist();render();
 if(innerWidth<=740)document.querySelector('.columns').scrollIntoView({block:'start'});
}
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
function practiceTools(){
 return `<div class="practice-tools">
   <div class="seg" role="group" aria-label="练习方式">
     <button data-mode="normal" class="${mode==='normal'?'on':''}" aria-pressed="${mode==='normal'}">顺序练习</button>
     <button data-mode="recite" class="${mode==='recite'?'on':''}" aria-pressed="${mode==='recite'}">背题模式</button>
   </div>
   <div class="searchbox">
     <label class="search">${icon('search')}<input id="qsearch" type="search" placeholder="搜索题目关键词，回车跳转" value="${esc(query)}" autocomplete="off" spellcheck="false" aria-label="题库内搜索"></label>
     <div id="searchResults" class="search-results" hidden></div>
   </div>
 </div>`;
}
function questionNumber(q){return q.num??(questions.indexOf(q)+1)}
function optionText(q,letter){return q.options?.['ABCDEFGH'.indexOf(letter)]||''}
function answerLabel(q){
 if(!q.answer)return '原文未提供';
 if(q.type==='fill'&&Array.isArray(q.blanks)&&q.blanks.length)return q.blanks.join('；');
 if(q.type==='judge'&&!q.selfReview)return optionText(q,q.answer)||q.answer;
 if((q.type==='choice'||q.type==='multi')&&q.options)return [...q.answer].map(l=>optionText(q,l)?`${l}. ${optionText(q,l)}`:l).join('；');
 return q.answer;
}
function record(q,ok){
 if(typeof ok!=='boolean')return;
 if(!Array.isArray(state.log))state.log=[];
 state.log.push({t:Date.now(),ok,topic:q.topic||''});
 if(state.log.length>800)state.log.splice(0,state.log.length-800);
}
function gradeAnswer(q,ok){
 record(q,ok);
 if(tab==='wrong'){
  if(ok===true){
   const n=(state.streak[q.id]||0)+1;
   if(n>=2){state.streak[q.id]=2;state.results[q.id]={ok:true}}
   else{state.streak[q.id]=n;state.results[q.id]={ok:false}}
  }else if(ok===false){
   state.streak[q.id]=0;state.results[q.id]={ok:false};
  }
  return;
 }
 state.results[q.id]={ok};
}
function side(){
 if(!pool.length||tab==='notes'||tab==='exam')return '';
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
 let status;
 if(tab==='wrong'){
  const n=state.streak[q.id]||0;
  status=r.ok===true?'已连续答对 2 次，移出错题本':r.ok===false?(n?`回答正确，连续答对 ${n}/2`:'回答错误，连续答对进度已重置'):'对照参考答案自评';
 }else{
  status=typeof r.ok==='boolean'?(r.ok?'回答正确':'已加入错题本'):(q.answer?'对照参考答案自评':'原文未提供答案，请自评');
 }
 const streak=tab==='wrong'&&r.ok===false&&(state.streak[q.id]||0)>0;
 return `<section class="response" aria-live="polite"><strong>${status}</strong>${q.type==='code'?`<pre>${esc(q.answer)}</pre><p>${q.rubric?'评分要点：'+esc(q.rubric):''}</p><p>${q.pitfall?'易错点：'+esc(q.pitfall):''}</p>`:`<p>参考答案：${esc(answerLabel(q))}</p>`}${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${q.topic?`<p class="subtle">知识点 · ${esc(q.topic)}</p>`:''}${streak?`<p class="subtle">再连续答对 ${2-(state.streak[q.id]||0)} 次即可移出错题本。</p>`:''}${manual&&r.ok===null?'<div class="control"><button class="btn primary" data-grade="1">答对了</button><button class="btn" data-grade="0">需要复习</button></div>':''}</section>`;
}
function ready(q,d){if(q.type==='multi')return Boolean(d?.length);if(q.type==='fill')return q.blanks.every((_,i)=>d?.[i]?.trim());return true}
function emptyCard(heading,iconKey,title,text){
 return `<section class="card">${heading}<div class="empty">${icon(iconKey)}<h3>${title}</h3><p>${text}</p><a class="btn" href="#practice">返回练习台</a></div></section>`;
}
function card(){
 if(tab==='practice'&&mode==='recite')return reciteCard();
 const title={practice:'顺序练习',wrong:'错题重练',saved:'收藏练习'}[tab];
 const heading=`<div class="cardhead">${head(title,tabs[tab][1])}${filterMenu()}</div>`;
 if(!pool.length)return emptyCard(heading,tabs[tab][1],state.filter[tab]&&state.filter[tab]!=='all'?'该题型暂无题目':tab==='saved'?'还没有收藏的题目':'当前没有错题',tab==='saved'?'练习时点击「收藏」即可在这里重温。':'答错或自评需要复习的题目会显示在这里。');
 if(summary){
 const graded=pool.filter(q=>typeof state.results[q.id]?.ok==='boolean'),unfinished=pool.findIndex(q=>typeof state.results[q.id]?.ok!=='boolean');
 return `<section class="card">${heading}<div class="summary-result"><h3>练习小结</h3><p>本组共 ${pool.length} 题，已完成 ${graded.length} 题，答对 ${graded.filter(q=>state.results[q.id].ok).length} 题。</p><div class="control"><button class="btn primary" data-jump="${unfinished<0?0:unfinished}">${unfinished<0?'回顾本组':'继续未完成题目'}</button></div></div></section>`}
 const q=pool[index],r=state.retrying[q.id]?null:state.results[q.id],d=state.drafts[q.id],saved=Boolean(state.saved[q.id]);
 const mastered=tab==='wrong'&&r?.ok===true;
 const streak=tab==='wrong'?`<span class="chip">连续 ${state.streak[q.id]||0}/2</span>`:'';
 return `<section class="card">${heading}<div class="inside"><div class="qmeta"><div class="chips"><span class="qid">第 <b>${String(index+1).padStart(2,'0')}</b> 题</span><span class="chip">${kinds[q.type]}</span>${streak}${q.level?`<span class="chip level ${{中:'mid',难:'hard'}[q.level]||''}">${{易:'基础',中:'中等',难:'较难'}[q.level]}</span>`:''}</div><button class="bookmark ${saved?'on':''}" data-action="save" aria-pressed="${saved}">${icon('star')}${saved?'已收藏':'收藏'}</button></div><h3 class="question">${esc(q.title)}</h3>${q.requirements?`<p class="requirements">${esc(q.requirements.join('\n'))}</p>`:''}${answerArea(q,r,d)}${feedback(q,r)}</div><div class="actions"><div class="control"><button class="btn" data-jump="${index-1}" ${!index?'disabled':''}>上一题</button><button class="btn" data-action="next">${index===pool.length-1?'查看小结':'下一题'}</button></div>${mastered?'<span class="notice">已移出错题本</span>':r?`<button class="btn" data-action="retry">${tab==='wrong'?'再练一次':'重新作答'}</button>`:(q.type==='choice'||q.type==='judge')?'<span class="notice">点选即提交</span>':`<button id="submit" class="btn primary" data-action="submit" ${ready(q,d)?'':'disabled'}>${['short','code'].includes(q.type)?(q.answer?'查看参考答案':'完成并自评'):'提交答案'}</button>`}</div></section>`;
}
function reciteCard(){
 const heading=`<div class="cardhead">${head('背题模式','book')}${filterMenu()}</div>`;
 if(!pool.length)return emptyCard(heading,'book',state.filter.practice&&state.filter.practice!=='all'?'该题型暂无题目':'题库里还没有题目','导入题库后就可以在这里先背答案，再翻转自测。');
 const q=pool[index],phase=recite[q.id]==='test'?'test':'memorize';
 const meta=`<div class="qmeta"><div class="chips"><span class="qid">第 <b>${String(index+1).padStart(2,'0')}</b> 题</span><span class="chip">${kinds[q.type]}</span>${q.topic?`<span class="chip">${esc(q.topic)}</span>`:''}</div><span class="chip recite-hint">${phase==='test'?'自测中':'先记答案'}</span></div>`;
 if(phase==='memorize'){
  const options=q.options?`<div class="options">${q.options.map((s,i)=>{const l='ABCDEFGH'[i],good=!q.selfReview&&q.answer.includes(l);return `<div class="option ${good?'good':''}"><span class="letter">${l}</span><span>${esc(s)}</span>${good?icon('check'):''}</div>`}).join('')}</div>`:'';
  return `<section class="card">${heading}<div class="inside">${meta}<h3 class="question">${esc(q.title)}</h3>${q.requirements?`<p class="requirements">${esc(q.requirements.join('\n'))}</p>`:''}${options}<section class="response memorize" aria-label="参考答案"><strong>参考答案</strong>${q.type==='code'?`<pre>${esc(q.answer)}</pre>`:`<p>${esc(answerLabel(q))}</p>`}${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${q.rubric?`<p>评分要点：${esc(q.rubric)}</p>`:''}${q.pitfall?`<p>易错点：${esc(q.pitfall)}</p>`:''}${q.topic?`<p class="subtle">知识点 · ${esc(q.topic)}</p>`:''}</section></div><div class="actions"><div class="control"><button class="btn" data-jump="${index-1}" ${!index?'disabled':''}>上一题</button><button class="btn" data-action="next">${index===pool.length-1?'查看小结':'下一题'}</button></div><button class="btn primary" data-action="flip">翻转自测</button></div></section>`;
 }
 const r=state.retrying[q.id]?null:state.results[q.id],d=state.drafts[q.id];
 return `<section class="card">${heading}<div class="inside">${meta}<h3 class="question">${esc(q.title)}</h3>${q.requirements?`<p class="requirements">${esc(q.requirements.join('\n'))}</p>`:''}${answerArea(q,r,d)}${feedback(q,r)}</div><div class="actions"><div class="control"><button class="btn" data-jump="${index-1}" ${!index?'disabled':''}>上一题</button><button class="btn" data-action="next">${index===pool.length-1?'查看小结':'下一题'}</button></div>${r?'<button class="btn" data-action="flipback">再看答案</button><button class="btn" data-action="retry">重新自测</button>':(q.type==='choice'||q.type==='judge')?'<span class="notice">点选即提交</span>':`<button id="submit" class="btn primary" data-action="submit" ${ready(q,d)?'':'disabled'}>${['short','code'].includes(q.type)?(q.answer?'查看参考答案':'完成并自评'):'提交答案'}</button>`}</div></section>`;
}
function searchMatches(){
 const k=normalize(query).toLowerCase();
 if(!k)return [];
 return questions.filter(q=>[q.num,q.title,q.topic,q.answer,q.explanation,q.rubric,...(q.options||[])].join(' ').toLowerCase().includes(k)).slice(0,30);
}
function snippet(q,k){
 const text=String(q.title||'');
 const at=text.toLowerCase().indexOf(k);
 if(at<0){
  const extra=(q.options||[]).join(' ');
  const pos=extra.toLowerCase().indexOf(k);
  if(pos<0)return text.slice(0,70)+(text.length>70?'…':'');
  return text.slice(0,36)+' … '+extra.slice(Math.max(0,pos-18),pos+30);
 }
 const start=Math.max(0,at-22),end=Math.min(text.length,at+k.length+36);
 return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
}
function updateSearch(){
 const box=document.getElementById('searchResults');
 if(!box)return;
 const k=query.trim();
 searchHits=k?searchMatches():[];
 box.hidden=!k;
 if(!k){box.innerHTML='';return}
 box.innerHTML=searchHits.length
  ?searchHits.slice(0,8).map(q=>`<button class="search-hit" data-goto="${esc(q.id)}"><span class="hit-meta">第 ${esc(questionNumber(q))} 题 · ${kinds[q.type]||''}</span><span class="hit-title">${esc(snippet(q,k))}</span></button>`).join('')+(searchHits.length>8?`<p class="hit-more">还有 ${searchHits.length-8} 条匹配，继续输入可缩小范围。</p>`:'')
  :'<p class="hit-more">没有找到匹配的题目。</p>';
}
function jumpToQuestion(id){
 const target=questions.find(q=>String(q.id)===String(id));
 if(!target)return;
 state.filter.practice='all';
 mode='normal';recite={};query='';summary=false;
 buildPool();
 const i=pool.findIndex(q=>String(q.id)===String(id));
 if(i<0)return;
 move(i);
 document.querySelector('.columns')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function dayKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function statsData(){
 const log=(state.log||[]).filter(e=>e&&typeof e.t==='number');
 const days=[];
 for(let i=13;i>=0;i--){
  const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-i);
  days.push({key:dayKey(date),date,count:0,total:0,right:0});
 }
 const map=new Map(days.map(d=>[d.key,d]));
 const topics=new Map();
 log.forEach(e=>{
  const day=map.get(dayKey(new Date(e.t)));
  if(day){day.count++;if(typeof e.ok==='boolean'){day.total++;if(e.ok)day.right++}}
  if(typeof e.ok==='boolean'&&e.topic){let t=topics.get(e.topic);if(!t)topics.set(e.topic,t={name:e.topic,total:0,right:0});t.total++;if(e.ok)t.right++}
 });
 return {days,topics:[...topics.values()]};
}
function trendSvg(days){
 const active=days.filter(d=>d.total);
 if(active.length<2)return `<p class="stats-empty">${active.length?'再练一天就能看到正确率趋势。':'还没有有效作答，练几题后这里会显示趋势。'}</p>`;
 const W=300,H=96,top=8,bottom=H-16;
 const points=active.map((d,i)=>{
  const x=active.length===1?W/2:6+i*(W-12)/(active.length-1);
  const y=bottom-(d.right/d.total)*(bottom-top);
  return [x,y];
 });
 const line=points.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
 const dots=points.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.2"/>`).join('');
 const last=active[active.length-1];
 return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="最近正确率趋势，最新 ${Math.round(last.right*100/last.total)}%"><line class="axis" x1="6" y1="${bottom}" x2="${W-6}" y2="${bottom}"/><polyline points="${line}"/>${dots}</svg><p class="stats-note">最近 ${active.length} 个练习日 · 最新 ${Math.round(last.right*100/last.total)}%</p>`;
}
function weakHtml(topics){
 const weak=topics.filter(t=>t.total>=2).sort((a,b)=>a.right/a.total-b.right/a.total||b.total-a.total).slice(0,3);
 if(!weak.length)return `<p class="stats-empty">${topics.length?'每个知识点至少练 2 题后才会参与排名。':'题目还没有知识点标签，导入时可在题目里写一行“知识点：xxx”。'}</p>`;
 return `<div class="weak-list">${weak.map(t=>{const p=Math.round(t.right*100/t.total);return `<div class="weak-row"><div class="weak-top"><span class="weak-name">${esc(t.name)}</span><span class="weak-rate">${p}%</span></div><div class="weak-bar"><i style="width:${p}%"></i></div><small class="subtle">${t.total} 题 · 错 ${t.total-t.right} 题</small></div>`}).join('')}</div>`;
}
function dailyBars(days){
 const recent=days.slice(-7),max=Math.max(1,...recent.map(d=>d.count));
 return `<div class="bars" role="img" aria-label="最近 7 天每天练题数量">${recent.map(d=>`<div class="bar-col ${d.count?'has':''}"><span class="bar-count">${d.count||''}</span><i style="height:${Math.round(d.count/max*100)}%"></i><small>${'日一二三四五六'[d.date.getDay()]}</small></div>`).join('')}</div>`;
}
function statsCards(){
 const {days,topics}=statsData();
 return `<section class="stats card" aria-label="学习统计">
   <div class="cardhead">${head('学习统计','chart')}<span class="subtle">最近 14 天</span></div>
   <div class="stats-grid">
     <div class="stats-block"><h4>正确率趋势</h4>${trendSvg(days)}</div>
     <div class="stats-block"><h4>最弱知识点</h4>${weakHtml(topics)}</div>
     <div class="stats-block"><h4>每天练题</h4>${dailyBars(days)}${days.every(d=>!d.count)?'<p class="stats-note">从本版本开始记录，练几题后图表会动起来。</p>':''}</div>
   </div>
 </section>`;
}
function examQuestion(){return exam?questions.find(q=>String(q.id)===String(exam.ids[exam.index])):null}
function examAnswer(q){const a=exam?.answers[q.id];return a}
function hasAnswer(q){
 if(!exam)return false;
 const a=exam.answers[q.id];
 if(q.type==='choice'||q.type==='judge')return Boolean(a);
 return ready(q,a);
}
function examAnswerText(q){
 const a=exam?.answers[q.id];
 if(a==null||a===''||(Array.isArray(a)&&!a.length))return '未作答';
 if(q.type==='fill')return q.blanks.map((_,i)=>`第 ${i+1} 空 ${a[i]||'—'}`).join('；');
 if(q.options&&(q.type==='choice'||q.type==='multi'||q.type==='judge'))return [...String(a)].map(l=>optionText(q,l)?`${l}. ${optionText(q,l)}`:l).join('；');
 return String(a);
}
function examSetup(){
 const types=new Set(questions.map(q=>q.type));
 const topics=[...new Set(questions.map(q=>q.topic).filter(Boolean))];
 const counts=[5,10,20,30,50].filter(n=>n<questions.length).concat(questions.length?[Math.min(questions.length,50)]:[]);
 const countOptions=[...new Set(counts)].sort((a,b)=>a-b);
 return `<div class="page-title"><h1>模拟考</h1><p>按题型和知识点随机抽题，计时作答，交卷后自动判分并逐题解析。</p></div>
 <section class="card">
  <div class="cardhead">${head('组卷设置','clock')}<span class="subtle">题库共 ${questions.length} 题</span></div>
  <div class="inside">
   <p class="exam-intro">考试时不会显示答案；交卷后给出分数、你的答案与正确答案，并附上解析。主观题不计入自动分，可对照参考答案自评。</p>
   <div class="exam-fields">
    <label>题型<select id="examType"><option value="all">全部题型</option>${[...types].map(t=>`<option value="${t}">${kinds[t]||t}</option>`).join('')}</select></label>
    <label>知识点<select id="examTopic"><option value="all">全部知识点</option>${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label>
    <label>题量<select id="examCount">${countOptions.map(n=>`<option value="${n}" ${n===Math.min(20,questions.length)?'selected':''}>${n} 题</option>`).join('')}</select></label>
    <label>时长<select id="examMin">${[10,20,30,45,60].map(n=>`<option value="${n}" ${n===30?'selected':''}>${n} 分钟</option>`).join('')}</select></label>
   </div>
   ${examError?`<p class="exam-error" role="status">${esc(examError)}</p>`:''}
   <div class="control"><button class="btn primary" data-action="exam-start" ${questions.length?'':'disabled'}>开始模拟考</button></div>
  </div>
 </section>`;
}
function examRunning(){
 const q=examQuestion();
 if(!q){exam=null;return examSetup()}
 const answered=exam.ids.filter(id=>{const item=questions.find(entry=>String(entry.id)===String(id));return Boolean(item&&hasAnswer(item))}).length;
 return `<div class="page-title"><h1>模拟考</h1><p>交卷后自动判分，并给出逐题解析。</p></div>
 <div class="exam-bar card"><span class="exam-timer" id="examTimer" role="timer">--:--</span><span class="subtle">剩余时间</span><span class="exam-progress">第 ${exam.index+1} / ${exam.ids.length} 题 · 已答 ${answered}</span></div>
 <div class="columns">
  <section class="card">
   <div class="cardhead">${head('答题中','clock')}<span class="chip">${kinds[q.type]}</span></div>
   <div class="inside"><div class="chips" style="margin-bottom:10px"><span class="qid">第 ${exam.index+1} 题</span>${q.topic?`<span class="chip">${esc(q.topic)}</span>`:''}</div><h3 class="question">${esc(q.title)}</h3>${q.requirements?`<p class="requirements">${esc(q.requirements.join('\n'))}</p>`:''}${answerArea(q,null,exam.answers[q.id])}</div>
   <div class="actions"><div class="control"><button class="btn" data-action="exam-prev" ${exam.index===0?'disabled':''}>上一题</button><button class="btn" data-action="exam-next" ${exam.index===exam.ids.length-1?'disabled':''}>下一题</button></div><div class="control"><button class="btn" data-action="exam-abort">放弃</button><button class="btn primary" data-action="exam-submit">交卷</button></div></div>
  </section>
  ${examSide(answered)}
 </div>`;
}
function examSide(answered){
 return `<aside class="side card"><div class="sidehead">${head('答题卡','grid')}<span class="subtle">已答 ${answered} / ${exam.ids.length}</span></div>
 <div class="grid">${exam.ids.map((id,i)=>{const q=questions.find(item=>String(item.id)===String(id));const done=q&&hasAnswer(q);return `<button class="num ${i===exam.index?'current':done?'ok':''}" data-exam-jump="${i}" aria-label="第 ${i+1} 题，${done?'已答':'未答'}">${i+1}</button>`}).join('')}</div>
 <div class="legend">${[['current','当前'],['ok','已答'],['','未答']].map(([k,v])=>`<span><i class="dot ${k}"></i>${v}</span>`).join('')}</div>
 <div class="batch"><span class="subtle">${exam.mins} 分钟</span><button class="tiny" data-action="exam-submit">交卷</button></div></aside>`;
}
function examGrade(q){
 const a=exam.answers[q.id];
 if(q.selfReview)return null;
 if(q.type==='choice'||q.type==='judge')return a===q.answer;
 if(q.type==='multi')return a===q.answer;
 if(q.type==='fill')return q.blanks.every((_,i)=>matches(q,i,a?.[i]||''));
 return null;
}
function startExam(){
 examError='';
 const type=document.getElementById('examType')?.value||'all';
 const topic=document.getElementById('examTopic')?.value||'all';
 const count=Number(document.getElementById('examCount')?.value)||20;
 const mins=Number(document.getElementById('examMin')?.value)||30;
 let list=questions.filter(q=>(type==='all'||q.type===type)&&(topic==='all'||(q.topic||'')===topic));
 if(!list.length){examError='当前筛选下没有题目，换一个题型或知识点试试。';render();return}
 list=list.slice();
 for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
 list=list.slice(0,Math.min(count,list.length));
 exam={ids:list.map(q=>q.id),answers:{},index:0,start:Date.now(),end:Date.now()+mins*60000,submitted:false,mins,grades:{}};
 render();window.scrollTo(0,0);
}
function submitExam(){
 if(!exam||exam.submitted)return;
 exam.submitted=true;exam.submitAt=Date.now();
 clearExamTimer();
 exam.ids.forEach(id=>{
  const q=questions.find(item=>String(item.id)===String(id));
  if(!q)return;
  const ok=examGrade(q);
  exam.grades[id]=ok;
  if(typeof ok==='boolean'&&hasAnswer(q))record(q,ok);
 });
 persist();render();window.scrollTo(0,0);
}
function reviewItem(q,i){
 const g=exam.grades?.[q.id];
 const tag=g===true?'答对':g===false?'答错':'待自评';
 return `<article class="review-item ${g===true?'ok':g===false?'no':''}"><div class="review-head"><span class="review-no">第 ${i+1} 题</span><span class="chip">${kinds[q.type]}</span><span class="review-tag">${tag}</span></div><h4>${esc(q.title)}</h4><p class="review-line"><b>你的答案</b>${esc(examAnswerText(q))}</p><p class="review-line"><b>正确答案</b>${esc(answerLabel(q))}</p>${q.explanation?`<p class="review-exp">${esc(q.explanation)}</p>`:''}${q.rubric?`<p class="review-line"><b>评分要点</b>${esc(q.rubric)}</p>`:''}${q.topic?`<p class="subtle">知识点 · ${esc(q.topic)}</p>`:''}</article>`;
}
function examResult(){
 const auto=exam.ids.filter(id=>typeof exam.grades[id]==='boolean');
 const right=auto.filter(id=>exam.grades[id]).length;
 const score=auto.length?Math.round(right*100/auto.length):'—';
 const used=(exam.submitAt||Date.now())-exam.start;
 return `<div class="page-title"><h1>模拟考结果</h1><p>${exam.ids.length} 题 · 自动判分 ${auto.length} 题</p></div>
 <section class="card exam-score"><div class="score-ring"><b>${score}</b><small>分</small></div><div class="score-info"><p>答对 ${right} / ${auto.length} 题</p><p>用时 ${fmtClock(used)}</p>${exam.ids.length-auto.length?`<p class="subtle">${exam.ids.length-auto.length} 道主观题不计入自动分，请对照参考答案自评。</p>`:''}</div><button class="btn primary" data-action="exam-restart">再来一套</button></section>
 <section class="card exam-review"><div class="cardhead">${head('逐题解析','book')}<span class="subtle">共 ${exam.ids.length} 题</span></div>${exam.ids.map((id,i)=>{const q=questions.find(item=>String(item.id)===String(id));return q?reviewItem(q,i):''}).join('')}</section>`;
}
function examPage(){
 if(!questions.length)return `<div class="page-title"><h1>模拟考</h1><p>题库里还没有题目。</p></div><section class="card"><div class="empty">${icon('clock')}<h3>暂无可考题目</h3><p>先导入题库，再开始模拟考。</p><a class="btn" href="#practice">去练习台</a></div></section>`;
 if(!exam)return examSetup();
 if(exam.submitted)return examResult();
 return examRunning();
}
function fmtClock(ms){
 const total=Math.max(0,Math.round(ms/1000)),m=Math.floor(total/60),s=total%60;
 return m+':'+String(s).padStart(2,'0');
}
function clearExamTimer(){if(examTimer){clearInterval(examTimer);examTimer=null}}
function startExamTimer(){
 clearExamTimer();
 const tick=()=>{
  const node=document.getElementById('examTimer');
  if(!node)return;
  const left=Math.max(0,exam.end-Date.now());
  node.textContent=fmtClock(left);
  node.classList.toggle('low',left<60000);
  if(left<=0&&!exam.submitted){clearExamTimer();submitExam()}
 };
 tick();
 examTimer=setInterval(tick,1000);
}
function render(){
 document.querySelector('nav').innerHTML=Object.entries(tabs).map(([k,[name,ic]])=>`<a href="#${k}" ${k===tab?'class="active" aria-current="page"':''}>${icon(ic)}${name}</a>`).join('');
 if(!hasBank){
  document.title='题栈';
  app.innerHTML=`<div class="page-title"><h1>还没有题库</h1><p>导入一份 Word 题库，就可以开始刷题。</p></div><section class="card"><div class="empty">${icon('book')}<h3>题库是空的</h3><p>支持 .doc 与 .docx，导入后自动识别题目、选项与参考答案。</p><button class="btn primary" data-action="import-bank">导入题库</button></div></section>`;
  return;
 }
 if(tab==='exam'){
  document.title='模拟考 · 题栈';
  app.innerHTML=examPage();
  if(exam&&!exam.submitted)startExamTimer();else clearExamTimer();
  return;
 }
 clearExamTimer();
 const chapterRows=(items,expand)=>items.map((c,i)=>`<details class="chapter" ${expand&&i===0?'open':''}><summary><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span>${esc(c.name)}</span></summary><ul>${c.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`).join('');
 const docs=Library.materials();
 const notes=tab==='notes'?`<section class="card chapters"><div class="cardhead">${head('章节目录','book')}<button class="btn" data-action="import-notes">导入复习资料</button></div>${chapterRows(chapters,true)}${docs.map(doc=>`<section class="material"><h3>${esc(doc.name)}</h3>${chapterRows(doc.chapters,false)}</section>`).join('')}${!chapters.length&&!docs.length?'<p class="no-notes">本题库暂无知识点，可从 Word 文档导入复习资料。</p>':''}</section>`:'';
 const totals={practice:questions.length,wrong:questions.filter(q=>state.results[q.id]?.ok===false).length,saved:questions.filter(q=>state.saved[q.id]).length};
 const captions={practice:`${questions.length} 道练习题 · ${new Set(questions.map(q=>q.type)).size} 种题型`,wrong:`${totals.wrong} 道题待复习，连续答对 2 次移出`,saved:`已收藏 ${totals.saved} 道题`,exam:`${questions.length} 道题可随机组卷`,notes:`${chapters.length} 章 · ${docs.length} 份导入资料`};
 document.title=tabs[tab][0]+' · 题栈';
 const columns=`<div class="columns ${tab==='notes'||!pool.length?'single':''}">${tab==='notes'?notes:card()}${side()}</div>`;
 app.innerHTML=`<div class="page-title"><h1>${tabs[tab][0]}</h1><p>${captions[tab]}</p></div>${tab==='practice'?practiceTools():''}${tab==='practice'?overview():''}${columns}${tab==='practice'?statsCards():''}`;
 updateSearch();
}
function normalize(s){return s.normalize('NFKC').trim().replace(/\s+/g,' ')}
function matches(q,i,s){
 const aliases={'分号（;）':[';','分号'],'一':['1','一次','1次'],'第一行':['首行','第1行','第一条语句'],'try…catch':['try...catch','try catch','try-catch','try/catch','catch'],'super(参数列表)':['super(参数列表);','super(参数)','super(...)']};
 const key=q.blanks[i];return [key,...(aliases[key]||[])].some(a=>normalize(a)===normalize(s));
}
app.addEventListener('change',e=>{if(e.target.id==='filter'){state.filter[tab]=e.target.value;summary=false;buildPool();persist();render()}});
app.addEventListener('input',e=>{
 if(e.target.id==='qsearch'){query=e.target.value;updateSearch();return}
 if(tab==='exam'){
  if(!exam||exam.submitted)return;
  const q=examQuestion();
  if(!q)return;
  if(e.target.hasAttribute('data-blank')){const arr=exam.answers[q.id]||[];arr[Number(e.target.dataset.blank)]=e.target.value;exam.answers[q.id]=arr}
  else if(e.target.id==='written')exam.answers[q.id]=e.target.value;
  return;
 }
 const q=pool[index];if(!q)return;
 if(e.target.hasAttribute('data-blank')){const arr=state.drafts[q.id]||[];arr[Number(e.target.dataset.blank)]=e.target.value;state.drafts[q.id]=arr}
 else if(e.target.id==='written')state.drafts[q.id]=e.target.value;else return;
 persist();if(document.querySelector('#submit'))document.querySelector('#submit').disabled=!ready(q,state.drafts[q.id]);
});
app.addEventListener('keydown',e=>{
 if(e.target.id==='qsearch'){
  if(e.key==='Enter'){e.preventDefault();if(searchHits[0])jumpToQuestion(searchHits[0].id)}
  else if(e.key==='Escape'){query='';e.target.value='';updateSearch()}
 }
});
app.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn||btn.disabled)return;
 const data=btn.dataset;
 if('mode' in data){mode=data.mode==='recite'?'recite':'normal';recite={};summary=false;query='';render();return}
 if('goto' in data){jumpToQuestion(data.goto);return}
 if(data.action==='import-bank'){Library.openImport('bank');return}
 if(data.action==='import-notes'){Library.openImport('notes');return}
 if(tab==='exam'){
  if(data.action==='exam-start'){startExam();return}
  if(!exam)return;
  if(exam.submitted){
   if(data.action==='exam-restart'){exam=null;examError='';render();window.scrollTo(0,0)}
   return;
  }
  if('examJump' in data){exam.index=Number(data.examJump);render();return}
  if(data.action==='exam-prev'){exam.index=Math.max(0,exam.index-1);render();return}
  if(data.action==='exam-next'){exam.index=Math.min(exam.ids.length-1,exam.index+1);render();return}
  if(data.action==='exam-submit'){submitExam();return}
  if(data.action==='exam-abort'){if(confirm('确定放弃本次模拟考？本次作答不会保存。')){exam=null;examError='';render();window.scrollTo(0,0)}return}
  const eq=examQuestion();
  if(eq&&'choice' in data){
   if(eq.type==='multi'){
    const set=new Set(exam.answers[eq.id]||'');
    if(set.has(data.choice))set.delete(data.choice);else set.add(data.choice);
    exam.answers[eq.id]=[...set].sort().join('');
   }else exam.answers[eq.id]=data.choice;
   render();
  }
  return;
 }
 const q=pool[index];
 if('jump' in data){move(Number(data.jump));return}
 if('page' in data){page+=Number(data.page);render();return}
 if(!q)return;
 if('choice' in data){
  if(q.type==='multi'){
   const selected=new Set(state.drafts[q.id]||'');
   if(selected.has(data.choice))selected.delete(data.choice);else selected.add(data.choice);
   state.drafts[q.id]=[...selected].sort().join('');persist();render();return;
  }
  state.drafts[q.id]=data.choice;
  if(q.selfReview){state.results[q.id]={ok:null};delete state.retrying[q.id];persist();render();return}
  gradeAnswer(q,data.choice===q.answer);
  delete state.retrying[q.id];
  if(tab==='wrong'||(tab==='practice'&&mode==='recite')){persist();render();return}
  persist();nextQuestion();
  return;
 }
 if('grade' in data){gradeAnswer(q,data.grade==='1');persist();render();return}
 switch(data.action){
 case 'save':state.saved[q.id]=!state.saved[q.id];if(tab==='saved'&&!state.saved[q.id]){pool.splice(index,1);index=Math.max(0,Math.min(index,pool.length-1));page=Math.floor(index/groupSize)}break;
 case 'next':nextQuestion();return;
 case 'retry':state.retrying[q.id]=true;delete state.drafts[q.id];break;
 case 'flip':recite[q.id]='test';delete state.drafts[q.id];delete state.retrying[q.id];break;
 case 'flipback':recite[q.id]='memorize';break;
 case 'submit':{
  const d=state.drafts[q.id];if(!ready(q,d))return;
  delete state.retrying[q.id];
  let ok=null;
  if(!q.selfReview){
   if(q.type==='multi')ok=d===q.answer;
   else if(q.type==='fill')ok=q.blanks.every((_,i)=>matches(q,i,d[i]));
  }
  gradeAnswer(q,ok);
  break;
 }
 default:return;
 }
 persist();render();
});
document.querySelectorAll('[data-icon]').forEach(n=>n.innerHTML=icon(n.dataset.icon));
window.addEventListener('hashchange',enter);
Library.init(activateBank);
