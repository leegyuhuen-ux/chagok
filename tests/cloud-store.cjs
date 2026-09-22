const fs=require('fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
const {createChagokStore}=require('../dist/cloud-store.js');
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-chagok',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(require('path').join(__dirname,'../firestore.rules'),'utf8')}});
 try{
  await env.clearFirestore();
  const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),guest=env.unauthenticatedContext().firestore();
  const storeA=createChagokStore({db:alice,sdk,getUid:()=> 'alice'});
  const initial=await storeA.load('alice',{nickname:'차벗',records:[{id:'local-one',name:'내 차',type:'홍차',date:'2026-09-22'}]});
  assert.equal(initial.revision,0);assert.equal(initial.state.records.length,1);
  console.log('PASS first-login account-specific local import');
  const saved=await storeA.save('alice',{...initial.state,nickname:'새차벗',records:[...initial.state.records,{id:'second',name:'우롱차'}]},0);
  const deviceTwo=createChagokStore({db:env.authenticatedContext('alice').firestore(),sdk,getUid:()=> 'alice'});
  const loaded=await deviceTwo.load('alice',{nickname:'오래된이름',records:[]});
  assert.equal(loaded.state.nickname,'새차벗');assert.equal(loaded.state.records.length,2);
  console.log('PASS second-device server reload and stale local data not overwriting server');
  await assert.rejects(()=>deviceTwo.save('alice',{...loaded.state,nickname:'충돌이름'},0),e=>e.code==='app/conflict');
  assert.equal((await storeA.load('alice')).state.nickname,'새차벗');
  console.log('PASS conflict rejects stale overwrite');
  await assertFails(sdk.getDoc(sdk.doc(bob,'users','alice')));
  await assertFails(sdk.setDoc(sdk.doc(bob,'users','alice'),{nickname:'hack'}));
  await assertFails(sdk.getDoc(sdk.doc(guest,'users','alice')));
  await assertFails(sdk.setDoc(sdk.doc(guest,'users','guest'),{}));
  await assertFails(sdk.getDocs(sdk.collection(alice,'users')));
  console.log('PASS unauthenticated/cross-account reads and writes, collection listing denied');
  const good={schema:1,nickname:'차벗',payload:'{}',revision:2,updatedAt:sdk.serverTimestamp()};
  await assertFails(sdk.setDoc(sdk.doc(alice,'users','alice'),{...good,admin:true}));
  await assertFails(sdk.setDoc(sdk.doc(alice,'users','alice'),{...good,revision:0}));
  await assertFails(sdk.setDoc(sdk.doc(alice,'users','alice'),{...good,nickname:'<script>'}));
  await assertFails(sdk.setDoc(sdk.doc(alice,'users','alice'),{...good,payload:'x'.repeat(700001)}));
  await assertFails(sdk.setDoc(sdk.doc(alice,'users','alice'),{...good,updatedAt:new Date(0)}));
  await assertFails(sdk.deleteDoc(sdk.doc(alice,'users','alice')));
  console.log('PASS schema, nickname, size, revision, timestamp and document deletion protection');
  const cleaned=await storeA.save('alice',{...saved.state,records:[]},saved.revision);
  assert.equal((await deviceTwo.load('alice')).state.records.length,0);
  const races=await Promise.allSettled([storeA.save('alice',{...cleaned.state,nickname:'동시수정A'},cleaned.revision),deviceTwo.save('alice',{...cleaned.state,nickname:'동시수정B'},cleaned.revision)]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(races.filter(r=>r.status==='rejected'&&r.reason.code==='app/conflict').length,1);
  console.log('PASS deletion sync and two-device concurrent edit protection');
  let active='alice';const switching=createChagokStore({db:alice,sdk,getUid:()=>active});active='bob';
  await assert.rejects(()=>switching.load('alice'),e=>e.code==='app/account-changed');
  const ownBob=createChagokStore({db:bob,sdk,getUid:()=> 'bob'});assert.equal((await ownBob.load('bob')).state.records.length,0);
  console.log('PASS account switch and isolated second-user initialization');
 }finally{await env.cleanup()}
}
main().catch(error=>{console.error(error);process.exitCode=1});

