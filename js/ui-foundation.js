
      function updateViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--app-vh', `${vh}px`);
      }

      window.addEventListener('resize', updateViewportHeight, { passive: true });
      window.addEventListener('orientationchange', updateViewportHeight, { passive: true });
      window.addEventListener('load', updateViewportHeight, { passive: true });

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

      function lockApp() {
        localStorage.removeItem(THALYS_APP_SESSION_KEY);
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

      function setCloudUserUI(payload) {
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

        // Offline-first: a previously authenticated installation may still open locally
        // when there is no network. Online, however, we do NOT unlock the app until
        // Google Drive has a valid access token and the databases have been connected.
        if (!navigator.onLine) {
          if (hasRememberedGoogleSession()) {
            unlockApp(false);
            if (typeof updateAuthUI === 'function') updateAuthUI(p || null);
            if (typeof setDriveStatus === 'function') setDriveStatus('error', 'Offline · dati locali');
            if (typeof updateSyncStatus === 'function') updateSyncStatus(false);
          } else {
            lockApp();
          }
          return;
        }

        // Online startup: keep/show the initial access screen until google-auth.js
        // restores a still-valid Drive token or completes Google authorization.
        const welcomeScreen = document.getElementById('welcome-screen');
        const appShell = document.getElementById('app-shell');
        if (appShell) appShell.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (typeof updateAuthUI === 'function') updateAuthUI(p || null);
        updateWelcomeConnectionUI();
        if (typeof requestGoogleAccessOnStartup === 'function') requestGoogleAccessOnStartup();
      }

      (function initGoogle() {
        ensureGoogleIdentityReady();
        refreshAuthUIFromStorage();
      })();

      window.addEventListener('DOMContentLoaded', refreshAuthUIFromStorage, { once: true });

      function closeNetworkRestoredModal() {
        document.getElementById('network-restored-modal')?.classList.add('hidden');
        if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
      }

      function showNetworkRestoredModal() {
        const modal = document.getElementById('network-restored-modal');
        if (!modal || localStorage.getItem(THALYS_APP_SESSION_KEY) !== '1') return;
        modal.classList.remove('hidden');
        if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
      }

      async function reconnectAndRefreshAfterOnline() {
        closeNetworkRestoredModal();
        if (!navigator.onLine) {
          showToast('La rete non è ancora disponibile', 'fa-wifi');
          return;
        }
        if (typeof getAccessToken === 'function' && getAccessToken()) {
          if (typeof refreshFromDrive === 'function') await refreshFromDrive(true, true);
          if (typeof renderAllViews === 'function') renderAllViews();
          showToast('Rete presente · pagine aggiornate ✓', 'fa-wifi');
          return;
        }
        window.thalysRefreshAfterGoogleReconnect = true;
        if (typeof loginHandler === 'function') loginHandler();
      }

      window.closeNetworkRestoredModal = closeNetworkRestoredModal;
      window.reconnectAndRefreshAfterOnline = reconnectAndRefreshAfterOnline;

      // v0.22: explicit network-mode notifications. Offline edits remain local and
      // are reconciled with Drive by syncAfterNetworkRestore() when connectivity returns.
      window.addEventListener('offline', () => {
        thalysWasOffline = true;
        window.thalysOfflineSessionActive = true;
        if (typeof setDriveStatus === 'function') setDriveStatus('error', 'Offline · modifiche salvate sul dispositivo');
        if (typeof updateSyncStatus === 'function') updateSyncStatus(false);
        showToast('modalità offline attivata - assenza connessione');
      }, { passive: true });
      window.addEventListener('online', () => {
        const returningFromOffline=thalysWasOffline||window.thalysOfflineSessionActive;
        thalysWasOffline = false;
        window.thalysOfflineSessionActive = false;
        if (typeof renderAllViews === 'function') renderAllViews();
        if (typeof updateSyncStatus === 'function') updateSyncStatus();
        if(returningFromOffline)showToast('modalità online attivata');
        setTimeout(()=>{
          if(typeof getAccessToken==='function'&&getAccessToken()&&typeof syncAfterNetworkRestore==='function')syncAfterNetworkRestore();
          else if(typeof requestGoogleAccessOnStartup==='function')requestGoogleAccessOnStartup();
        },120);
      }, { passive: true });
      window.addEventListener('thalys:network-resync-complete', () => {
        if (typeof updateSyncStatus === 'function') updateSyncStatus(true);
        showToast('Sincronizzazione completata: modifiche offline aggiornate su Drive');
      });

      async function autoSaveToCloud(payload) {
        const idToken = sessionStorage.getItem('google_id_token');
        try {
          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': idToken ? `Bearer ${idToken}` : '' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Save failed');
          showToast('Salvataggio cloud riuscito', 'success');
          updateSyncStatus(true);
          return await res.json();
        } catch (err) {
          showToast('Errore salvataggio cloud', 'error');
          updateSyncStatus(false);
          return null;
        }
      }

      function showToast(msg) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        toastMsg.textContent = msg;
        toast.classList.remove('opacity-0','pointer-events-none');
        setTimeout(()=>{ toast.classList.add('opacity-0','pointer-events-none'); }, 3000);
      }

      function updateSyncStatus(isCloud) {
        const icon = document.getElementById('sync-icon');
        const text = document.getElementById('sync-text');
        const onlineDot = document.getElementById('online-indicator');
        const hasDriveToken = !!(window.gapi && window.gapi.client && window.gapi.client.getToken && window.gapi.client.getToken());
        const hasRememberedGoogle = !!(localStorage.getItem('thalys_google_profile') || localStorage.getItem('google_id_token') || sessionStorage.getItem('google_id_token'));
        const connected = navigator.onLine && (typeof isCloud === 'boolean' ? isCloud : hasDriveToken);
        const reconnecting = navigator.onLine && !connected && hasRememberedGoogle;

        if (connected) {
          if (icon) icon.className = 'fa-solid fa-cloud-arrow-up text-cyan-400';
          if (text) text.textContent = 'Cloud';
          if (onlineDot) { onlineDot.className = 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border border-slate-800'; } const pd=document.getElementById('profile-connection-dot');if(pd)pd.className='profile-connection-dot online';

          const cloudStatusText = document.getElementById('cloud-user-status');
          if (cloudStatusText) {
            cloudStatusText.textContent = 'Accesso Google Drive attivo';
            cloudStatusText.classList.remove('text-slate-400');
            cloudStatusText.classList.add('text-emerald-400');
          }

          const cloudStatusIcon = document.getElementById('cloud-status-icon');
          if (cloudStatusIcon) {
            cloudStatusIcon.className = 'w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-lg flex items-center justify-center';
            cloudStatusIcon.innerHTML = '<i class="fa-solid fa-cloud-check"></i>';
          }
        } else if (reconnecting) {
          if (icon) icon.className = 'fa-solid fa-cloud-arrow-up text-amber-300';
          if (text) text.textContent = 'Connessione…';
          if (onlineDot) onlineDot.className = 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 border border-slate-800';
          const pd=document.getElementById('profile-connection-dot');if(pd)pd.className='profile-connection-dot reconnecting';
        } else {
          if (icon) icon.className = 'fa-solid fa-cloud text-slate-400';
          if (text) text.textContent = 'Locale';
          if (onlineDot) { onlineDot.className = 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 border border-slate-800'; } const pd=document.getElementById('profile-connection-dot');if(pd)pd.className='profile-connection-dot offline';

          const cloudStatusText = document.getElementById('cloud-user-status');
          if (cloudStatusText) {
            cloudStatusText.textContent = 'Salvataggio locale su browser';
            cloudStatusText.classList.remove('text-emerald-400');
            cloudStatusText.classList.add('text-slate-400');
          }

          const cloudStatusIcon = document.getElementById('cloud-status-icon');
          if (cloudStatusIcon) {
            cloudStatusIcon.className = 'w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-lg flex items-center justify-center';
            cloudStatusIcon.innerHTML = '<i class="fa-solid fa-user-slash"></i>';
          }
        }
      }
    
