/* Shared content never reads or publishes the private account snapshot. */
(function(root){
  function createCommunityStore({db,sdk,getUid}){
    const check=uid=>{if(!uid||uid!==getUid())throw Object.assign(new Error('Account changed'),{code:'app/account-changed'})};
    const rows=snap=>snap.docs.map(d=>({...d.data(),id:d.id}));
    return {
      watch(uid,admin,onData,onError){
        check(uid);
        const q=admin?sdk.collection(db,'posts'):sdk.query(sdk.collection(db,'posts'),sdk.where('hidden','==',false));
        return sdk.onSnapshot(q,snap=>{if(uid===getUid())onData(rows(snap))},onError);
      },
      watchNotices(uid,onData,onError){check(uid);return sdk.onSnapshot(sdk.collection(db,'announcements'),s=>{if(uid===getUid())onData(rows(s))},onError)},
      async savePost(uid,input,id,expectedRevision){
        check(uid);const ref=id?sdk.doc(db,'posts',id):sdk.doc(sdk.collection(db,'posts'));
        if(!id){
          await sdk.setDoc(ref,{kind:input.kind,type:input.type,name:input.name.trim(),note:input.note.trim(),author:input.author,authorUid:uid,
            hidden:false,deleted:false,createdAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp(),revision:0});
          check(uid);return ref.id;
        }
        await sdk.runTransaction(db,async tx=>{
          const existing=await tx.get(ref);check(uid);
          if(id&&(!existing.exists()||existing.data().revision!==expectedRevision))throw Object.assign(new Error('Changed'),{code:'app/conflict'});
          const old=existing.exists()?existing.data():null;
          tx.set(ref,{kind:input.kind,type:input.type,name:input.name.trim(),note:input.note.trim(),author:input.author,authorUid:uid,
            hidden:old?.hidden||false,deleted:false,createdAt:old?.createdAt||sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp(),revision:(old?.revision??-1)+1});
        });check(uid);return ref.id;
      },
      async deletePost(uid,id,revision){
        check(uid);const ref=sdk.doc(db,'posts',id);
        await sdk.runTransaction(db,async tx=>{const s=await tx.get(ref);check(uid);if(!s.exists()||s.data().revision!==revision)throw Object.assign(new Error('Changed'),{code:'app/conflict'});tx.update(ref,{name:'삭제된 게시글',note:'',hidden:true,deleted:true,updatedAt:sdk.serverTimestamp(),revision:revision+1})});check(uid);
      },
      async moderate(uid,id,hidden,revision){check(uid);const ref=sdk.doc(db,'posts',id);await sdk.runTransaction(db,async tx=>{const s=await tx.get(ref);check(uid);if(!s.exists()||s.data().revision!==revision)throw Object.assign(new Error('Changed'),{code:'app/conflict'});tx.update(ref,{hidden,updatedAt:sdk.serverTimestamp(),revision:revision+1})});check(uid)},
      watchComments(uid,id,onData,onError){check(uid);return sdk.onSnapshot(sdk.collection(db,'posts',id,'comments'),s=>{if(uid===getUid())onData(rows(s))},onError)},
      async comment(uid,id,text,author){check(uid);await sdk.addDoc(sdk.collection(db,'posts',id,'comments'),{text:text.trim(),author,authorUid:uid,createdAt:sdk.serverTimestamp()});check(uid)},
      async deleteComment(uid,id,commentId){check(uid);await sdk.deleteDoc(sdk.doc(db,'posts',id,'comments',commentId));check(uid)},
      async notice(uid,title){check(uid);await sdk.addDoc(sdk.collection(db,'announcements'),{title:title.trim(),authorUid:uid,createdAt:sdk.serverTimestamp()});check(uid)},
      async deleteNotice(uid,id){check(uid);await sdk.deleteDoc(sdk.doc(db,'announcements',id));check(uid)}
    };
  }
  root.createCommunityStore=createCommunityStore;
  if(typeof module!=='undefined')module.exports={createCommunityStore};
})(typeof window==='undefined'?globalThis:window);
