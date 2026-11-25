const WordImport = (function(){
'use strict';
const sectionTypes={'单项选择':'choice','单选':'choice','选择':'choice','多项选择':'multi','多选':'multi','判断':'judge','填空':'fill','简答':'short','问答':'short','论述':'short','编程':'code','程序设计':'code','知识点速览':'notes','知识点':'notes','复习资料':'notes'};
const numbered=/^\s*(?:第\s*(\d+)\s*题[：:、.]?|(\d{1,4})\s*[.．、)）](?!\d))\s*(.*)$/;
function heading(line){
 const title=line.trim().replace(/^(?:[一二三四五六七八九十百]+|\d+)\s*[、.．]\s*/,'').replace(/[（(].*$/,'').replace(/[\s：:]+$/,'').replace(/题$/,'');
 return sectionTypes[title];
}
function labelParts(text){
 const labels=/【\s*(参考答案|正确答案|答案|知识点|答案解析|解析|参考代码|评分要点|易错点)\s*】\s*[：:]?|(?:参考答案|正确答案|答案解析|参考代码|评分要点|易错点|知识点|解析|答案)\s*[：:]/g;
 const matches=Array.from(text.matchAll(labels));const fields={prompt:text.slice(0,matches.length?matches[0].index:text.length).trim()};
 for(let i=0;i<matches.length;i++){
  const m=matches[i],key=(m[1]||m[0]).replace(/[\s：:]/g,'');
  fields[key]=text.slice(m.index+m[0].length,i+1<matches.length?matches[i+1].index:text.length).trim();
 }
 return fields;
}
function notesFrom(lines,name){
 const chapters=[];let current;
 for(const raw of lines){
  const line=raw.trim();if(!line||/^[一二三四五六七八九十]+、知识点速览$/.test(line))continue;
  if(/^第[一二三四五六七八九十百\d]+[章节篇](?:\s|[、：:.．]|$)/.test(line)){
   current={name:line,notes:[]};chapters.push(current);continue;
  }
  if(!current){current={name,notes:[]};chapters.push(current)}
  current.notes.push(line.replace(/^[·•]\s*/,''));
 }
 return chapters.filter(c=>c.notes.length);
}
function choices(text){
 const re=/(?:^|[\s　])([A-HＡ-Ｈ])[.．、:：)）]\s*/gm;
 const markers=Array.from(text.matchAll(re));
 const start=markers.findIndex(m=>m[1].normalize('NFKC')==='A');
 if(start<0)return null;
 const options=markers.slice(start);
 if(options.length<2||!options.every((m,i)=>m[1].normalize('NFKC')==='ABCDEFGH'[i]))return null;
 return {title:text.slice(0,options[0].index).trim(),options:options.map((m,i)=>text.slice(m.index+m[0].length,i+1<options.length?options[i+1].index:text.length).trim())};
}
function choiceKey(answer,count){
 const key=answer.normalize('NFKC').toUpperCase().replace(/[\s、,;，；.。]/g,'');
 if(!/^[A-H]+$/.test(key)||[...key].some(c=>'ABCDEFGH'.indexOf(c)>=count))return '';
 return [...new Set(key)].sort().join('');
}
function judgeKey(a){
 const s=a.trim().replace(/[。.\s]/g,'').toUpperCase();
 if(/^(?:正确|对|是|√|✓|✔|T|TRUE|A)$/.test(s))return 'A';
 if(/^(?:错误|错|否|×|✗|✘|X|F|FALSE|B)$/.test(s))return 'B';
 return '';
}
function makeQuestion(block,id){
 const f=labelParts([block.title,...block.lines].join('\n'));
 let answer=f['参考代码']||f['正确答案']||f['参考答案']||f['答案']||block.endKey||'';
 const opts=choices(f.prompt);
 let type=block.type||(opts?'choice':/_{2,}/.test(f.prompt)?'fill':'short');
 const q={id,num:block.n,type,title:f.prompt,topic:f['知识点']||'',explanation:f['解析']||f['答案解析']||''};
 const level=q.topic.match(/[（(]([易中难])[）)]$/);if(level){q.level=level[1];q.topic=q.topic.slice(0,level.index)}
 if(['choice','multi','judge'].includes(type)){
  let title=opts?opts.title:f.prompt;
  const marked=title.match(/[（(]\s*([A-Ha-hＡ-Ｈ]{1,8}|正确|错误|√|×)\s*[）)]\s*[。.]?$/);
  if(marked&&!answer){answer=marked[1];title=title.slice(0,marked.index)}
  q.title=title.replace(/[（(]\s*[）)]\s*$/,'').trim();
  q.options=opts?.options||(type==='judge'?['正确','错误']:[]);
  if(!q.options.length||q.options.some(s=>!s)){q.type='short';q.title=f.prompt;q.answer=answer;q.selfReview=true;return q}
  let key=choiceKey(answer,q.options.length);
  if(type==='judge'&&!key){
   const truth=judgeKey(answer);
   const at=truth?q.options.findIndex(option=>judgeKey(option)===truth):-1;
   key=at>=0?'ABCDEFGH'[at]:'';
  }
  if(key.length>1)q.type='multi';
  q.answer=key||answer;q.selfReview=!key;
 }else if(type==='fill'){
  const slots=(f.prompt.match(/_{2,}|（\s*）/g)||[]).length;
  let keys=answer.split(/[；;]/).map(s=>s.trim());
  if(slots===1)keys=[answer];
  if(slots>1&&keys.length!==slots)keys=answer.split(/[、，,]/).map(s=>s.trim());
  q.selfReview=!answer||Boolean(slots&&keys.length!==slots)||keys.some(x=>!x);
  q.blanks=q.selfReview?Array(slots||1).fill(''):keys;q.answer=answer;
 }else{
  q.answer=answer;
  if(type==='code'){
   const parts=q.title.split('\n');q.title=parts.shift();q.requirements=parts;
   q.rubric=f['评分要点']||'';q.pitfall=f['易错点']||'';
  }
 }
 return q;
}
function parseBank(lines,name){
 const blocks=[],preface=[],pendingKeys=[];let block,type,answerSection=false,answerType,notes=false,lastKey;
 const content=lines.filter(line=>line.trim());
 for(const [i,raw] of content.entries()){
  const line=raw.trim();
  if(/^(?:[一二三四五六七八九十]+[、.．]\s*)?(?:参考答案|答案(?:与解析|及解析|汇总)?)[：:]?$/.test(line)){
   // A standalone answer label inside a question can introduce a multiline model answer.
   const next=(content[i+1]||'').trim();
   if(block&&!numbered.test(next)&&!heading(next)&&!line.includes('汇总')){
    block.lines.push('参考答案：');continue;
   }
   answerSection=true;answerType=null;block=null;lastKey=null;continue;
  }
  const kind=heading(line);
  if(kind){if(answerSection)answerType=kind;else{type=kind==='notes'?null:kind;notes=kind==='notes';block=null}continue}
  if(answerSection){
   const parts=line.split(/\s+(?=\d{1,4}\s*[.．、)）]\s*[A-HＡ-Ｈ√×对错](?:[\s,，、A-HＡ-Ｈ]|$))/);
   for(const p of parts){const m=p.match(numbered);if(m){lastKey={n:Number(m[1]||m[2]),type:answerType,text:m[3]};pendingKeys.push(lastKey)}else if(lastKey){lastKey.text+='\n'+p}}
   continue;
  }
  if(notes){preface.push(raw);continue}
  const m=line.match(numbered);
  if(m){block={n:Number(m[1]||m[2]),type,title:m[3],lines:[]};blocks.push(block)}
  else if(block)block.lines.push(raw);
 }
 for(const k of pendingKeys){
  const matches=blocks.filter(b=>b.n===k.n&&(!k.type||b.type===k.type));
  if(matches.length===1&&!matches[0].endKey)matches[0].endKey=k.text;
 }
 const questions=blocks.map((b,i)=>makeQuestion(b,i+1));
 if(!questions.length)throw Error('没有识别到带题号的题目。请用“1、题干”另起一行，选项用“A、… B、…”，答案用“答案：B”。');
 if(questions.some(q=>!q.title))throw Error('有题号缺少题干，请补全题目后重新导入。');
 return {name,questions,chapters:notesFrom(preface,'知识点'),manual:questions.filter(q=>q.selfReview||!q.answer).length};
}
function parseAnswers(lines){
 const entries=[];let last=null;
 const push=(n,text)=>{text=String(text||'').trim();if(!text)return;last={n,text};entries.push(last)};
 for(const raw of lines){
  const line=raw.trim();if(!line)continue;
  if(/^(?:[一二三四五六七八九十]+[、.．]\s*)?(?:参考答案|正确答案|答案(?:与解析|及解析|汇总)?)[：:]?$/.test(line)){last=null;continue}
  const range=line.match(/^(\d{1,4})\s*[-–—~至]\s*(\d{1,4})\s*[：:.、]?\s*([A-HＡ-Ｈ]{2,})$/);
  if(range){
   const from=Number(range[1]),to=Number(range[2]),letters=[...range[3].normalize('NFKC').toUpperCase()];
   for(let n=from;n<=to;n++)push(n,letters[n-from]||'');
   last=null;continue;
  }
  const parts=line.split(/\s+(?=\d{1,4}\s*[.．、)）]\s*\S)/);
  let matched=false;
  for(const part of parts){
   const m=part.match(numbered);
   if(!m)continue;
   matched=true;push(Number(m[1]||m[2]),m[3]);
  }
  if(!matched&&last&&!/^[一二三四五六七八九十百\d]+\s*[、.．]\s*/.test(line))last.text+='\n'+line;
 }
 return entries;
}
function applyAnswer(q,text){
 const raw=String(text??'').trim();if(!raw)return false;
 if(['choice','multi','judge'].includes(q.type)){
  let key='';
  const run=raw.normalize('NFKC').toUpperCase().match(/^[A-H][A-H\s、,，;；.。]*/);
  if(run)key=choiceKey(run[0],q.options?.length||0);
  if(!key&&q.type==='judge'){
   const truth=judgeKey(raw.split(/[，,。.；;\s]/)[0]);
   const at=truth?(q.options||[]).findIndex(option=>judgeKey(option)===truth):-1;
   key=at>=0?'ABCDEFGH'[at]:'';
  }
  if(!key)return false;
  q.answer=key;if(q.type!=='judge')q.type=key.length>1?'multi':'choice';q.selfReview=false;return true;
 }
 if(q.type==='fill'){
  const slots=Array.isArray(q.blanks)&&q.blanks.length?q.blanks.length:1;
  let keys=raw.split(/[；;]/).map(s=>s.trim()).filter(Boolean);
  if(slots===1)keys=[raw];
  else if(keys.length!==slots)keys=raw.split(/[、，,]/).map(s=>s.trim());
  if(slots>1&&keys.length!==slots)return false;
  q.blanks=keys;q.answer=raw;q.selfReview=false;return true;
 }
 q.answer=raw;q.selfReview=false;return true;
}
return {parseBank,notesFrom,parseAnswers,applyAnswer};
})();
