const fs=require('fs'),assert=require('node:assert/strict'),sdk=require('firebase/firestore');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {createChagokStore}=require('../dist/cloud-store.js'),{createCommunityStore}=require('../dist/community-store.js');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-chagok',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(require('path').join(__dirname,'../firestore.rules'),'utf8')}});
 try{
  await env.clearFirestore();const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore(),ad=env.authenticatedContext('admin',{email:'leegyuhuen@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const make=(db,uid)=>createCommunityStore({db,sdk,getUid:()=>uid}),A=make(a,'alice'),B=make(b,'bob'),Admin=make(ad,'admin');
  await createChagokStore({db:a,sdk,getUid:()=> 'alice'}).load('alice',{nickname:'차벗'});
  const id=await A.savePost('alice',{kind:'talk',type:'홍차',name:'검증 글',note:'검증 내용',author:'차벗'});
  await B.report('bob',id,'광고·도배');await assert.rejects(()=>B.report('bob',id,'기타'),e=>e.code==='app/already-reported');
  await assertFails(A.report('alice',id,'기타'));
  await assertFails(sdk.getDocFromServer(sdk.doc(a,'posts',id,'reports','bob')));
  await assertFails(sdk.getDocs(sdk.collectionGroup(b,'reports')));
  await assertFails(B.resolveReport('bob',id,'bob'));
  let stop;await new Promise((resolve,reject)=>{stop=Admin.watchReports('admin',rows=>{if(rows.length){assert.equal(rows[0].postId,id);resolve();}},reject)});stop();
  await Admin.resolveReport('admin',id,'bob');assert.equal((await sdk.getDocFromServer(sdk.doc(ad,'posts',id,'reports','bob'))).data().status,'resolved');
  console.log('PASS report submission, duplicate prevention, self-report denial, reporter privacy, admin-only review and collection-group query.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
