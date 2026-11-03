export const VERSION = 1;
export const GRADES = ['〇', '△', '×'];
export const FAILURE_DAYS = [1, 3, 7, 14, 30];
export function unitKey(item) {
  return `${item.bookId || ''}:${item.question}:${item.subquestion || 0}`;
}
export function questionLabel(item) {
  return `第${item.question}問${item.subquestion ? `（${item.subquestion}）` : ''}`;
}
export function questionUnits(book, question) {
  const count = book.subquestions?.[question] || 0;
  return count ? Array.from({length:count}, (_,i)=>({question,subquestion:i+1})) : [{question}];
}
export function activeRecord(book, record) {
  const count = book.subquestions?.[record.question] || 0;
  return count ? record.subquestion >= 1 && record.subquestion <= count : !record.subquestion;
}
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
    if(b.subquestions !== undefined){
      if(!b.subquestions || typeof b.subquestions !== 'object' || Array.isArray(b.subquestions))throw new Error('小問設定が不正です。');
      for(const [question,count] of Object.entries(b.subquestions)){
        if(!/^[1-9]\d*$/.test(question) || Number(question)>b.count || !Number.isInteger(count) || count<0 || count>100)throw new Error('小問数は0〜100で指定してください。');
      }
    }
  }
  const bookMap=new Map(data.books.map(b=>[b.id,b]));
  for(const r of data.records){
    if(!r)throw new Error('学習記録データが不正です。');
    if(r.subquestion!==undefined && (!Number.isInteger(r.subquestion)||r.subquestion<1||r.subquestion>100))throw new Error('小問番号が不正です。');
    if(r.voided!==undefined && typeof r.voided!=='boolean')throw new Error('記録の取消状態が不正です。');
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
  for(const r of sortedRecords(records).filter(r=>!r.voided)){
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
  const books = new Map(data.books.map(book=>[book.id,book]));
  for(const r of data.records){if(r.voided || !activeRecord(books.get(r.bookId),r))continue;const key=unitKey(r);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
  const states=[...grouped.values()].map(records=>({bookId:records[0].bookId,question:records[0].question,subquestion:records[0].subquestion,...questionState(records,asOf)}));
  for(const book of data.books)for(const [number,count] of Object.entries(book.subquestions||{})){
    if(!count)continue;
    for(const unit of questionUnits(book,Number(number))){const item={bookId:book.id,...unit};if(!grouped.has(unitKey(item)))states.push({...item,dates:[asOf],next:asOf,last:{grade:'未入力'},failure:null,postponedDays:0,awaitingFirst:true});}
  }
  return states;
}
export function dueQuestions(data, day=today(), bookId=null) {
  return allQuestions(data,day).filter(q=>q.next && q.next<=day && (!bookId||q.bookId===bookId)).sort((a,b)=>a.next.localeCompare(b.next)||a.question-b.question);
}
export function groupedDue(data,day=today()) {
  const due=dueQuestions(data,day);
  return data.books.map(book=>({book,questions:due.filter(q=>q.bookId===book.id)})).filter(g=>g.questions.length);
}
export function newRecord({bookId,question,subquestion,grade,mode,day=today()},id=globalThis.crypto.randomUUID(),at=new Date().toISOString()) {
  if(!GRADES.includes(grade)||!['new','review'].includes(mode)||!Number.isInteger(question)||question<1||!isDate(day))throw new Error('入力内容を確認してください。');
  if(subquestion!==undefined && (!Number.isInteger(subquestion)||subquestion<1||subquestion>100))throw new Error('小問番号を確認してください。');
  return {id,bookId,question,...(subquestion?{subquestion}:{}),grade,mode,day,at};
}

export function bookOverview(data, bookId, asOf=today()) {
 const book=data.books.find(b=>b.id===bookId);if(!book)return [];
 const histories=new Map();
 for(const r of data.records){if(r.bookId!==bookId||r.voided||!activeRecord(book,r))continue;const key=unitKey(r);if(!histories.has(key))histories.set(key,[]);histories.get(key).push(r);}
 return Array.from({length:book.count},(_,i)=>questionUnits(book,i+1)).flat().map(unit=>{
  const item={bookId,...unit},records=histories.get(unitKey(item))||[],state=questionState(records,asOf);
  const ifWrong=state.next?questionState([...records,{...item,id:'preview',grade:'×',mode:'review',day:state.next,at:state.next+'T23:59:59.999Z'}]).dates:[];
  return {...item,...state,...(!state.last&&unit.subquestion?{next:asOf}:{}),ifWrong};
 });
}
