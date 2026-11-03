import {VERSION, GRADES, today, addDays, emptyData, validateData, allQuestions, dueQuestions, groupedDue, newRecord, unitKey, questionLabel, questionUnits, activeRecord} from './core.js?v=subquestions-1';

const KEY='study-review:data:v1', BACKUP_KEY='study-review:before-import:v1';
const main=document.querySelector('#main'), dialog=document.querySelector('#dialog');
const icons={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',pencil:'<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h.01m4 0h.01m4 0h.01"/>',chevron:'<path d="m9 5 7 7-7 7"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',book:'<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',plus:'<path d="M12 4v16M4 12h16"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||icons.book}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{const date=new Date(`${d}T12:00:00`);return `${date.getMonth()+1}/${date.getDate()}`;};
const long=d=>new Date(`${d}T12:00:00`).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
let data=emptyData(),raw=null,loadError=false,page='home',selectedBook='',inputMode='review',inputBook='',session=null,summary=null,calBook='',calView='dates',calOffset=0,calDay=null,bookFormId=null,bulk={bookId:'',view:'latest',from:'',to:'',day:'',selected:new Set()},toastTimer;
try{raw=localStorage.getItem(KEY);if(raw)data=validateData(JSON.parse(raw));}catch(e){loadError=true;storageAlert('保存データを読み込めませんでした。データを上書きしないため入力を停止しています。ブラウザー設定、またはバックアップを確認してください。');}
function storageAlert(message){const el=document.querySelector('#storage-alert');el.textContent=message;el.hidden=false;}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},3800);}
function clone(){return JSON.parse(JSON.stringify(data));}
function commit(next,{restore=false}={}){
 try{
  if(loadError&&!restore)throw Error('保存データを確認できないため変更できません。');
  validateData(next);
  if(!restore&&localStorage.getItem(KEY)!==raw){reloadFromStorage();throw Error('別の画面で記録が更新されました。最新の内容を確認して、もう一度操作してください。');}
  const text=JSON.stringify(next);localStorage.setItem(KEY,text);raw=text;data=next;loadError=false;document.querySelector('#storage-alert').hidden=true;return true;
 }catch(e){toast(e.name==='QuotaExceededError'?'端末の保存容量が不足しています。バックアップを書き出して容量をご確認ください。':e.message);return false;}
}
function reloadFromStorage(){
 try{raw=localStorage.getItem(KEY);data=raw?validateData(JSON.parse(raw)):emptyData();loadError=false;session=null;summary=null;bulk.selected.clear();render();}catch{loadError=true;storageAlert('別の画面で保存データが変更されましたが、読み込めません。入力を停止しています。');}
}
window.addEventListener('storage',e=>{if(e.key===KEY){if(dialog.open)dialog.close();reloadFromStorage();toast('別の画面の変更を反映しました。');}});
const bookById=id=>data.books.find(b=>b.id===id);
const bookOptions=(id,all=false)=>`${all?'<option value="">すべての教材</option>':''}${data.books.map(b=>`<option value="${esc(b.id)}" ${id===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}`;
function empty(title,body,action=''){return `<div class="empty"><h2>${title}</h2><p class="muted">${body}</p>${action}</div>`;}
const btn=(label,action,cls='primary')=>`<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
function back(label='戻る',action='back-home'){return btn(`‹ ${label}`,action,'quiet');}
function questionList(questions){return `<div class="question-list">${questions.map(q=>`<div class="question-item"><div><h3>${questionLabel(q)}</h3><p class="muted">予定：${fmt(q.next)}${q.postponedDays?` · ${q.postponedDays}日繰越`:''}</p></div><span class="badge">前回 ${q.last.grade}</span></div>`).join('')}</div>`;}
function home(){
 const groups=groupedDue(data),total=groups.reduce((n,g)=>n+g.questions.length,0),overdue=dueQuestions(data).filter(q=>q.postponedDays>0).length;
 return `<p class="eyebrow">${long(today())}</p><h1>今日の学習</h1><div class="hero"><div><p class="muted">今日の復習</p><p class="big">${total}<small>問</small></p><p class="muted">${groups.length}つの教材から${overdue?` · 繰越 ${overdue}問を含む`:''}</p></div><div class="rings" aria-hidden="true"></div></div>${data.books.length===0?empty('最初の教材を登録しましょう','教材名と問題数を登録すると、学習結果を入力できます。',btn('教材を追加','add-book')):groups.length?`<div class="row section"><h2>今日取り組む教材</h2><span class="muted">あと${total}問</span></div>${groups.map(g=>`<button class="book" data-open-book="${esc(g.book.id)}"><span><span class="book-title">${esc(g.book.name)}</span><span class="muted">タップして対象の問題を確認</span></span><span class="count">${g.questions.length}<small>問</small>${icon('chevron')}</span></button>`).join('')}`:empty('今日の復習はありません',data.records.length?'次の復習はカレンダーで確認できます。新しく学習した内容も入力できます。':'「入力」から新しいサイクルの学習結果を記録しましょう。',btn('新しいサイクルを入力','new-cycle'))}<p class="note">復習予定から、自動でまとめています。</p>`;
}
function detail(){const book=bookById(selectedBook);if(!book)return home();const due=dueQuestions(data,today(),book.id);return `${back('今日の学習')}<h1>${esc(book.name)}</h1><p class="muted">今日復習する問題 · ${due.length}問</p>${questionList(due)}${due.length?btn('この教材の結果を入力','review-book'):empty('今日の復習は完了しました','次の予定はカレンダーで確認できます。')}`;}
function input(){
 const header=`<div class="row"><button class="quiet menu-button" data-action="menu" aria-label="編集メニュー">${icon('menu')}<span>編集</span></button>${session?btn('終了','finish','quiet'):''}</div>`;
 if(session){
  const book=bookById(session.bookId),q=session.questions[session.index],state=allQuestions(data).find(s=>s.bookId===session.bookId&&s.question===q.question&&(s.subquestion||0)===(q.subquestion||0));
  return header+`<p class="eyebrow" style="margin-top:17px">${esc(book.name)} · ${session.mode==='review'?'今日の復習':'新しいサイクル'}</p><div class="row"><h2>学習結果を記録</h2><span class="muted">${session.index+1} / ${session.questions.length}問</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${session.questions.length}" aria-valuenow="${session.index}" aria-label="入力済み"><span style="width:${session.index/session.questions.length*100}%"></span></div><div class="flash"><p class="muted">この問題の結果は？</p><p class="question">${questionLabel(q)}</p><span class="muted">${state?.last?`前回の結果：${state.last.grade}`:'初めての記録'}</span></div>${btn(q.subquestion?'小問の設定を変更':'この問題を小問に分ける','split-current','quiet')}<div class="grades">${GRADES.map((g,i)=>`<button type="button" data-grade="${g}" aria-label="${['完答','計算ミスなど、本質的ではないミス','不正解'][i]}"><span class="grade">${g}</span><span>${['完答','計算ミスなど','不正解'][i]}</span></button>`).join('')}</div><button class="secondary" data-action="skip">未入力のまま次へ</button><div class="center"><button class="quiet" data-action="undo" ${session.index>0?'':'disabled'}>↶ ひとつ戻る</button></div><p class="inline-note center">入力ごとに自動保存 · 途中で終了できます</p>`;
 }
 if(summary){
  const records=data.records.filter(r=>summary.ids.includes(r.id)&&!r.voided),states=allQuestions(data).filter(q=>q.bookId===summary.bookId&&records.some(r=>unitKey(r)===unitKey(q)));
  return header+`<div class="hero"><div><p class="muted">今回の入力</p><p class="big">${records.length}<small>問</small></p></div><div class="rings" aria-hidden="true"></div></div><h1>おつかれさまでした</h1><div class="summary-grades">${GRADES.map(g=>`<span>${g} ${records.filter(r=>r.grade===g).length}問</span>`).join('')}</div><p class="inline-note">未入力のまま進んだ問題：${summary.skipped||0}問（結果・予定の変更なし）</p><h2>次回の復習</h2><div class="question-list">${states.sort((a,b)=>a.question-b.question).map(q=>`<div class="question-item"><span>${questionLabel(q)}</span><span>${fmt(q.next)}</span></div>`).join('')}</div>${btn('入力画面に戻る','input-setup')}`;
 }
 if(!data.books.length)return header+empty('教材を追加してください','まず教材名と問題数を登録します。',btn('教材を追加','add-book'));
 if(!bookById(inputBook))inputBook=data.books[0].id;
 const due=dueQuestions(data,today(),inputBook);
 return header+`<h1 style="margin-top:15px">学習のあとに、<br>さっと記録。</h1><div class="pills"><button data-mode="review" aria-pressed="${inputMode==='review'}">復習</button><button data-mode="new" aria-pressed="${inputMode==='new'}">新しいサイクル</button></div><form id="input-form"><label class="field">教材<select id="input-book" name="bookId">${bookOptions(inputBook)}</select></label>${inputMode==='new'?`<label class="field">開始問題番号<input name="start" type="number" min="1" max="${bookById(inputBook).count}" required value="1" inputmode="numeric"></label><p class="inline-note">全${bookById(inputBook).count}問 · 開始番号から順に入力します。</p>`:`<div class="detail"><p class="muted">今日の復習対象</p><p class="count">${due.length}<small>問</small></p><p class="muted">${due.length?'繰越分を含め、対象の問題を順番に表示します。':'この教材の復習予定は、まだありません。'}</p></div>`}<button class="primary" type="submit" ${inputMode==='review'&&!due.length?'disabled':''}>入力を始める</button></form>`;
}
function calendar(){
 const start=addDays(today(),calOffset),questions=allQuestions(data).filter(q=>!calBook||q.bookId===calBook),book=bookById(calBook);
 const onDay=d=>questions.filter(q=>q.next&&(d===today()?q.next<=d:q.next===d));
 const grouped=qs=>data.books.map(b=>({book:b,count:qs.filter(q=>q.bookId===b.id).length})).filter(g=>g.count);
 const days=Array.from({length:7},(_,i)=>addDays(start,i));
 const header=`<p class="eyebrow">${long(start)} — ${fmt(days[6])}</p><h1>これからの復習</h1><label class="field">教材<select id="calendar-book">${bookOptions(calBook,true)}</select></label>${book?`<div class="pills"><button data-view="dates" aria-pressed="${calView==='dates'}">日付別</button><button data-view="questions" aria-pressed="${calView==='questions'}">問題別</button></div>`:''}`;
 if(book&&calView==='questions')return header+`<p class="inline-note">各問題の直近と、その次の予定</p>${questions.length?questions.sort((a,b)=>a.question-b.question).map(q=>`<div class="schedule"><div class="row"><h3>${questionLabel(q)}</h3><span class="badge">前回 ${q.last.grade}</span></div><p class="muted">直近：${q.next?fmt(q.next):'なし'} → 次：${q.dates[1]?fmt(q.dates[1]):'未設定'}</p></div>`).join(''):empty('まだ記録がありません','新しいサイクルから学習結果を記録してください。')}`;
 return header+`<div class="row" style="margin-top:14px"><button class="quiet" data-action="prev-week" ${calOffset===0?'disabled':''}>‹ 前の7日</button><button class="quiet" data-action="this-week">今日から</button><button class="quiet" data-action="next-week">次の7日 ›</button></div><div class="week">${days.map(d=>`<button class="day" data-day="${d}" aria-label="${long(d)}" aria-pressed="${calDay===d}"><span>${new Date(d+'T12:00:00').toLocaleDateString('ja-JP',{weekday:'short'})}</span>${Number(d.slice(-2))}${onDay(d).length?'<span class="dot" aria-hidden="true"></span>':''}</button>`).join('')}</div>${calDay?`<div class="row"><h2>${long(calDay)}</h2>${btn('一覧に戻る','calendar-list','quiet')}</div>${onDay(calDay).length?data.books.map(b=>{const qs=onDay(calDay).filter(q=>q.bookId===b.id);return qs.length?`<h2 class="subheading">${esc(b.name)}：${qs.length}問</h2>${questionList(qs)}`:'';}).join(''):empty('復習予定はありません','この日のタスクはありません。')}`:days.map(d=>`<button class="schedule" data-day="${d}"><p class="date-label">${long(d)}${d===today()?' · 今日':''}</p>${grouped(onDay(d)).map(g=>`<div class="row"><span>${esc(g.book.name)}</span><span>${g.count}問</span></div>`).join('')||'<p class="muted">予定なし</p>'}</button>`).join('')}<p class="note">各問題の直近の予定だけを表示します。未実施の問題は後続の予定ごと翌日へ繰り越します。</p>`;
}
function menu(){return `${back('入力に戻る','input-setup')}<h1>編集・教材管理</h1><div class="menu-list"><button data-action="bulk">${icon('pencil')}正誤の一括編集</button><button data-action="subquestions">${icon('book')}小問の設定・修正</button><button data-action="books">${icon('book')}教材の概要編集</button><button data-action="add-book">${icon('plus')}教材を追加</button><button data-action="export">${icon('download')}バックアップを書き出す</button><button data-action="import">${icon('upload')}バックアップを読み込む</button></div><input class="hidden-file" id="import-file" type="file" accept="application/json,.json"><p class="note">記録は、この端末・ブラウザー内に保存されます。別端末で使うときはバックアップを移してください。自動同期は行いません。</p>${loadError?'<p class="error">既存の保存データを読み込めないため、入力を停止しています。バックアップから復元できます。</p>':''}`;}
function books(){return `${back('編集メニュー','menu')}<div class="row"><h1>教材の編集</h1>${btn('＋ 追加','add-book','quiet')}</div>${data.books.map(b=>`<button class="book" data-edit-book="${esc(b.id)}"><span><span class="book-title">${esc(b.name)}</span><span class="muted">全${b.count}問 · ${new Set(data.records.filter(r=>r.bookId===b.id).map(r=>r.question)).size}問を学習済み</span></span>${icon('chevron')}</button>`).join('')||empty('教材がありません','教材を追加して学習を始めましょう。')}`;}
function bookForm(){const b=bookById(bookFormId);return `${back('教材一覧','books')}<h1>${b?'教材の概要編集':'教材を追加'}</h1><form id="book-form"><label class="field">教材名<input name="name" maxlength="100" required value="${esc(b?.name||'')}" placeholder="例：数学 問題集A" autocomplete="off"></label><label class="field">問題数<input name="count" type="number" min="1" max="10000" inputmode="numeric" required value="${b?.count||''}" placeholder="例：150"></label><label class="field">メモ（任意）<textarea name="note" maxlength="2000" placeholder="教材の概要など">${esc(b?.note||'')}</textarea></label><p class="inline-note">問題番号は第1問〜指定した問題数です。</p><div id="form-error" role="alert"></div><button class="primary" type="submit">${b?'変更を保存':'教材を追加'}</button></form>`;}
function filteredBulk(){
 const records=data.records.filter(r=>r.bookId===bulk.bookId);
 const candidates=bulk.view==='all'?records:allQuestions(data).filter(q=>q.bookId===bulk.bookId).map(q=>q.last);
 return candidates.filter(r=>(!bulk.from||r.question>=Number(bulk.from))&&(!bulk.to||r.question<=Number(bulk.to))&&(!bulk.day||r.day===bulk.day)).sort((a,b)=>a.question-b.question||b.day.localeCompare(a.day)||b.at.localeCompare(a.at));
}
function bulkPage(){
 if(!bookById(bulk.bookId))bulk.bookId=data.books[0]?.id||'';
 const records=filteredBulk();
 return `${back('編集メニュー','menu')}<h1>学習記録の修正</h1><p class="note">① 教材を選ぶ → ② 下の問題にチェック → ③ 変更内容を選び、確認して保存</p>${bulkUndo?btn('直前の編集を取り消す','undo-bulk','secondary'):''}${data.books.length?`<form id="bulk-filter"><label class="field">教材<select name="bookId" id="bulk-book">${bookOptions(bulk.bookId)}</select></label><details class="filter-details"><summary>問題番号・日付で絞り込む</summary><label class="field">表示する記録<select name="view" id="bulk-view"><option value="latest" ${bulk.view==='latest'?'selected':''}>問題ごとの最新の記録</option><option value="all" ${bulk.view==='all'?'selected':''}>すべての記録</option></select></label><div class="actions"><label class="field">開始番号<input name="from" type="number" min="1" max="10000" value="${esc(bulk.from)}" inputmode="numeric"></label><label class="field">終了番号<input name="to" type="number" min="1" max="10000" value="${esc(bulk.to)}" inputmode="numeric"></label></div><label class="field">記録日（任意）<input name="day" type="date" value="${esc(bulk.day)}" max="${today()}"></label><button type="submit" class="secondary">絞り込む</button></details></form><div class="toolbar"><div class="row"><label class="check-row"><input type="checkbox" id="select-all" ${records.length&&records.every(r=>bulk.selected.has(r.id))?'checked':''}><span>すべて選択（${records.length}件）</span></label></div><div class="row"><label class="field" style="margin:0;flex:1">変更する内容<select id="bulk-grade"><option value="">選択してください</option>${GRADES.map(g=>`<option value="${g}">${g}に変更</option>`).join('')}<option value="clear">未入力に戻す（この記録を取り消す）</option></select></label><button class="quiet" data-action="preview-bulk">確認して保存 <span id="selected-count">(${bulk.selected.size}件)</span></button></div></div><div class="question-list">${records.map(r=>`<label class="question-item"><input type="checkbox" data-record="${esc(r.id)}" ${bulk.selected.has(r.id)?'checked':''}><div><h3>${questionLabel(r)}</h3><p class="muted">${long(r.day)} · ${r.mode==='new'?'新しいサイクル':'復習'}</p></div><span class="badge">${r.voided?'未入力':r.grade}</span></label>`).join('')||empty('対象の記録はありません','教材・問題番号・記録日を確認してください。')}</div>`:empty('教材がありません','先に教材を追加してください。',btn('教材を追加','add-book'))}`;
}
function render(){
 const active=['home','detail'].includes(page)?'home':page==='calendar'?'calendar':'input';
 document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 main.innerHTML=({home,detail,input,calendar,menu,books,bookform:bookForm,bulk:bulkPage,subquestions:subquestionPage}[page]||home)();
}
function go(next){page=next;render();window.scrollTo({top:0,behavior:'instant'});}
function showDialog(title,body,onConfirm,label='保存する'){
 document.querySelector('#dialog-body').innerHTML=`<h2 id="dialog-title">${esc(title)}</h2>${body}<div class="actions">${btn('キャンセル','dialog-cancel','secondary')}<button type="button" class="primary" id="dialog-confirm">${esc(label)}</button></div>`;
 document.querySelector('#dialog-confirm').onclick=()=>{if(onConfirm()!==false)dialog.close();};dialog.showModal();
}
function finish(){if(!session)return;summary={bookId:session.bookId,ids:[...session.ids],skipped:session.steps.filter(id=>id===null).length};session=null;go('input');}
let subquestionBook='',subquestionNumber=1,splitInSession=false;
function subquestionPage(){
 if(!bookById(subquestionBook))subquestionBook=data.books[0]?.id||'';
 const book=bookById(subquestionBook);
 if(!book)return back('編集メニュー','menu')+empty('教材を追加してください','教材を登録すると小問を設定できます。');
 return back('編集メニュー','menu')+'<h1>小問の設定・修正</h1>'+subquestionForm(book,subquestionNumber);
}
function subquestionForm(book,question,locked=false){
 const count=book.subquestions?.[question]||0;
 return '<form id="subquestion-form"><label class="field">教材<select name="bookId" id="subquestion-book"'+(locked?' disabled':'')+'>'+bookOptions(book.id)+'</select>'+(locked?'<input type="hidden" name="bookId" value="'+esc(book.id)+'">':'')+'</label><label class="field">問題番号<input name="question" id="subquestion-number"'+(locked?' readonly':'')+' type="number" min="1" max="'+book.count+'" value="'+question+'" required></label><label class="field">小問数（0で分割を解除）<input name="count" type="number" min="0" max="100" value="'+count+'" required></label><p class="note">（1）〜指定した小問数を作ります。各小問に正誤と復習予定を設定します。</p><p class="note">分割前の結果や、減らした小問の履歴は保管します。元の設定へ戻すと再び予定に反映されます。</p><button class="primary" type="submit">設定内容を確認</button></form>';
}
function openSubquestions(){
 const current=session.questions[session.index];
 subquestionBook=session.bookId;subquestionNumber=current.question;splitInSession=true;
 document.querySelector('#dialog-body').innerHTML='<h2 id="dialog-title">'+questionLabel(current)+'の小問設定</h2>'+subquestionForm(bookById(subquestionBook),subquestionNumber,true)+btn('閉じる','dialog-cancel','secondary');
 dialog.showModal();
}
function saveSubquestions(fields){
 const bookId=String(fields.get('bookId')),question=Number(fields.get('question')),count=Number(fields.get('count')),book=bookById(bookId);
 if(!book||!Number.isInteger(question)||question<1||question>book.count||!Number.isInteger(count)||count<0||count>100){toast('問題番号と小問数を確認してください。');return;}
 const resume=splitInSession&&session&&session.bookId===bookId&&session.questions[session.index].question===question;
 const next=clone();const edited=next.books.find(b=>b.id===bookId);edited.subquestions={...edited.subquestions,[question]:count};
 dialog.close();
 showDialog('小問設定を保存','<p>第'+question+'問を'+(count?count+'個の小問に分けます。':'問題全体で記録する設定に戻します。')+'</p><p>新しい小問は未入力から始まります。設定に含まれない過去の記録は保管され、復習対象から外れます。</p>',()=>{
  if(!commit(next))return false;
  if(resume){
   const prefix=session.questions.slice(0,session.index);
   const suffix=session.questions.slice(session.index).filter(q=>q.question!==question);
   const units=questionUnits(edited,question).filter(q=>!prefix.some(p=>p.question===q.question&&(p.subquestion||0)===(q.subquestion||0)));
   session.questions=[...units,...suffix];session.index=0;session.steps=[];
   if(session.index>=session.questions.length)finish();
  }
  splitInSession=false;subquestionBook=bookId;subquestionNumber=question;render();toast('小問設定を保存しました。');
 });
}
let lastGradeAt=0;
let bulkUndo=null;
// Cancel the native touch-generated click/zoom only on the flashcard controls.
// Invoke the button once ourselves; keyboard and mouse clicks keep their path.
let inputTouch=null;
function flashControl(target){
 const button=target.closest('button');
 return button&&(button.dataset.grade||['skip','undo'].includes(button.dataset.action))?button:null;
}
document.addEventListener('touchstart',e=>{
 inputTouch=null;
 if(page!=='input'||!session||e.touches.length!==1)return;
 const button=flashControl(e.target);if(!button||button.disabled)return;
 const touch=e.touches[0];inputTouch={button,x:touch.clientX,y:touch.clientY};
},{passive:true});
document.addEventListener('touchmove',e=>{
 if(!inputTouch)return;
 const touch=e.touches[0];
 if(e.touches.length!==1||Math.hypot(touch.clientX-inputTouch.x,touch.clientY-inputTouch.y)>12)inputTouch=null;
},{passive:true});
document.addEventListener('touchcancel',()=>{inputTouch=null;},{passive:true});
document.addEventListener('touchend',e=>{
 const tap=inputTouch;inputTouch=null;
 if(!tap||e.touches.length!==0||e.changedTouches.length!==1||!e.cancelable)return;
 const touch=e.changedTouches[0];
 if(flashControl(e.target)!==tap.button||Math.hypot(touch.clientX-tap.x,touch.clientY-tap.y)>12)return;
 e.preventDefault();
 tap.button.click();
},{passive:false});
document.addEventListener('dblclick',e=>{if(flashControl(e.target))e.preventDefault();});
function grade(value){
 if(!session||Date.now()-lastGradeAt<180)return;
 if(session.day!==today()){finish();toast('日付が変わりました。今日の日付で入力を再開してください。');return;}
 const r=newRecord({bookId:session.bookId,...session.questions[session.index],grade:value,mode:session.mode,day:session.day});
 const next=clone();next.records.push(r);
 if(!commit(next))return;
 lastGradeAt=Date.now();session.ids.push(r.id);session.steps.push(r.id);session.index++;
 if(session.index===session.questions.length)finish();else render();
}
function exportData(value=data){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`問題集管理-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function importFile(file){
 if(!file)return;
 try{
  if(file.size>25*1024*1024)throw Error('ファイルが大きすぎます（上限25MB）。');
  const next=validateData(JSON.parse(await file.text()));
  showDialog('バックアップを復元',`<p>教材 ${next.books.length}件・学習記録 ${next.records.length}件を読み込みます。</p><p>現在の教材 ${data.books.length}件・学習記録 ${data.records.length}件を置き換えます。復元前のデータは自動でバックアップとして書き出します。</p>`,()=>{
   try{if(!loadError){localStorage.setItem(BACKUP_KEY,JSON.stringify(data));exportData(data);}}catch{toast('復元前のバックアップを保存できません。復元を中止しました。');return false;}
   if(!commit(next,{restore:true}))return false;
   session=null;summary=null;bulk.selected.clear();go('home');toast('バックアップを復元しました。');
  },'復元する');
 }catch(e){toast(e instanceof SyntaxError?'JSONファイルを読み込めませんでした。':e.message);}
}
function previewBulk(){
 const ids=[...bulk.selected],value=document.querySelector('#bulk-grade').value;
 if(!ids.length){toast('下の一覧から変更する問題にチェックを付けてください。');return;}
 if(!['clear',...GRADES].includes(value)){toast('変更する内容を選択してください。');return;}
 const before=data.records.filter(r=>ids.includes(r.id)).map(r=>({...r}));
 const next=clone();next.records=next.records.map(r=>ids.includes(r.id)?{...r,...(value==='clear'?{voided:true}:{grade:value,voided:false})}:r);
 const changed=allQuestions(next);
 const affected=[...new Set(before.map(unitKey))].map(key=>{const r=before.find(r=>unitKey(r)===key);const q=changed.find(q=>unitKey(q)===unitKey(r));return {question:r.question,subquestion:r.subquestion,next:q?.next};});
 const title=value==='clear'?'選択した記録を未入力に戻す':'正誤と復習予定を更新';
 const message=value==='clear'?'選択した'+ids.length+'件の正誤入力を取り消します。以前の記録があれば、その結果と予定に戻ります。記録が残らない問題は復習予定から外れます。':ids.length+'件の記録を「'+value+'」に変更します。';
 const rows=affected.map(q=>'<div class="question-item"><span>'+questionLabel(q)+'</span><span>'+(q.next?'次回 '+fmt(q.next):'未入力・予定なし')+'</span></div>').join('');
 showDialog(title,'<p>'+message+'</p><div class="question-list">'+rows+'</div><p>取り消した記録は「すべての記録」から再設定できます。</p>',()=>{
  if(!commit(next))return false;
  bulkUndo={before,after:next.records.filter(r=>ids.includes(r.id))};
  bulk.selected.clear();render();toast(value==='clear'?'選択した記録を取り消しました。':'正誤と復習予定を更新しました。');
 });
}
function undoBulk(){
 if(!bulkUndo)return;
 if(bulkUndo.after.some(r=>JSON.stringify(data.records.find(current=>current.id===r.id))!==JSON.stringify(r))){bulkUndo=null;toast('記録が変更されたため、履歴から修正してください。');render();return;}
 const next=clone();next.records=next.records.map(r=>bulkUndo.before.find(old=>old.id===r.id)||r);
 if(commit(next)){bulkUndo=null;render();toast('直前の編集を取り消しました。');}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.tab){go(b.dataset.tab);return;}
 if(b.dataset.openBook){selectedBook=b.dataset.openBook;go('detail');return;}
 if(b.dataset.editBook){bookFormId=b.dataset.editBook;go('bookform');return;}
 if(b.dataset.mode){inputMode=b.dataset.mode;render();return;}
 if(b.dataset.grade){grade(b.dataset.grade);return;}
 if(b.dataset.day){calDay=b.dataset.day;render();return;}
 if(b.dataset.view){calView=b.dataset.view;render();return;}
 switch(b.dataset.action){
  case'back-home':go('home');break;
  case'menu':if(session)finish();go('menu');break;
  case'books':go('books');break;
  case'split-current':openSubquestions();break;
  case'subquestions':if(session)finish();splitInSession=false;go('subquestions');break;
  case'add-book':bookFormId=null;go('bookform');break;
  case'bulk':bulk.selected.clear();go('bulk');break;
  case'input-setup':summary=null;go('input');break;
  case'new-cycle':if(session)finish();inputMode='new';summary=null;go('input');break;
  case'review-book':if(session)finish();inputBook=selectedBook;inputMode='review';summary=null;go('input');break;
  case'finish':finish();break;
  case'undo':if(session?.steps.length){const id=session.steps.at(-1);if(id){const next=clone();next.records=next.records.filter(r=>r.id!==id);if(!commit(next))break;session.ids.pop();}session.steps.pop();session.index--;lastGradeAt=0;render();}break;
  case'skip':if(session){session.steps.push(null);session.index++;if(session.index===session.questions.length)finish();else render();}break;
  case'undo-bulk':undoBulk();break;
  case'prev-week':calOffset=Math.max(0,calOffset-7);calDay=null;render();break;
  case'next-week':calOffset+=7;calDay=null;render();break;
  case'this-week':calOffset=0;calDay=null;render();break;
  case'calendar-list':calDay=null;render();break;
  case'export':if(loadError){toast('データを読み込めないため書き出せません。');break;}exportData();toast('バックアップを書き出しました。');break;
  case'import':document.querySelector('#import-file').click();break;
  case'preview-bulk':previewBulk();break;
  case'dialog-cancel':dialog.close();break;
 }
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='subquestion-book'){subquestionBook=el.value;subquestionNumber=1;if(dialog.open)dialog.close();splitInSession=false;go('subquestions');}
 if(el.id==='subquestion-number'){const book=bookById(subquestionBook);const number=Number(el.value);if(book&&Number.isInteger(number)&&number>=1&&number<=book.count){subquestionNumber=number;document.querySelector('[name="count"]').value=book.subquestions?.[number]||0;}}
 if(el.id==='input-book'){inputBook=el.value;render();}
 if(el.id==='calendar-book'){calBook=el.value;calDay=null;render();}
 if(el.id==='bulk-book'){bulk.bookId=el.value;bulk.selected.clear();render();}
 if(el.id==='bulk-view'){bulk.view=el.value;bulk.selected.clear();render();}
 if(el.dataset.record){el.checked?bulk.selected.add(el.dataset.record):bulk.selected.delete(el.dataset.record);document.querySelector('#selected-count').textContent=`(${bulk.selected.size}件)`;const records=filteredBulk();document.querySelector('#select-all').checked=records.length>0&&records.every(r=>bulk.selected.has(r.id));}
 if(el.id==='select-all'){bulk.selected=el.checked?new Set(filteredBulk().map(r=>r.id)):new Set();document.querySelectorAll('[data-record]').forEach(box=>{box.checked=el.checked;});document.querySelector('#selected-count').textContent=`(${bulk.selected.size}件)`;}
 if(el.id==='import-file'){importFile(el.files[0]);el.value='';}
});
document.addEventListener('submit',e=>{
 e.preventDefault();const form=e.target,fields=new FormData(form);
 if(form.id==='subquestion-form'){saveSubquestions(fields);return;}
 if(form.id==='book-form'){
  const name=String(fields.get('name')).trim(),count=Number(fields.get('count')),note=String(fields.get('note')).trim(),existing=bookById(bookFormId);
  const error=msg=>{document.querySelector('#form-error').innerHTML=`<p class="error">${esc(msg)}</p>`;};
  if(!name||!Number.isInteger(count)||count<1||count>10000){error('教材名と、1〜10000の問題数を入力してください。');return;}
  if(data.books.some(b=>b.id!==bookFormId&&b.name===name)){error('同じ名前の教材があります。区別できる名前を付けてください。');return;}
  const max=Math.max(0,...data.records.filter(r=>r.bookId===bookFormId).map(r=>r.question));
  if(count<max){error(`第${max}問まで記録があります。問題数は${max}以上にしてください。`);return;}
  const next=clone(),b={...existing,id:existing?.id||crypto.randomUUID(),name,count,note};
  if(existing)next.books=next.books.map(old=>old.id===b.id?b:old);else next.books.push(b);
  if(commit(next)){inputBook=b.id;go('books');toast(existing?'教材を更新しました。':'教材を追加しました。');}
 }
 if(form.id==='input-form'){
  if(loadError){toast('保存データを確認できないため、入力を開始できません。');return;}
  const id=String(fields.get('bookId')),book=bookById(id),start=Number(fields.get('start')||1);
  if(!book||!Number.isInteger(start)||start<1||start>book.count)return;
  const questions=inputMode==='review'?dueQuestions(data,today(),id).map(q=>({question:q.question,...(q.subquestion?{subquestion:q.subquestion}:{})})):Array.from({length:book.count-start+1},(_,i)=>questionUnits(book,start+i)).flat();
  if(!questions.length){toast('復習対象がありません。');return;}
  session={bookId:id,mode:inputMode,questions,index:0,ids:[],steps:[],day:today()};summary=null;lastGradeAt=0;render();
 }
 if(form.id==='bulk-filter'){
  const from=String(fields.get('from')),to=String(fields.get('to'));
  if(from&&to&&Number(from)>Number(to)){toast('開始番号は終了番号以下にしてください。');return;}
  bulk={bookId:String(fields.get('bookId')),view:String(fields.get('view')),from,to,day:String(fields.get('day')),selected:new Set()};render();
 }
});
let lastDay=today();
function refreshDay(){
 if(lastDay!==today()){
  lastDay=today();if(dialog.open)dialog.close();
  if(session)finish();else render();
  toast('未実施の学習と後続の予定を繰り越しました。');
 }
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});
window.addEventListener('focus',refreshDay);
function watchDay(){refreshDay();setTimeout(watchDay,30000);}
setTimeout(watchDay,30000);
render();
