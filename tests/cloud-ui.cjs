const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();function el(s){if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',open:false,remove(){},classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},insertAdjacentHTML(){},getBoundingClientRect(){return {left:0,right:500,top:0,bottom:600}}});return elements.get(s)}
const storage={};const context={console,Date,Math,Set,Map,JSON,String,Number,Object,Array,RegExp,Error,crypto:require('crypto').webcrypto,innerWidth:1400,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},document:{querySelector:el,querySelectorAll:()=>[]}};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/app.js'),'utf8'),context);
for(const file of ['photos.js','community.js','events.js'])vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/'+file),'utf8'),context);
const run=s=>vm.runInContext(s,context);

(async()=>{
const tick=()=>new Promise(r=>setImmediate(r));
await assert.rejects(()=>run("ChagokPhotos.compress({type:'image/gif',size:10})"),/JPG/);
await assert.rejects(()=>run("ChagokPhotos.compress({type:'image/jpeg',size:16*1024*1024})"),/15MB/);
let docs={},failLoad=false,failSave=false,holdSave=null;
const store={async load(uid,seed){if(failLoad)throw {code:'permission-denied'};if(!docs[uid])docs[uid]={state:{...JSON.parse(run('JSON.stringify(defaults)')),...seed},revision:0};return structuredClone(docs[uid])},async save(uid,next,rev){if(holdSave)await holdSave;if(failSave)throw {code:'unavailable'};if(docs[uid].revision!==rev)throw {code:'app/conflict'};docs[uid]={state:structuredClone(next),revision:rev+1};return structuredClone(docs[uid])}};
context.chagokAuth={ready:true,configured:true,user:{uid:'alice'},getStore:async()=>store,getCommunity:async()=>({watch(uid,admin,cb){cb([]);return ()=>{}},watchNotices(uid,cb){cb([]);return ()=>{}},watchEvents(uid,admin,cb){cb([]);return ()=>{}}})};
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
run("community.phase='ready';community.items=[{id:'shared',kind:'talk',type:'홍차',name:'<script>alert(1)</script>',note:'긴 내용',author:'다른차벗',authorUid:'bob',hidden:false,deleted:false,revision:0}];state.saved=['shared'];filter='저장한 기록';renderFeed()");
assert(el('#app').innerHTML.includes('&lt;script&gt;'));assert(!el('#app').innerHTML.includes('<script>'));assert(el('#app').innerHTML.includes('다른차벗'));assert(!el('#app').innerHTML.includes('askDeletePost'));
run("go('admin')");assert.notEqual(run('page'),'admin');
assert.equal(el('#admin-slot').innerHTML,'');
run("community.eventsPhase='ready';community.events=[{id:'event1',title:'공개 이벤트',description:'안내',venue:'서울',status:'published',startsAt:{seconds:1800000000},endsAt:{seconds:1800003600}},{id:'draft1',title:'비공개초안',description:'내용',venue:'서울',status:'draft',startsAt:{seconds:1800000000},endsAt:{seconds:1800003600}}];go('events')");
assert(el('#app').innerHTML.includes('공개 이벤트'));assert(!el('#app').innerHTML.includes('비공개초안'));assert(!el('#app').innerHTML.includes('이벤트 만들기'));assert(!el('#app').innerHTML.includes('이벤트 수정'));
context.chagokAuth.user.isAdmin=true;run('updateAuthUI();go("admin")');assert(el('#app').innerHTML.includes('커뮤니티 관리'));assert(el('#admin-slot').innerHTML.includes('관리자'));
run("go('events')");assert(el('#app').innerHTML.includes('이벤트 만들기'));assert(el('#app').innerHTML.includes('비공개초안'));
run("filter='전체';go('feed')");assert(el('#app').innerHTML.indexOf('우롱차</button>')<el('#app').innerHTML.indexOf('보이차</button>'));
context.chagokAuth.user=null;run('updateAuthUI()');assert.equal(run('community.items.length'),0);assert.equal(run('community.notices.length'),0);assert.equal(el('#admin-slot').innerHTML,'');assert.equal(run('photoCache.size'),0);
console.log('PASS shared UI: saved stories, escaped member content, ownership controls, admin-only navigation, logout clears shared data.');
console.log('PASS photos/events UI: administrator menu absent for members, private event drafts, event controls, tab order, invalid photo inputs, photo cache reset.');
console.log('PASS UI: load-before-access, local migration, server restore, failed save does not delete data, confirmed delete, nickname cloud save, stale conflict, load-error gate, logout, cross-account late response.');
})().catch(e=>{console.error(e);process.exitCode=1});
