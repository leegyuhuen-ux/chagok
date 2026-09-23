/* Shared content never reads or publishes the private account snapshot. */
(function(root){
  function createCommunityStore({db,sdk,getUid}){
    const check=uid=>{if(!uid||uid!==getUid())throw Object.assign(new Error('Account changed'),{code:'app/account-changed'})};
    const rows=snap=>snap.docs.map(d=>({...d.data(),id:d.id}));
    const conflict=()=>Object.assign(new Error('Changed'),{code:'app/conflict'});
    function photoList(value=[]){
      if(!Array.isArray(value)||value.length>3||value.some(p=>typeof p!=='string'||p.length>200000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p)))throw Object.assign(new Error('Invalid photos'),{code:'app/photos-invalid'});
      return [...value];
    }
    function writePhotos(writer,ref,photos){const media=sdk.doc(ref,'media','photos');if(photos.length)writer.set(media,{photos});else writer.delete(media);}
    return {
      watch(uid,admin,onData,onError){
        check(uid);
        const q=admin?sdk.collection(db,'posts'):sdk.query(sdk.collection(db,'posts'),sdk.where('hidden','==',false));
        return sdk.onSnapshot(q,snap=>{if(uid===getUid())onData(rows(snap))},onError);
      },
      watchNotices(uid,onData,onError){check(uid);return sdk.onSnapshot(sdk.collection(db,'announcements'),s=>{if(uid===getUid())onData(rows(s))},onError)},
      async savePost(uid,input,id,expectedRevision){
        check(uid);const photos=photoList(input.photos),ref=id?sdk.doc(db,'posts',id):sdk.doc(sdk.collection(db,'posts'));
        if(!id){
          const batch=sdk.writeBatch(db);batch.set(ref,{kind:input.kind,type:input.type,name:input.name.trim(),note:input.note.trim(),author:input.author,authorUid:uid,photoCount:photos.length,
            hidden:false,deleted:false,createdAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp(),revision:0});
          if(photos.length)writePhotos(batch,ref,photos);await batch.commit();
          check(uid);return ref.id;
        }
        await sdk.runTransaction(db,async tx=>{
          const existing=await tx.get(ref);check(uid);
          if(id&&(!existing.exists()||existing.data().revision!==expectedRevision))throw Object.assign(new Error('Changed'),{code:'app/conflict'});
          const old=existing.exists()?existing.data():null;
          tx.set(ref,{kind:input.kind,type:input.type,name:input.name.trim(),note:input.note.trim(),author:input.author,authorUid:uid,photoCount:photos.length,
            hidden:old?.hidden||false,deleted:false,createdAt:old?.createdAt||sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp(),revision:(old?.revision??-1)+1});
          writePhotos(tx,ref,photos);
        });check(uid);return ref.id;
      },
      async deletePost(uid,id,revision){
        check(uid);const ref=sdk.doc(db,'posts',id);
        await sdk.runTransaction(db,async tx=>{const s=await tx.get(ref);check(uid);if(!s.exists()||s.data().revision!==revision)throw conflict();tx.update(ref,{name:'삭제된 게시글',note:'',photoCount:0,hidden:true,deleted:true,updatedAt:sdk.serverTimestamp(),revision:revision+1});writePhotos(tx,ref,[])});check(uid);
      },
      async loadPhotos(uid,id){check(uid);const s=await sdk.getDocFromServer(sdk.doc(db,'posts',id,'media','photos'));check(uid);return s.exists()?photoList(s.data().photos):[]},
      watchPhotos(uid,id,onData,onError){check(uid);return sdk.onSnapshot(sdk.doc(db,'posts',id,'media','photos'),s=>{if(uid===getUid())onData(s.exists()?photoList(s.data().photos):[])},onError)},
      watchEvents(uid,admin,onData,onError){check(uid);const ref=sdk.collection(db,'events');return sdk.onSnapshot(admin?ref:sdk.query(ref,sdk.where('status','in',['published','cancelled'])),s=>{if(uid===getUid())onData(rows(s))},onError)},
      async saveEvent(uid,input,id,revision){
        check(uid);const ref=id?sdk.doc(db,'events',id):sdk.doc(sdk.collection(db,'events'));
        const fields={title:input.title.trim(),description:input.description.trim(),venue:input.venue.trim(),startsAt:sdk.Timestamp.fromDate(input.startsAt),endsAt:sdk.Timestamp.fromDate(input.endsAt),status:input.status,updatedAt:sdk.serverTimestamp()};
        if(!id){await sdk.setDoc(ref,{...fields,authorUid:uid,createdAt:sdk.serverTimestamp(),revision:0});check(uid);return ref.id;}
        await sdk.runTransaction(db,async tx=>{const s=await tx.get(ref);check(uid);if(!s.exists()||s.data().revision!==revision)throw conflict();tx.update(ref,{...fields,revision:revision+1})});check(uid);return id;
      },
      async deleteEvent(uid,id,revision){check(uid);const ref=sdk.doc(db,'events',id);await sdk.runTransaction(db,async tx=>{const s=await tx.get(ref);check(uid);if(!s.exists()||s.data().revision!==revision)throw conflict();tx.delete(ref)});check(uid)},
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
