/* The same Firestore adapter is used by the website and emulator tests. */
(function(root){
  function fault(code){return Object.assign(new Error(code),{code})}
  function cleanState(input={}){
    const result={nickname:typeof input.nickname==='string'?input.nickname:'',records:[],likes:[],saved:[],comments:{},joined:[],hidden:[],announcements:[]};
    for(const key of ['records','likes','saved','joined','hidden','announcements'])if(Array.isArray(input[key]))result[key]=input[key];
    if(input.comments&&typeof input.comments==='object'&&!Array.isArray(input.comments))result.comments=input.comments;
    if(result.nickname&&!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(result.nickname))throw fault('app/invalid-nickname');
    return JSON.parse(JSON.stringify(result));
  }
  function createChagokStore({db,sdk,getUid}){
    const own=uid=>{if(!uid||getUid()!==uid)throw fault('app/account-changed')};
    function encode(input,revision){
      const state=cleanState(input),{nickname,...rest}=state,payload=JSON.stringify(rest);
      if(new TextEncoder().encode(payload).length>700000)throw fault('app/storage-limit');
      return {schema:1,nickname,payload,revision,updatedAt:sdk.serverTimestamp()};
    }
    function decode(snapshot){
      const value=snapshot.data();
      if(value.schema!==1||!Number.isInteger(value.revision)||value.revision<0||typeof value.payload!=='string')throw fault('app/invalid-data');
      return {state:cleanState({...JSON.parse(value.payload),nickname:value.nickname}),revision:value.revision};
    }
    return {
      async load(uid,seed={}){
        own(uid);const ref=sdk.doc(db,'users',uid);
        const snapshot=await sdk.getDocFromServer(ref);own(uid);
        if(snapshot.exists())return decode(snapshot);
        const result=await sdk.runTransaction(db,async transaction=>{
          own(uid);const existing=await transaction.get(ref);own(uid);
          if(existing.exists())return decode(existing);
          const initial=cleanState(seed);transaction.set(ref,encode(initial,0));return {state:initial,revision:0};
        });own(uid);return result;
      },
      async save(uid,input,expectedRevision){
        own(uid);const snapshot=cleanState(input),ref=sdk.doc(db,'users',uid);
        const result=await sdk.runTransaction(db,async transaction=>{
          own(uid);const current=await transaction.get(ref);own(uid);
          if(!current.exists()||current.data().revision!==expectedRevision)throw fault('app/conflict');
          const revision=expectedRevision+1;
          transaction.set(ref,encode(snapshot,revision));return {state:snapshot,revision};
        }).catch(async error=>{
          // Rules can reject the losing commit before the SDK retries it.
          // Re-read only to distinguish a revision conflict from denied access.
          if(['permission-denied','aborted','failed-precondition'].includes(error.code)){
            own(uid);let latest;
            try{latest=await sdk.getDocFromServer(ref)}catch{throw error}
            own(uid);
            if(latest.exists()&&latest.data().revision!==expectedRevision)throw fault('app/conflict');
          }
          throw error;
        });own(uid);return result;
      }
    };
  }
  root.createChagokStore=createChagokStore;
  if(typeof module!=='undefined')module.exports={createChagokStore,cleanState};
})(typeof window==='undefined'?globalThis:window);
