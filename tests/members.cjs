const fs=require('fs'),assert=require('node:assert/strict'),sdk=require('firebase/firestore');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {createChagokStore}=require('../dist/cloud-store.js'),{createCommunityStore}=require('../dist/community-store.js');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-chagok',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(require('path').join(__dirname,'../firestore.rules'),'utf8')}});
 try{
  await env.clearFirestore();const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore(),ad=env.authenticatedContext('admin',{email:'leegyuhuen@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const make=(db,uid)=>createCommunityStore({db,sdk,getUid:()=>uid}),A=make(a,'alice'),B=make(b,'bob'),Admin=make(ad,'admin');
  const storeA=createChagokStore({db:a,sdk,getUid:()=>'alice'}),photos=['data:image/jpeg;base64,/9j/AA=='];
  for(const [db,uid,nickname] of [[a,'alice','차벗'],[b,'bob','다른차벗'],[ad,'admin','운영자']])await createChagokStore({db,sdk,getUid:()=>uid}).load(uid,{nickname});
  const input={kind:'talk',type:'홍차',name:'광고 글',note:'광고 내용',author:'차벗'};
  const spam=await A.savePost('alice',input),bobPost=await B.savePost('bob',{...input,name:'질문',author:'다른차벗'});
  await assertFails(B.ban('bob','alice','차벗','광고'));
  await assertFails(Admin.ban('admin','admin','운영자','본인'));
  await Admin.ban('admin','alice','차벗','광고 반복',[{id:spam,revision:0}]);
  assert.equal((await sdk.getDocFromServer(sdk.doc(ad,'posts',spam))).data().hidden,true);
  assert.equal((await sdk.getDocFromServer(sdk.doc(a,'bans','alice'))).data().reason,'광고 반복');
  await assertFails(sdk.getDocFromServer(sdk.doc(b,'bans','alice')));
  await assertFails(sdk.getDocs(sdk.collection(b,'bans')));
  await assertFails(sdk.updateDoc(sdk.doc(ad,'bans','alice'),{reason:'변경'}));
  await assertFails(A.savePost('alice',input));
  await assertFails(A.comment('alice',bobPost,'홍보 댓글','차벗'));
  await assertFails(A.report('alice',bobPost,'기타'));
  const loaded=await storeA.load('alice');await storeA.save('alice',{...loaded.state,records:[{id:'r1',name:'개인 기록',type:'홍차',date:'2026-10-01'}]},loaded.revision);
  console.log('PASS admin-only bans, hidden posts on ban, ban privacy, banned members blocked from posts/comments/reports but keep private records');
  await Admin.unban('admin','alice');
  const kept=await A.savePost('alice',{...input,name:'다시 쓴 글'});
  await A.comment('alice',bobPost,'탈퇴 전 댓글','차벗');await B.comment('bob',bobPost,'남는 댓글','다른차벗');
  await A.savePost('alice',{...input,name:'사진 글',photos},kept,0);
  await sdk.setDoc(sdk.doc(a,'users','alice','recordMedia','r1'),{photos});
  await assertFails(sdk.getDocs(sdk.query(sdk.collectionGroup(b,'comments'),sdk.where('authorUid','==','alice'))));
  await assertFails(sdk.deleteDoc(sdk.doc(b,'users','alice')));
  await A.removeMemberContent('alice');
  for(const id of [spam,kept]){const post=(await sdk.getDocFromServer(sdk.doc(ad,'posts',id))).data();assert.equal(post.deleted,true);assert.equal(post.note,'');assert.equal(post.photoCount,0);}
  await env.withSecurityRulesDisabled(async ctx=>assert.equal((await sdk.getDoc(sdk.doc(ctx.firestore(),'posts',kept,'media','photos'))).exists(),false));
  const left=(await sdk.getDocs(sdk.collection(b,'posts',bobPost,'comments'))).docs.map(d=>d.data().author);assert.deepEqual(left,['다른차벗']);
  await storeA.deleteAccount('alice');
  assert.equal((await sdk.getDocFromServer(sdk.doc(a,'users','alice'))).exists(),false);
  assert.equal((await sdk.getDocs(sdk.collection(a,'users','alice','recordMedia'))).size,0);
  const fresh=await storeA.load('alice');assert.equal(fresh.revision,0);assert.equal(fresh.state.records.length,0);
  console.log('PASS withdrawal removes own posts, photos, comments, record media and account document; others cannot delete or list them');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
