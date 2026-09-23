/* Firebase Authentication adapter. No database or administrator grants. */
(() => {
  const config = window.CHAGOK_FIREBASE_CONFIG;
  const configured = !!config && ['apiKey', 'authDomain', 'projectId', 'appId'].every(k => typeof config[k] === 'string' && config[k].trim());
  let auth, sdk, app, provider, storePromise, busy = false;
  const api = window.chagokAuth = {
    configured, ready: !configured, user: null, error: null,
    async getCommunity() {
      await api.getStore();
      const firestore=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
      return window.createCommunityStore({db:firestore.getFirestore(app),sdk:firestore,getUid:()=>auth.currentUser?.uid});
    },
    async getStore() {
      if (!auth?.currentUser) throw {code:'auth/requires-recent-login'};
      if (!storePromise) storePromise=import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js').then(firestore=>window.createChagokStore({db:firestore.getFirestore(app),sdk:firestore,getUid:()=>auth.currentUser?.uid})).catch(error=>{storePromise=null;throw error});
      return storePromise;
    },
    signIn() {
      if (!configured) return Promise.reject({code:'app/not-configured'});
      if (!api.ready || !auth) return Promise.reject({code:'app/not-ready'});
      if (busy) return Promise.reject({code:'auth/cancelled-popup-request'});
      busy = true;
      // Called directly from a user gesture to preserve popup permission.
      return sdk.signInWithPopup(auth, provider).finally(() => { busy = false; });
    },
    async signOut() {
      if (!auth) throw {code:'app/not-ready'};
      await sdk.signOut(auth);
    }

  };
  function emit() { window.dispatchEvent(new CustomEvent('chagok-auth-change')); }
  if (!configured) return;
  (async () => {
    try {
      if (!['https:', 'http:'].includes(location.protocol)) throw {code:'app/https-required'};
      const [appModule, authModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
      ]);
      sdk = authModule;
      app = appModule.initializeApp(config);
      auth = sdk.getAuth(app);
      auth.languageCode = 'ko';
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      sdk.onAuthStateChanged(auth, user => {
        api.user = user ? {uid:user.uid, displayName:user.displayName || '차벗', email:user.email || '', isAdmin:user.email==='leegyuhuen@gmail.com'&&user.emailVerified&&user.providerData.some(p=>p.providerId==='google.com')} : null;
        api.ready = true; api.error = null; emit();
      }, error => { api.error = error.code || 'app/auth-error'; api.ready = true; emit(); });
    } catch (error) {
      api.error = error.code || 'app/network-error'; api.ready = true; emit();
    }
  })();
})();
