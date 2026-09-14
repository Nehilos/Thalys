

// v0.28.4: prevent Drive/Auth/UI callbacks from rendering a partially initialized core.
function runWhenThalysCoreReady(callback){
  if(typeof callback!=='function')return;
  if(window.__THALYS_APP_CORE_READY__===true){callback();return;}
  window.addEventListener('thalys:core-ready',()=>callback(),{once:true});
}
window.runWhenThalysCoreReady=runWhenThalysCoreReady;

      function updateViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--app-vh', `${vh}px`);
      }

      window.addEventListener('resize', updateViewportHeight, { passive: true });
      window.addEventListener('orientationchange', updateViewportHeight, { passive: true });
      window.addEventListener('load', updateViewportHeight, { passive: true });

      // Google authentication/session bootstrap moved to js/auth.js in v0.26.



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
          if(typeof runWhenThalysCoreReady==='function')runWhenThalysCoreReady(()=>{if(typeof renderAllViews==='function')renderAllViews();});
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
        window.thalysNetworkRecoveryPending = true;
        if (typeof setDriveStatus === 'function') setDriveStatus('error', 'Offline · modifiche salvate sul dispositivo');
        if (typeof updateSyncStatus === 'function') updateSyncStatus(false);
        showToast('modalità offline attivata - assenza connessione');
      }, { passive: true });
      window.addEventListener('online', () => {
        const returningFromOffline=thalysWasOffline||window.thalysOfflineSessionActive;
        thalysWasOffline = false;
        window.thalysOfflineSessionActive = false;
        // v0.36.2: do not render stale local data before Drive/tombstone reconciliation.
        window.thalysNetworkRecoveryPending = true;
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
    
