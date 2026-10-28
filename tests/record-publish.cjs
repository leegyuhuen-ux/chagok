const fs=require('fs'),assert=require('node:assert/strict'),sdk=require('firebase/firestore');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {createChagokStore}=require('../dist/cloud-store.js');
const {createCommunityStore}=require('../dist/community-store.js');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-chagok',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(require('path').join(__dirname,'../firestore.rules'),'utf8')}});
 try{
  await env.clearFirestore();
  const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore();
  const ad=env.authenticatedContext('admin',{email:'leegyuhuen@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const A=createChagokStore({db:a,sdk,getUid:()=> 'alice'}),Admin=createCommunityStore({db:ad,sdk,getUid:()=> 'admin'});
  const photos=['data:image/jpeg;base64,/9j/AA=='];
  let saved=await A.load('alice',{nickname:'차벗'});
  saved.state.records.push({id:'rec1',date:'2026-10-10',type:'우롱차',name:'검증용 기록',note:'향과 맛'});
  const save=async(publish,postRevision=null,next=saved.state)=>saved=await A.saveRecord('alice',next,saved.revision,{recordId:'rec1',publish,photos,postRevision});
  await save(false);assert.equal(saved.state.records[0].photoCount,1);
  assert.deepEqual((await A.loadRecordAssets('alice',saved.state.records[0])).photos,photos);
  await assertFails(sdk.getDocFromServer(sdk.doc(b,'users','alice','recordMedia','rec1')));
  await save(true);const id=saved.state.records[0].sharedPostId;
  assert.equal((await sdk.getDocFromServer(sdk.doc(b,'posts',id))).data().name,'검증용 기록');
  assert.deepEqual((await sdk.getDocFromServer(sdk.doc(b,'posts',id,'media','photos'))).data().photos,photos);
  saved.state.records[0].name='수정된 기록';await save(true,0);assert.equal(saved.state.records[0].sharedPostId,id);
  await assert.rejects(()=>save(true,0),e=>e.code==='app/conflict');
  const bad=structuredClone(saved.state);bad.records[0].type='커피';await assertFails(save(true,1,bad));
  assert.equal((await A.load('alice')).revision,saved.revision);
  await Admin.moderate('admin',id,true,1);await save(true,2);
  assert.equal((await sdk.getDocFromServer(sdk.doc(a,'posts',id))).data().hidden,true);
  await assertFails(sdk.getDocFromServer(sdk.doc(b,'posts',id,'media','photos')));
  await save(false,3);assert.equal(saved.state.records[0].visibility,'private');assert(!saved.state.records[0].sharedPostId);
  assert.deepEqual((await A.loadRecordAssets('alice',saved.state.records[0])).photos,photos);
  await save(true);const second=saved.state.records[0].sharedPostId;assert.notEqual(id,second);
  const next=structuredClone(saved.state);next.records=[];await save(false,0,next);
  assert.equal((await sdk.getDocFromServer(sdk.doc(a,'users','alice','recordMedia','rec1'))).exists(),false);
  assert.equal((await sdk.getDocFromServer(sdk.doc(a,'posts',second))).data().deleted,true);
  console.log('PASS record/photo privacy, atomic publication, edit without duplicate, stale edit rejection, failed transaction rollback, moderation preservation, unpublish/re-publish and deletion.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
