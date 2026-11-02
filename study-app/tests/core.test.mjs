import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays,questionState,dueQuestions,allQuestions,validateData,emptyData,today} from '../dist/core.js';
const record=(day,grade,mode='review',id=day)=>({id,bookId:'b',question:1,grade,mode,day,at:day+'T00:00:00Z'});
test('〇: 30 days; leap years and month rollover',()=>{
 assert.equal(questionState([record('2026-11-02','〇')]).next,'2026-12-02');
 assert.equal(addDays('2028-02-28',1),'2028-02-29');
 assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
test('△ keeps its independent 30-day date through subsequent 〇',()=>{
 const history=[record('2026-11-02','△'),record('2026-11-09','〇')];
 assert.deepEqual(questionState(history).dates,['2026-12-02','2026-12-09']);
 assert.deepEqual(questionState([...history,record('2026-12-02','〇')]).dates,['2027-01-01']);
});
test('△ keeps the original 30-day date after another △ or ×',()=>{
 assert.deepEqual(questionState([record('2026-11-02','△'),record('2026-11-09','△')]).dates,['2026-11-16','2026-12-02','2026-12-09']);
 assert.deepEqual(questionState([record('2026-11-02','△'),record('2026-11-09','×')]).dates,['2026-11-10','2026-12-02']);
});
test('× follows anchor + 1,3,7,14,30; after 30 keeps scheduling in the future',()=>{
 const days=['2026-11-02','2026-11-03','2026-11-05','2026-11-09','2026-11-16','2026-12-02'];
 const expect=['2026-11-03','2026-11-05','2026-11-09','2026-11-16','2026-12-02','2027-01-01'];
 const history=[];days.forEach((day,i)=>{history.push(record(day,'×'));assert.equal(questionState(history).next,expect[i]);});
});
test('overdue × moves the anchor and retains the next interval',()=>{
 assert.equal(questionState([record('2026-11-02','×'),record('2026-11-20','×')]).next,'2026-11-22');
});
test('missed △ moves both dates; repeated reads do not add duplicate delays',()=>{
 const history=[record('2026-11-02','△')];
 assert.deepEqual(questionState(history,'2026-11-09').dates,['2026-11-09','2026-12-02']);
 assert.deepEqual(questionState(history,'2026-11-10').dates,['2026-11-10','2026-12-03']);
 assert.deepEqual(questionState(history,'2026-11-10').dates,['2026-11-10','2026-12-03']);
 assert.deepEqual(questionState(history,'2026-11-12').dates,['2026-11-12','2026-12-05']);
 assert.equal(history[0].day,'2026-11-02');
});
test('late completion retains shifted fixed dates and affects only that question',()=>{
 assert.deepEqual(questionState([record('2026-11-02','△'),record('2026-11-10','〇')]).dates,['2026-12-03','2026-12-10']);
 const data={version:1,books:[{id:'b',name:'教材',count:10,note:''}],records:[record('2026-11-02','△'),{...record('2026-11-08','〇'),question:2}]};
 const states=allQuestions(data,'2026-11-10');
 assert.deepEqual(states.find(q=>q.question===1).dates,['2026-11-10','2026-12-03']);
 assert.deepEqual(states.find(q=>q.question===2).dates,['2026-12-08']);
});
test('postponement crosses year boundaries and survives backup round trip',()=>{
 const data={version:1,books:[{id:'b',name:'教材',count:10,note:''}],records:[record('2026-12-24','△')]};
 assert.deepEqual(allQuestions(validateData(JSON.parse(JSON.stringify(data))),'2027-01-02')[0].dates,['2027-01-02','2027-01-25']);
});
test('〇 and △ end the failure sequence; new cycle restarts ×',()=>{
 assert.equal(questionState([record('2026-11-02','×'),record('2026-11-03','〇')]).next,'2026-12-03');
 assert.equal(questionState([record('2026-11-02','×'),record('2026-11-03','△')]).next,'2026-11-10');
 assert.equal(questionState([record('2026-11-02','×'),record('2026-11-03','×','new')]).next,'2026-11-04');
});
test('corrections recompute the complete sequence',()=>{
 const history=[record('2026-11-02','×'),record('2026-11-03','×')];
 assert.equal(questionState(history).next,'2026-11-05');
 history[0].grade='〇';assert.equal(questionState(history).next,'2026-11-04');
});
test('only nearest date is a task; same-date obligations deduplicate',()=>{
 const data={version:1,books:[{id:'b',name:'教材',count:10,note:''}],records:[record('2026-11-02','△')]};
 assert.equal(allQuestions(data).length,1);
 assert.equal(dueQuestions(data,'2026-11-09').length,1);
 assert.equal(dueQuestions(data,'2026-11-08').length,0);
 assert.equal(dueQuestions(data,'2026-12-02').length,1);
 const history=[record('2026-11-02','△'),record('2026-11-02','〇','review','second')];
 assert.deepEqual(questionState(history).dates,['2026-12-02']);
});
test('validate backup rejects invalid dates, grades, ids and question numbers',()=>{
 const data={version:1,books:[{id:'b',name:'教材',count:10,note:''}],records:[record('2026-11-02','△')]};
 assert.equal(validateData(data),data);assert.deepEqual(validateData(emptyData()),emptyData());
 for(const patch of [{day:'2026-02-30'},{grade:'A'},{bookId:'missing'},{question:11},{at:'bad'}])assert.throws(()=>validateData({...data,records:[{...data.records[0],...patch}]}));
 assert.throws(()=>validateData({...data,records:[...data.records,...data.records]}));
 assert.equal(today(new Date(2026,10,2,1)), '2026-11-02');
});
