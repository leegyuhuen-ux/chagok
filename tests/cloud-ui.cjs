const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();function el(s){if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',open:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},insertAdjacentHTML(){},getBoundingClientRect(){return {left:0,right:500,top:0,bottom:600}}});return elements.get(s)}
const storage={};const context={console,Date,Math,Set,Map,JSON,String,Number,Object,Array,RegExp,Error,crypto:require('crypto').webcrypto,innerWidth:1400,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},document:{querySelector:el,querySelectorAll:()=>[]}};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/app.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);

(async()=>{
const tick=()=>new Promise(r=>setImmediate(r));
let docs={},failLoad=false,failSave=false,holdSave=null;
const store={async load(uid,seed){if(failLoad)throw {code:'permission-denied'};if(!docs[uid])docs[uid]={state:{...JSON.parse(run('JSON.stringify(defaults)')),...seed},revision:0};return structuredClone(docs[uid])},async save(uid,next,rev){if(holdSave)await holdSave;if(failSave)throw {code:'unavailable'};if(docs[uid].revision!==rev)throw {code:'app/conflict'};docs[uid]={state:structuredClone(next),revision:rev+1};return structuredClone(docs[uid])}};
context.chagokAuth={ready:true,configured:true,user:{uid:'alice'},getStore:async()=>store};
storage['chagok-user-alice']=JSON.stringify({nickname:'차벗',records:[{id:'one',name:'내 차',date:'2026-09-22',type:'홍차',visibility:'private'}]});
run('updateAuthUI()');assert(el('#app').innerHTML.includes('불러와요'));await tick();assert(run('isMember()'));assert.equal(run('state.records.length'),1);
failSave=true;await run("confirmDelete('one')");assert.equal(run('state.records.length'),1);assert(el('#toast').textContent.includes('서버'));failSave=false;
await run("confirmDelete('one')");assert.equal(run('state.records.length'),0);assert.equal(docs.alice.state.records.length,0);
assert.equal(await run("saveNickname('새차벗','alice')"),true);assert.equal(docs.alice.state.nickname,'새차벗');
context.chagokAuth.user=null;run('updateAuthUI()');assert(!run('isMember()'));assert(!el('#app').innerHTML.includes('calendar-box'));
// A new login restores the server state, despite the unchanged old local copy.
context.chagokAuth.user={uid:'alice'};run('updateAuthUI()');await tick();assert.equal(run('nickname()'),'새차벗');assert.equal(run('state.records.length'),0);
assert.equal(await run('verifyServerData()'),true);docs.alice.revision++;assert.equal(await run('verifyServerData()'),false);assert.equal(await run("commitState({...state,nickname:'덮어쓰기'})"),false);assert.equal(run('nickname()'),'새차벗');assert.equal(run('cloud.error'),'app/conflict');
await run('loadAccount()');assert.equal(run('cloud.revision'),docs.alice.revision);
failLoad=true;context.chagokAuth.user={uid:'bob'};run('updateAuthUI()');await tick();assert(!run('isMember()'));assert(el('#app').innerHTML.includes('불러오지 못했어요'));assert(!el('#app').innerHTML.includes('nickname-form'));failLoad=false;
await run('loadAccount()');assert(el('#app').innerHTML.includes('nickname-form'));
assert.equal(await run("saveNickname('두번째차벗','bob')"),true);
let release;holdSave=new Promise(r=>release=r);const pending=run("commitState({...state,nickname:'늦은저장'})");await tick();context.chagokAuth.user={uid:'alice'};run('updateAuthUI()');await tick();release();await pending;assert.equal(run('currentUser.uid'),'alice');assert.equal(run('nickname()'),'새차벗');
console.log('PASS UI: load-before-access, local migration, server restore, failed save does not delete data, confirmed delete, nickname cloud save, stale conflict, load-error gate, logout, cross-account late response.');
})().catch(e=>{console.error(e);process.exitCode=1});
