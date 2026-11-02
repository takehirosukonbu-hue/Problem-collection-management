export const VERSION = 1;
export const GRADES = ['〇', '△', '×'];
export const FAILURE_DAYS = [1, 3, 7, 14, 30];
export function today(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
}
export function addDays(day, count) {
  if (!isDate(day) || !Number.isInteger(count)) throw new Error('日付を確認してください。');
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+count);
  return d.toISOString().slice(0,10);
}
export function emptyData() { return { version: VERSION, books: [], records: [] }; }
export function validateData(data) {
  if (!data || data.version !== VERSION || !Array.isArray(data.books) || !Array.isArray(data.records)) throw new Error('対応するバックアップファイルではありません。');
  if(data.books.length>1000 || data.records.length>300000) throw new Error('データ件数が上限を超えています。');
  const bookIds=new Set(), recordIds=new Set();
  for(const b of data.books){
    if(!b || typeof b.id!=='string' || !b.id || bookIds.has(b.id) || typeof b.name!=='string' || !b.name.trim() || b.name.length>100 || !Number.isInteger(b.count) || b.count<1 || b.count>10000 || typeof b.note!=='string' || b.note.length>2000) throw new Error('教材データが不正です。');
    bookIds.add(b.id);
  }
  const bookMap=new Map(data.books.map(b=>[b.id,b]));
  for(const r of data.records){
    if(!r || typeof r.id!=='string' || !r.id || recordIds.has(r.id) || !bookMap.has(r.bookId) || !Number.isInteger(r.question) || r.question<1 || r.question>bookMap.get(r.bookId).count || !GRADES.includes(r.grade) || !['new','review'].includes(r.mode) || !isDate(r.day) || typeof r.at!=='string' || Number.isNaN(Date.parse(r.at))) throw new Error('学習記録データが不正です。');
    recordIds.add(r.id);
  }
  return data;
}
export function sortedRecords(records) {
  return records.map((r,i)=>({...r,_order:i})).sort((a,b)=>a.day.localeCompare(b.day)||a.at.localeCompare(b.at)||a._order-b._order);
}
// Replay a question's history, retaining the independent 30-day obligations from △.
export function questionState(records, asOf = null) {
  let pending=[], failure=null, last=null;
  function postponeUntil(day) {
    if(!pending.length)return 0;
    const nearest=pending.reduce((a,p)=>p.due<a?p.due:a,pending[0].due);
    if(nearest>=day)return 0;
    const days=Math.round((Date.parse(`${day}T12:00:00Z`)-Date.parse(`${nearest}T12:00:00Z`))/86400000);
    pending=pending.map(p=>({...p,due:addDays(p.due,days)}));
    if(failure)failure={...failure,anchor:addDays(failure.anchor,days)};
    return days;
  }
  for(const r of sortedRecords(records)){
    // Move the whole uncompleted schedule before consuming today's task.
    postponeUntil(r.day);
    pending=pending.filter(p=>p.kind==='fixed' && p.due>r.day);
    if(r.mode==='new') failure=null;
    if(r.grade==='〇'){
      failure=null;
      pending.push({due:addDays(r.day,30),kind:'primary',source:r.id});
    }else if(r.grade==='△'){
      failure=null;
      pending.push({due:addDays(r.day,7),kind:'primary',source:r.id});
      pending.push({due:addDays(r.day,30),kind:'fixed',source:r.id});
    }else{
      failure=failure?{anchor:failure.anchor,step:failure.step+1}:{anchor:r.day,step:0};
      let due;
      while(failure.step<FAILURE_DAYS.length){
        due=addDays(failure.anchor,FAILURE_DAYS[failure.step]);
        if(due>r.day)break;
        failure.step++;
      }
      if(failure.step>=FAILURE_DAYS.length)due=addDays(r.day,30);
      pending.push({due,kind:'primary',source:r.id});
    }
    last=r;
  }
  const postponedDays=asOf?postponeUntil(asOf):0;
  const unique=new Map();
  for(const p of pending)unique.set(p.due,p);
  const dates=[...unique.keys()].sort();
  return {dates,next:dates[0]||null,last,failure,postponedDays};
}
export function allQuestions(data, asOf=today()) {
  const grouped=new Map();
  for(const r of data.records){const key=`${r.bookId}:${r.question}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
  return [...grouped.values()].map(records=>({bookId:records[0].bookId,question:records[0].question,...questionState(records,asOf)}));
}
export function dueQuestions(data, day=today(), bookId=null) {
  return allQuestions(data,day).filter(q=>q.next && q.next<=day && (!bookId||q.bookId===bookId)).sort((a,b)=>a.next.localeCompare(b.next)||a.question-b.question);
}
export function groupedDue(data,day=today()) {
  const due=dueQuestions(data,day);
  return data.books.map(book=>({book,questions:due.filter(q=>q.bookId===book.id)})).filter(g=>g.questions.length);
}
export function newRecord({bookId,question,grade,mode,day=today()},id=globalThis.crypto.randomUUID(),at=new Date().toISOString()) {
  if(!GRADES.includes(grade)||!['new','review'].includes(mode)||!Number.isInteger(question)||question<1||!isDate(day))throw new Error('入力内容を確認してください。');
  return {id,bookId,question,grade,mode,day,at};
}
