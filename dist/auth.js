/* Firebase Authentication adapter. No database or administrator grants. */
(() => {
  const config = window.CHAGOK_FIREBASE_CONFIG;
  const configured = !!config && ['apiKey', 'authDomain', 'projectId', 'appId'].every(k => typeof config[k] === 'string' && config[k].trim());
  let auth, sdk, app, provider, storePromise, busy = false, authVersion = 0;
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
    },
    // Account deletion needs a fresh sign-in; call from a user gesture like signIn.
    reauthenticate() {
      if (!auth?.currentUser) return Promise.reject({code:'app/not-ready'});
      return sdk.reauthenticateWithPopup(auth.currentUser, provider);
    },
    async deleteAccount() {
      if (!auth?.currentUser) throw {code:'app/not-ready'};
      await sdk.deleteUser(auth.currentUser);
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
      // App Check must start before Firestore is used. Until enforcement is on, a load failure only skips it.
      if (window.CHAGOK_APP_CHECK_KEY) {
        try {
          const appCheck = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js');
          appCheck.initializeAppCheck(app, {provider: new appCheck.ReCaptchaEnterpriseProvider(window.CHAGOK_APP_CHECK_KEY), isTokenAutoRefreshEnabled: true});
        } catch (error) { console.warn('App Check unavailable', error); }
      }
      auth = sdk.getAuth(app);
      auth.languageCode = 'ko';
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      sdk.onAuthStateChanged(auth, async user => {
        const version=++authVersion;
        api.user=null;api.ready=false;emit();
        try {
          const token=user?await sdk.getIdTokenResult(user):null;
          if(version!==authVersion||auth.currentUser?.uid!==user?.uid)return;
          const claims=token?.claims;
          const isAdmin=claims?.email==='leegyuhuen@gmail.com'&&claims.email_verified===true&&claims.firebase?.sign_in_provider==='google.com';
          api.user=user?{uid:user.uid,displayName:user.displayName||'차벗',email:user.email||'',isAdmin}:null;
          api.ready=true;api.error=null;emit();
        } catch(error) {if(version===authVersion){api.ready=true;api.error=error.code||'app/auth-error';emit();}}
      }, error => { api.error = error.code || 'app/auth-error'; api.ready = true; emit(); });
    } catch (error) {
      api.error = error.code || 'app/network-error'; api.ready = true; emit();
    }
  })();
})();
