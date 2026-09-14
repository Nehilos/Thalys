// Thalys v0.41.0 - Authentication and persistent session module
// Owns Google identity/OAuth, token persistence, startup session restore, login/logout and access gating.

// ===== Google OAuth / Drive authorization =====
const GYM_CLIENT_ID = '530515970912-7mlo4stsbcbcajrov07f911se4upv8t2.apps.googleusercontent.com';
    const GYM_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    const GYM_DISCOVERY_DOC_OAUTH2 = 'https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest';
    const GYM_SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
    const AUTH_PROFILE_STORAGE_KEY = 'thalys_google_profile';
    const AUTH_DRIVE_TOKEN_STORAGE_KEY = 'thalys_drive_access_v1';
    const AUTH_SESSION_VERSION_KEY = 'thalys_auth_software_version_v1';
    const THALYS_SOFTWARE_VERSION = window.ThalysConfig?.appVersion || '0.41.0';
    let tokenClient = null, gapiInited = false, gisInited = false, startupAccessRequested = false, authRequestInFlight = false, manualAuthFallbackUsed = false;
    let authRequestSerial = 0, reconnectRetryTimer = null, reconnectRetryCount = 0;

    function getAccessToken(){ return (window.gapi && gapi.client && gapi.client.getToken && gapi.client.getToken())?.access_token || null; }
    function cacheDriveAccessToken(resp){
      if(!resp?.access_token)return;
      const expiresIn=Math.max(60,Number(resp.expires_in||3600));
      const payload={access_token:resp.access_token,expiresAt:Date.now()+expiresIn*1000};
      try{localStorage.setItem(AUTH_DRIVE_TOKEN_STORAGE_KEY,JSON.stringify(payload));}catch(_){}
      if(window.gapi?.client)gapi.client.setToken({access_token:resp.access_token});
    }
    function clearCachedDriveAccessToken(){try{localStorage.removeItem(AUTH_DRIVE_TOKEN_STORAGE_KEY);}catch(_){}}
    function restoreCachedDriveAccessToken(){
      if(!window.gapi?.client)return false;
      try{
        const raw=JSON.parse(localStorage.getItem(AUTH_DRIVE_TOKEN_STORAGE_KEY)||'null');
        if(!raw?.access_token||!raw?.expiresAt||Number(raw.expiresAt)<=Date.now()+5000){clearCachedDriveAccessToken();return false;}
        gapi.client.setToken({access_token:raw.access_token});
        return true;
      }catch(_){clearCachedDriveAccessToken();return false;}
    }
    function savedGoogleProfile(){try{return JSON.parse(localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)||sessionStorage.getItem('gymbro_google_profile')||'null')||null;}catch(_){return null;}}
    function authDiagnostics(){
      let cached=null;try{cached=JSON.parse(localStorage.getItem(AUTH_DRIVE_TOKEN_STORAGE_KEY)||'null');}catch(_){}
      const expiresAt=Number(cached?.expiresAt||0);
      return {remembered:hasRememberedGoogleSession(),sessionVersion:rememberedSessionVersion(),currentVersion:THALYS_SOFTWARE_VERSION,online:navigator.onLine,driveTokenInMemory:!!getAccessToken(),cachedDriveTokenValid:!!(expiresAt>Date.now()+5000),cachedDriveTokenExpiresAt:expiresAt?new Date(expiresAt).toISOString():null,needsVersionReconnect:needsSoftwareVersionReconnect()};
    }

    function rememberedSessionVersion(){try{return localStorage.getItem(AUTH_SESSION_VERSION_KEY)||'';}catch(_){return '';}}
    function sessionAuthorizedForCurrentVersion(){return localStorage.getItem('thalys_app_session_v1')==='1' && rememberedSessionVersion()===THALYS_SOFTWARE_VERSION;}
    function needsSoftwareVersionReconnect(){return hasRememberedGoogleSession() && !sessionAuthorizedForCurrentVersion();}
    function markCurrentVersionAuthorized(){try{localStorage.setItem('thalys_app_session_v1','1');localStorage.setItem(AUTH_SESSION_VERSION_KEY,THALYS_SOFTWARE_VERSION);}catch(_){}}

    function updateAuthUI(profile){
      profile=profile||savedGoogleProfile();
      const connected=navigator.onLine&&!!getAccessToken();
      const reconnecting=navigator.onLine&&!connected&&!!profile;
      const appPreferredName=String(window.appState?.profile?.preferredName||'').trim();
      document.querySelectorAll('#cloud-user-name').forEach(el=>el.textContent=(connected||reconnecting)?(appPreferredName||profile?.name||profile?.displayName||profile?.email||'Utente Google'):'Utente Ospite');
      document.querySelectorAll('#cloud-user-email').forEach(el=>el.textContent=(connected||reconnecting)?(profile?.email||''):'' );
      document.querySelectorAll('#cloud-user-status').forEach(el=>{el.textContent=connected?'Google Drive · Thalys App attivo':reconnecting?'Connessione automatica a Google Drive…':'Salvataggio locale sul dispositivo';el.classList.toggle('text-emerald-400',connected);el.classList.toggle('text-amber-300',reconnecting);el.classList.toggle('text-slate-400',!connected&&!reconnecting);});
      const icon=document.getElementById('cloud-status-icon');
      if(icon){icon.className=connected?'w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-lg flex items-center justify-center':'w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-lg flex items-center justify-center';icon.innerHTML=connected?'<i class="fa-solid fa-cloud-check"></i>':'<i class="fa-solid fa-user-slash"></i>';}
      const authStatus=document.getElementById('auth-status');
      if(authStatus){
        authStatus.textContent=connected?'Stato: Connesso a Google Drive ✅':reconnecting?'Stato: connessione automatica a Drive…':'Stato: Non connesso';
        authStatus.classList.toggle('text-emerald-300',connected);
        authStatus.classList.toggle('text-slate-300/80',!connected);
      }
            const btn=document.getElementById('google-login-btn'); if(btn){btn.innerText=connected?'Disconnetti':'Accedi con Google';btn.onclick=connected?handleSignoutClick:handleAuthClick;}
      const driveActions=document.getElementById('drive-actions'); if(driveActions) driveActions.style.display=(connected||reconnecting)?'flex':'none';
      const details=document.getElementById('auth-user-details'); if(details) details.classList.toggle('hidden',!connected&&!reconnecting);
      if(connected)setDriveStatus('ok','Drive pronto');else if(reconnecting)setDriveStatus('saving','Connessione automatica…');else setDriveStatus('idle','Locale');
      const pd=document.getElementById('profile-connection-dot');
      if(pd)pd.className='profile-connection-dot '+(connected?'online':reconnecting?'reconnecting':'offline');
      if(typeof renderProfilePhotoUI==='function')renderProfilePhotoUI();
    }

    function gapiLoaded(){ if(window.gapi) gapi.load('client',initializeGapiClient); }
    async function initializeGapiClient(){ try{await gapi.client.init({discoveryDocs:[GYM_DISCOVERY_DOC,GYM_DISCOVERY_DOC_OAUTH2]});gapiInited=true;const restored=restoreCachedDriveAccessToken();maybeEnableButtons();if(needsSoftwareVersionReconnect()){updateAuthUI(savedGoogleProfile());updateWelcomeConnectionUI?.();return;}if(restored){setTimeout(()=>connectDriveAfterToken(true),50);}else{requestGoogleAccessOnStartup();}}catch(e){console.error(e);showToast('Google non disponibile al momento','fa-triangle-exclamation');} }
    function rebuildTokenClient(useRememberedHint=true){
      if(!window.google?.accounts?.oauth2)return false;
      const remembered=useRememberedHint?savedGoogleProfile():null;
      tokenClient=google.accounts.oauth2.initTokenClient({
        client_id:GYM_CLIENT_ID,
        scope:GYM_SCOPES,
        hint:remembered?.email||undefined,
        callback:()=>{}
      });
      return true;
    }
    function gisLoaded(){ if(!rebuildTokenClient(true)) return; gisInited=true;maybeEnableButtons();requestGoogleAccessOnStartup(); }
    function maybeEnableButtons(){const b=document.getElementById('google-login-btn');if(b)b.style.visibility=(gapiInited&&gisInited)?'visible':'visible';}
    function requestGoogleAccessOnStartup(){
      if(startupAccessRequested || !navigator.onLine || !gapiInited || !gisInited)return;
      if(needsSoftwareVersionReconnect())return;
      if(getAccessToken()){setTimeout(()=>connectDriveAfterToken(true),100);return;}
      const returningUser=localStorage.getItem('thalys_app_session_v1')==='1' || !!localStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
      if(!returningUser)return;
      startupAccessRequested=true;
      handleAuthClick(true);
    }
    function loginHandler(){
      // Explicit user action must never be blocked by a stale silent-startup request.
      if(gapiInited&&gisInited) return handleAuthClick(false,true);
      showToast('Google si sta caricando, riprova tra un secondo');
    }

    async function getGoogleProfile(){ try{const r=await gapi.client.oauth2.userinfo.get();return r.result||{};}catch(e){return{};} }

    async function connectDriveAfterToken(silent=false,retryCount=0){
      if(!navigator.onLine||!getAccessToken())return false;
      const profile=savedGoogleProfile()||await getGoogleProfile();
      if(profile&&Object.keys(profile).length){try{sessionStorage.setItem('gymbro_google_profile',JSON.stringify(profile));localStorage.setItem(AUTH_PROFILE_STORAGE_KEY,JSON.stringify(profile));}catch(_){}}
      updateAuthUI(profile);
      try{
        setDriveStatus('saving','Collegamento ai database Drive…');
        await initializeDriveWorkspace();
        // v0.37.8: a restored Google token is not enough to call the device synchronized.
        // If the device edited anything offline, force the full read/merge/write recovery
        // before the reconnect is considered complete. This also survives app restarts,
        // because driveDirty / sync_queue_pending are persisted locally.
        let pendingLocalSync = window.thalysNeedsDriveReconnectSync === true
          || localStorage.getItem('thalys_drive_dirty') === '1'
          || localStorage.getItem('thalys_sync_queue_pending') === '1';
        if(!pendingLocalSync && window.ThalysSyncQueue?.countPending){
          try{ pendingLocalSync = (await window.ThalysSyncQueue.countPending()) > 0; }catch(_){}
        }
        if(pendingLocalSync && typeof syncAfterNetworkRestore==='function'){
          window.thalysNeedsDriveReconnectSync=true;
          const recovered=await syncAfterNetworkRestore();
          if(!recovered)throw Object.assign(new Error('NETWORK_RECOVERY_PENDING'),{code:'NETWORK_ERROR'});
        } else {
          await refreshFromDrive(false,true);
        }
        if(typeof runWhenThalysCoreReady==='function')runWhenThalysCoreReady(()=>{if(typeof renderAllViews==='function')renderAllViews();});
        markCurrentVersionAuthorized();
        unlockApp(false);
        window.thalysRefreshAfterGoogleReconnect=false;
        if(typeof resetAppDatesToToday==='function')resetAppDatesToToday(true);
        updateAuthUI(profile);
        if(!silent)showToast('Google Drive sincronizzato','fa-cloud-check');
        try{closeModal('cloud-modal');}catch(_){}
        return true;
      }catch(e){
        console.warn('Auto Drive connect',e);
        const status=e?.status||e?.result?.error?.code;
        // v0.35.2: after an explicit logout/re-login Google may briefly answer 403 while
        // the newly issued OAuth token/grant propagates. Retry exactly once with a fresh
        // Drive workspace lookup before showing a permission error.
        if(Number(status)===403 && retryCount<1 && navigator.onLine && getAccessToken()){
          try{driveFolders=null;}catch(_){}
          await new Promise(r=>setTimeout(r,450));
          return connectDriveAfterToken(silent,retryCount+1);
        }
        if(Number(status)===401){if(window.gapi?.client)gapi.client.setToken('');clearCachedDriveAccessToken();startupAccessRequested=false;}
        setDriveStatus('error',navigator.onLine?'Drive da riconnettere':'Offline · dati locali');
        updateAuthUI(profile);
        // A transient Drive/network failure must never throw the user back to the
        // access screen. Keep the already authenticated installation usable locally
        // and let the reconnect supervisor retry in the background.
        if(typeof unlockApp==='function' && hasRememberedGoogleSession())unlockApp(false);
        if(navigator.onLine)scheduleAutomaticReconnect();
        return false;
      }
    }

    async function handleAuthClick(silentStartup=false, forceInteractive=false){
      const silent = silentStartup === true;
      if(!tokenClient||!gapiInited){if(!silent)showToast('Google non pronto: riprova tra poco');return false;}
      // v0.35.2: never allow two Google token popups/callbacks to overlap.
      // A second OAuth request could finish after the first and incorrectly show permission_denied.
      if(authRequestInFlight){
        if(silent)return false;
        // Manual reconnect supersedes a silent request that may have stalled while
        // iOS was offline/backgrounded. The serial invalidates any late callback.
        authRequestSerial++;
        authRequestInFlight=false;
        startupAccessRequested=false;
        manualAuthFallbackUsed=false;
        rebuildTokenClient(false);
      }
      authRequestInFlight=true;
      const requestSerial=++authRequestSerial;
      tokenClient.callback=async resp=>{
        if(requestSerial!==authRequestSerial)return;
        authRequestInFlight=false;
        if(resp?.error){
          console.warn('OAuth response',resp);
          startupAccessRequested=false;
          // If another Google path already installed a valid token, do not turn a late
          // popup-close/error callback into a false permission error. Use the valid token.
          if(getAccessToken()){
            await connectDriveAfterToken(silent);
            return;
          }
          // v0.35.3 desktop reconnect: after a normal local logout the OAuth grant still
          // exists. First try to reuse it without forcing account selection. Only when
          // Google explicitly requires interaction do one controlled select_account retry.
          const oauthErr=String(resp.error||'').toLowerCase();
          if(!silent && !manualAuthFallbackUsed && ['interaction_required','consent_required','login_required','account_selection_required'].includes(oauthErr)){
            manualAuthFallbackUsed=true;
            authRequestInFlight=false;
            setTimeout(()=>handleAuthClick(false,true),0);
            return;
          }
          manualAuthFallbackUsed=false;
          updateAuthUI(savedGoogleProfile());
          if(!silent)showOAuthBlockedInfo(resp);
          return;
        }
        manualAuthFallbackUsed=false;
        cacheDriveAccessToken(resp);
        const ok=await connectDriveAfterToken(silent);
        if(!ok&&!silent)showToast('Accesso riuscito, ma Drive non è stato sincronizzato','fa-triangle-exclamation');
      };
      try{
        // v0.35.3: normal reconnect first reuses the existing OAuth grant. This is more
        // reliable on desktop Chrome after a local Thalys logout and avoids unnecessary
        // popup/account-selection cycles. If Google requires interaction, callback above
        // retries exactly once with select_account.
        tokenClient.requestAccessToken((silent || !forceInteractive)?{prompt:''}:{prompt:'select_account'});
        return true;
      }catch(e){
        authRequestInFlight=false;
        startupAccessRequested=false;
        console.error(e);
        if(!silent)showToast('Errore accesso Google');
        return false;
      }
    }
    function handleSignoutClick(){
      // Normal Thalys logout is a LOCAL sign-out, not an OAuth grant revocation.
      // Revoking here is asynchronous and can race with an immediate re-login,
      // producing permission_denied even though the new token was already issued.
      authRequestSerial++;
      authRequestInFlight=false;
      startupAccessRequested=false;
      manualAuthFallbackUsed=false;
      if(window.gapi?.client) gapi.client.setToken('');
      clearCachedDriveAccessToken();
      try{window.google?.accounts?.id?.disableAutoSelect?.();}catch(_){}
      sessionStorage.removeItem('gymbro_google_profile');
      localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY);
      localStorage.removeItem(AUTH_SESSION_VERSION_KEY);
      localStorage.removeItem('google_id_token');
      sessionStorage.removeItem('google_id_token');
      driveFolders=null;
      driveDirty=false;
      // Rebuild without the old account hint so the next explicit login is clean.
      if(gisInited)rebuildTokenClient(false);
      updateAuthUI(null);
      if(typeof lockApp==='function')lockApp();
      showToast('Disconnesso da Google Drive');
    }
    function setCloudUserUI(profile){updateAuthUI(profile);}
    function logoutCloud(){handleSignoutClick();}
    function scheduleAutomaticReconnect(delay=1500){
      if(!navigator.onLine||reconnectRetryTimer)return;
      reconnectRetryTimer=setTimeout(async()=>{
        reconnectRetryTimer=null;
        if(!navigator.onLine)return;
        reconnectRetryCount++;
        const ok=await autoReconnectGoogleAfterNetwork();
        if(!ok && reconnectRetryCount<4)scheduleAutomaticReconnect(Math.min(8000,1500*reconnectRetryCount));
      },delay);
    }
    async function autoReconnectGoogleAfterNetwork(){
      if(!navigator.onLine)return false;
      startupAccessRequested=false;

      // v0.37.8: on iOS/PWA the in-memory gapi token can disappear while the app is
      // backgrounded/offline even though the cached OAuth token is still valid.
      // Restore that token first and only consider it unusable when it is actually
      // expired (5s safety margin), not one minute early.
      if(!getAccessToken())restoreCachedDriveAccessToken();
      if(getAccessToken()){
        const ok=await connectDriveAfterToken(true);
        if(ok){reconnectRetryCount=0;updateAuthUI(savedGoogleProfile());return true;}
      }

      // A genuinely expired OAuth access token cannot always be renewed by Google GIS
      // without browser/user interaction (especially iOS PWA). Try the existing grant
      // silently, but keep the app open/local if the browser refuses the background
      // request. A manual reconnect remains available without losing local state.
      startupAccessRequested=false;
      if(gapiInited&&gisInited&&!authRequestInFlight){
        try{await handleAuthClick(true,false);}catch(_){ }
      }else{
        requestGoogleAccessOnStartup();
      }
      return !!getAccessToken();
    }
    window.autoReconnectGoogleAfterNetwork=autoReconnectGoogleAfterNetwork;
    window.addEventListener('offline',()=>{
      if(reconnectRetryTimer){clearTimeout(reconnectRetryTimer);reconnectRetryTimer=null;}
      window.thalysNeedsDriveReconnectSync=true;
      if(typeof setDriveStatus==='function')setDriveStatus('idle','Locale');
      updateAuthUI(savedGoogleProfile());
    },{passive:true});
    window.addEventListener('online',()=>{
      reconnectRetryCount=0;
      if(typeof setDriveStatus==='function')setDriveStatus('saving','Riconnessione…');
      setTimeout(()=>autoReconnectGoogleAfterNetwork().then(ok=>{
        // autoReconnectGoogleAfterNetwork -> connectDriveAfterToken already performs
        // syncAfterNetworkRestore when this device was offline. Avoid a duplicate pass.
        if(ok)updateAuthUI(savedGoogleProfile());
        else scheduleAutomaticReconnect(900);
      }),250);
    },{passive:true});
    window.addEventListener('pageshow',()=>{if(navigator.onLine&&hasRememberedGoogleSession()&&!getAccessToken())setTimeout(()=>autoReconnectGoogleAfterNetwork(),200);},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine&&hasRememberedGoogleSession()&&!getAccessToken())setTimeout(()=>autoReconnectGoogleAfterNetwork(),150);},{passive:true});

// ===== Session gate / welcome screen =====
// Set your Google OAuth Client ID here
      const GOOGLE_CLIENT_ID = '530515970912-7mlo4stsbcbcajrov07f911se4upv8t2.apps.googleusercontent.com';
      const THALYS_APP_SESSION_KEY = 'thalys_app_session_v1';
      const THALYS_PROFILE_KEY = 'thalys_google_profile';
      let thalysWasOffline = !navigator.onLine;

      function unlockApp(rememberSession = true) {
        const welcomeScreen = document.getElementById('welcome-screen');
        const appShell = document.getElementById('app-shell');
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (appShell) appShell.classList.remove('hidden');
        if (rememberSession) localStorage.setItem(THALYS_APP_SESSION_KEY, '1');
        if (typeof maybeShowOfflineSetup === 'function') maybeShowOfflineSetup();
      }

      function showReconnectGateForVersion() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const appShell = document.getElementById('app-shell');
        if (appShell) appShell.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        const note=document.getElementById('welcome-connection-note');
        if(note)note.textContent='Nuova versione Thalys rilevata. Riconnetti Google una volta per confermare la sessione su questa versione.';
        updateWelcomeConnectionUI();
      }

      function lockApp() {
        localStorage.removeItem(THALYS_APP_SESSION_KEY);
        localStorage.removeItem(AUTH_SESSION_VERSION_KEY);
        const welcomeScreen = document.getElementById('welcome-screen');
        const appShell = document.getElementById('app-shell');
        if (appShell) appShell.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        updateWelcomeConnectionUI();
      }

      function onGoogleLoggedIn(response) {
        const idToken = response.credential;
        const remember = document.getElementById('remember-creds') && document.getElementById('remember-creds').checked;
        if (remember) localStorage.setItem('google_id_token', idToken);
        else sessionStorage.setItem('google_id_token', idToken);
        const payload = parseJwt(idToken);
        if(payload)try{sessionStorage.setItem('gymbro_google_profile',JSON.stringify(payload));localStorage.setItem(THALYS_PROFILE_KEY,JSON.stringify(payload));}catch(_){}
        unlockApp();
        setCloudUserUI(payload);
        updateAuthUI({ displayName: payload && (payload.name || payload.given_name || payload.email), email: payload && payload.email });
        showToast('Accesso Google effettuato', 'success');
        updateSyncStatus(true);
        try { closeModal('cloud-modal'); } catch(e){}
      }

      function parseJwt (token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch (e) { return null; }
      }

      function setCloudUserUILegacy(payload) {
        if (!payload) return;
        const userName = payload.name || payload.given_name || payload.email || 'Utente Google';
        const email = payload.email || '';
        const details = document.getElementById('auth-user-details');
        const driveActions = document.getElementById('drive-actions');
        const status = document.getElementById('auth-status');

        document.querySelectorAll('#cloud-user-name').forEach(el => {
          el.textContent = userName;
        });
        document.querySelectorAll('#cloud-user-email').forEach(el => {
          el.textContent = email;
        });
        document.querySelectorAll('#cloud-user-status').forEach(el => {
          el.textContent = 'Accesso Google Drive attivo';
          el.classList.remove('text-slate-400');
          el.classList.add('text-emerald-400');
        });

        const cloudStatusIcon = document.getElementById('cloud-status-icon');
        if (cloudStatusIcon) {
          cloudStatusIcon.className = 'w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-lg flex items-center justify-center';
          cloudStatusIcon.innerHTML = '<i class="fa-solid fa-cloud-check"></i>';
        }

        if (details) details.classList.remove('hidden');
        if (driveActions) driveActions.classList.remove('hidden');
        if (status) {
          status.textContent = 'Stato: Connesso a Google Drive ✅';
          status.style.color = 'green';
        }

        updateSyncStatus(true);
      }

      let googleIdentityReady = false;

      function ensureGoogleIdentityReady() {
        if (!window.google || !window.google.accounts || !GOOGLE_CLIENT_ID) return false;
        if (!googleIdentityReady) {
          google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleLoggedIn });
          googleIdentityReady = true;
        }
        return true;
      }

      function enterApp() {
        if (!navigator.onLine) {
          unlockApp();
          if (typeof updateAuthUI === 'function') updateAuthUI(null);
          if (typeof setDriveStatus === 'function') setDriveStatus('error', 'Offline · dati locali');
          showToast('Modalità offline: stai usando i dati salvati sul dispositivo', 'fa-cloud-arrow-down');
          return;
        }

        if (typeof loginHandler === 'function') {
          loginHandler();
          return;
        }

        if (gapiInited && gisInited && typeof handleAuthClick === 'function') {
          handleAuthClick();
          return;
        }

        if (ensureGoogleIdentityReady()) {
          google.accounts.id.prompt();
          return;
        }

        if (typeof loginWithGoogle === 'function') {
          loginWithGoogle();
          return;
        }

        showToast('Google non pronto: riprova più tardi', 'error');
      }

      function updateWelcomeConnectionUI() {
        const offline = !navigator.onLine;
        const label = document.getElementById('enter-app-label');
        const icon = document.getElementById('enter-app-icon');
        const note = document.getElementById('enter-app-note');
        const remembered = localStorage.getItem(THALYS_APP_SESSION_KEY) === '1' || !!localStorage.getItem(THALYS_PROFILE_KEY);
        if (label) label.textContent = offline ? 'Continua offline' : (remembered ? 'Riconnetti con Google' : 'Continua con Google');
        if (icon) icon.className = offline ? 'fa-solid fa-cloud-arrow-down text-base' : 'fa-brands fa-google text-base';
        if (note) note.textContent = offline
          ? 'Userai i dati locali. Potrai riconnettere Google Drive quando torni online.'
          : (remembered ? 'La sessione Drive deve essere rinnovata prima di entrare.' : 'I tuoi dati restano nel tuo spazio Google Drive.');
      }

      window.addEventListener('online', updateWelcomeConnectionUI, { passive: true });
      window.addEventListener('offline', updateWelcomeConnectionUI, { passive: true });
      window.addEventListener('DOMContentLoaded', updateWelcomeConnectionUI, { once: true });
      updateWelcomeConnectionUI();

      function triggerGoogleSignIn() {
        enterApp();
      }

      function hasRememberedGoogleSession() {
        return localStorage.getItem(THALYS_APP_SESSION_KEY) === '1' || !!localStorage.getItem(THALYS_PROFILE_KEY);
      }

      function refreshAuthUIFromStorage() {
        const saved = localStorage.getItem('google_id_token') || sessionStorage.getItem('google_id_token');
        const p = saved ? parseJwt(saved) : null;
        if (p) {
          try { localStorage.setItem(THALYS_PROFILE_KEY, JSON.stringify(p)); } catch (_) {}
        }

        const remembered=hasRememberedGoogleSession();
        if(!remembered){lockApp();return;}

        // A software update is the only normal case where an already authenticated
        // installation is intentionally returned to the reconnect screen.
        if(needsSoftwareVersionReconnect()){
          showReconnectGateForVersion();
          if (typeof updateAuthUI === 'function') updateAuthUI(p || savedGoogleProfile());
          return;
        }

        // Same software version: open the app immediately from the remembered local
        // session. Drive token restoration/renewal happens in the background and must
        // never force a Google popup or welcome screen just because the page refreshed.
        unlockApp(false);
        if (typeof updateAuthUI === 'function') updateAuthUI(p || savedGoogleProfile());
        if(!navigator.onLine){
          if (typeof setDriveStatus === 'function') setDriveStatus('error', 'Offline · dati locali');
          if (typeof updateSyncStatus === 'function') updateSyncStatus(false);
          return;
        }
        if (typeof requestGoogleAccessOnStartup === 'function') requestGoogleAccessOnStartup();
      }

      let authBootstrapPromise=null;
      function initializeAuthAfterLocalState() {
        if(authBootstrapPromise)return authBootstrapPromise;
        authBootstrapPromise=(async()=>{
          // IndexedDB on iOS can occasionally take time to resume after backgrounding.
          // Never let that make the Google reconnect button unavailable indefinitely.
          try{
            const stateReady=window.thalysPrimaryStateReady || window.thalysStorageReady || Promise.resolve();
            await Promise.race([stateReady,new Promise(resolve=>setTimeout(resolve,1800))]);
          }catch(_){}
          ensureGoogleIdentityReady();
          refreshAuthUIFromStorage();
        })();
        return authBootstrapPromise;
      }
      initializeAuthAfterLocalState();
      window.addEventListener('DOMContentLoaded', initializeAuthAfterLocalState, { once: true });

// Canonical public UI bridge after legacy compatibility helpers.
function setCloudUserUI(profile){ updateAuthUI(profile); }

// ===== v0.37.8: robust reconnect after an app was STARTED offline =====
let thalysReconnectSupervisorV0376=null;
let thalysReconnectBusyV0376=false;
function stopReconnectSupervisorV0376(){if(thalysReconnectSupervisorV0376){clearInterval(thalysReconnectSupervisorV0376);thalysReconnectSupervisorV0376=null;}}
async function reconnectTickV0376(){
  if(thalysReconnectBusyV0376||!navigator.onLine||!hasRememberedGoogleSession())return false;
  thalysReconnectBusyV0376=true;
  try{
    if(!getAccessToken()&&gapiInited)restoreCachedDriveAccessToken();
    if(getAccessToken()){
      const ok=await connectDriveAfterToken(true);
      if(ok){stopReconnectSupervisorV0376();updateAuthUI(savedGoogleProfile());return true;}
    }
    if(gapiInited&&gisInited&&!authRequestInFlight){startupAccessRequested=false;await handleAuthClick(true,false);}
    return !!getAccessToken();
  }catch(e){console.warn('Reconnect supervisor v0.37.8',e);return false;}
  finally{thalysReconnectBusyV0376=false;}
}
function startReconnectSupervisorV0376(){
  if(!navigator.onLine||!hasRememberedGoogleSession())return;
  stopReconnectSupervisorV0376();
  reconnectTickV0376();
  let ticks=0;
  thalysReconnectSupervisorV0376=setInterval(()=>{
    ticks++;
    if(!navigator.onLine||!hasRememberedGoogleSession()||getAccessToken()&&window.thalysNeedsDriveReconnectSync===false||ticks>30){stopReconnectSupervisorV0376();return;}
    reconnectTickV0376();
  },1000);
}
window.addEventListener('offline',()=>{stopReconnectSupervisorV0376();window.thalysNeedsDriveReconnectSync=true;updateAuthUI(savedGoogleProfile());},{passive:true});
window.addEventListener('online',()=>{setTimeout(startReconnectSupervisorV0376,100);},{passive:true});
window.addEventListener('pageshow',()=>{if(navigator.onLine&&hasRememberedGoogleSession())setTimeout(startReconnectSupervisorV0376,250);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine&&hasRememberedGoogleSession())setTimeout(startReconnectSupervisorV0376,200);});

// ===== v0.37.8: reload Google libraries after an app was opened offline =====
let thalysGoogleLibrariesLoadingV0377=null;
function loadExternalScriptV0377(src,marker){
  return new Promise((resolve,reject)=>{
    if(marker())return resolve(true);
    const existing=[...document.scripts].find(s=>String(s.src||'').startsWith(src));
    if(existing){
      const poll=setInterval(()=>{if(marker()){clearInterval(poll);resolve(true);}},120);
      setTimeout(()=>{clearInterval(poll);if(marker())resolve(true);else{try{existing.remove();}catch(_){};const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve(true);s.onerror=reject;document.head.appendChild(s);}},1000);
      return;
    }
    const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve(true);s.onerror=reject;document.head.appendChild(s);
  });
}
async function ensureGoogleLibrariesV0377(){
  if(!navigator.onLine)return false;
  if(thalysGoogleLibrariesLoadingV0377)return thalysGoogleLibrariesLoadingV0377;
  thalysGoogleLibrariesLoadingV0377=(async()=>{
    try{
      if(!window.google?.accounts?.oauth2)await loadExternalScriptV0377('https://accounts.google.com/gsi/client',()=>!!window.google?.accounts?.oauth2);
      if(!window.gapi)await loadExternalScriptV0377('https://apis.google.com/js/api.js',()=>!!window.gapi);
      if(window.gapi&&!gapiInited){await new Promise((resolve,reject)=>{try{gapi.load('client',{callback:resolve,onerror:reject,timeout:5000,ontimeout:reject});}catch(e){reject(e);}});await initializeGapiClient();}
      if(window.google?.accounts?.oauth2&&!gisInited){if(rebuildTokenClient(true)){gisInited=true;maybeEnableButtons();}}
      return !!(gapiInited&&gisInited&&tokenClient);
    }catch(e){console.warn('Google libraries reload v0.37.8',e);return false;}
    finally{thalysGoogleLibrariesLoadingV0377=null;}
  })();
  return thalysGoogleLibrariesLoadingV0377;
}
window.ensureGoogleLibrariesV0377=ensureGoogleLibrariesV0377;

const _autoReconnectGoogleAfterNetworkV0377Base=autoReconnectGoogleAfterNetwork;
autoReconnectGoogleAfterNetwork=async function(){
  if(!navigator.onLine||!hasRememberedGoogleSession())return false;
  if(needsSoftwareVersionReconnect())return false;
  await ensureGoogleLibrariesV0377();
  if(!gapiInited||!gisInited)return false;
  if(!getAccessToken())restoreCachedDriveAccessToken();
  if(getAccessToken()){
    const ok=await connectDriveAfterToken(true);
    if(ok)return true;
  }
  return _autoReconnectGoogleAfterNetworkV0377Base();
};
window.autoReconnectGoogleAfterNetwork=autoReconnectGoogleAfterNetwork;

loginHandler=async function(){
  if(!navigator.onLine){showToast('Sei offline: collega Internet per riconnettere Google');return false;}
  const ready=await ensureGoogleLibrariesV0377();
  if(!ready){showToast('Google non è ancora disponibile. Riprova tra qualche secondo');return false;}
  startupAccessRequested=false;
  return handleAuthClick(false,true);
};

// If the app booted offline, the original external Google scripts may have failed permanently.
// On network restoration, reload them and retry until the remembered session is connected.
window.addEventListener('online',()=>{
  reconnectRetryCount=0;
  setTimeout(async()=>{
    await ensureGoogleLibrariesV0377();
    if(typeof startReconnectSupervisorV0376==='function')startReconnectSupervisorV0376();
    else autoReconnectGoogleAfterNetwork();
  },150);
},{passive:true});

window.ThalysAuthDiagnostics=authDiagnostics;
