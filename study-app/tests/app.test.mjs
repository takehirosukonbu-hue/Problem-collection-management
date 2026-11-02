import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import * as core from '../dist/core.js';
import {webcrypto} from 'node:crypto';

// Exercise the actual application handlers and persistence without a browser.
const source=(await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*?;\n/,'const {VERSION, GRADES, today, addDays, emptyData, validateData, allQuestions, dueQuestions, groupedDue, newRecord}=core;\n');
function harness(seed){
 const events={},windowEvents={},elements=new Map(),saved=new Map();
 if(seed)saved.set('study-review:data:v1',JSON.stringify(seed));
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:true,open:false,value:'',checked:false,showModal(){this.open=true;},close(){this.open=false;},click(){}});return elements.get(id);};
 const doc={querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>{events[name]=fn;},createElement:()=>({click(){}})};
 const context=vm.createContext({core,document:doc,window:{addEventListener:(n,f)=>windowEvents[n]=f,scrollTo(){}},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},crypto:webcrypto,Date,Set,Map,JSON,String,Number,Math,Blob,URL,FormData:class{constructor(form){this.fields=form.fields;}get(k){return this.fields[k]??null;}},setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(source,context);
 return {elements,saved,element,html:()=>element('#main').innerHTML,click:dataset=>events.click({target:{closest:()=>({dataset,disabled:false})}}),submit:(id,fields)=>events.submit({preventDefault(){},target:{id,fields}}),change:target=>events.change({target}),storage:()=>windowEvents.storage({key:'study-review:data:v1'}),data:()=>JSON.parse(saved.get('study-review:data:v1'))};
}
const seed=()=>({version:1,books:[{id:'b',name:'数学',count:10,note:''}],records:[]});
test('create textbook, input, persist, reload, edit textbook',()=>{
 const h=harness();h.click({action:'add-book'});h.submit('book-form',{name:'数学',count:'10',note:'テスト'});
 assert.equal(h.data().books[0].name,'数学');
 h.click({tab:'input'});h.click({mode:'new'});h.submit('input-form',{bookId:h.data().books[0].id,start:'3'});
 assert.match(h.html(),/第3問/);h.click({grade:'△'});
 assert.equal(h.data().records[0].grade,'△');assert.match(h.html(),/第4問/);
 h.click({action:'undo'});assert.equal(h.data().records.length,0);assert.match(h.html(),/第3問/);
 h.click({action:'finish'});assert.match(h.html(),/おつかれさまでした/);
 const again=harness(h.data());again.click({action:'books'});assert.match(again.html(),/数学/);
 again.click({editBook:h.data().books[0].id});again.submit('book-form',{name:'数学改訂',count:'12',note:''});assert.equal(again.data().books[0].name,'数学改訂');
});
test('today task, review, completion and calendar reflect persisted results',()=>{
 const data=seed();data.records=[{id:'old',bookId:'b',question:2,grade:'×',mode:'new',day:core.addDays(core.today(),-1),at:new Date(Date.now()-86400000).toISOString()}];
 const h=harness(data);assert.match(h.html(),/あと1問/);h.click({openBook:'b'});assert.match(h.html(),/第2問/);
 h.click({action:'review-book'});h.submit('input-form',{bookId:'b'});h.click({grade:'〇'});assert.match(h.html(),/おつかれさまでした/);
 assert.equal(core.dueQuestions(h.data()).length,0);h.click({tab:'home'});assert.match(h.html(),/今日の復習はありません/);
 h.click({tab:'calendar'});assert.match(h.html(),/これからの復習/);
 h.change({id:'calendar-book',value:'b',dataset:{}});h.click({view:'questions'});assert.match(h.html(),/第2問/);assert.match(h.html(),/前回 〇/);
});
test('bulk correction previews then recalculates; concurrent update cancels stale dialog',()=>{
 const data=seed();data.records=[{id:'old',bookId:'b',question:1,grade:'〇',mode:'new',day:core.today(),at:new Date().toISOString()}];
 const h=harness(data);h.click({action:'bulk'});h.change({id:'box',dataset:{record:'old'},checked:true});h.element('#bulk-grade').value='△';h.click({action:'preview-bulk'});
 assert.equal(h.element('#dialog').open,true);h.element('#dialog-confirm').onclick();assert.equal(h.data().records[0].grade,'△');assert.equal(core.allQuestions(h.data())[0].dates.length,2);
 h.change({id:'box',dataset:{record:'old'},checked:true});h.element('#bulk-grade').value='×';h.click({action:'preview-bulk'});assert.equal(h.element('#dialog').open,true);
 h.storage();assert.equal(h.element('#dialog').open,false);
});
test('failed storage leaves unsaved results out of the persisted state',()=>{
 const h=harness(seed());h.click({tab:'input'});h.click({mode:'new'});h.submit('input-form',{bookId:'b',start:'1'});
 // Simulate another tab saving after this page read its revision.
 const next=seed();next.books[0].name='別画面の変更';h.saved.set('study-review:data:v1',JSON.stringify(next));h.click({grade:'〇'});
 assert.equal(h.data().records.length,0);assert.equal(h.data().books[0].name,'別画面の変更');
});
