
    // Global Application State Default Structure
    // Shared date state must exist before any bootstrap/render path can reference it.
    // Keeping these declarations at the top prevents Safari/WebKit temporal-dead-zone errors.

    // Shared date state must exist before any bootstrap/render path can reference it.
    // Keeping these declarations at the top prevents Safari/WebKit temporal-dead-zone errors.
    let homeSelectedDate = new Date().toISOString().split('T')[0];
    let analyticsSelectedDate = new Date().toISOString().split('T')[0];

    // v0.28.4 startup safety: this helper must exist before appState normalization.
    // It used to live in body.js, which is loaded after app-core.js.
    function normalizeProfileGenderValue(gender){
      const v=String(gender||'').trim().toLowerCase();
      return ['female','femmina','donna','woman','mujer','mulher','femeie','f'].includes(v)?'female':'male';
    }
    window.normalizeProfileGenderValue = normalizeProfileGenderValue;
    window.__THALYS_APP_CORE_READY__ = false;

    const DEFAULT_STATE = {
      profile: { preferredName: '', gender: 'male', age: 25, height: 175, sleepHours: 7, lifestyle: 'moderato' },
      profilePhoto: null,
      messages: [],
      deletedMessageIds: [],
      consultations: [],
      aiConsults: [],
      targets: { calories: 2200, p: 150, c: 250, f: 70, satFat: 20, sugars: 50, calcium: 1000, magnesium: 350, zinc: 11, fiber: 30, salt: 5, iron: 11, potassium: 3500 },
      workouts: [], // completed per-exercise workout logs
      workoutHistory: [], // completed training days
      activeWorkoutPlanHistory: [], // plan activation timeline
      nutrition: [], // consumed-dose values; vitamins are code strings (e.g. B1 B12 C / A D E K)
      water: {}, // { "YYYY-MM-DD": 1500 }
      settings: { waterTargetMl: 2500 },
      avatar: { skin:'#ddb28f', hairStyle:'short', hairColor:'#18120f', view:'front', showMeasures:false },
      workoutPlans: [], // [{ id, name, days[], exercises: [...] }]
      activeWorkoutPlanId: null,
      workoutAssignments: {}, // { "YYYY-MM-DD": planId }
      workoutCompletions: {}, // { "YYYY-MM-DD": { planId, exercises: { planExerciseId: true }, completedAt } }
      wellness: [], // [{ id, date, sleepHours, stress, recovery, mood, readiness, notes, meditationMinutes, meditationQuality, meditationType }]
      meditation: [],
      presets: [
        { name: "Petto di Pollo (Cotto)", p: 31, c: 0, f: 3.6, sugars: 0, calcium: 15, magnesium: 30, fiber: 0 },
        { name: "Riso Basmati (Crudo)", p: 7, c: 78, f: 0.9, sugars: 0, calcium: 10, magnesium: 50, fiber: 1.6 },
        { name: "Fiocchi d'Avena", p: 13, c: 68, f: 7, sugars: 0, calcium: 52, magnesium: 120, fiber: 8 },
        { name: "Uova Intere", p: 13, c: 1, f: 10, sugars: 0, calcium: 56, magnesium: 12, fiber: 0 }
      ],
      bodyMetrics: [], // [{ id, date, weight, bf, neck, shoulders, chest, waist, hips, biceps, forearm, thigh, calf }]
      photos: [], // [{ id, date, base64 }]
      weeklyNutritionStatus: {}
    };

    let appState = JSON.parse(localStorage.getItem('thalys_data') || localStorage.getItem('gymbro_data')) || DEFAULT_STATE;
    appState = {...DEFAULT_STATE, ...appState, profile:{...DEFAULT_STATE.profile,...(appState.profile||{})}, targets:{...DEFAULT_STATE.targets,...(appState.targets||{})}, settings:{...DEFAULT_STATE.settings,...(appState.settings||{})}, avatar:{...DEFAULT_STATE.avatar,...(appState.avatar||{})}};
    appState.profile.gender=normalizeProfileGenderValue(appState.profile.gender);
    const legacyFoodDb = localStorage.getItem('thalys_foods');
    if (legacyFoodDb) {
      try {
        const parsedDb = JSON.parse(legacyFoodDb);
        if (Array.isArray(parsedDb)) {
          appState.presets = parsedDb;
        } else if (parsedDb && typeof parsedDb === 'object') {
          const migrated = Object.values(parsedDb)
            .filter(item => item && typeof item === 'object' && item.name)
            .map(item => ({ name: item.name, p: Number(item.p) || 0, c: Number(item.c) || 0, f: Number(item.f) || 0 }));
          if (migrated.length) appState.presets = migrated;
        }
      } catch (err) {
        console.warn('Legacy food DB parse failed:', err);
      }
    }
    window.appState = appState;
    window.__THALYS_PRIMARY_STATE_HYDRATED__ = false;

    function normalizeLoadedAppState(raw) {
      const state = raw && typeof raw === 'object' ? raw : {};
      const normalized = {...DEFAULT_STATE, ...state, profile:{...DEFAULT_STATE.profile,...(state.profile||{})}, targets:{...DEFAULT_STATE.targets,...(state.targets||{})}, settings:{...DEFAULT_STATE.settings,...(state.settings||{})}, avatar:{...DEFAULT_STATE.avatar,...(state.avatar||{})}};
      normalized.profile.gender = normalizeProfileGenderValue(normalized.profile.gender);
      return normalized;
    }

    // v0.37: IndexedDB is the authoritative local snapshot. localStorage remains an
    // immediate compatibility/fallback mirror until the next migration step.
    window.thalysPrimaryStateReady = (async () => {
      try {
        await (window.thalysStorageReady || Promise.resolve());
        const record = await window.ThalysStorage?.readPrimaryState?.();
        if (record?.state) {
          appState = normalizeLoadedAppState(record.state);
          // v0.37.2: recover the full user-selected profile photo from the local
          // IndexedDB document if the first v0.37 migration started from the compact
          // localStorage mirror where dataUrl was intentionally stripped.
          try {
            const photoRecord = await window.ThalysStorage?.get?.(window.ThalysStorage.CONFIG.stores.files, 'profile_photo.json');
            const storedPhoto = photoRecord?.data;
            if (storedPhoto?.dataUrl) {
              const currentPhoto = appState.profilePhoto || null;
              const st = Date.parse(storedPhoto.updatedAt || 0) || 0;
              const ct = Date.parse(currentPhoto?.updatedAt || 0) || 0;
              if (!currentPhoto?.dataUrl || st >= ct) appState.profilePhoto = { ...storedPhoto, mode: 'custom' };
            }
          } catch (error) { console.warn('Ripristino foto profilo completa', error); }
          window.appState = appState;
          window.__THALYS_PRIMARY_STATE_HYDRATED__ = true;
          try{window.dispatchEvent(new CustomEvent('thalys:primary-state-ready',{detail:{source:'indexeddb'}}));}catch(_){}
          try { localStorage.setItem('thalys_data', JSON.stringify(compactStateForLocalStorage(appState))); } catch (_) {}
          try { await window.ThalysStorage?.writePrimaryState?.(appState, { source: 'v0.37.2-profile-photo-repair' }); } catch (_) {}
          return { source: 'indexeddb', savedAt: record.savedAt || null };
        }
        window.__THALYS_PRIMARY_STATE_HYDRATED__ = true;
        try{window.dispatchEvent(new CustomEvent('thalys:primary-state-ready',{detail:{source:'localStorage'}}));}catch(_){}
        await window.ThalysStorage?.writePrimaryState?.(appState, { source: 'bootstrap-fallback' });
        return { source: 'localStorage' };
      } catch (error) {
        console.warn('Bootstrap stato IndexedDB', error);
        window.__THALYS_PRIMARY_STATE_HYDRATED__ = true;
        return { source: 'localStorage', error };
      }
    })();

    function compactStateForLocalStorage(state) {
      const source = state || {};
      return {
        ...source,
        photos: (source.photos || []).map(({ base64, ...photo }) => photo),
        profilePhoto: source.profilePhoto?.dataUrl ? { ...source.profilePhoto, dataUrl: '' } : (source.profilePhoto || null),
        // Full consultation/AI histories are mirrored in IndexedDB and Drive. Keeping
        // only compact metadata here prevents WebKit QuotaExceededError (code 22).
        consultations: (source.consultations || []).slice(0, 40).map(x => ({id:x.id,type:x.type,date:x.date,createdAt:x.createdAt,updatedAt:x.updatedAt,goal:x.goal||''})),
        aiConsults: (source.aiConsults || []).slice(0, 30).map(x => ({id:x.id,date:x.date,createdAt:x.createdAt,updatedAt:x.updatedAt,type:x.type,status:x.status,title:x.title||''}))
      };
    }

    function persistThalysStateLocally(state = appState, meta = {}) {
      // Primary write: full state to IndexedDB. Fire-and-forget by design so UI saves
      // stay synchronous; thalysPrimaryWriteTail can be awaited by sync/recovery paths.
      if (window.__THALYS_PRIMARY_STATE_HYDRATED__ && window.ThalysStorage?.writePrimaryState) {
        const write = () => window.ThalysStorage.writePrimaryState(state, { source: meta.source || 'persistThalysStateLocally' });
        window.thalysPrimaryWriteTail = (window.thalysPrimaryWriteTail || Promise.resolve()).then(write, write).catch(error => { console.warn('Primary state IndexedDB write', error); return null; });
      }
      try {
        localStorage.setItem('thalys_data', JSON.stringify(compactStateForLocalStorage(state)));
        return true;
      } catch (error) {
        console.error('Salvataggio locale compatto', error);
        if (error?.name === 'QuotaExceededError' || error?.code === 22) {
          showToast('Spazio locale pieno: i dati completi restano in IndexedDB', 'fa-database');
          return false;
        }
        throw error;
      }
    }
    window.persistThalysStateLocally = persistThalysStateLocally;
    persistThalysStateLocally(appState);


    // Save State locally and sync to cloud if available
    function saveStateToLocal(meta={}){let previousState=null;try{previousState=JSON.parse(localStorage.getItem('thalys_data')||'null');}catch(_){}if(previousState&&window.ThalysSyncQueue?.enqueueGranularChanges)window.ThalysSyncQueue.enqueueGranularChanges(previousState,appState,{source:meta.source||'saveStateToLocal'});persistThalysStateLocally(appState,{source:meta.source||'saveStateToLocal'});try{localStorage.setItem('thalys_foods',JSON.stringify(appState.presets||[]));}catch(e){console.warn('Food cache quota',e);localStorage.removeItem('thalys_foods');}if(typeof syncThalysLocalDocuments==='function')syncThalysLocalDocuments(appState);if(window.ThalysSyncQueue?.enqueueStateChange)window.ThalysSyncQueue.enqueueStateChange({source:meta.source||'saveStateToLocal'});driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();scheduleDriveSync(350);}
    window.saveStateToLocal = saveStateToLocal;


    const PROFILE_MESSAGES=[
      {id:'profile_workout',title:'Completamento profilo · Scheda allenamento',body:'Crea una scheda con esercizi distribuiti su giorni diversi. Puoi modificarla, renderla attiva, importarla o esportarla.',target:'workout',action:'Schede'},
      {id:'profile_body',title:'Completamento profilo · Misure corpo',body:'Inserisci una misurazione completa per alimentare trend, BMI/BMR e avatar corporeo.',target:'body',action:'Nuova misura'},
      {id:'profile_demo',title:'Completamento profilo · Dati anagrafici',body:'Imposta sesso biologico, età, altezza e stile di vita.',target:'body',action:'Dati anagrafici'},
      {id:'profile_targets',title:'Completamento profilo · Target nutrizionali',body:'Conferma o modifica i target nutrizionali. Una volta salvati restano attivi finché non li cambi.',target:'nutrition',action:'Target'}
    ];
    let messageSelectionMode=false;const selectedMessageIds=new Set();
    function ensureMessageArrayOnly(){if(!Array.isArray(appState.messages))appState.messages=[];if(!Array.isArray(appState.deletedMessageIds))appState.deletedMessageIds=[];}
    function isMessageDeleted(id){ensureMessageArrayOnly();return appState.deletedMessageIds.includes(id);}
    function isCompleteBodyMeasure(){const x=[...(appState.bodyMetrics||[])].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];return !!x&&['weight','neck','shoulders','chest','waist','hips','biceps','thigh','calf'].every(k=>Number(x[k])>0);}
    function isProfileDataComplete(){const p=appState.profile||{};return !!p.gender&&Number(p.age)>0&&Number(p.height)>0&&!!p.lifestyle;}
    function ensureProfileMessages(){ensureMessageArrayOnly();PROFILE_MESSAGES.forEach(m=>{if(!isMessageDeleted(m.id)&&!appState.messages.some(x=>x.id===m.id))appState.messages.push({...m,type:'onboarding',status:'todo',read:false,skipped:false,createdAt:new Date().toISOString()});});refreshProfileMessageCompletion(false);}
    function refreshProfileMessageCompletion(save=true){ensureMessageArrayOnly();const c={profile_workout:()=>!!getActiveWorkoutPlan(),profile_body:()=>isCompleteBodyMeasure(),profile_demo:()=>isProfileDataComplete()&&!!appState.profileConfigured,profile_targets:()=>!!appState.targetsConfirmed};let changed=false;appState.messages.forEach(m=>{if(c[m.id]?.()&&m.status!=='done'){m.status='done';m.read=true;changed=true;}});if(changed&&save)saveStateToLocal();renderMessageBadge();}
    function renderMessageBadge(){ensureMessageArrayOnly();const now=Date.now(),n=appState.messages.filter(m=>!m.read&&m.status!=='done'&&(!m.snoozedUntil||Date.parse(m.snoozedUntil)<=now)).length,b=document.getElementById('header-message-badge');if(!b)return;b.textContent=n>99?'99+':n;b.classList.toggle('hidden',n===0);}
    function openMessages(){ensureProfileMessages();renderMessages();openModal('messages-modal');}
    function renderMessages(){
      const box=document.getElementById('messages-list');if(!box)return;ensureMessageArrayOnly();const now=Date.now();
      const visible=appState.messages.filter(m=>!m.snoozedUntil||Date.parse(m.snoozedUntil)<=now||m.status==='done');
      if(!visible.length){box.innerHTML=`<div class="p-5 text-center text-xs text-slate-500">${tk('messages.no_messages','Nessun messaggio.')}</div>`;return;}
      box.innerHTML=visible.map(m=>{
        const onboarding=m.type==='onboarding',completed=onboarding&&m.status==='done';
        const statusText=onboarding?(completed?tr('Completato'):tr('Da fare')):(m.read?tr('Letto'):tr('Nuovo'));
        const category=tr(m.type==='milestone'?'Risultato':m.type==='insight'?'Suggerimento':'Onboarding');
        return `<div class="message-row ${completed?'done':''} rounded-2xl border ${completed?'border-emerald-500/20':'border-slate-800'} bg-slate-900/65 p-3">
          <div class="flex items-start gap-3">
            ${messageSelectionMode?`<input type="checkbox" ${selectedMessageIds.has(m.id)?'checked':''} onchange="toggleMessageSelect('${m.id}',this.checked)" class="mt-1 h-5 w-5 accent-cyan-500">`:''}
            <button class="min-w-0 flex-1 text-left" onclick="openMessageDetail('${m.id}')">
              <div class="mb-1 flex items-center gap-1"><span class="rounded-full bg-slate-800 px-2 py-0.5 text-[8px] text-slate-400">${category}</span>${!m.read?'<span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>':''}</div>
              <div class="flex justify-between gap-2"><div class="message-title text-xs font-black text-white">${m.titleKey?tk(m.titleKey,m.title):tr(escapeHTML(m.title))}</div><span class="shrink-0 rounded-full px-2 py-1 text-[8px] font-bold ${completed?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-300'}">${statusText}</span></div>
              <div class="mt-1 line-clamp-2 text-[10px] text-slate-400">${m.bodyKey?tk(m.bodyKey,m.body):tr(escapeHTML(m.body))}</div>
            </button>
          </div>
        </div>`;
      }).join('');
    }
    function escapeHTML(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
    function openMessageDetail(id){
      const m=appState.messages.find(x=>x.id===id);if(!m)return;m.read=true;saveStateToLocal();renderMessageBadge();
      const actionable=m.type==='onboarding'&&m.status!=='done';
      const go=actionable?`<button onclick="runProfileMessage('${m.id}')" class="mt-3 w-full min-h-11 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black">${tr('Vai a')} ${tr(escapeHTML(m.action||''))}</button>`:'';
      const skip=actionable?`<button onclick="skipProfileMessage('${m.id}')" class="mt-2 w-full min-h-10 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">${tr('Salta')}</button>`:'';
      const snooze=m.status!=='done'?`<button onclick="snoozeMessage('${m.id}',7)" class="mt-2 w-full min-h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold">${tr('Ricordamelo tra 7 giorni')}</button>`:'';
      document.getElementById('messages-list').innerHTML=`<button onclick="renderMessages()" class="mb-3 text-[10px] font-bold text-cyan-300">← ${tr('Tutti')}</button><div class="rounded-2xl bg-slate-900/70 p-4"><div class="text-sm font-black text-white">${m.titleKey?tk(m.titleKey,m.title):tr(escapeHTML(m.title))}</div><div class="mt-2 text-xs leading-relaxed text-slate-300">${m.bodyKey?tk(m.bodyKey,m.body):tr(escapeHTML(m.body))}</div><div class="mt-2 text-[10px] ${m.type==='onboarding'&&m.status==='done'?'text-emerald-300':'text-slate-400'}">${tr('Stato')}: ${m.type==='onboarding'?(m.status==='done'?tr('Completato'):tr('Da fare')):(m.read?tr('Letto'):tr('Nuovo'))}</div>${go}${skip}${snooze}</div>`;
    }
    function markAllMessagesRead(){ensureMessageArrayOnly();appState.messages.forEach(m=>m.read=true);saveStateToLocal();renderMessages();renderMessageBadge();}
    function snoozeMessage(id,days=7){const m=appState.messages.find(x=>x.id===id);if(!m)return;const d=new Date();d.setDate(d.getDate()+days);m.snoozedUntil=d.toISOString();m.read=true;saveStateToLocal();renderMessages();renderMessageBadge();}
    function skipProfileMessage(id){const m=appState.messages.find(x=>x.id===id);if(!m)return;m.skipped=true;m.read=true;saveStateToLocal();renderMessages();renderMessageBadge();}
    function runProfileMessage(id){closeModal('messages-modal');const pulse=sel=>{const e=document.querySelector(sel);if(!e)return;e.classList.add('guided-pulse');setTimeout(()=>e.classList.remove('guided-pulse'),9000)};if(id==='profile_workout'){switchTab('workout');setTimeout(()=>pulse('#tab-workout .workout-header-actions button:first-child'),150)}if(id==='profile_body'){switchTab('body');setTimeout(()=>pulse('#tab-body button[onclick*="add-body-modal"]'),150)}if(id==='profile_demo'){switchTab('body');setTimeout(()=>pulse('#tab-body button[onclick*="profile-modal"]'),150)}if(id==='profile_targets'){switchTab('nutrition');setTimeout(()=>pulse('#tab-nutrition button[onclick*="target"]'),150)}}


    function addMilestoneMessage(id,titleKey,bodyKey){
      ensureMessageArrayOnly();
      if(isMessageDeleted(id)||appState.messages.some(m=>m.id===id))return;
      appState.messages.push({id,type:'milestone',titleKey,bodyKey,title:'',body:'',status:'info',read:false,createdAt:new Date().toISOString()});
      saveStateToLocal();renderMessageBadge();
    }
    function checkWorkoutMilestones(date){
      const active=getActiveWorkoutPlan();if(!active)return;
      if(isWorkoutPlanCompleted(date,active.id))addMilestoneMessage('milestone_first_workout','milestone.first_workout.title','milestone.first_workout.body');
      if(getSmartWorkoutStreak(date)>=7)addMilestoneMessage('milestone_streak7','milestone.streak7.title','milestone.streak7.body');
    }

    function weekKey(dateStr){
      const d=new Date(dateStr+'T12:00:00'),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
      return d.toISOString().slice(0,10);
    }
    function maybeCreateWeeklyInsightMessage(dateStr,body){
      if(!body)return;ensureMessageArrayOnly();const wk=weekKey(dateStr),id=`weekly_${wk}`;
      if(isMessageDeleted(id)||appState.messages.some(m=>m.id===id))return;
      const snap=getWeekSnapshot(dateStr);
      if((snap.workouts+snap.hydrated+snap.mind)===0)return;
      let bodyKey='insight.none';
      if((snap.workouts+snap.hydrated+snap.mind)>=9)bodyKey='insight.good';
      else if(snap.hydrated<3)bodyKey='insight.hydration';
      else if(snap.mind<2)bodyKey='insight.mind';
      appState.messages.push({id,type:'insight',titleKey:'home.weekly_insight',bodyKey,title:'Insight settimanale',body:'',status:'info',read:false,createdAt:new Date().toISOString()});
      saveStateToLocal();renderMessageBadge();
    }

    function toggleMessageSelection(){messageSelectionMode=!messageSelectionMode;if(!messageSelectionMode)selectedMessageIds.clear();document.getElementById('message-delete-btn')?.classList.toggle('hidden',!messageSelectionMode);document.getElementById('message-select-btn').textContent=messageSelectionMode?'Fine':'Seleziona';renderMessages()}
    function toggleMessageSelect(id,on){if(on)selectedMessageIds.add(id);else selectedMessageIds.delete(id)}
    function deleteSelectedMessages(){ensureMessageArrayOnly();selectedMessageIds.forEach(id=>{if(!appState.deletedMessageIds.includes(id))appState.deletedMessageIds.push(id)});appState.messages=appState.messages.filter(m=>!selectedMessageIds.has(m.id));selectedMessageIds.clear();messageSelectionMode=false;saveStateToLocal();renderMessages();renderMessageBadge()}



    let activeHelpKey='home';
    const HELP_CONTENT={
      home:{titleKey:'help.home.title',items:[
        ['help.home.date','help.home.date.body','fa-calendar-day'],
        ['help.home.avatar','help.home.avatar.body','fa-person'],
        ['help.home.focus','help.home.focus.body','fa-bullseye'],
        ['help.home.coach','help.home.coach.body','fa-wand-magic-sparkles']
      ]},
      workout:{titleKey:'help.workout.title',items:[
        ['help.workout.plans','help.workout.plans.body','fa-clipboard-list'],['help.workout.history','help.workout.history.body','fa-database'],
        ['help.workout.active','help.workout.active.body','fa-calendar-check'],
        ['help.workout.import','help.workout.import.body','fa-share-nodes'],
        ['help.workout.complete','help.workout.complete.body','fa-circle-check']
      ]},
      meditation:{titleKey:'help.mind.title',items:[
        ['help.mind.breath','help.mind.breath.body','fa-wind'],
        ['help.mind.checkin','help.mind.checkin.body','fa-heart-pulse'],
        ['help.mind.history','help.mind.history.body','fa-clock-rotate-left'],
        ['help.mind.audio','help.mind.audio.body','fa-headphones']
      ]},
      nutrition:{titleKey:'help.nutrition.title',items:[
        ['help.nutrition.meals','help.nutrition.meals.body','fa-utensils'],
        ['help.nutrition.targets','help.nutrition.targets.body','fa-bullseye'],
        ['help.nutrition.database','help.nutrition.database.body','fa-database'],['help.nutrition.database_meals','help.nutrition.database_meals.body','fa-calendar-days'],['help.nutrition.charts','help.nutrition.charts.body','fa-chart-pie'],
        ['help.nutrition.ai_food','help.nutrition.ai_food.body','fa-wand-magic-sparkles'],
        ['help.nutrition.water','help.nutrition.water.body','fa-glass-water']
      ]},
      body:{titleKey:'help.body.title',items:[
        ['help.body.profile','help.body.profile.body','fa-id-card'],
        ['help.body.measure','help.body.measure.body','fa-ruler-combined'],
        ['help.body.avatar','help.body.avatar.body','fa-person'],
        ['help.body.photos','help.body.photos.body','fa-images']
      ]},
      analytics:{titleKey:'help.analytics.title',items:[
        ['help.analytics.filter','help.analytics.filter.body','fa-filter'],['help.analytics.strength','help.analytics.strength.body','fa-dumbbell'],
        ['help.analytics.health','help.analytics.health.body','fa-heart-pulse'],
        ['help.analytics.body','help.analytics.body.body','fa-chart-line'],
        ['help.analytics.nutrition','help.analytics.nutrition.body','fa-chart-column']
      ]},
      consult:{titleKey:'help.consult.title',items:[
        ['help.consult.snapshot','help.consult.snapshot.body','fa-camera-retro'],
        ['help.consult.goal','help.consult.goal.body','fa-bullseye'],
        ['help.consult.ai','help.consult.ai.body','fa-wand-magic-sparkles'],
        ['help.consult.workout','help.consult.workout.body','fa-dumbbell'],
        ['help.consult.food','help.consult.food.body','fa-apple-whole'],
        ['help.consult.history','help.consult.history.body','fa-clock-rotate-left']
      ]},
      settings:{titleKey:'help.settings.title',items:[
        ['help.settings.access','help.settings.access.body','fa-gear'],['help.settings.drive_creation','help.settings.drive_creation.body','fa-cloud-arrow-up'],
        ['help.settings.account','help.settings.account.body','fa-user'],
        ['help.settings.sync','help.settings.sync.body','fa-rotate'],
        ['help.settings.backup','help.settings.backup.body','fa-box-archive'],
        ['help.settings.language','help.settings.language.body','fa-language']
      ]}
    };
    function renderHelpTree(k='home'){
      activeHelpKey=k;
      const d=HELP_CONTENT[k]||HELP_CONTENT.home,b=document.getElementById('help-tree-content');if(!b)return;
      b.innerHTML=`
        <div class="text-sm font-black text-white">${tk(d.titleKey,d.titleKey)}</div>
        <div class="mt-3 space-y-4">
          ${d.items.map(([labelKey,bodyKey,icon])=>`
            <div class="rounded-2xl border border-slate-800 bg-slate-900/45 p-3">
              <div class="flex items-center gap-2">
                <span class="help-demo-btn"><i class="fa-solid ${icon} text-cyan-300"></i>${tk(labelKey,labelKey)}</span>
              </div>
              <div class="mt-2 text-[10px] leading-relaxed text-slate-400">${tk(bodyKey,bodyKey)}</div>
            </div>`).join('')}
        </div>`;
      document.querySelectorAll('.help-tree-tab').forEach(x=>x.classList.toggle('active',x.getAttribute('onclick')?.includes(`'${k}'`)));
    }


    function currentLocalDateStr(){
      const now=new Date();
      const y=now.getFullYear();
      const m=String(now.getMonth()+1).padStart(2,'0');
      const d=String(now.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    }

    function resetAppDatesToToday(render=true){
      const today=currentLocalDateStr();
      homeSelectedDate=today;
      analyticsSelectedDate=today;

      const ids=['workout-date','home-date-picker','nutrition-date','body-date','wellness-date','analytics-date-picker'];
      ids.forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.value=today;
      });

      updateDateLabels();
      const analyticsLabel=document.getElementById('analytics-date-label');
      if(analyticsLabel)analyticsLabel.textContent=weekdayLabel(today);

      sessionStorage.setItem('thalys_active_calendar_day',today);

      if(render){
        renderHomeDashboard();
        renderWorkouts();
        renderWorkoutPlans();
        renderNutrition();
        renderBodyMetrics();
        renderWellnessSummary();
        updateAnalyticsCharts();
      }
      return today;
    }

    // Initialize Date Controls & Views
    document.addEventListener('DOMContentLoaded', () => {
      const todayStr = currentLocalDateStr();
      document.getElementById('workout-date').value = todayStr;
      homeSelectedDate = todayStr;
      document.getElementById('home-date-picker')?.setAttribute('value', todayStr);
      document.getElementById('nutrition-date').value = todayStr;
      document.getElementById('body-date').value = todayStr;
      const wellnessDate = document.getElementById('wellness-date');
      if (wellnessDate) wellnessDate.value = todayStr;
      analyticsSelectedDate=todayStr;const ap=document.getElementById('analytics-date-picker');if(ap)ap.value=todayStr;const al=document.getElementById('analytics-date-label');if(al)al.textContent=weekdayLabel(todayStr);

      const planContainer = document.getElementById('plan-exercises-container');
      if (planContainer && planContainer.children.length === 0) {
        addPlanExerciseRow();
      }

      loadProfileUI();
      loadTargetsUI();
      renderAllViews();
      updateDateLabels();
      updateManualSyncUI();
      ensureProfileMessages();renderMessageBadge();renderHelpTree('home');updateOptionsFocusToggle();initAppLanguage();
      resetAppDatesToToday(false);
    });

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState!=='visible')return;
      const today=currentLocalDateStr();
      const active=sessionStorage.getItem('thalys_active_calendar_day');
      if(active && active!==today) resetAppDatesToToday(true);
    });


    /* ==========================================================
       CONSULT / AI
       ========================================================== */
    let consultSnapshotSelectionMode=false, aiConsultSelectionMode=false;
    const selectedConsultSnapshotIds=new Set(), selectedAIConsultIds=new Set();
    let lastAIWorkoutProposal=null;

    function dateRangeForConsult(){
      const mode=document.getElementById('consult-period')?.value||'30';
      const today=currentLocalDateStr();
      let to=today,from=today;
      if(mode==='custom'){
        from=document.getElementById('consult-date-from')?.value||today;
        to=document.getElementById('consult-date-to')?.value||today;
        if(from>to)[from,to]=[to,from];
      }else{
        const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-(Number(mode)-1));from=d.toISOString().slice(0,10);
      }
      return {from,to,label:mode};
    }
    function inDateRange(date,from,to){return !!date&&date>=from&&date<=to;}
    function consultGoal(){
      const select=document.getElementById('consult-goal'),v=select?.value||'wellness';
      if(v==='custom')return document.getElementById('consult-goal-custom')?.value.trim()||tr('Obiettivo personalizzato');
      return select?.options?.[select.selectedIndex]?.textContent||v;
    }
    function setConsultSnapshotType(value){
      const input=document.getElementById('consult-snapshot-type');if(input)input.value=value;
      document.querySelectorAll('[data-consult-snapshot]').forEach(b=>b.classList.toggle('active',b.dataset.consultSnapshot===value));
      updateConsultUI();
    }
    function setConsultAIType(value){
      const input=document.getElementById('consult-ai-type');if(input)input.value=value;
      document.querySelectorAll('[data-consult-ai]').forEach(b=>b.classList.toggle('active',b.dataset.consultAi===value));
      updateConsultAIUI();
    }
    function setConsultFilterType(value){
      const input=document.getElementById('consult-filter-type');if(input)input.value=value;
      document.querySelectorAll('[data-consult-filter]').forEach(b=>b.classList.toggle('active',b.dataset.consultFilter===value));
      renderConsultationsStable();
    }
    function renderConsultationsStable(){
      const main=document.querySelector('main');
      const top=main?.scrollTop||0;
      renderConsultations();
      requestAnimationFrame(()=>{if(main)main.scrollTop=top;});
    }
    function updateConsultPeriodUI(){
      const custom=document.getElementById('consult-period')?.value==='custom';
      document.getElementById('consult-custom-period')?.classList.toggle('hidden',!custom);
      if(custom){
        const to=document.getElementById('consult-date-to'),from=document.getElementById('consult-date-from'),today=currentLocalDateStr();
        if(to&&!to.value)to.value=today;if(from&&!from.value){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-29);from.value=d.toISOString().slice(0,10);}
      }
    }
    function updateConsultGoalUI(){document.getElementById('consult-goal-custom')?.classList.toggle('hidden',document.getElementById('consult-goal')?.value!=='custom');}
    function updateConsultUI(){updateConsultPeriodUI();updateConsultGoalUI();}

    function avg(arr,key){
      const vals=arr.map(x=>Number(x?.[key])).filter(Number.isFinite);
      return vals.length?Number((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)):null;
    }
    function summarizeNutrition(logs,water,dates){
      const byDay={};logs.forEach(x=>{(byDay[x.date] ||= []).push(x)});
      const tracked=Object.keys(byDay);
      const dayTotals=tracked.map(date=>{
        const xs=byDay[date];
        return {date,kcal:xs.reduce((s,x)=>s+Number(x.kcal||0),0),p:xs.reduce((s,x)=>s+Number(x.p||0),0),c:xs.reduce((s,x)=>s+Number(x.c||0),0),f:xs.reduce((s,x)=>s+Number(x.f||0),0),satFat:xs.reduce((s,x)=>s+Number(x.satFat||0),0),sugars:xs.reduce((s,x)=>s+Number(x.sugars||0),0),fiber:xs.reduce((s,x)=>s+Number(x.fiber||0),0),calcium:xs.reduce((s,x)=>s+Number(x.calcium||0),0),magnesium:xs.reduce((s,x)=>s+Number(x.magnesium||0),0),zinc:xs.reduce((s,x)=>s+Number(x.zinc||0),0),iron:xs.reduce((s,x)=>s+Number(x.iron||0),0),potassium:xs.reduce((s,x)=>s+Number(x.potassium||0),0),salt:xs.reduce((s,x)=>s+Number(x.salt||0),0)};
      });
      return {
        trackedDays:tracked.length,
        averages:{kcal:avg(dayTotals,'kcal'),protein:avg(dayTotals,'p'),carbs:avg(dayTotals,'c'),fat:avg(dayTotals,'f'),satFat:avg(dayTotals,'satFat'),sugars:avg(dayTotals,'sugars'),fiber:avg(dayTotals,'fiber'),calcium:avg(dayTotals,'calcium'),magnesium:avg(dayTotals,'magnesium'),zinc:avg(dayTotals,'zinc'),iron:avg(dayTotals,'iron'),potassium:avg(dayTotals,'potassium'),salt:avg(dayTotals,'salt')},
        averageWaterMl:dates.length?Math.round(dates.reduce((s,d)=>s+Number(water[d]||0),0)/dates.length):0,
        dayTotals
      };
    }
    function summarizeWorkouts(from,to){
      const logs=(appState.workouts||[]).filter(x=>inDateRange(x.date,from,to));
      const active=getActiveWorkoutPlan(),completions=[];
      if(active){
        const d=new Date(from+'T12:00:00'),end=new Date(to+'T12:00:00');
        while(d<=end){
          const ds=d.toISOString().slice(0,10),ex=getExercisesForDate(active,ds);
          if(ex.length){
            const c=getWorkoutCompletion(ds,active.id),done=ex.filter(x=>c?.exercises?.[x.id]).length;
            completions.push({date:ds,scheduled:ex.length,completed:done,complete:done===ex.length});
          }
          d.setDate(d.getDate()+1);
        }
      }
      const exerciseVolume={};
      logs.forEach(w=>{
        const sets=Array.isArray(w.sets)?w.sets:[];
        const vol=sets.reduce((s,set)=>s+Number(set.weight||0)*Number(set.reps||0),0);
        exerciseVolume[w.name]=(exerciseVolume[w.name]||0)+vol;
      });
      return {loggedSessions:logs.length,scheduledDays:completions.length,completedScheduledDays:completions.filter(x=>x.complete).length,completionRate:completions.length?Math.round(completions.filter(x=>x.complete).length/completions.length*100):null,exerciseVolume,completions};
    }
    function buildConsultSnapshot(type,from,to){
      const dates=[];for(let d=new Date(from+'T12:00:00'),e=new Date(to+'T12:00:00');d<=e;d.setDate(d.getDate()+1))dates.push(d.toISOString().slice(0,10));
      const body=(appState.bodyMetrics||[]).filter(x=>inDateRange(x.date,from,to));
      const nutrition=(appState.nutrition||[]).filter(x=>inDateRange(x.date,from,to));
      const wellness=(appState.wellness||[]).filter(x=>inDateRange(x.date,from,to));
      const meditation=(appState.meditation||[]).filter(x=>inDateRange(x.date,from,to));
      const includePhysical=['physical','full'].includes(type),includeNutrition=['nutrition','full'].includes(type),includeWorkout=['workout','full'].includes(type);
      const snapshot={schemaVersion:1,type,period:{from,to},createdAt:new Date().toISOString(),profile:{gender:appState.profile?.gender,age:appState.profile?.age,height:appState.profile?.height,lifestyle:appState.profile?.lifestyle}};
      if(includePhysical){
        const sorted=[...body].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        const first=sorted[0],last=sorted.at(-1);
        snapshot.physical={measurements:body,summary:{measurementCount:body.length,latest:last||null,weightChangeKg:first&&last&&Number(first.weight)&&Number(last.weight)?Number((Number(last.weight)-Number(first.weight)).toFixed(2)):null},wellness,wellnessAverages:{sleepHours:avg(wellness,'sleepHours'),stress:avg(wellness,'stress'),recovery:avg(wellness,'recovery'),mood:avg(wellness,'mood'),readiness:avg(wellness,'readiness')}};
      }
      if(includeNutrition)snapshot.nutrition={logs:nutrition,targets:{...(appState.targets||{})},waterTargetMl:appState.settings?.waterTargetMl||2500,summary:summarizeNutrition(nutrition,appState.water||{},dates)};
      if(includeWorkout)snapshot.workout={logs:(appState.workouts||[]).filter(x=>inDateRange(x.date,from,to)),summary:summarizeWorkouts(from,to),activePlan:getActiveWorkoutPlan()?JSON.parse(JSON.stringify(getActiveWorkoutPlan())):null};
      if(type==='full')snapshot.mind={sessions:meditation,totalMinutes:meditation.reduce((s,x)=>s+Number(x.minutes||0),0)};
      return snapshot;
    }
    function createConsultSnapshot(ev){
      ev?.preventDefault?.();ev?.stopPropagation?.();
      const type=document.getElementById('consult-snapshot-type')?.value||'full',range=dateRangeForConsult(),goal=consultGoal();
      if(!goal){showToast(tr('Inserisci un obiettivo'),'fa-circle-exclamation');return;}
      const record={id:'consult_'+Date.now(),date:currentLocalDateStr(),createdAt:new Date().toISOString(),type,goal,period:range,snapshot:buildConsultSnapshot(type,range.from,range.to)};
      appState.consultations=Array.isArray(appState.consultations)?appState.consultations:[];
      appState.consultations.unshift(record);saveStateToLocal();renderConsultations();refreshConsultSelectors();showToast(tr('Quadro salvato'),'fa-camera-retro');
    }
    function consultTypeLabel(type){return tr({physical:'Fisico',nutrition:'Alimentazione',workout:'Allenamenti',full:'Completo'}[type]||type)}
    function visibleConsultSnapshots(){
      const type=document.getElementById('consult-filter-type')?.value||'all',month=document.getElementById('consult-filter-month')?.value||'';
      return (appState.consultations||[]).filter(x=>(type==='all'||x.type===type)&&(!month||String(x.date||x.createdAt).slice(0,7)===month));
    }
    function renderConsultations(){
      const list=document.getElementById('consult-snapshot-list');if(!list)return;
      const rows=visibleConsultSnapshots();
      list.innerHTML=rows.length?rows.map(x=>`
        <div class="rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
          <div class="flex items-start gap-2">
            ${consultSnapshotSelectionMode?`<input type="checkbox" class="mt-1 h-4 w-4 accent-cyan-500" ${selectedConsultSnapshotIds.has(x.id)?'checked':''} onchange="toggleConsultSnapshot('${x.id}',this.checked)">`:''}
            <button onclick="openConsultSnapshot('${x.id}')" class="min-w-0 flex-1 text-left">
              <div class="flex items-center justify-between gap-2"><span class="text-xs font-black text-white">${consultTypeLabel(x.type)}</span><span class="text-[9px] text-cyan-300">${formatConsultDate(x.date)}</span></div>
              <div class="mt-1 text-[9px] text-slate-400">${escapeHTML(x.goal||'')} · ${x.period?.from||''} → ${x.period?.to||''}</div>
            </button>
            <button onclick="deleteConsultSnapshot('${x.id}')" class="w-8 h-8 rounded-lg bg-slate-950 text-rose-300"><i class="fa-solid fa-trash text-[10px]"></i></button>
          </div>
        </div>`).join(''):`<div class="rounded-xl bg-slate-900/50 p-4 text-center text-[10px] text-slate-500">${tr('Nessun quadro salvato.')}</div>`;
    }
    function formatConsultDate(d){try{return new Date((d||currentLocalDateStr())+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'short',year:'numeric'})}catch(_){return d||''}}
    function consultExportSafeName(record,ext){
      const type=(record?.type||'consulto').replace(/[^a-z0-9_-]/gi,'_');
      const date=record?.date||currentLocalDateStr();
      return `Thalys_${type}_${date}.${ext}`;
    }
    function consultSnapshotText(record){
      if(!record)return '';
      const header=[
        'THALYS · CONSULTO',
        '================',
        `${tr('Tipo')}: ${consultTypeLabel(record.type)}`,
        `${tr('Data')}: ${formatConsultDate(record.date)}`,
        `${tr('Periodo')}: ${record.period?.from||'—'} → ${record.period?.to||'—'}`,
        `${tr('Obiettivo')}: ${record.goal||'—'}`,
        '',
        `${tr('Quadro generale')}`,
        '----------------',
        JSON.stringify(record.snapshot||{},null,2)
      ];
      return header.join('\n');
    }
    function downloadTextFile(filename,content){
      const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }
    function exportConsultSnapshotTXT(id){
      const record=(appState.consultations||[]).find(x=>x.id===id);if(!record)return;
      downloadTextFile(consultExportSafeName(record,'txt'),consultSnapshotText(record));
      showToast(tr('Consulto esportato in formato testo'),'fa-file-lines');
    }
    function thalysPdfLogoMarkup(){
      return `<div style="display:flex;align-items:center;gap:12px">
        <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
          <defs><linearGradient id="pdfLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
          <circle cx="32" cy="32" r="27" fill="none" stroke="#67e8f9" stroke-opacity=".65" stroke-width="2"/>
          <path d="M16 18h31v7c-4-3-8-4-12-4h-1v23c0 4 1 7 4 9H24c3-2 4-5 4-9V21h-1c-4 0-8 1-11 4v-7z" fill="#f8fafc"/>
          <path d="M27 50c5-13 14-21 27-24-2 12-9 21-21 27 4-5 8-10 10-15-5 4-10 8-16 12z" fill="url(#pdfLeaf)"/>
        </svg>
        <div><div style="font-size:25px;font-weight:900;letter-spacing:.04em;color:#ecfeff">THALYS</div><div style="font-size:9px;letter-spacing:.24em;color:#67e8f9">WELLNESS · CONSULTO</div></div>
      </div>`;
    }
    function consultPdfSection(title,value){
      const content=escapeHTML(typeof value==='string'?value:JSON.stringify(value,null,2));
      return `<section style="margin-top:14px;padding:14px;border:1px solid #1e293b;border-radius:14px;background:#0f172a;page-break-inside:avoid">
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#67e8f9;text-transform:uppercase">${escapeHTML(title)}</div>
        <pre style="margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font:10px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#cbd5e1">${content}</pre>
      </section>`;
    }
    async function exportConsultSnapshotPDF(id){
      const record=(appState.consultations||[]).find(x=>x.id===id);if(!record)return;
      if(!window.html2pdf){
        showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');
        return;
      }
      const root=document.createElement('div');
      root.style.cssText='position:fixed;left:-10000px;top:0;width:794px;padding:42px;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;z-index:-1';
      const sections=Object.entries(record.snapshot||{}).map(([k,v])=>consultPdfSection(tr(k),v)).join('');
      root.innerHTML=`<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
        <div style="margin-top:22px">
          <div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(consultTypeLabel(record.type))}</div>
          <div style="margin-top:5px;font-size:22px;font-weight:900;color:#ffffff">${escapeHTML(tr('Quadro generale'))}</div>
          <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))} · ${escapeHTML(record.period?.from||'—')} → ${escapeHTML(record.period?.to||'—')}</div>
          <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div>
        </div>
        ${sections}
        <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal quadro salvato'))}</div>`;
      document.body.appendChild(root);
      try{
        await html2pdf().set({
          margin:[8,8,10,8],
          filename:consultExportSafeName(record,'pdf'),
          image:{type:'jpeg',quality:.96},
          html2canvas:{scale:2,useCORS:true,backgroundColor:'#090d16'},
          jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
          pagebreak:{mode:['css','legacy']}
        }).from(root).save();
        showToast(tr('Consulto esportato in PDF'),'fa-file-pdf');
      }catch(e){
        console.error('Consult PDF',e);
        showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');
      }finally{root.remove();}
    }
    function aiConsultText(record){
      if(!record)return '';
      return [
        'THALYS · RISPOSTA IA',
        '====================',
        `${tr('Tipo')}: ${tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type)}`,
        `${tr('Data')}: ${formatConsultDate(record.date)}`,
        `${tr('Obiettivo')}: ${record.goal||'—'}`,
        `${tr('Richiesta specifica')}: ${record.specificRequest||'—'}`,
        '',
        `${tr('Risposta IA')}`,
        '-----------',
        JSON.stringify(record.response||{},null,2),
        record.generatedWorkoutPlan?`\n${tr('Scheda generata')}\n---------------\n${JSON.stringify(record.generatedWorkoutPlan,null,2)}`:''
      ].join('\n');
    }
    function exportAIConsultTXT(id){
      const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
      downloadTextFile(`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.txt`,aiConsultText(record));
      showToast(tr('Risposta IA esportata in formato testo'),'fa-file-lines');
    }
    async function exportAIConsultPDF(id){
      const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
      if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
      const root=document.createElement('div');
      root.style.cssText='position:fixed;left:-10000px;top:0;width:794px;padding:42px;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;z-index:-1';
      root.innerHTML=`<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
        <div style="margin-top:22px">
          <div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(tr('Risposta IA'))}</div>
          <div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">${escapeHTML(tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type))}</div>
          <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))}</div>
          <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div>
        </div>
        ${consultPdfSection(tr('Risposta IA'),record.response||{})}
        ${record.generatedWorkoutPlan?consultPdfSection(tr('Scheda generata'),record.generatedWorkoutPlan):''}
        <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal consulto IA salvato'))}</div>`;
      document.body.appendChild(root);
      try{
        await html2pdf().set({margin:[8,8,10,8],filename:`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.pdf`,image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:'#090d16'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(root).save();
        showToast(tr('Risposta IA esportata in PDF'),'fa-file-pdf');
      }catch(e){console.error('AI consult PDF',e);showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');}
      finally{root.remove();}
    }

    function openConsultSnapshot(id){
      const x=(appState.consultations||[]).find(r=>r.id===id);if(!x)return;
      const title=document.getElementById('consult-detail-title');
      const meta=document.getElementById('consult-detail-meta');
      const body=document.getElementById('consult-detail-body');
      if(title)title.textContent=`${tr('Quadro generale')} · ${consultTypeLabel(x.type)}`;
      if(meta)meta.textContent=`${formatConsultDate(x.date)} · ${x.period?.from||'—'} → ${x.period?.to||'—'} · ${x.goal||''}`;
      if(body){
        const sections=Object.entries(x.snapshot||{});
        body.innerHTML=sections.length?sections.map(([key,value])=>`
          <div class="mb-2 rounded-xl border border-slate-800 bg-slate-900/65 p-3">
            <div class="text-[9px] font-black uppercase tracking-[.13em] text-cyan-300">${tr(key)}</div>
            <pre class="mt-2 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-300">${escapeHTML(JSON.stringify(value,null,2))}</pre>
          </div>`).join(''):`<div class="text-slate-500">${tr('Nessun dato disponibile')}</div>`;
      }
      const pdf=document.getElementById('consult-export-pdf-btn'),txt=document.getElementById('consult-export-txt-btn');
      if(pdf)pdf.onclick=()=>exportConsultSnapshotPDF(id);
      if(txt)txt.onclick=()=>exportConsultSnapshotTXT(id);
      const aiSelect=document.getElementById('consult-ai-snapshot');
      if(aiSelect&&[...aiSelect.options].some(o=>o.value===id))aiSelect.value=id;
      openModal('consult-snapshot-modal');
    }

    function deleteConsultSnapshot(id){appState.consultations=(appState.consultations||[]).filter(x=>x.id!==id);saveStateToLocal();renderConsultations();refreshConsultSelectors();}
    function toggleConsultSnapshotSelection(){consultSnapshotSelectionMode=!consultSnapshotSelectionMode;selectedConsultSnapshotIds.clear();document.getElementById('consult-snapshot-delete-btn')?.classList.toggle('hidden',!consultSnapshotSelectionMode);renderConsultations();}
    function toggleConsultSnapshot(id,on){on?selectedConsultSnapshotIds.add(id):selectedConsultSnapshotIds.delete(id)}
    function deleteSelectedConsultSnapshots(){appState.consultations=(appState.consultations||[]).filter(x=>!selectedConsultSnapshotIds.has(x.id));selectedConsultSnapshotIds.clear();consultSnapshotSelectionMode=false;saveStateToLocal();document.getElementById('consult-snapshot-delete-btn')?.classList.add('hidden');renderConsultations();refreshConsultSelectors();}
    function clearConsultFilters(){const t=document.getElementById('consult-filter-type'),m=document.getElementById('consult-filter-month');if(t)t.value='all';if(m)m.value='';document.querySelectorAll('[data-consult-filter]').forEach(b=>b.classList.toggle('active',b.dataset.consultFilter==='all'));renderConsultationsStable();}

    function refreshConsultSelectors(){
      const snap=document.getElementById('consult-ai-snapshot'),plan=document.getElementById('consult-ai-plan');if(snap){
        const old=snap.value;snap.innerHTML=(appState.consultations||[]).map(x=>`<option value="${x.id}">${consultTypeLabel(x.type)} · ${formatConsultDate(x.date)} · ${escapeHTML(x.goal||'')}</option>`).join('');
        if([...snap.options].some(o=>o.value===old))snap.value=old;
      }
      if(plan){
        const old=plan.value;plan.innerHTML=(appState.workoutPlans||[]).map(x=>`<option value="${x.id}">${escapeHTML(x.name)}</option>`).join('');
        if([...plan.options].some(o=>o.value===old))plan.value=old;
      }
      updateConsultAIUI();
    }
    function updateConsultAIUI(){
      const type=document.getElementById('consult-ai-type')?.value||'nutrition';
      document.getElementById('consult-ai-snapshot-wrap')?.classList.toggle('hidden',type==='food');
      document.getElementById('consult-ai-plan-wrap')?.classList.toggle('hidden',type!=='workout');
      document.getElementById('consult-ai-food-wrap')?.classList.toggle('hidden',type!=='food');
      const snap=document.getElementById('consult-ai-snapshot');
      if(snap&&type!=='food'){
        const previous=snap.value;
        const allowed=type==='nutrition'?['nutrition','full']:type==='workout'?['workout','physical','full']:['full'];
        const rows=(appState.consultations||[]).filter(x=>allowed.includes(x.type));
        snap.innerHTML=rows.map(x=>`<option value="${x.id}">${consultTypeLabel(x.type)} · ${formatConsultDate(x.date)} · ${escapeHTML(x.goal||'')}</option>`).join('');
        if([...snap.options].some(o=>o.value===previous))snap.value=previous;
      }
    }
    async function callThalysAI(payload){
      // Usa prima il token OAuth già usato da Thalys per Google Drive.
      // Il Google ID token resta solo come fallback.
      const accessToken=(typeof getAccessToken==='function' ? getAccessToken() : '')||'';
      const idToken=localStorage.getItem('google_id_token')||sessionStorage.getItem('google_id_token')||'';
      if(!accessToken&&!idToken)throw new Error('AUTH_REQUIRED');

      const headers={'Content-Type':'application/json'};
      if(accessToken)headers['X-Google-Access-Token']=accessToken;
      else headers['X-Google-ID-Token']=idToken;

      const r=await fetch('/api/ai',{method:'POST',headers,body:JSON.stringify(payload)});
      let data=null;try{data=await r.json()}catch(_){}
      if(!r.ok||!data?.ok){
        if(r.status===401)throw new Error('AUTH_EXPIRED');
        throw new Error(data?.error||`AI_HTTP_${r.status}`);
      }
      return data;
    }
    function ensureAIConsent(){
      const k='thalys_ai_data_consent_v1';if(localStorage.getItem(k)==='1')return true;
      const ok=confirm(tr('Per questo consulto i dati dello snapshot selezionato verranno inviati al provider IA tramite il server Vercel. Vuoi continuare?'));
      if(ok)localStorage.setItem(k,'1');return ok;
    }
    function aiResultHTML(data){
      const d=data?.data||{},text=data?.text||'';
      if(text)return `<div class="whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300">${escapeHTML(text)}</div>`;
      const blocks=[];
      const push=(title,value)=>{
        if(value==null||value===''||(Array.isArray(value)&&!value.length))return;
        const body=Array.isArray(value)?value.map(v=>`<li>${escapeHTML(typeof v==='string'?v:JSON.stringify(v))}</li>`).join(''):`<div>${escapeHTML(typeof value==='string'?value:JSON.stringify(value,null,2))}</div>`;
        blocks.push(`<div class="rounded-xl bg-slate-900/65 p-3"><div class="text-[10px] font-black text-violet-200">${tr(title)}</div><div class="mt-1 text-[10px] leading-relaxed text-slate-300">${Array.isArray(value)?`<ul class="list-disc pl-4 space-y-1">${body}</ul>`:body}</div></div>`);
      };
      push('Situazione attuale',d.summary);push('Cosa va bene',d.positives);push('Cosa migliorare',d.priorities);push('Piano 7 giorni',d.sevenDayPlan);push('Note',d.notes||d.cautions);
      return blocks.join('')||`<pre class="whitespace-pre-wrap text-[9px] text-slate-300">${escapeHTML(JSON.stringify(d,null,2))}</pre>`;
    }
    async function runAIConsult(){
      if(!ensureAIConsent())return;
      const type=document.getElementById('consult-ai-type')?.value||'nutrition',specific=document.getElementById('consult-ai-specific')?.value.trim()||'';
      let snapshotRecord=null,plan=null,foodName='';
      if(type!=='food'){
        const id=document.getElementById('consult-ai-snapshot')?.value;snapshotRecord=(appState.consultations||[]).find(x=>x.id===id);
        if(!snapshotRecord){showToast(tr('Seleziona prima un quadro salvato'),'fa-circle-exclamation');return;}
      }
      if(type==='workout'){
        const planId=document.getElementById('consult-ai-plan')?.value;plan=(appState.workoutPlans||[]).find(x=>x.id===planId);
        if(!plan){showToast(tr('Seleziona una scheda allenamento'),'fa-circle-exclamation');return;}
      }
      if(type==='food'){foodName=document.getElementById('consult-ai-food-name')?.value.trim()||'';if(!foodName){showToast(tr('Inserisci il nome dell’alimento'),'fa-circle-exclamation');return;}}
      const loading=document.getElementById('consult-ai-loading'),result=document.getElementById('consult-ai-result'),btn=document.getElementById('consult-ai-run');
      loading?.classList.remove('hidden');result?.classList.add('hidden');if(btn)btn.disabled=true;
      try{
        const action=type==='nutrition'?'nutrition_consult':type==='workout'?'workout_consult':type==='full'?'full_consult':'food_lookup';
        const response=await callThalysAI({action,locale:currentLocale(),goal:snapshotRecord?.goal||consultGoal(),snapshot:snapshotRecord?.snapshot||null,workoutPlan:plan||null,foodName,specificRequest:specific});
        const record={id:'ai_'+Date.now(),date:currentLocalDateStr(),createdAt:new Date().toISOString(),type,snapshotId:snapshotRecord?.id||null,workoutPlanId:plan?.id||null,goal:snapshotRecord?.goal||null,specificRequest:specific,response:response.data||response.text,model:response.model||null};
        appState.aiConsults=Array.isArray(appState.aiConsults)?appState.aiConsults:[];appState.aiConsults.unshift(record);saveStateToLocal();renderAIConsultHistory();
        if(result){
          result.classList.remove('hidden');
          result.innerHTML=`<div class="flex items-center justify-between gap-2"><div class="text-xs font-black text-white">${tr('Risposta IA')}</div><span class="text-[8px] text-slate-500">${escapeHTML(response.model||'')}</span></div><div class="mt-3 space-y-2">${aiResultHTML(response)}</div>${type==='workout'?`<button onclick="generateAIWorkoutPlan('${record.id}')" class="mt-3 w-full min-h-10 rounded-xl bg-emerald-500 text-[10px] font-black text-slate-950"><i class="fa-solid fa-thumbs-up mr-1"></i>${tr('Mi piace · genera scheda')}</button>`:''}`;
        }
      }catch(e){
        console.error('AI consult',e);if(result){result.classList.remove('hidden');const msg=(e.message==='AUTH_REQUIRED'||e.message==='AUTH_EXPIRED')?tr('Riconnetti Google Drive e riprova.'):e.message;result.innerHTML=`<div class="text-[10px] text-rose-300">${tr('Consulto IA non riuscito')}: ${escapeHTML(msg)}</div>`}
      }finally{loading?.classList.add('hidden');if(btn)btn.disabled=false}
    }
    async function generateAIWorkoutPlan(aiRecordId){
      if(!ensureAIConsent())return;
      const rec=(appState.aiConsults||[]).find(x=>x.id===aiRecordId),snap=(appState.consultations||[]).find(x=>x.id===rec?.snapshotId),plan=(appState.workoutPlans||[]).find(x=>x.id===rec?.workoutPlanId);
      if(!rec||!snap||!plan)return;
      const result=document.getElementById('consult-ai-result');if(result)result.innerHTML=`<div class="p-4 text-center text-[10px] text-violet-300"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i>${tr('Generazione scheda in corso…')}</div>`;
      try{
        const response=await callThalysAI({action:'workout_plan',locale:currentLocale(),goal:snap.goal,snapshot:snap.snapshot,workoutPlan:plan,previousAdvice:rec.response});
        const proposal=normalizeAIWorkoutPlan(response.data?.workoutPlan||response.data);
        if(!proposal)throw new Error('INVALID_WORKOUT_PLAN');
        lastAIWorkoutProposal=proposal;
        rec.generatedWorkoutPlan=proposal;rec.updatedAt=new Date().toISOString();saveStateToLocal();renderAIConsultHistory();
        if(result){result.innerHTML=`<div class="text-xs font-black text-white">${tr('Scheda proposta')}</div><div class="mt-2 text-[9px] text-slate-400">${escapeHTML(proposal.name)} · ${proposal.exercises.length} ${tr('esercizi')}</div><pre class="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[9px] text-slate-300">${escapeHTML(JSON.stringify(proposal,null,2))}</pre><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="downloadAIWorkoutPlan()" class="min-h-10 rounded-xl bg-slate-800 text-[10px] font-bold text-cyan-300"><i class="fa-solid fa-download mr-1"></i>${tr('Scarica JSON')}</button><button onclick="importAIWorkoutPlan()" class="min-h-10 rounded-xl bg-emerald-500 text-[10px] font-black text-slate-950"><i class="fa-solid fa-file-import mr-1"></i>${tr('Importa in Schede')}</button></div><div class="mt-2 text-[9px] text-slate-500">${tr('La scheda non viene resa attiva automaticamente.')}</div>`}
      }catch(e){if(result)result.innerHTML=`<div class="text-[10px] text-rose-300">${tr('Generazione scheda non riuscita')}: ${escapeHTML(e.message)}</div>`}
    }
    function normalizeAIWorkoutPlan(p){
      if(!p||!p.name||!Array.isArray(p.exercises)||!p.exercises.length)return null;
      const days=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
      return {id:'plan_'+Date.now(),name:String(p.name).slice(0,80),restDays:Array.isArray(p.restDays)?p.restDays.filter(d=>days.includes(d)):[],exercises:p.exercises.map((x,i)=>({id:'plan_ex_'+Date.now()+'_'+i,name:String(x.name||'Esercizio').slice(0,80),dayOfWeek:days.includes(x.dayOfWeek)?x.dayOfWeek:'Lunedì',category:String(x.category||'Altro'),series:Math.max(1,Math.round(Number(x.series)||3)),rpe:Math.min(10,Math.max(1,Number(x.rpe)||8)),weight:Math.max(0,Number(x.weight)||0),reps:Math.max(1,Math.round(Number(x.reps)||8)),recovery:Math.max(15,Math.round(Number(x.recovery)||90))})),updatedAt:new Date().toISOString(),source:'Thalys AI'};
    }
    function downloadAIWorkoutPlan(){if(!lastAIWorkoutProposal)return;const b=new Blob([JSON.stringify(lastAIWorkoutProposal,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=(lastAIWorkoutProposal.name||'thalys_ai').toLowerCase().replace(/[^a-z0-9]+/gi,'_')+'_schema.json';a.click();URL.revokeObjectURL(u);}
    function importAIWorkoutPlan(){if(!lastAIWorkoutProposal)return;const p=normalizeAIWorkoutPlan(lastAIWorkoutProposal);if(!p)return;appState.workoutPlans.push(p);saveStateToLocal();renderWorkoutPlans();refreshConsultSelectors();showToast(tr('Scheda IA importata'),'fa-file-import');}

    function visibleAIConsults(){
      const type=document.getElementById('ai-history-filter-type')?.value||'all',month=document.getElementById('ai-history-filter-month')?.value||'';
      return (appState.aiConsults||[]).filter(x=>(type==='all'||x.type===type)&&(!month||String(x.date||x.createdAt).slice(0,7)===month));
    }
    function renderAIConsultHistory(){
      const list=document.getElementById('ai-history-list');if(!list)return;const rows=visibleAIConsults();
      list.innerHTML=rows.length?rows.map(x=>`<div class="rounded-2xl border border-slate-800 bg-slate-900/55 p-3"><div class="flex items-start gap-2">${aiConsultSelectionMode?`<input type="checkbox" class="mt-1 h-4 w-4 accent-violet-500" ${selectedAIConsultIds.has(x.id)?'checked':''} onchange="toggleAIConsultSelect('${x.id}',this.checked)">`:''}<button onclick="openAIConsultHistory('${x.id}')" class="min-w-0 flex-1 text-left"><div class="flex items-center justify-between gap-2"><span class="text-xs font-black text-white">${tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[x.type]||x.type)}</span><span class="text-[9px] text-violet-300">${formatConsultDate(x.date)}</span></div><div class="mt-1 line-clamp-2 text-[9px] text-slate-400">${escapeHTML(x.goal||x.specificRequest||'')}</div></button><button onclick="deleteAIConsult('${x.id}')" class="w-8 h-8 rounded-lg bg-slate-950 text-rose-300"><i class="fa-solid fa-trash text-[10px]"></i></button></div></div>`).join(''):`<div class="rounded-xl bg-slate-900/50 p-4 text-center text-[10px] text-slate-500">${tr('Nessuna risposta IA salvata.')}</div>`;
    }
    function openAIConsultHistory(id){
      const x=(appState.aiConsults||[]).find(r=>r.id===id);if(!x)return;
      const title=document.getElementById('consult-detail-title'),meta=document.getElementById('consult-detail-meta'),body=document.getElementById('consult-detail-body');
      if(title)title.textContent=`${tr('Risposta IA')} · ${tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[x.type]||x.type)}`;
      if(meta)meta.textContent=`${formatConsultDate(x.date)} · ${x.goal||x.specificRequest||''}`;
      if(body){
        body.innerHTML=`<div class="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">${aiResultHTML({data:x.response||{}})}</div>
          ${x.generatedWorkoutPlan?`<div class="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3"><div class="text-[9px] font-black uppercase tracking-[.13em] text-emerald-300">${tr('Scheda generata')}</div><button type="button" onclick="closeModal('consult-snapshot-modal');loadStoredAIWorkoutPlan('${x.id}')" class="mt-2 w-full min-h-10 rounded-xl bg-emerald-500 text-[10px] font-black text-slate-950">${tr('Apri scheda generata')}</button></div>`:''}`;
      }
      const pdf=document.getElementById('consult-export-pdf-btn'),txt=document.getElementById('consult-export-txt-btn');
      if(pdf)pdf.onclick=()=>exportAIConsultPDF(id);
      if(txt)txt.onclick=()=>exportAIConsultTXT(id);
      openModal('consult-snapshot-modal');
    }
    function loadStoredAIWorkoutPlan(id){const x=(appState.aiConsults||[]).find(r=>r.id===id);if(!x?.generatedWorkoutPlan)return;lastAIWorkoutProposal=x.generatedWorkoutPlan;const box=document.getElementById('consult-ai-result');if(box)box.innerHTML=`<div class="text-xs font-black text-white">${tr('Scheda proposta')}</div><pre class="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[9px] text-slate-300">${escapeHTML(JSON.stringify(lastAIWorkoutProposal,null,2))}</pre><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="downloadAIWorkoutPlan()" class="min-h-10 rounded-xl bg-slate-800 text-[10px] font-bold text-cyan-300">${tr('Scarica JSON')}</button><button onclick="importAIWorkoutPlan()" class="min-h-10 rounded-xl bg-emerald-500 text-[10px] font-black text-slate-950">${tr('Importa in Schede')}</button></div>`}
    function deleteAIConsult(id){appState.aiConsults=(appState.aiConsults||[]).filter(x=>x.id!==id);saveStateToLocal();renderAIConsultHistory();}
    function toggleAIConsultSelection(){aiConsultSelectionMode=!aiConsultSelectionMode;selectedAIConsultIds.clear();document.getElementById('ai-history-delete-btn')?.classList.toggle('hidden',!aiConsultSelectionMode);renderAIConsultHistory();}
    function toggleAIConsultSelect(id,on){on?selectedAIConsultIds.add(id):selectedAIConsultIds.delete(id)}
    function deleteSelectedAIConsults(){appState.aiConsults=(appState.aiConsults||[]).filter(x=>!selectedAIConsultIds.has(x.id));selectedAIConsultIds.clear();aiConsultSelectionMode=false;saveStateToLocal();document.getElementById('ai-history-delete-btn')?.classList.add('hidden');renderAIConsultHistory();}
    function clearAIHistoryFilters(){const t=document.getElementById('ai-history-filter-type'),m=document.getElementById('ai-history-filter-month');if(t)t.value='all';if(m)m.value='';renderAIConsultHistory();}

    async function aiFillFoodPreset(){
      if(!ensureAIConsent())return;
      const name=document.getElementById('preset-name')?.value.trim()||'',status=document.getElementById('preset-ai-status'),btn=document.getElementById('preset-ai-fill-btn');
      if(!name){showToast(tr('Inserisci il nome dell’alimento'),'fa-circle-exclamation');return;}
      if(btn)btn.disabled=true;if(status){status.classList.remove('hidden');status.innerHTML=`<i class="fa-solid fa-circle-notch fa-spin mr-1"></i>${tr('Ricerca valori nutrizionali…')}`}
      try{
        const response=await callThalysAI({action:'food_lookup',locale:currentLocale(),foodName:name});
        fillFoodPresetFromAI(response.data||{});
        if(status)status.innerHTML=`<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>${tr('Valori proposti dall’IA. Controlla o modifica i campi prima di salvare.')} ${response.data?.source?`<span class="text-slate-400">· ${escapeHTML(response.data.source)}</span>`:''}`;
      }catch(e){if(status){const msg=(e.message==='AUTH_REQUIRED'||e.message==='AUTH_EXPIRED')?tr('Riconnetti Google Drive e riprova.'):e.message;status.textContent=`${tr('Ricerca IA non riuscita')}: ${msg}`}}
      finally{if(btn)btn.disabled=false}
    }
    function fillFoodPresetFromAI(d){
      const map={kcal:'preset-kcal',p:'preset-p',c:'preset-c',f:'preset-f',satFat:'preset-sat-fat',sugars:'preset-sugars',calcium:'preset-calcium',magnesium:'preset-magnesium',zinc:'preset-zinc',fiber:'preset-fiber',salt:'preset-salt',iron:'preset-iron',potassium:'preset-potassium',vitaminsId:'preset-vitamins-id',vitaminsLip:'preset-vitamins-lip'};
      Object.entries(map).forEach(([k,id])=>{const el=document.getElementById(id),v=d[k];if(el&&v!==null&&v!==undefined&&v!=='')el.value=Array.isArray(v)?v.join(' '):v;});
    }

    function renderAllViews() {
      renderWorkouts();
      renderWorkoutPlans();
      renderNutrition();
      renderBodyMetrics();
      renderPhotos();
      renderPresets();
      renderWellnessSummary();
      renderMeditationStats();
      renderMeditationPage();
      renderHomeDashboard();
      updateAnalyticsCharts();
      renderConsultations();
      renderAIConsultHistory();
      refreshConsultSelectors();
    }

    // UI Tab Navigation Switcher
    function switchTab(tabName) {
      const tabs = ['home', 'workout', 'meditation', 'nutrition', 'body', 'analytics', 'consult', 'settings'];
      tabs.forEach(t => {
        const section = document.getElementById(`tab-${t}`);
        const navBtn = document.getElementById(`nav-${t}`);
        if (!section) return;
        if (t === tabName) {
          section.classList.remove('hidden');
          if(navBtn){navBtn.classList.remove('text-slate-400');navBtn.classList.add('text-cyan-400');}
        } else {
          section.classList.add('hidden');
          if(navBtn){navBtn.classList.remove('text-cyan-400');navBtn.classList.add('text-slate-400');}
        }
      });
      if (tabName === 'home') { renderTodayDashboard(); renderHomeAvatar(); }
      if (tabName === 'meditation') { renderMeditationStats(); renderMeditationPage(); }
      if (tabName === 'body') { renderBodyMetrics(); setTimeout(()=>{aggiornaAvatarDaUltimaMisura();renderHomeAvatar();},50); }
      if (tabName === 'analytics') { updateAnalyticsCharts(); }
      if (tabName === 'consult') {
        try{document.activeElement?.blur?.();}catch(_){}
        const main=document.querySelector('#app-shell > main');
        if(main)main.scrollTop=0;
        window.scrollTo(0,0);
        renderConsultations();renderAIConsultHistory();refreshConsultSelectors();
        const resetTop=()=>{if(main){main.scrollTop=0;main.scrollTo?.({top:0,left:0,behavior:'auto'});}window.scrollTo(0,0);};
        requestAnimationFrame(resetTop);setTimeout(resetTop,80);setTimeout(resetTop,220);
      }
      if (tabName === 'settings') {
        const main=document.querySelector('#app-shell > main');if(main)main.scrollTop=0;
        requestAnimationFrame(()=>{if(main)main.scrollTop=0;window.scrollTo(0,0);});
      }
    }

    function updateModalScrollLock() {
      const activeModal = document.querySelector('.fixed.inset-0.z-50:not(.hidden), #offline-setup-modal:not(.hidden), #network-restored-modal:not(.hidden)');
      const isOpen = !!activeModal;
      document.body.classList.toggle('modal-open', isOpen);
      document.documentElement.classList.toggle('modal-open', isOpen);
      if (isOpen) {
        const currentScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.top = `-${currentScrollY}px`;
      } else {
        const savedTop = parseInt(document.body.style.top || '0', 10) || 0;
        document.body.style.top = '';
        window.scrollTo(0, Math.abs(savedTop));
      }
    }

    // Modal Display Logic
    function openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('hidden');
      if(modalId==='cloud-modal'){
        try{
          const p=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
          if(typeof updateAuthUI==='function')updateAuthUI(p);
        }catch(_){
          if(typeof updateAuthUI==='function')updateAuthUI(null);
        }
      }
      updateModalScrollLock();
    }
    function closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('hidden');
      }
      updateModalScrollLock();
    }

    // Toast Notification System
    function showToast(msg, icon = 'fa-info-circle') {
      const toast = document.getElementById('toast');
      document.getElementById('toast-msg').textContent = msg;
      document.getElementById('toast-icon').className = `fa-solid ${icon}`;
      toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
      setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-10px]');
      }, 2500);
    }

    // ----------------------------------------------------
    // Workout and rest timer logic moved to js/workout.js in v0.30.

    // Nutrition logic moved to js/nutrition.js in v0.29.










    function saveWellnessEntry(e) {
      e.preventDefault();
      const wellnessDateInput = document.getElementById('wellness-date');
      const date = (wellnessDateInput && wellnessDateInput.value) ? wellnessDateInput.value : new Date().toISOString().split('T')[0];
      const entry = {
        id: 'wellness_' + Date.now(),
        date,
        sleepHours: parseFloat(document.getElementById('wellness-sleep').value) || 7,
        stress: parseInt(document.getElementById('wellness-stress').value) || 4,
        recovery: parseInt(document.getElementById('wellness-recovery').value) || 7,
        mood: parseInt(document.getElementById('wellness-mood').value) || 7,
        readiness: parseInt(document.getElementById('wellness-readiness').value) || 7,
        notes: document.getElementById('wellness-notes').value.trim(),
        meditationMinutes: parseInt(document.getElementById('wellness-meditation-min')?.value || '0') || 0,
        meditationQuality: parseInt(document.getElementById('wellness-meditation-quality')?.value || '7') || 7,
        meditationType: document.getElementById('wellness-meditation-type')?.value || 'Mindfulness', updatedAt:new Date().toISOString()
      };

      appState.wellness = Array.isArray(appState.wellness) ? appState.wellness.filter(item => item.date !== date) : [];
      appState.wellness.push(entry);
      appState.wellness.sort((a, b) => new Date(a.date) - new Date(b.date));
      window.appState = appState;
      saveStateToLocal();
      
      renderWellnessSummary();
      updateWellnessTrendChart();
      if (wellnessDateInput) wellnessDateInput.value = date;
      closeModal('wellness-modal');
      showToast('Stato salute salvato', 'fa-brain');
    }

    function computeHealthOverviewSummary() {
      const today = analyticsSelectedDate || document.getElementById('analytics-date-picker')?.value || new Date().toISOString().split('T')[0];
      const todayEntry = (appState.wellness || []).find(item => item.date === today) || null;
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today+'T12:00:00');
        d.setDate(d.getDate() - i);
        last7.push(d.toISOString().split('T')[0]);
      }
      const weeklyEntries = (appState.wellness || []).filter(item => last7.includes(item.date));
      const weeklySleep = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.sleepHours) || 0), 0) / weeklyEntries.length : 0;
      const weeklyStress = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.stress) || 0), 0) / weeklyEntries.length : 0;
      const weeklyRecovery = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.recovery) || 0), 0) / weeklyEntries.length : 0;
      const weeklyReadiness = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.readiness) || 0), 0) / weeklyEntries.length : 0;
      const dietScore = (() => {
        const target = appState.targets || {};
        const currentDate = today;
        const todayLogs = (appState.nutrition || []).filter(item => item.date === currentDate);
        const totalKcal = todayLogs.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
        const totalP = todayLogs.reduce((sum, item) => sum + (Number(item.p) || 0), 0);
        const proteinRatio = target.p ? (totalP / target.p) : 0;
        const calorieRatio = target.calories ? (totalKcal / target.calories) : 0;
        return Math.min(100, Math.round((Math.min(1, proteinRatio) * 50) + (Math.min(1, calorieRatio) * 50)));
      })();

      const currentVolume = (() => {
        const selDate = today;
        return (appState.workouts || []).filter(item => item.date === selDate).reduce((sum, ex) => sum + ex.sets.reduce((inner, set) => inner + ((set.weight || 0) * (set.reps || 0)), 0), 0);
      })();

      const dailyStatus = todayEntry
        ? (todayEntry.sleepHours >= 7 && todayEntry.stress <= 6 && todayEntry.recovery >= 6 ? 'Buono' : 'Da migliorare')
        : 'In attesa';
      const weeklyStatus = weeklySleep >= 7 && weeklyStress <= 6 && weeklyRecovery >= 6 ? 'Buono' : 'Da migliorare';

      const monthStart = new Date(today+'T12:00:00');
      monthStart.setDate(1);
      const monthEntries = (appState.wellness || []).filter(item => new Date(item.date) >= monthStart);
      const monthlyAvgSleep = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.sleepHours) || 0), 0) / monthEntries.length : 0;
      const monthlyAvgStress = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.stress) || 0), 0) / monthEntries.length : 0;
      const monthlyAvgRecovery = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.recovery) || 0), 0) / monthEntries.length : 0;
      const monthlyStatus = monthlyAvgSleep >= 7 && monthlyAvgStress <= 6 && monthlyAvgRecovery >= 6 ? 'Buono' : 'Da migliorare';

      const insights = [
        `Riposo medio settimanale: ${weeklySleep ? weeklySleep.toFixed(1) : '--'} h`,
        `Stress medio settimanale: ${weeklyStress ? weeklyStress.toFixed(1) : '--'} / 10`,
        `Recupero medio settimanale: ${weeklyRecovery ? weeklyRecovery.toFixed(1) : '--'} / 10`,
        `Dieta del giorno: ${dietScore}% rispetto al target`,
        `Volume del giorno: ${currentVolume} kg`,
        `Readiness media settimanale: ${weeklyReadiness ? weeklyReadiness.toFixed(1) : '--'} / 10`
      ];

      return {
        dailyStatus,
        weeklyStatus,
        monthlyStatus,
        dailyScore: dailyStatus === 'Buono' ? 80 : 45,
        weeklyScore: weeklySleep >= 7 && weeklyStress <= 6 && weeklyRecovery >= 6 ? 83 : 52,
        monthlyScore: monthlyAvgSleep >= 7 && monthlyAvgStress <= 6 && monthlyAvgRecovery >= 6 ? 81 : 52,
        insights,
        weeklySleep,
        weeklyStress,
        weeklyRecovery,
        weeklyReadiness,
        monthAvgSleep: monthlyAvgSleep,
        monthAvgStress: monthlyAvgStress,
        monthAvgRecovery: monthlyAvgRecovery
      };
    }

    function renderWellnessSummary() {
      const summary = computeHealthOverviewSummary();
      const dailyEl = document.getElementById('health-daily-status');
      const weeklyEl = document.getElementById('health-weekly-status');
      const monthlyEl = document.getElementById('health-monthly-status');
      const scoreEl = document.getElementById('health-score-pill');
      const insightsEl = document.getElementById('health-insights');

      if (dailyEl) dailyEl.textContent = summary.dailyStatus;
      if (weeklyEl) weeklyEl.textContent = summary.weeklyStatus;
      if (monthlyEl) monthlyEl.textContent = summary.monthlyStatus;
      if (scoreEl) {
        const avg = Math.round((summary.dailyScore + summary.weeklyScore + summary.monthlyScore) / 3);
        scoreEl.textContent = `${avg}%`;
        scoreEl.className = `text-[10px] px-2 py-1 rounded-full ${avg >= 70 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`;
      }
      if (insightsEl) {
        insightsEl.innerHTML = summary.insights.map(item => `<div class="mb-1">• ${item}</div>`).join('');
      }
    }

    function weekdayLabel(date){if(!date)return '—';try{return new Date(date+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'long',day:'numeric',month:'long'});}catch(e){return '—';}}
    function updateDateLabels(){
      const pairs=[['workout-date','workout-weekday'],['nutrition-date','nutrition-weekday'],['body-date','body-weekday'],['wellness-date','wellness-weekday']];pairs.forEach(([input,label])=>{const i=document.getElementById(input),l=document.getElementById(label);if(i&&l)l.textContent=weekdayLabel(i.value);});
    }

    // Home dashboard/avatar/coach logic moved to js/home.js in v0.31.

    // Food presets logic moved to js/nutrition.js in v0.29.



    // Body/profile logic moved to js/body.js in v0.28.

    // Analytics and charts moved to js/analytics.js in v0.31.

    // ----------------------------------------------------
    // DATA BACKUP JSON EXPORT / IMPORT

    // ----------------------------------------------------
    function exportDataJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Thalys_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('File JSON esportato!', 'fa-file-export');
    }

    function importDataJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported && typeof imported === 'object') {
            appState = imported;
            window.appState = appState;
            saveStateToLocal();
            renderAllViews();
            loadProfileUI();
            loadTargetsUI();
            showToast('Dati importati con successo!', 'fa-file-import');
          }
        } catch (err) {
          showToast('Errore nel formato del file JSON');
        }
      };
      reader.readAsText(file);
    }

    function resetAllDataConfirm() {
      if (confirm('Sei sicuro di voler cancellare TUTTI i dati salvati? Questa azione non può essere annullata.')) {
        appState = DEFAULT_STATE;
        window.appState = appState;
        saveStateToLocal();
        renderAllViews();
        showToast('Dati resettati');
      }
    }

    // Core finished evaluating successfully. External modules may now render safely.
    window.__THALYS_APP_CORE_READY__ = true;
    window.dispatchEvent(new CustomEvent('thalys:core-ready'));
