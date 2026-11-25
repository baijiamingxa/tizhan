const BankExport = (function(){
'use strict';
const enc=new TextEncoder();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={choice:'单选题',multi:'多选题',judge:'判断题',fill:'填空题',short:'简答题',code:'编程题'};
const crcTable=(()=>{
 const table=new Uint32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0}
 return table;
})();
function crc32(bytes){
 let c=0xFFFFFFFF;
 for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&0xFF]^(c>>>8);
 return (c^0xFFFFFFFF)>>>0;
}
function zip(files){
 const u16=v=>[v&255,(v>>8)&255];
 const u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
 const parts=[],central=[];
 let offset=0;
 const date=((2026-1980)<<9)|(1<<5)|1;
 for(const file of files){
  const name=enc.encode(file.name),data=enc.encode(file.content),crc=crc32(data);
  const head=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)];
  central.push({name,crc,size:data.length,offset});
  parts.push(new Uint8Array(head),name,data);
  offset+=head.length+name.length+data.length;
 }
 const centralStart=offset;
 for(const entry of central){
  const head=[...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(date),...u32(entry.crc),...u32(entry.size),...u32(entry.size),...u16(entry.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(entry.offset)];
  parts.push(new Uint8Array(head),entry.name);
  offset+=head.length+entry.name.length;
 }
 parts.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(offset-centralStart),...u32(centralStart),...u16(0)]));
 const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);
 let at=0;parts.forEach(p=>{out.set(p,at);at+=p.length});
 return out;
}
function documentXml(lines){
 const body=lines.map(line=>`<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr/></w:body></w:document>';
}
function linesFor(bank,withAnswers){
 const lines=[bank.name||'题库'];
 if(bank.chapters&&bank.chapters.length){
  lines.push('一、知识点速览');
  bank.chapters.forEach(chapter=>{
   lines.push(chapter.name);
   (chapter.notes||[]).forEach(note=>lines.push(note));
  });
 }
 let lastType=null;
 (bank.questions||[]).forEach((q,index)=>{
  const type=q.type||'choice';
  if(type!==lastType){lines.push('一、'+(types[type]||'题目'));lastType=type}
  lines.push(`${q.num||index+1}、${q.title}`);
  (q.requirements||[]).forEach(item=>lines.push(item));
  (q.options||[]).forEach((option,i)=>lines.push('ABCDEFGH'[i]+'、'+option));
  if(withAnswers){
   if(q.answer)lines.push('参考答案：'+q.answer);
   if(q.explanation)lines.push('解析：'+q.explanation);
   if(q.rubric)lines.push('评分要点：'+q.rubric);
   if(q.pitfall)lines.push('易错点：'+q.pitfall);
   if(q.topic)lines.push('知识点：'+q.topic);
  }
 });
 return lines;
}
function fileName(bank,withAnswers){
 const base=String(bank.name||'题库').replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,60);
 return `${base}-${withAnswers?'含答案':'无答案'}.docx`;
}
function create(bank,withAnswers){
 const bytes=zip([
  {name:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
  {name:'word/document.xml',content:documentXml(linesFor(bank,withAnswers))}
 ]);
 return {name:fileName(bank,withAnswers),bytes};
}
function save(bank,withAnswers){
 const file=create(bank,withAnswers);
 const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 if(window.TizhanSave&&typeof window.TizhanSave.save==='function'){
  let binary='';
  for(let i=0;i<file.bytes.length;i+=0x8000)binary+=String.fromCharCode.apply(null,file.bytes.subarray(i,i+0x8000));
  window.TizhanSave.save(file.name,mime,btoa(binary));
  return file.name;
 }
 const url=URL.createObjectURL(new Blob([file.bytes],{type:mime}));
 const link=document.createElement('a');
 link.href=url;link.download=file.name;document.body.appendChild(link);link.click();
 setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},1000);
 return file.name;
}
return {create,save};
})();
