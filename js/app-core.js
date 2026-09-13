
    // Global Application State Default Structure
    const DEFAULT_STATE = {
      profile: { gender: 'male', age: 25, height: 175, sleepHours: 7, lifestyle: 'moderato' },
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

    function persistThalysStateLocally(state = appState) {
      try {
        localStorage.setItem('thalys_data', JSON.stringify(compactStateForLocalStorage(state)));
        return true;
      } catch (error) {
        console.error('Salvataggio locale compatto', error);
        if (error?.name === 'QuotaExceededError' || error?.code === 22) {
          showToast('Spazio locale pieno: i dati pesanti restano nell’archivio offline', 'fa-database');
          return false;
        }
        throw error;
      }
    }
    window.persistThalysStateLocally = persistThalysStateLocally;
    persistThalysStateLocally(appState);

    function persistFoodDatabase(){appState.presets=(appState.presets||[]).map(normalizeFoodPreset).filter(x=>x.name);localStorage.setItem('thalys_foods',JSON.stringify(appState.presets));persistThalysStateLocally(appState);if(typeof syncThalysLocalDocuments==='function')syncThalysLocalDocuments(appState);driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();scheduleDriveSync(250); }

    // Save State locally and sync to cloud if available
    function saveStateToLocal(){persistThalysStateLocally(appState);try{localStorage.setItem('thalys_foods',JSON.stringify(appState.presets||[]));}catch(e){console.warn('Food cache quota',e);localStorage.removeItem('thalys_foods');}if(typeof syncThalysLocalDocuments==='function')syncThalysLocalDocuments(appState);driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();scheduleDriveSync(350);}
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


    /* ===== External language packs =====
       The full dictionaries live in lang_it/en/es/pt/ro.json and are mirrored
       into Thalys App/database on Google Drive. index.html only keeps the engine. */
    const APP_LOCALES={it:'it-IT',en:'en-US',es:'es-ES',pt:'pt-BR',ro:'ro-RO'};
    const LANG_FILES={it:'lang_it.json',en:'lang_en.json',es:'lang_es.json',pt:'lang_pt.json',ro:'lang_ro.json'};
    let appLanguage=localStorage.getItem('thalys_language')||'it';
    let languagePack={version:22,locale:'it-IT',phrases:{},words:[],keys:{}};
    const languageCache={};
    const thalysOriginalText=new WeakMap(),thalysOriginalAttrs=new WeakMap();
    let languageMutationLock=false;

    function currentLocale(){return APP_LOCALES[appLanguage]||'it-IT';}
    function tr(raw){
      if(raw==null)return '';
      const s=String(raw),trim=s.trim();
      if(appLanguage==='it')return s;
      const dict=languagePack?.phrases||{};
      if(dict[trim])return s.replace(trim,dict[trim]);
      let out=trim;
      (languagePack?.words||[]).forEach(([a,b])=>{out=out.replace(new RegExp(`\\b${a}\\b`,'gi'),b);});
      return s.replace(trim,out);
    }
    function tk(key,fallback,vars={}){
      let s=(languagePack?.keys||{})[key]||fallback||key;
      Object.entries(vars).forEach(([k,v])=>{s=s.replaceAll(`{${k}}`,String(v));});
      return s;
    }
    async function fetchLocalLanguagePack(lang){
      const r=await fetch(`./lang/${LANG_FILES[lang]}?v=22`,{cache:'no-store'});
      if(!r.ok)throw new Error(`LANG_HTTP_${r.status}`);
      return await r.json();
    }
    async function loadLanguagePack(lang){
      lang=APP_LOCALES[lang]?lang:'it';
      if(languageCache[lang])return languageCache[lang];
      const cached=localStorage.getItem(`thalys_lang_pack_${lang}_v22`);
      let pack=null;
      if(getAccessToken()&&driveFolders?.databaseFolderId)pack=await fetchDriveLanguagePack(lang);
      if(!pack){try{pack=await fetchLocalLanguagePack(lang);}catch(e){console.warn('Local language pack',lang,e)}}
      if(!pack&&cached){try{pack=JSON.parse(cached)}catch(_){}}
      if(!pack)pack={version:3,locale:APP_LOCALES[lang],phrases:{},words:[],keys:{}};
      pack.locale=pack.locale||APP_LOCALES[lang];
      pack.phrases=pack.phrases||{};pack.words=pack.words||[];pack.keys=pack.keys||{};
      languageCache[lang]=pack;
      try{localStorage.setItem(`thalys_lang_pack_${lang}_v22`,JSON.stringify(pack))}catch(_){}
      return pack;
    }

    function translateElementTree(root=document.body){
      if(languageMutationLock||!root)return;
      languageMutationLock=true;
      try{
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
          if(!n.nodeValue?.trim())return NodeFilter.FILTER_REJECT;
          const p=n.parentElement;if(!p||['SCRIPT','STYLE','CODE','OPTION'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }});
        const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
        nodes.forEach(n=>{
          if(!thalysOriginalText.has(n))thalysOriginalText.set(n,n.nodeValue);
          n.nodeValue=tr(thalysOriginalText.get(n));
        });
        root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el=>{
          if(!thalysOriginalAttrs.has(el))thalysOriginalAttrs.set(el,{
            placeholder:el.getAttribute('placeholder'),title:el.getAttribute('title'),'aria-label':el.getAttribute('aria-label')
          });
          const o=thalysOriginalAttrs.get(el);
          ['placeholder','title','aria-label'].forEach(a=>{if(o[a]!=null)el.setAttribute(a,tr(o[a]))});
        });
        // Native selects are translated from their stored Italian source text,
        // while option values remain unchanged for business logic.
        root.querySelectorAll?.('option').forEach(opt=>{
          if(!opt.dataset.i18nSource)opt.dataset.i18nSource=opt.textContent;
          if(!opt.hasAttribute('value'))opt.setAttribute('value',opt.dataset.i18nSource);
          opt.textContent=tr(opt.dataset.i18nSource);
        });
      }finally{languageMutationLock=false}
    }
    async function setAppLanguage(lang,{silent=false}={}){
      appLanguage=APP_LOCALES[lang]?lang:'it';
      localStorage.setItem('thalys_language',appLanguage);
      languagePack=await loadLanguagePack(appLanguage);
      document.documentElement.lang=appLanguage;
      const sel=document.getElementById('app-language-select');if(sel&&sel.value!==appLanguage)sel.value=appLanguage;
      // Re-render first so all dynamic strings are recreated from canonical data.
      renderAllViews();
      renderHelpTree(activeHelpKey);
      translateElementTree(document.body);
      setTimeout(()=>translateElementTree(document.body),40);
      if(!silent)showToast(tr('Lingua aggiornata'),'fa-language');
    }
    const thalysLangObserver=new MutationObserver(records=>{
      if(languageMutationLock||appLanguage==='it')return;
      records.forEach(r=>r.addedNodes.forEach(n=>{
        if(n.nodeType===Node.TEXT_NODE){
          if(!thalysOriginalText.has(n))thalysOriginalText.set(n,n.nodeValue);
          languageMutationLock=true;n.nodeValue=tr(thalysOriginalText.get(n));languageMutationLock=false;
        }else if(n.nodeType===Node.ELEMENT_NODE)translateElementTree(n);
      }));
    });
    async function initAppLanguage(){
      languagePack=await loadLanguagePack(appLanguage);
      document.documentElement.lang=appLanguage;
      const sel=document.getElementById('app-language-select');if(sel)sel.value=appLanguage;
      renderHelpTree(activeHelpKey);
      translateElementTree(document.body);
      thalysLangObserver.observe(document.body,{childList:true,subtree:true});
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
    // WORKOUT LOGIC
    // ----------------------------------------------------
    function onWorkoutDateChange(date){ if(!date)return; homeSelectedDate=date; const hp=document.getElementById('home-date-picker'); if(hp)hp.value=date; updateDateLabels();renderWorkouts(); renderWorkoutPlans(); renderHomeDashboard(); }
    function shiftWorkoutDate(days){ const input=document.getElementById('workout-date'); if(!input?.value)return; const d=new Date(input.value+'T12:00:00'); d.setDate(d.getDate()+days); const iso=d.toISOString().split('T')[0]; if(input)input.value=iso; onWorkoutDateChange(iso); }

    function addPlanExerciseRow() {
      const container = document.getElementById('plan-exercises-container');
      if (!container) return;

      const row = document.createElement('div');
      row.className = 'plan-exercise-row grid grid-cols-2 gap-2 bg-slate-950/70 border border-slate-800 rounded-xl p-2';
      row.innerHTML = `
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-cyan-300 block mb-1">Giorno della settimana</label>
          <select class="plan-ex-day w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-2 py-2 text-[11px] text-white">
            <option value="Lunedì">Lunedì</option><option value="Martedì">Martedì</option><option value="Mercoledì">Mercoledì</option><option value="Giovedì">Giovedì</option><option value="Venerdì">Venerdì</option><option value="Sabato">Sabato</option><option value="Domenica">Domenica</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Nome esercizio</label>
          <input type="text" placeholder="Es. Panca piana" class="plan-ex-name w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Categoria</label>
          <select class="plan-ex-category w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white">
            <option value="Petto">Petto</option>
            <option value="Dorso">Dorso</option>
            <option value="Gambe">Gambe</option>
            <option value="Spalle">Spalle</option>
            <option value="Braccia">Braccia</option>
            <option value="Core">Core</option>
            <option value="Cardio">Cardio</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">RPE</label>
          <input type="number" min="1" max="10" value="8" class="plan-ex-rpe w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Peso in kg</label>
          <input type="number" min="0" step="0.5" value="10" class="plan-ex-weight w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Ripetizioni</label>
          <input type="number" min="1" value="8" class="plan-ex-reps w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Recupero in sec</label>
          <input type="number" min="0" value="90" class="plan-ex-recovery w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
      `;
      container.appendChild(row);
    }

    let editingWorkoutPlanId = null;
    function saveWorkoutPlan(e) {
      e.preventDefault();
      const name = document.getElementById('plan-name').value.trim();
const rows = document.querySelectorAll('#plan-exercises-container .plan-exercise-row');

      const exercises = Array.from(rows).map(row => {
        const nameValue = row.querySelector('.plan-ex-name').value.trim();
        if (!nameValue) return null;
        return {
          id: 'plan_ex_' + Date.now() + Math.random().toString(16).slice(2),
          name: nameValue,
          dayOfWeek: row.querySelector('.plan-ex-day')?.value || 'Lunedì',
          category: row.querySelector('.plan-ex-category').value,
          rpe: parseFloat(row.querySelector('.plan-ex-rpe').value) || 8,
          weight: parseFloat(row.querySelector('.plan-ex-weight').value) || 0,
          reps: parseInt(row.querySelector('.plan-ex-reps').value) || 0,
          recovery: parseInt(row.querySelector('.plan-ex-recovery').value) || 90
        };
      }).filter(Boolean);

      if (!name || exercises.length === 0) {
        showToast('Inserisci un nome e almeno un esercizio', 'fa-circle-exclamation');
        return;
      }

      if (editingWorkoutPlanId) {
        const idx = appState.workoutPlans.findIndex(p => p.id === editingWorkoutPlanId);
        if (idx >= 0) appState.workoutPlans[idx] = { ...appState.workoutPlans[idx], name, exercises, updatedAt: new Date().toISOString() };
      } else {
        appState.workoutPlans.push({ id: 'plan_' + Date.now(), name, exercises, updatedAt: new Date().toISOString() });
      }

      const wasEditing = !!editingWorkoutPlanId;
      editingWorkoutPlanId = null;
      saveStateToLocal();
      document.getElementById('workout-plan-form').reset();
      document.getElementById('plan-exercises-container').innerHTML = '';
      addPlanExerciseRow();
      renderWorkoutPlans();
      refreshProfileMessageCompletion();
      showToast(wasEditing ? 'Scheda modificata ✓' : 'Scheda salvata!', 'fa-clipboard-list');
    }

    function editWorkoutPlan(planId) {
      const plan = (appState.workoutPlans || []).find(p => p.id === planId);
      if (!plan) return;
      editingWorkoutPlanId = planId;
      const nameEl=document.getElementById('plan-name'), c=document.getElementById('plan-exercises-container');
      if(nameEl)nameEl.value=plan.name||'';
if(c)c.innerHTML='';
      (plan.exercises||[]).forEach(ex=>{ addPlanExerciseRow(); const row=c?.lastElementChild; if(!row)return; const set=(q,v)=>{const e=row.querySelector(q);if(e)e.value=v??'';}; set('.plan-ex-name',ex.name);set('.plan-ex-category',ex.category);set('.plan-ex-rpe',ex.rpe);set('.plan-ex-weight',ex.weight);set('.plan-ex-reps',ex.reps);set('.plan-ex-recovery',ex.recovery); });
      if(c && !c.children.length) addPlanExerciseRow();
      document.getElementById('workout-plan-form')?.scrollIntoView({behavior:'smooth',block:'start'});
      showToast(`Modifica scheda: ${plan.name}`, 'fa-pen');
    }

    function activateWorkoutPlan(planId) {
      appState.activeWorkoutPlanId=planId;
      saveStateToLocal();renderWorkouts();renderWorkoutPlans();renderHomeDashboard();
      const plan=appState.workoutPlans.find(item=>item.id===planId);
      refreshProfileMessageCompletion();
      showToast(plan?`Scheda attiva: ${plan.name}`:'Scheda attivata','fa-calendar-check');
    }

    function exportWorkoutPlan(planId) {
      const plan = appState.workoutPlans.find(item => item.id === planId);
      if (!plan) return;

      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Schema esportato', 'fa-file-export');
    }

    function deleteWorkoutPlan(planId) {
      appState.workoutPlans = appState.workoutPlans.filter(item => item.id !== planId);
      if(appState.activeWorkoutPlanId===planId)appState.activeWorkoutPlanId=null;
      Object.keys(appState.workoutAssignments || {}).forEach(date => {
        if (appState.workoutAssignments[date] === planId) delete appState.workoutAssignments[date];
      });
      saveStateToLocal();
      renderWorkouts();
      renderWorkoutPlans();
      showToast('Scheda rimossa', 'fa-trash');
    }

    function importWorkoutPlanFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const imported = JSON.parse(reader.result);
            if (!imported || !imported.name || !Array.isArray(imported.exercises)) {
              throw new Error('Formato schema non valido');
            }
            appState.workoutPlans.push({
              id: imported.id || 'plan_' + Date.now(),
              name: imported.name,
              dayOfWeek: imported.dayOfWeek || imported.days?.[0] || 'Lunedì',
              exercises: imported.exercises.map(ex=>({...ex,dayOfWeek:ex.dayOfWeek||imported.dayOfWeek||'Lunedì'}))
            });
            saveStateToLocal();
            renderWorkoutPlans();
            showToast('Scheda importata', 'fa-file-import');
          } catch (err) {
            console.error(err);
            showToast('File schema non valido', 'fa-circle-exclamation');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    function renderWorkoutPlans() {
      const list = document.getElementById('workout-plans-list');
      if (!list) return;
      list.innerHTML = '';

      if (!appState.workoutPlans.length) {
        list.innerHTML = '<div class="text-[11px] text-slate-400 italic">Nessuna scheda salvata.</div>';
        return;
      }

      const selectedDate = document.getElementById('workout-date')?.value;
      appState.workoutPlans.forEach(plan => {
        const days=getPlanDays(plan);
        const activeOnSelected=appState.activeWorkoutPlanId===plan.id;

        const item = document.createElement('div');
        item.className = 'bg-slate-900/60 border border-slate-800 rounded-xl p-3';
        item.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-bold text-white text-sm">${plan.name}</div>
              <div class="text-[10px] text-slate-400">${days.join(' · ')} · ${plan.exercises.length} esercizi</div>
              ${activeOnSelected ? `<div class="text-[10px] text-emerald-400 mt-1">Scheda attiva ogni giorno</div>` : ''}
            </div>
            <div class="flex flex-wrap gap-1 justify-end">
              <button data-plan-id="${plan.id}" class="plan-activate-btn rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-bold text-slate-950">${activeOnSelected ? 'Attiva' : 'Rendi attiva'}</button>
              <button type="button" onclick="editWorkoutPlan('${plan.id}')" class="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-bold text-white">Modifica</button>
              <button data-export-plan="${plan.id}" class="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200">Esporta</button>
              <button data-delete-plan="${plan.id}" class="rounded-md bg-rose-700 px-2 py-1 text-[10px] font-bold text-white">Elimina</button>
            </div>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('[data-plan-id]').forEach(btn => {
        btn.addEventListener('click', () => activateWorkoutPlan(btn.dataset.planId));
      });
      list.querySelectorAll('[data-export-plan]').forEach(btn => {
        btn.addEventListener('click', () => exportWorkoutPlan(btn.dataset.exportPlan));
      });
      list.querySelectorAll('[data-delete-plan]').forEach(btn => {
        btn.addEventListener('click', () => deleteWorkoutPlan(btn.dataset.deletePlan));
      });
    }

    function renderWorkouts() {
      const selectedDate = document.getElementById('workout-date').value;
      const container = document.getElementById('workout-list');
      container.innerHTML = '';

      const assignedPlan=getActiveWorkoutPlan();
      const assignedPlanId=assignedPlan?.id||null;
      const scheduledToday=assignedPlan?isPlanScheduledOnDate(assignedPlan,selectedDate):false;
      const todayPlanExercises=assignedPlan?getExercisesForDate(assignedPlan,selectedDate):[];
      if(assignedPlanId){
          const totalPlanVolume = todayPlanExercises.reduce((sum, ex) => sum + ((Number(ex.weight) || 0) * (Number(ex.reps) || 0)), 0);
          const planCard = document.createElement('div');
          planCard.className = 'bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-4 space-y-3 shadow-md';
          planCard.innerHTML = `
            <div class="flex justify-between items-start">
              <div>
                <div class="text-[10px] uppercase tracking-[0.2rem] text-cyan-300">Scheda attiva</div>
                <div class="text-lg font-bold text-white">${assignedPlan.name}</div>
              </div>
              <span class="rounded-full bg-emerald-500/15 border border-emerald-400/40 px-2 py-1 text-[10px] font-bold text-emerald-300">${getPlanDays(assignedPlan).map(d=>tr(d)).join(" · ")}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="text-[11px] text-slate-300">Volume previsto: <span class="text-cyan-400 font-bold">${totalPlanVolume} kg</span></div>
              ${scheduledToday?`<label class="flex items-center gap-2 rounded-xl bg-slate-950/70 border border-emerald-500/20 px-3 py-2 cursor-pointer">
                <input type="checkbox" ${isWorkoutPlanCompleted(selectedDate, assignedPlan.id) ? 'checked' : ''} onchange="toggleWorkoutPlanComplete('${selectedDate}','${assignedPlan.id}',this.checked)" class="w-4 h-4 accent-emerald-500">
                <span class="text-[10px] font-bold ${isWorkoutPlanCompleted(selectedDate, assignedPlan.id) ? 'text-emerald-300' : 'text-slate-300'}">Scheda completata</span>
              </label>`:`<span class="rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-400">${tk('workout.rest_scheduled','Riposo programmato')}</span>`}
            </div>
            <div class="space-y-2">
              ${(scheduledToday?todayPlanExercises:assignedPlan.exercises).map(ex => { const done=scheduledToday&&isWorkoutExerciseCompleted(selectedDate,assignedPlan.id,ex.id); return `
                <div class="bg-slate-900/70 border ${done?'border-emerald-500/30':'border-slate-800'} rounded-xl p-2 flex items-center gap-3 ${scheduledToday?'':'opacity-70'}">
                  <input type="checkbox" ${done?'checked':''} ${scheduledToday?'':'disabled'} onchange="toggleWorkoutExerciseComplete('${selectedDate}','${assignedPlan.id}','${ex.id}',this.checked)" class="w-5 h-5 shrink-0 accent-emerald-500" aria-label="Completato ${ex.name}">
                  <div class="min-w-0 flex-1">
                    <div class="flex justify-between items-center gap-2">
                      <span class="text-sm font-bold ${done?'text-emerald-300 line-through':'text-white'}">${ex.name}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 font-semibold border border-cyan-800/50">${ex.category}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-1">RPE ${ex.rpe} · ${ex.weight} kg · ${ex.reps} reps · Recupero ${ex.recovery}s</div>
                  </div>
                </div>
              `; }).join('')}
            </div>
            <div id="workout-gamification-${selectedDate}" class="rounded-2xl bg-slate-950/70 border border-slate-800 p-3"></div>
          `;
          container.appendChild(planCard);
          const gbox=document.getElementById(`workout-gamification-${selectedDate}`);
          if(gbox){
            if(!scheduledToday){
              gbox.innerHTML=`<div class="flex items-center gap-2 text-[10px] text-slate-400"><i class="fa-solid fa-moon text-violet-300"></i><span>${tk('workout.plan_stays_active','La scheda resta attiva ogni giorno. Oggi non ci sono esercizi programmati.')}</span></div>`;
            }else{
              const gc=getWorkoutCompletion(selectedDate,assignedPlan.id);
              const dayExercises=getExercisesForDate(assignedPlan,selectedDate);
              const done=dayExercises.filter(ex=>gc.exercises?.[ex.id]).length;
              const pct=Math.round(done/Math.max(1,dayExercises.length)*100);
              gbox.innerHTML=`<div class="flex items-center justify-between"><span class="text-[10px] uppercase tracking-widest text-slate-500">Progressione scheda</span><span class="text-sm font-black ${pct===100?'text-emerald-300':'text-cyan-300'}">${done}/${todayPlanExercises.length}</span></div><div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style="width:${pct}%"></div></div><div class="mt-2 text-[10px] text-slate-400">${pct===100?'🏆 Scheda completata!':'Ti mancano '+(todayPlanExercises.length-done)+' esercizi per completarla.'}</div>`;
            }
          }
      }

      const dayWorkouts = appState.workouts.filter(w => w.date === selectedDate);
      let dayVolume = 0;

      if (dayWorkouts.length === 0 && !assignedPlanId) {
        container.innerHTML = `
          <div class="text-center py-10 bg-darkcard/50 rounded-2xl border border-dashed border-slate-800">
            <i class="fa-solid fa-dumbbell text-3xl text-slate-600 mb-2"></i>
            <p class="text-xs text-slate-400">Nessun esercizio per questa data.</p>
            <button onclick="openWorkoutPlans()" class="mt-3 text-xs text-cyan-400 font-bold hover:underline">Apri Schede</button>
          </div>
        `;
      }

      dayWorkouts.forEach(ex => {
        let exVolume = 0;
        let maxWeight = 0;
        ex.sets.forEach(s => {
          exVolume += (s.weight * s.reps);
          if (s.weight > maxWeight) maxWeight = s.weight;
        });
        dayVolume += exVolume;

        const topSet = ex.sets[0] || { weight: 0, reps: 0 };
        const est1RM = Math.round(topSet.weight * (1 + topSet.reps / 30));

        const card = document.createElement('div');
        card.className = "bg-darkcard border border-darkborder rounded-2xl p-4 space-y-3 shadow-md";
        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-sm font-bold text-white">${ex.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 font-semibold border border-cyan-800/50">${ex.category}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">
                Vol: <span class="text-cyan-400 font-bold">${exVolume} kg</span> | 1RM stima: <span class="text-emerald-400 font-bold">${est1RM} kg</span> | RPE: ${ex.rpe}
              </div>
            </div>
            <button onclick="deleteExercise('${ex.id}')" class="text-slate-500 hover:text-rose-400 text-xs p-1">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>

          <div class="space-y-2 pt-1">
            ${ex.sets.map((s, idx) => `
              <div class="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-xs">
                <span class="w-12 font-bold text-slate-400 text-[11px]">Set ${idx + 1}</span>
                <div class="flex items-center space-x-2">
                  <input type="number" value="${s.weight}" step="0.5" onchange="updateSet('${ex.id}', ${idx}, 'weight', this.value)" class="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-semibold text-white">
                  <span class="text-slate-500 text-[10px]">kg</span>
                  <span class="text-slate-500 font-bold">×</span>
                  <input type="number" value="${s.reps}" onchange="updateSet('${ex.id}', ${idx}, 'reps', this.value)" class="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-semibold text-white">
                  <span class="text-slate-500 text-[10px]">reps</span>
                </div>
                <button onclick="removeSet('${ex.id}', ${idx})" class="text-slate-600 hover:text-red-400 px-1">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            `).join('')}
          </div>

          <div class="flex justify-between items-center pt-1">
            <button onclick="addSetToExercise('${ex.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1">
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>Aggiungi Serie</span>
            </button>
            <button onclick="setRestTimer(90); toggleTimerModal();" class="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1">
              <i class="fa-solid fa-stopwatch text-cyan-400"></i>
              <span>Timer 90s</span>
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      const dailyTotalVolumeEl = document.getElementById('daily-total-volume');
      if (dailyTotalVolumeEl) dailyTotalVolumeEl.textContent = `${dayVolume} kg`;
    }

    // ----------------------------------------------------
    // REST TIMER LOGIC
    // ----------------------------------------------------
    let timerInterval = null;
    let timerSeconds = 90;
    let timerRunning = false;

    function syncTimerInputs() {
      const minutesInput = document.getElementById('timer-minutes-input');
      const secondsInput = document.getElementById('timer-seconds-input');
      if (!minutesInput || !secondsInput) return;

      const minutes = Math.floor(timerSeconds / 60);
      const seconds = timerSeconds % 60;
      minutesInput.value = Math.max(0, minutes);
      secondsInput.value = Math.max(0, seconds);
    }

    function setRestTimer(sec) {
      timerSeconds = Math.max(0, Number(sec) || 0);
      updateTimerDisplay();
    }

    function applyCustomTimer() {
      const minutesInput = document.getElementById('timer-minutes-input');
      const secondsInput = document.getElementById('timer-seconds-input');
      if (!minutesInput || !secondsInput) return;

      const minutes = Math.max(0, Number(minutesInput.value) || 0);
      const seconds = Math.max(0, Math.min(59, Number(secondsInput.value) || 0));
      const totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 0) {
        showToast('Inserisci un tempo valido');
        return;
      }

      timerSeconds = totalSeconds;
      updateTimerDisplay();
    }

    function updateTimerDisplay() {
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      const timerDisplay = document.getElementById('timer-display');
      if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
      syncTimerInputs();
    }

    function toggleTimerStart() {
      const btn = document.getElementById('timer-start-btn');
      if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = 'Avvia';
        btn.className = "flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm";
      } else {
        timerRunning = true;
        btn.textContent = 'Pausa';
        btn.className = "flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm";
        document.getElementById('timer-badge').classList.remove('hidden');

        timerInterval = setInterval(() => {
          if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
          } else {
            clearInterval(timerInterval);
            timerRunning = false;
            btn.textContent = 'Completato!';
            document.getElementById('timer-badge').classList.add('hidden');
            playTimerSound();
            showToast('Tempo di recupero terminato!', 'fa-bell');
          }
        }, 1000);
      }
    }

    function resetTimer() {
      clearInterval(timerInterval);
      timerRunning = false;
      timerSeconds = 90;
      updateTimerDisplay();
      const timerBadge = document.getElementById('timer-badge');
      if (timerBadge) timerBadge.classList.add('hidden');
      const timerStartBtn = document.getElementById('timer-start-btn');
      if (timerStartBtn) {
        timerStartBtn.textContent = 'Avvia';
        timerStartBtn.className = 'flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm';
      }
    }

    function toggleTimerModal() {
      const modal = document.getElementById('modal-timer');
      if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        updateTimerDisplay();
      } else {
        modal.classList.add('hidden');
      }
    }

    function playTimerSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {
        console.log("Audio Web API restricted");
      }
    }

    // ----------------------------------------------------
    // NUTRITION LOGIC
    // ----------------------------------------------------
    function shiftNutritionDate(days) {
      const input = document.getElementById('nutrition-date');
      const cur = new Date(input.value);
      cur.setDate(cur.getDate() + days);
      input.value = cur.toISOString().split('T')[0];
      renderNutrition();
      // Aggiorna grafici quando cambia la data
      updateAnalyticsCharts();
    }

    function normalizeVitaminCodes(value, group='id') {
      const allowed = group === 'lip' ? ['A','D','E','K'] : ['B1','B2','B3','B5','B6','B7','B9','B12','C'];
      const raw = String(value || '').toUpperCase().replace(/VITAMIN[AE]?/g,' ').replace(/[;,/|]+/g,' ').split(/\s+/).filter(Boolean);
      return [...new Set(raw.filter(x => allowed.includes(x)))].join(' ');
    }
    function mergeVitaminCodes(values, group='id') {
      return normalizeVitaminCodes((values || []).filter(Boolean).join(' '), group);
    }
    function updateFoodDosePreview(){
      const grams=Math.max(0,Number(document.getElementById('food-grams')?.value||0)); const r=grams/100;
      const n=id=>Number(document.getElementById(id)?.value||0); const kcal=Math.round(n('food-kcal')*r);
      const el=document.getElementById('food-dose-preview'); if(!el)return;
      el.innerHTML=`Dose ${grams||0} g → <b class="text-slate-200">${kcal} kcal</b> · P ${(n('food-p')*r).toFixed(1)}g · C ${(n('food-c')*r).toFixed(1)}g · G ${(n('food-f')*r).toFixed(1)}g · saturi ${(n('food-sat-fat')*r).toFixed(1)}g`;
    }
    function openFoodForMeal(meal){openModal('add-food-modal');setTimeout(()=>{const s=document.getElementById('food-meal');if(s)s.value=meal},0)}
    function saveFoodLog(e) {
      e.preventDefault();
      const date = document.getElementById('nutrition-date').value;
      const name = document.getElementById('food-name').value.trim();
      const meal = document.getElementById('food-meal').value;
      const grams = Math.max(0, parseFloat(document.getElementById('food-grams').value) || 0);
      const ratio = grams / 100;
      const base = id => parseFloat(document.getElementById(id)?.value) || 0;
      const p = base('food-p') * ratio, c = base('food-c') * ratio, f = base('food-f') * ratio;
      const satFat = base('food-sat-fat') * ratio, sugars = base('food-sugars') * ratio;
      const calcium = base('food-calcium') * ratio, magnesium = base('food-magnesium') * ratio, zinc = base('food-zinc') * ratio;
      const fiber = base('food-fiber') * ratio, salt = base('food-salt') * ratio;
      const iron = base('food-iron') * ratio, potassium = base('food-potassium') * ratio;
      const vitaminsId = normalizeVitaminCodes(document.getElementById('food-vitamins-id')?.value,'id');
      const vitaminsLip = normalizeVitaminCodes(document.getElementById('food-vitamins-lip')?.value,'lip');
      const baseKcal=base('food-kcal'); const kcal=baseKcal>0?Math.round(baseKcal*ratio):Math.round((p*4)+(c*4)+(f*9));
      const newLog={id:'food_'+Date.now(),date,name,meal,grams,p,c,f,satFat,sugars,calcium,magnesium,zinc,fiber,salt,iron,potassium,vitaminsId,vitaminsLip,kcal};
      appState.nutrition.push(newLog); saveStateToLocal(); closeModal('add-food-modal'); document.getElementById('add-food-form').reset();
      const gramsEl=document.getElementById('food-grams');if(gramsEl)gramsEl.value=100; updateFoodDosePreview(); renderNutrition(); updateAnalyticsCharts(); showToast('Alimento salvato ✓','fa-circle-check');
    }

    function deleteFoodLog(id) {
      appState.nutrition = appState.nutrition.filter(n => n.id !== id);
      saveStateToLocal();
      renderNutrition();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Alimento rimosso');
    }

    function getWaterTarget(date){
      const manual=Number(appState.settings?.waterTargetMl||0);
      if(manual>=500) return Math.round(manual/50)*50;
      const latest=(appState.bodyMetrics||[]).filter(x=>x.date<=date && Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      const kg=latest?.weight || appState.profile?.weight || 70;
      return Math.round(Math.max(1500,Math.min(4000,kg*35))/50)*50;
    }

    function openWaterTargetModal(){const date=document.getElementById('nutrition-date')?.value||homeSelectedDate||new Date().toISOString().split('T')[0];const el=document.getElementById('water-target-input');if(el)el.value=getWaterTarget(date);openModal('water-target-modal');}
    function setWaterTargetQuick(v){const el=document.getElementById('water-target-input');if(el)el.value=v;}
    function saveWaterTarget(){const el=document.getElementById('water-target-input');const v=Math.round((Number(el?.value)||0)/50)*50;if(v<500||v>8000)return showToast('Inserisci un target tra 500 e 8000 ml','fa-triangle-exclamation');appState.settings=appState.settings||{};appState.settings.waterTargetMl=v;saveStateToLocal();renderNutrition();renderHomeDashboard();closeModal('water-target-modal');showToast(`Target acqua salvato: ${v} ml`,'fa-glass-water');}
    function openNutritionInfo(){openModal('nutrition-info-modal');}

    function addWater(amountMs) {
      const date = document.getElementById('nutrition-date').value || homeSelectedDate || new Date().toISOString().split('T')[0];
      const current = appState.water[date] || 0;
      const updated = Math.max(0, current + amountMs);
      appState.water[date] = updated;
      appState.waterUpdatedAt = appState.waterUpdatedAt || {};
      appState.waterUpdatedAt[date] = new Date().toISOString();
      saveStateToLocal();
      renderNutrition();
      renderHomeDashboard();
      renderTodayDashboard();
      updateManualSyncUI();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
    }

    function nutritionScore(value,target,isMaximum=false){
      const v=Math.max(0,Number(value)||0),t=Math.max(.0001,Number(target)||1);
      if(isMaximum){
        if(v<=t)return 100;
        return Math.max(0,Math.min(100,(t/v)*100));
      }
      return Math.max(0,Math.min(100,(v/t)*100));
    }

    function nutritionNutrientDefinitions(target={},waterTarget=2500){
      return [
        {key:'kcal',label:'Calorie',target:Number(target.calories||2200),unit:'kcal',rgb:[244,63,94]},
        {key:'p',label:'Proteine',target:Number(target.p||150),unit:'g',rgb:[251,113,133]},
        {key:'c',label:'Carboidrati',target:Number(target.c||250),unit:'g',rgb:[251,191,36]},
        {key:'f',label:'Grassi',target:Number(target.f||70),unit:'g',rgb:[96,165,250]},
        {key:'satFat',label:'Grassi saturi',target:Number(target.satFat||20),unit:'g',maximum:true,rgb:[56,189,248]},
        {key:'sugars',label:'Zuccheri',target:Number(target.sugars||50),unit:'g',maximum:true,rgb:[167,139,250]},
        {key:'fiber',label:'Fibre',target:Number(target.fiber||30),unit:'g',rgb:[251,191,36]},
        {key:'calcium',label:'Calcio',target:Number(target.calcium||1000),unit:'mg',rgb:[34,211,238]},
        {key:'magnesium',label:'Magnesio',target:Number(target.magnesium||350),unit:'mg',rgb:[52,211,153]},
        {key:'zinc',label:'Zinco',target:Number(target.zinc||11),unit:'mg',rgb:[45,212,191]},
        {key:'iron',label:'Ferro',target:Number(target.iron||11),unit:'mg',rgb:[251,146,60]},
        {key:'potassium',label:'Potassio',target:Number(target.potassium||3500),unit:'mg',rgb:[163,230,53]},
        {key:'salt',label:'Sale',target:Number(target.salt||5),unit:'g',maximum:true,rgb:[232,121,249]},
        {key:'water',label:'Acqua',target:Number(waterTarget||2500),unit:'ml',rgb:[96,165,250]}
      ];
    }

    function computeWeeklyNutritionSummary(referenceDate){
      const target=appState.targets||{};
      const ref=referenceDate||document.getElementById('nutrition-date')?.value||currentLocalDateStr();
      const dates=[];
      for(let i=6;i>=0;i--){
        const d=new Date(ref+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));
      }
      const daySummaries=dates.map(date=>{
        const items=(appState.nutrition||[]).filter(item=>item.date===date);
        return {
          date,
          kcal:items.reduce((s,x)=>s+Number(x.kcal||0),0),
          p:items.reduce((s,x)=>s+Number(x.p||0),0),
          c:items.reduce((s,x)=>s+Number(x.c||0),0),
          f:items.reduce((s,x)=>s+Number(x.f||0),0),
          satFat:items.reduce((s,x)=>s+Number(x.satFat||0),0),
          sugars:items.reduce((s,x)=>s+Number(x.sugars||0),0),
          fiber:items.reduce((s,x)=>s+Number(x.fiber||0),0),
          calcium:items.reduce((s,x)=>s+Number(x.calcium||0),0),
          magnesium:items.reduce((s,x)=>s+Number(x.magnesium||0),0),
          zinc:items.reduce((s,x)=>s+Number(x.zinc||0),0),
          iron:items.reduce((s,x)=>s+Number(x.iron||0),0),
          potassium:items.reduce((s,x)=>s+Number(x.potassium||0),0),
          salt:items.reduce((s,x)=>s+Number(x.salt||0),0),
          water:Number(appState.water?.[date]||0),
          vitaminsId:mergeVitaminCodes(items.map(x=>x.vitaminsId),'id'),
          vitaminsLip:mergeVitaminCodes(items.map(x=>x.vitaminsLip),'lip'),
          hasFood:items.length>0
        };
      });
      const quantitative=nutritionNutrientDefinitions(target,getWaterTarget(ref));
      const allVitId=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsId),'id');
      const allVitLip=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsLip),'lip');
      const averages={};
      quantitative.forEach(n=>averages[n.key]=Number((daySummaries.reduce((s,d)=>s+Number(d[n.key]||0),0)/7).toFixed(n.unit==='mg'?1:2)));
      const scores=quantitative.map(n=>nutritionScore(averages[n.key],n.target,n.maximum));
      scores.push((allVitId?allVitId.split(/\s+/).filter(Boolean).length:0)/9*100);
      scores.push((allVitLip?allVitLip.split(/\s+/).filter(Boolean).length:0)/4*100);
      const compliance=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)||0;
      const missing=quantitative
        .map((n,i)=>({label:n.label,score:scores[i]}))
        .filter(x=>x.score<80)
        .sort((a,b)=>a.score-b.score)
        .slice(0,5)
        .map(x=>x.label.toLowerCase());
      const summary={
        compliance,
        isComplete:compliance>=70,
        missing,
        averages,
        daySummaries,
        vitaminsId:allVitId,
        vitaminsLip:allVitLip,
        trackedDays:daySummaries.filter(x=>x.hasFood).length,
        referenceDate:ref
      };
      appState.weeklyNutritionStatus={compliance:summary.compliance,isComplete:summary.isComplete,missing:summary.missing};
      return summary;
    }

    function renderNutritionAnalytics(weeklySummary,daily,vitId,vitLip,waterVal,waterTarget){
      const target=appState.targets||{};
      const defs=nutritionNutrientDefinitions(target,waterTarget);
      const scoreEl=document.getElementById('nutrition-week-score');
      if(scoreEl)scoreEl.textContent=`${weeklySummary.compliance}%`;

      const bars=document.getElementById('nutrition-week-bars');
      if(bars){
        bars.innerHTML=defs.map(n=>{
          const value=Number(weeklySummary.averages?.[n.key]||0);
          const score=Math.round(nutritionScore(value,n.target,n.maximum));
          const width=Math.max(2,Math.min(100,score));
          const cap=n.maximum?tr('max'):tr('target');
          return `<div class="rounded-xl bg-slate-950/45 p-2.5">
            <div class="flex items-center justify-between gap-2 text-[10px]">
              <span class="font-bold text-slate-200">${tr(n.label)}</span>
              <span class="text-slate-400">${Number(value.toFixed(n.unit==='mg'?1:1))} ${n.unit} <span class="text-slate-600">/ ${cap} ${n.target}</span></span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full transition-all" style="width:${width}%;background:rgb(${n.rgb.join(',')})"></div></div>
            <div class="mt-1 text-right text-[8px] font-bold ${score>=80?'text-emerald-300':score>=55?'text-amber-300':'text-rose-300'}">${score}%</div>
          </div>`;
        }).join('');
      }

      const weekVitId=weeklySummary.vitaminsId?weeklySummary.vitaminsId.split(/\s+/).filter(Boolean):[];
      const weekVitLip=weeklySummary.vitaminsLip?weeklySummary.vitaminsLip.split(/\s+/).filter(Boolean):[];
      const vitaminNote=document.getElementById('nutrition-week-vitamin-note');
      if(vitaminNote){
        vitaminNote.innerHTML=`<div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-2"><div class="font-bold text-indigo-300">${tr('Vitamine ID')} · ${weekVitId.length}/9</div><div class="mt-1 leading-relaxed">${weekVitId.join(' · ')||'—'}</div></div>
          <div class="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-2"><div class="font-bold text-yellow-300">${tr('Vitamine LIP')} · ${weekVitLip.length}/4</div><div class="mt-1 leading-relaxed">${weekVitLip.join(' · ')||'—'}</div></div>
        </div><div class="mt-2">${tr('Per le vitamine Thalys registra la presenza dichiarata, non la quantità: per questo sono mostrate come copertura e non come dose.')}</div>`;
      }

      const dailyData={...daily,water:Number(waterVal||0)};
      const dailyVitId=vitId?vitId.split(/\s+/).filter(Boolean):[];
      const dailyVitLip=vitLip?vitLip.split(/\s+/).filter(Boolean):[];
      const wheel=[
        ...defs.map(n=>({...n,score:Math.round(nutritionScore(dailyData[n.key],n.target,n.maximum))})),
        {key:'vitId',label:'Vitamine ID',score:Math.round(dailyVitId.length/9*100),rgb:[129,140,248]},
        {key:'vitLip',label:'Vitamine LIP',score:Math.round(dailyVitLip.length/4*100),rgb:[250,204,21]}
      ];
      const overall=Math.round(wheel.reduce((s,n)=>s+n.score,0)/wheel.length)||0;
      const center=document.getElementById('nutrient-donut-score');if(center)center.textContent=`${overall}%`;
      const donut=document.getElementById('macro-donut');
      if(donut){
        const step=100/wheel.length;
        donut.style.background=`conic-gradient(${wheel.map((n,i)=>{
          const alpha=(.20+.80*(n.score/100)).toFixed(2);
          return `rgba(${n.rgb.join(',')},${alpha}) ${(i*step).toFixed(2)}% ${((i+1)*step).toFixed(2)}%`;
        }).join(',')})`;
      }
      const legend=document.getElementById('nutrient-donut-legend');
      if(legend){
        legend.innerHTML=wheel.map(n=>`<div class="flex min-h-9 items-center gap-2 rounded-xl bg-slate-950/45 px-2.5 py-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:rgb(${n.rgb.join(',')})"></span>
          <span class="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-300">${tr(n.label)}</span>
          <span class="text-[9px] font-black ${n.score>=80?'text-emerald-300':n.score>=55?'text-amber-300':'text-rose-300'}">${n.score}%</span>
        </div>`).join('');
      }
    }

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
    let homeSelectedDate = new Date().toISOString().split('T')[0];

    function setHomeDate(date){
      if(!date) return;
      homeSelectedDate=date;
      const hp=document.getElementById('home-date-picker'); if(hp) hp.value=date;
      const wd=document.getElementById('workout-date'); if(wd) wd.value=date;
      const nd=document.getElementById('nutrition-date'); if(nd) nd.value=date;
      updateDateLabels();renderHomeDashboard(); renderWorkouts(); renderWorkoutPlans(); renderNutrition();
      updateAnalyticsCharts();
    }

    function getActiveWorkoutPlan(){
      let plan=(appState.workoutPlans||[]).find(p=>p.id===appState.activeWorkoutPlanId)||null;
      if(!plan){
        const entries=Object.entries(appState.workoutAssignments||{}).sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
        const legacyId=entries[0]?.[1];
        plan=(appState.workoutPlans||[]).find(p=>p.id===legacyId)||null;
        if(plan)appState.activeWorkoutPlanId=plan.id;
      }
      return plan;
    }
    function getItalianWeekday(date){return ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][new Date(date+'T12:00:00').getDay()];}
    function getPlanDays(plan){return [...new Set((plan?.exercises||[]).map(ex=>ex.dayOfWeek||plan?.dayOfWeek||'Lunedì'))];}
    function getExercisesForDate(plan,date){if(!plan)return[];const wd=getItalianWeekday(date);return (plan.exercises||[]).filter(ex=>(ex.dayOfWeek||plan.dayOfWeek||'Lunedì')===wd);}
    function isPlanScheduledOnDate(plan,date){return getExercisesForDate(plan,date).length>0;}
    function getDayWorkoutPlan(date){const plan=getActiveWorkoutPlan();return isPlanScheduledOnDate(plan,date)?plan:null;}
    function getWorkoutCompletion(date,planId){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=appState.workoutCompletions[date];
      if(!c || c.planId!==planId) return {planId,exercises:{}};
      return c;
    }
    function isWorkoutExerciseCompleted(date,planId,exerciseId){ return !!getWorkoutCompletion(date,planId).exercises?.[exerciseId]; }
    function isWorkoutPlanCompleted(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return false;
      const dayExercises=getExercisesForDate(plan,date);if(!dayExercises.length)return false;
      const c=getWorkoutCompletion(date,planId); return dayExercises.every(ex=>!!c.exercises?.[ex.id]);
    }
    function updateWorkoutCompletion(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      const dayExercises=getExercisesForDate(plan,date),c=getWorkoutCompletion(date,planId);
      const done=dayExercises.filter(ex=>c.exercises?.[ex.id]).length;
      c.planId=planId; c.completedAt=dayExercises.length&&done===dayExercises.length?new Date().toISOString():null;
      appState.workoutCompletions[date]=c; saveStateToLocal(); renderWorkouts(); renderHomeDashboard(); updateAnalyticsCharts(); checkWorkoutMilestones(date);
    }
    function toggleWorkoutExerciseComplete(date,planId,exerciseId,checked){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=getWorkoutCompletion(date,planId); c.exercises=c.exercises||{}; c.exercises[exerciseId]=!!checked; appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Esercizio completato!':'Esercizio riaperto',checked?'fa-check':'fa-rotate-left');
    }
    function toggleWorkoutPlanComplete(date,planId,checked){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      appState.workoutCompletions=appState.workoutCompletions||{}; const c=getWorkoutCompletion(date,planId); c.exercises={}; plan.exercises.forEach(ex=>c.exercises[ex.id]=!!checked); appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Scheda completata! +100 XP':'Scheda segnata come incompleta',checked?'fa-trophy':'fa-rotate-left');
    }
    function getDayGamification(date){
      const plan=getDayWorkoutPlan(date); const c=plan?getWorkoutCompletion(date,plan.id):null;
      const dayExercises=plan?getExercisesForDate(plan,date):[];
      const exerciseTotal=dayExercises.length; const exerciseDone=plan?dayExercises.filter(ex=>c?.exercises?.[ex.id]).length:0;
      const workoutDone=exerciseTotal>0 && exerciseDone===exerciseTotal;
      const nutrition=(appState.nutrition||[]).filter(x=>x.date===date); const kcal=nutrition.reduce((a,x)=>a+Number(x.kcal||0),0); const target=appState.targets||{};
      const water=Number(appState.water?.[date]||0); const waterTarget=getWaterTarget(date); const wellness=appState.wellness?.find(x=>x.date===date); const meditation=(appState.meditation||[]).filter(x=>x.date===date).reduce((a,x)=>a+Number(x.minutes||0),0);
      const activePlan=getActiveWorkoutPlan();
      const scheduled=isPlanScheduledOnDate(activePlan,date);
      const steps=[];
      if(scheduled)steps.push({label:`${tr('Scheda')} ${activePlan.name}`,done:workoutDone,icon:'fa-dumbbell'});
      else if((appState.workouts||[]).some(x=>x.date===date))steps.push({label:tr('Allenamento extra'),done:true,icon:'fa-dumbbell'});
      steps.push(
        {label:tr('Check-in wellness'),done:!!wellness,icon:'fa-heart-pulse'},
        {label:tr('Idratazione'),done:water>=waterTarget*0.8,icon:'fa-glass-water'},
        {label:tr('Registra la dieta'),done:nutrition.length>0 && (kcal>=Number(target.calories||2200)*0.8),icon:'fa-utensils'},
        {label:tr('Pausa mentale'),done:meditation>=5,icon:'fa-spa'}
      );
      return {plan,exerciseDone,exerciseTotal,workoutDone,steps,done:steps.filter(x=>x.done).length,total:steps.length,water,waterTarget,kcal,wellness,meditation};
    }

    const HOME_AVATAR_QUIPS={
      zero:[
        ['avatar.zero.01','Il divano mi chiama, ma so che posso farcela a iniziare! 🦥'],
        ['avatar.zero.02','0%. Performance da soprammobile premium. 😴'],
        ['avatar.zero.03','Per ora ho completato esattamente... niente. È quasi talento. 🐢'],
        ['avatar.zero.04','{name}, il piano è semplice: iniziare prima che il divano presenti ricorso. 😏'],
        ['avatar.zero.05','La motivazione non risponde. Possiamo procedere senza di lei. 💪'],
        ['avatar.zero.06','Ancora tutto intatto. Anche le scuse, purtroppo. 😂'],
        ['avatar.zero.07','Il primo passo è gratis. Il secondo pure, non spargere la voce. 🐌'],
        ['avatar.zero.08','Oggi il bradipo interiore ha preso il comando. Per ora. 🦥'],
        ['avatar.zero.09','Zero fatto, zero drammi: basta rompere il ghiaccio. ❄️'],
        ['avatar.zero.10','{name}, puoi iniziare piano. Ma devi pur sempre iniziare. 😌'],
        ['avatar.zero.11','La giornata è ancora vergine. Facciamole vedere qualcosa di interessante. ✨'],
        ['avatar.zero.12','Il 100% sembra lontano solo finché non fai l’1%.'],
        ['avatar.zero.13','Sto aspettando un segnale. Anche un bicchiere d’acqua conta. 🥤'],
        ['avatar.zero.14','Modalità statua attiva. Disattivarla richiede un solo gesto. 🗿'],
        ['avatar.zero.15','Non serve sentirsi pronti. Serve cominciare abbastanza male da migliorare. 😎'],
        ['avatar.zero.16','{name}, oggi niente epica: una cosa piccola e concreta.'],
        ['avatar.zero.17','Il calendario ha aperto la giornata. Tu quando apri le danze? 💃'],
        ['avatar.zero.18','0% non è una sentenza, è solo la schermata di caricamento.'],
        ['avatar.zero.19','Il mio livello di attività al momento è “ornamento da salotto”. Aiutami. 😂'],
        ['avatar.zero.20','Partenza lenta? Va bene. Basta che non diventi parcheggio permanente. 🚗']
      ],
      low:[
        ['avatar.low.01','Qualcosa si muove! Non siamo più arredamento. 😏'],
        ['avatar.low.02','Ho iniziato. Ora sarebbe brutto fermarsi. 🐌'],
        ['avatar.low.03','Progressi piccoli, ego già enorme. 😎'],
        ['avatar.low.04','{name}, ufficialmente siamo usciti dalla modalità soprammobile.'],
        ['avatar.low.05','Piccolo passo registrato. Il divano è stato informato.'],
        ['avatar.low.06','Non è ancora una leggenda, ma almeno c’è una trama. 📖'],
        ['avatar.low.07','Il motore si è acceso. Evitiamo di spegnerlo al semaforo.'],
        ['avatar.low.08','Bene. Ora fai finta che fosse tutto pianificato. 😌'],
        ['avatar.low.09','Hai iniziato: statisticamente è già meglio di non iniziare.'],
        ['avatar.low.10','{name}, il bradipo che è in me concede un cenno di approvazione. 🦥'],
        ['avatar.low.11','Una casella fatta. Il perfezionismo può aspettare fuori.'],
        ['avatar.low.12','Siamo in movimento. Piano, ma con dignità.'],
        ['avatar.low.13','Il progresso ha bussato. Per una volta hai aperto. 😂'],
        ['avatar.low.14','Non correre: accumula vittorie piccole e irritantemente efficaci.'],
        ['avatar.low.15','La giornata sta prendendo forma. Strano, eh?'],
        ['avatar.low.16','Hai rotto l’inerzia. Quella era la parte antipatica.'],
        ['avatar.low.17','{name}, continua così e dovrò smettere di prenderti in giro. Forse.'],
        ['avatar.low.18','Primo livello superato. Nessun boss finale, promesso. 🎮'],
        ['avatar.low.19','Poco fatto, ma fatto davvero. Questo conta.'],
        ['avatar.low.20','Il divano perde terreno. Non dirglielo troppo forte.']
      ],
      mid:[
        ['avatar.mid.01','Metà strada circa. Il divano inizia a preoccuparsi. 😌'],
        ['avatar.mid.02','Abbastanza per vantarmi, non abbastanza per mollare. 😏'],
        ['avatar.mid.03','Qui si comincia a ragionare. 💪'],
        ['avatar.mid.04','{name}, sei nella zona pericolosa: quella in cui funziona davvero.'],
        ['avatar.mid.05','Metà fatta. Le scuse hanno perso la maggioranza.'],
        ['avatar.mid.06','Ora fermarsi sarebbe una scelta creativa. Non farla. 😂'],
        ['avatar.mid.07','Il grafico sale e improvvisamente sembri una persona organizzata.'],
        ['avatar.mid.08','Siamo oltre il riscaldamento psicologico. Bene così.'],
        ['avatar.mid.09','La parte difficile era partire. Adesso resta solo… il resto. 😎'],
        ['avatar.mid.10','{name}, il bradipo è confuso: stai facendo sul serio.'],
        ['avatar.mid.11','Progresso concreto. Puoi già guardare male il te di stamattina.'],
        ['avatar.mid.12','Metà percorso, zero bisogno di diventare un monaco guerriero.'],
        ['avatar.mid.13','Stai accumulando abbastanza punti da sbloccare “persona affidabile”. 🎮'],
        ['avatar.mid.14','Non male. Ho visto lunedì peggiori.'],
        ['avatar.mid.15','La giornata ha smesso di essere una bozza.'],
        ['avatar.mid.16','Continua: il 70% è dietro l’angolo a fare il brillante.'],
        ['avatar.mid.17','{name}, ormai puoi finire per pura testardaggine.'],
        ['avatar.mid.18','Il ritmo c’è. Non serve accelerare, serve non sparire.'],
        ['avatar.mid.19','Metà strada: abbastanza lontano dall’inizio, abbastanza vicino al premio.'],
        ['avatar.mid.20','Hai fatto troppo per poter dire “oggi niente”. Mi spiace. 😌']
      ],
      high:[
        ['avatar.high.01','Quasi tutto fatto. Fermarsi ora sarebbe imbarazzante. 😂'],
        ['avatar.high.02','Sto volando. Qualcuno avvisi il me di stamattina. 🚀'],
        ['avatar.high.03','Il 100% mi sta già facendo l’occhiolino. 😎'],
        ['avatar.high.04','{name}, ormai il divano può solo sperare in un colpo di scena.'],
        ['avatar.high.05','Sei quasi alla fine. Non trasformare il finale in una trilogia.'],
        ['avatar.high.06','Molto bene. Sto finendo le battute sarcastiche, ed è grave.'],
        ['avatar.high.07','Hai fatto il grosso. Ora rifinisci il lavoro come una persona sospettosamente efficiente.'],
        ['avatar.high.08','Il traguardo è lì. Sì, quello che fingevi di non vedere.'],
        ['avatar.high.09','{name}, manca poco: il bradipo ha già preparato i coriandoli. 🦥'],
        ['avatar.high.10','Quasi completo. La tua versione pigra sta chiedendo il VAR.'],
        ['avatar.high.11','A questo punto mollare richiederebbe più creatività che finire.'],
        ['avatar.high.12','Il 100% è a distanza di una pessima scusa.'],
        ['avatar.high.13','Prestazione sospettosamente adulta. Continua.'],
        ['avatar.high.14','Ci siamo quasi. Puoi già sentire il rumore del check finale.'],
        ['avatar.high.15','Il grafico è alto. Anche le aspettative, adesso. 😏'],
        ['avatar.high.16','{name}, oggi stai rendendo difficile il mio lavoro di prenderti in giro.'],
        ['avatar.high.17','Manca il dettaglio finale. E no, “domani” non è un dettaglio.'],
        ['avatar.high.18','Quasi missione compiuta. Il divano ha smesso di scrivere.'],
        ['avatar.high.19','Hai costruito troppo slancio per parcheggiare adesso.'],
        ['avatar.high.20','Ultimo tratto. Elegante o brutto, basta chiuderlo.']
      ],
      full:[
        ['avatar.full.01','Oggi ho fatto tutto. Posso andare in pensione. 🏖️'],
        ['avatar.full.02','100%. Chiamate il museo: questa giornata va esposta. 🏆'],
        ['avatar.full.03','Missione completata. Ora posso giudicare il me di ieri. 😌'],
        ['avatar.full.04','{name}, oggi il bradipo che è in me ti porta rispetto. 🦥'],
        ['avatar.full.05','Tutto fatto. Le scuse sono state gentilmente accompagnate all’uscita.'],
        ['avatar.full.06','100%. Non montarti la testa, ma sì: gran giornata.'],
        ['avatar.full.07','Hai chiuso il cerchio. Ora recupero senza sensi di colpa.'],
        ['avatar.full.08','Obiettivi completati. Il divano può finalmente riaverti. 😂'],
        ['avatar.full.09','{name}, questa volta non ho niente da criticare. Situazione inquietante.'],
        ['avatar.full.10','Giornata completata. Screenshot mentale e si replica quando serve.'],
        ['avatar.full.11','Il 100% esiste davvero. Testimoni presenti.'],
        ['avatar.full.12','Hai fatto tutto. Adesso il riposo è parte del piano, non una fuga.'],
        ['avatar.full.13','Prestazione premium. Abbonamento alla costanza non ancora incluso. 😏'],
        ['avatar.full.14','Missione chiusa. Nessun DLC richiesto. 🎮'],
        ['avatar.full.15','{name}, oggi hai vinto tu. Domani si rinegozia.'],
        ['avatar.full.16','Tutto verde. Puoi smettere di fissare le percentuali adesso.'],
        ['avatar.full.17','Obiettivi presi. Bradipo soddisfatto, ego sotto osservazione.'],
        ['avatar.full.18','100%: efficiente, pulito, quasi sospetto.'],
        ['avatar.full.19','Fine giornata con tutti i check. Il futuro te ringrazia in silenzio.'],
        ['avatar.full.20','Hai completato tutto. Ora fai la cosa rivoluzionaria: riposati.']
      ]
    };
    let homeAvatarQuipIndex=0;
    let avatarTapTimes=[];
    let avatarSecretUntil=0;

    function getHomeAvatarBucket(p){return p>=100?'full':p>=70?'high':p>=40?'mid':p>0?'low':'zero'}

    function getAvatarUserName(){
      try{
        const p=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
        const raw=p?.given_name||p?.name||'';
        if(raw)return String(raw).trim().split(/\s+/)[0];
      }catch(_){}
      try{
        const token=localStorage.getItem('google_id_token')||sessionStorage.getItem('google_id_token');
        const p=token&&typeof parseJwt==='function'?parseJwt(token):null;
        const raw=p?.given_name||p?.name||'';
        if(raw)return String(raw).trim().split(/\s+/)[0];
      }catch(_){}
      return '';
    }

    function avatarQuipText(entry){
      if(!entry)return '';
      const name=getAvatarUserName()||tr('campione');
      return tk(entry[0],entry[1],{name});
    }

    function avatarTimeZeroQuip(){
      const h=new Date().getHours();
      const name=getAvatarUserName()||tr('campione');
      if(h>=6&&h<=9)return tk('avatar.time.morning.zero','Ancora sonno? Ti capisco, ma un piccolo passo cambierà la giornata!',{name});
      if(h>=22||h<1)return tk('avatar.time.late.zero','Oggi è andata così, domani ti rifarai! Ora riposati.',{name});
      return '';
    }

    function renderHomeAvatar(){
      const p=(()=>{try{const g=getDayGamification(homeSelectedDate||currentLocalDateStr());return g.total?Math.round(g.done/g.total*100):0}catch(_){return 0}})();
      const b=getHomeAvatarBucket(p),arr=HOME_AVATAR_QUIPS[b],pc=document.getElementById('home-avatar-percent'),q=document.getElementById('home-avatar-quips');
      if(pc)pc.textContent=`${p}% ${tr('completato')}`;
      if(q){
        let message='';
        if(Date.now()<avatarSecretUntil)message=tk('avatar.secret.tickles','Ehi! Smetti di solleticarmi e vai a fare i tuoi esercizi! 😂');
        else if(p===0&&homeAvatarQuipIndex===0)message=avatarTimeZeroQuip();
        if(!message)message=avatarQuipText(arr[homeAvatarQuipIndex%arr.length]);
        q.textContent=message;
      }
      const homeCard=document.querySelector('.home-avatar-card');if(homeCard)homeCard.dataset.progress=getHomeAvatarBucket(p);
      const avatarDay=homeSelectedDate||currentLocalDateStr(),celebrateKey=`thalys_avatar_celebrated_${avatarDay}`;
      if(p>=100&&!localStorage.getItem(celebrateKey)){
        localStorage.setItem(celebrateKey,'1');
        setTimeout(()=>{const a=document.getElementById('home-avatar-mini'),s=document.getElementById('home-avatar-sparkle');a?.classList.add('avatar-bounce');if(s){s.classList.remove('hidden');s.classList.add('avatar-sparkle');setTimeout(()=>s.classList.add('hidden'),800)}},120);
      }
      const source=document.getElementById('avatar-art-svg'),mini=document.getElementById('home-avatar-mini');
      const currentAvatarGender=normalizeProfileGenderValue(appState.profile?.gender)==='female'?'femmina':'maschio';
      avatarSetArtwork(currentAvatarGender);
      if(source&&mini){
        const c=source.cloneNode(true);c.removeAttribute('id');c.style.width='100%';c.style.height='100%';
        c.querySelector('#avatar-measures-overlay')?.remove();c.querySelector('#avatar-thought-bubble')?.remove();
        mini.innerHTML='';mini.appendChild(c);
      }
    }

    function interactHomeAvatar(){
      const now=Date.now();
      avatarTapTimes=avatarTapTimes.filter(t=>now-t<=5000);
      avatarTapTimes.push(now);
      const a=document.getElementById('home-avatar-mini'),s=document.getElementById('home-avatar-sparkle');
      a?.classList.remove('avatar-bounce');void a?.offsetWidth;a?.classList.add('avatar-bounce');
      if(s){s.classList.remove('hidden','avatar-sparkle');void s.offsetWidth;s.classList.add('avatar-sparkle');setTimeout(()=>s.classList.add('hidden'),720)}
      if(avatarTapTimes.length>=10){
        avatarTapTimes=[];
        avatarSecretUntil=Date.now()+7000;
        renderHomeAvatar();
        try{navigator.vibrate?.([35,30,35])}catch(_){}
        return;
      }
      const p=(()=>{try{const g=getDayGamification(homeSelectedDate||currentLocalDateStr());return g.total?Math.round(g.done/g.total*100):0}catch(_){return 0}})();
      const arr=HOME_AVATAR_QUIPS[getHomeAvatarBucket(p)];
      homeAvatarQuipIndex=(homeAvatarQuipIndex+1)%arr.length;
      renderHomeAvatar();try{navigator.vibrate?.(30)}catch(_){}
    }


    function getSmartWorkoutStreak(referenceDate=currentLocalDateStr()){
      const active=getActiveWorkoutPlan();if(!active)return 0;
      let streak=0,started=false;
      for(let i=0;i<120;i++){
        const d=new Date(referenceDate+'T12:00:00');d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);
        const ex=getExercisesForDate(active,ds);
        if(!ex.length)continue; // scheduled rest never breaks the streak
        started=true;
        const c=getWorkoutCompletion(ds,active.id),done=ex.length>0&&ex.every(x=>c?.exercises?.[x.id]);
        if(done)streak++;else break;
      }
      return started?streak:0;
    }
    function getWeekSnapshot(referenceDate=currentLocalDateStr()){
      const dates=[];for(let i=0;i<7;i++){const d=new Date(referenceDate+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10))}
      const active=getActiveWorkoutPlan();
      let workouts=0,scheduled=0,hydrated=0,mind=0;
      dates.forEach(ds=>{
        if(active){
          const ex=getExercisesForDate(active,ds);
          if(ex.length){scheduled++;const c=getWorkoutCompletion(ds,active.id);if(ex.every(x=>c?.exercises?.[x.id]))workouts++}
        }else if((appState.workouts||[]).some(x=>x.date===ds))workouts++;
        if(Number(appState.water?.[ds]||0)>=getWaterTarget(ds)*.8)hydrated++;
        if((appState.meditation||[]).some(x=>x.date===ds))mind++;
      });
      return {workouts,scheduled,hydrated,mind};
    }
    function renderPremiumCoach(referenceDate=currentLocalDateStr()){
      const now=new Date(),h=now.getHours();
      const coachKey=h<12?'coach.morning':h<18?'coach.afternoon':'coach.evening';
      const title=document.getElementById('home-coach-title'),copy=document.getElementById('home-coach-text');
      if(title)title.textContent=tk('home.daily_coach','Coach del giorno');
      if(copy)copy.textContent=tk(coachKey,'');
      const streak=getSmartWorkoutStreak(referenceDate),ss=document.getElementById('home-smart-streak');
      if(ss)ss.textContent=streak;
      const sl=document.getElementById('smart-streak-label');if(sl)sl.textContent=tk('home.smart_streak','Streak intelligente');
      const sd=document.getElementById('smart-streak-days');if(sd)sd.textContent=tr('giorni');
      const snap=getWeekSnapshot(referenceDate),mini=document.getElementById('home-weekly-mini'),wl=document.getElementById('weekly-insight-label');
      if(wl)wl.textContent=tk('home.weekly_insight','Insight settimanale');
      if(mini){
        mini.textContent=`${snap.workouts} ${tr('Allenamenti completati')} · ${snap.hydrated} ${tr('giorni idratati')} · ${snap.mind} ${tr('sessioni mente')}`;
      }
      const total=snap.workouts+snap.hydrated+snap.mind;
      let insightKey='insight.none';
      if(total>=9)insightKey='insight.good';else if(snap.hydrated<3&&total>0)insightKey='insight.hydration';else if(snap.mind<2&&total>0)insightKey='insight.mind';
      maybeCreateWeeklyInsightMessage(referenceDate,tk(insightKey,''));
      applyHomeFocus();
    }
    function toggleHomeFocus(){
      appState.settings={...(appState.settings||{}),focusMode:!appState.settings?.focusMode};
      saveStateToLocal();applyHomeFocus();
    }

    function updateOptionsFocusToggle(){
      const b=document.getElementById('options-focus-toggle'),dot=b?.querySelector('span'),on=!!appState.settings?.focusMode;
      if(!b||!dot)return;
      b.classList.toggle('bg-cyan-500/20',on);b.classList.toggle('border-cyan-400/40',on);
      dot.classList.toggle('translate-x-5',on);dot.classList.toggle('bg-cyan-300',on);dot.classList.toggle('bg-slate-400',!on);
    }

    function applyHomeFocus(){
      const on=!!appState.settings?.focusMode,tab=document.getElementById('tab-home'),btn=document.getElementById('home-focus-toggle');
      tab?.classList.toggle('focus-mode',on);btn?.classList.toggle('active',on);updateOptionsFocusToggle();
      const span=btn?.querySelector('span');if(span)span.textContent=on?tr('Esci da Focus'):tr('Apri Focus');
    }

    function renderHomeDashboard(){
      const d=homeSelectedDate || new Date().toISOString().split('T')[0];
      const workouts=(appState.workouts||[]).filter(x=>x.date===d), nutrition=(appState.nutrition||[]).filter(x=>x.date===d);
      const kcal=nutrition.reduce((s,x)=>s+Number(x.kcal||0),0), water=Number((appState.water||{})[d]||0), target=appState.targets||{};
      const w=(appState.wellness||[]).find(x=>x.date===d), med=(appState.meditation||[]).filter(x=>x.date===d).reduce((s,x)=>s+Number(x.minutes||0),0);
      const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      const hp=document.getElementById('home-date-picker'); if(hp) hp.value=d;
      set('home-date',new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
      const waterTarget=getWaterTarget(d); set('home-water',`${water} ml`);set('home-water-target',`/ ${waterTarget} ml`);set('home-kcal',Math.round(kcal));set('home-kcal-target',`/ ${target.calories||2200} kcal`);set('home-workout-count',workouts.length);set('home-readiness',w?`${w.readiness}/10`:'—');set('home-sleep',w?`${w.sleepHours} h`:'—');set('home-recovery',w?`${w.recovery}/10`:'—');set('home-mood',w?`${w.mood}/10`:'—');set('home-stress',w?`${w.stress}/10`:'—');set('home-med-today',`${med} min`);
      const arr=Array.isArray(appState.meditation)?appState.meditation:[]; let streak=0; for(let i=0;i<365;i++){const dd=new Date();dd.setDate(dd.getDate()-i);const ds=dd.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;} set('home-med-streak',`${tr('Streak')}: ${streak} ${tr('giorni')}`);
      [['home-sleep-bar',w?Math.min(100,(Number(w.sleepHours)/8)*100):0],['home-recovery-bar',w?Number(w.recovery)*10:0],['home-mood-bar',w?Number(w.mood)*10:0],['home-stress-bar',w?Number(w.stress)*10:0]].forEach(([id,width])=>{const e=document.getElementById(id);if(e)e.style.width=width+'%';});
      const g=getDayGamification(d);
      const activePlanForHome=getActiveWorkoutPlan();
      const scheduledForHome=isPlanScheduledOnDate(activePlanForHome,d);
      if(activePlanForHome && !scheduledForHome){
        set('home-workout-count',tk('home.rest_today','Oggi riposo'));
        const hwc=document.getElementById('home-workout-count'); if(hwc){hwc.classList.add('text-sm');hwc.classList.remove('text-lg');}
        set('home-workout-label','');
      }else{
        set('home-workout-count', g.plan ? `${g.exerciseDone}/${g.exerciseTotal}` : workouts.length);
        const hwc=document.getElementById('home-workout-count'); if(hwc){hwc.classList.add('text-lg');hwc.classList.remove('text-sm');}
        set('home-workout-label',tr('esercizi'));
      }
      const pe=document.getElementById('home-priorities');
      if(pe){pe.innerHTML=`<div class="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3"><div class="flex justify-between"><span class="font-bold text-white">Progressione giornata</span><span class="font-black text-cyan-300">${g.done}/${g.total}</span></div><div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full" style="width:${Math.round(g.done/g.total*100)}%"></div></div><div class="mt-2 grid grid-cols-1 gap-1">${g.steps.map(x=>`<div class="flex items-center gap-2 text-[10px]"><i class="fa-solid ${x.done?'fa-circle-check text-emerald-400':'fa-circle text-slate-600'}"></i><span class="${x.done?'text-emerald-300':'text-slate-400'}">${x.label}</span></div>`).join('')}</div></div>`;}
      const ie=document.getElementById('home-insight'); if(ie){
        ie.textContent=g.workoutDone
          ? `${tr('Scheda completata: ottimo lavoro.')} ${g.done}/${g.total}`
          : (g.plan
              ? `${g.exerciseDone}/${g.exerciseTotal} ${tr('esercizi')} · ${Math.max(0,g.exerciseTotal-g.exerciseDone)} ${tr('Da fare')}`
              : tr('Nessuna scheda assegnata per questa data.'));
      }
      const sb=document.getElementById('home-sync-badge');if(sb){sb.textContent=getAccessToken()?'Drive':'Locale';sb.className=`rounded-full px-2.5 py-1 text-[9px] ${getAccessToken()?'bg-emerald-500/10 text-emerald-300':'bg-slate-900/70 text-slate-400'}`;}
      renderHomeAvatar();
      renderPremiumCoach(d);
    }
    function renderTodayDashboard(){ renderHomeDashboard(); }


    function renderTodayDashboard(){const d=new Date().toISOString().split('T')[0];const workouts=(appState.workouts||[]).filter(x=>x.date===d);const kcal=(appState.nutrition||[]).filter(x=>x.date===d).reduce((s,x)=>s+Number(x.kcal||0),0);const water=Number((appState.water||{})[d]||0);const w=(appState.wellness||[]).find(x=>x.date===d);document.getElementById('dash-workout')?.replaceChildren(document.createTextNode(`${workouts.length} ${workouts.length===1?'sessione':'esercizi'}`));document.getElementById('dash-kcal')?.replaceChildren(document.createTextNode(`${Math.round(kcal)} kcal`));document.getElementById('dash-water')?.replaceChildren(document.createTextNode(`${water} ml`));document.getElementById('dash-readiness')?.replaceChildren(document.createTextNode(w?`${w.readiness} / 10`:'— / 10'));const b=document.getElementById('today-sync-badge');if(b){b.textContent=getAccessToken()?'Drive':'Locale';b.className=`text-[9px] px-2 py-1 rounded-full ${getAccessToken()?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}`;} renderHomeDashboard();}

    function renderNutrition() {
      const selectedDate = document.getElementById('nutrition-date').value;
      const container = document.getElementById('meals-container');
      container.innerHTML = '';

      const dayLogs = appState.nutrition.filter(n => n.date === selectedDate);
      const waterVal = appState.water[selectedDate] || 0;
      document.getElementById('water-amount').textContent = waterVal;
      const waterTarget=getWaterTarget(selectedDate);const waterTargetEl=document.getElementById('water-target-display'); if(waterTargetEl) waterTargetEl.textContent=waterTarget;const waterBar=document.getElementById('water-progress-bar');if(waterBar)waterBar.style.width=`${Math.min(100,waterTarget>0?(waterVal/waterTarget)*100:0)}%`;
      const latestWeight=(appState.bodyMetrics||[]).filter(x=>x.date<=selectedDate&&Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]?.weight || appState.profile?.weight || 70;
      const smartProtein=Math.round(latestWeight*1.6), smartWater=getWaterTarget(selectedDate);
      const smart=document.getElementById('nutrition-smart-targets'); if(smart) smart.innerHTML=`<div class="flex items-center gap-2"><i class="fa-solid fa-wand-magic-sparkles text-cyan-400"></i><span class="text-xs font-bold text-white">Target pratici stimati</span><span class="text-[9px] text-slate-500">peso ${latestWeight} kg</span></div><div class="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Proteine</span><div class="font-black text-emerald-300">~${smartProtein} g/die</div><div class="text-[8px] text-slate-500">1,6 g/kg · allenamento di forza</div></div><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Acqua</span><div class="font-black text-blue-300">~${smartWater} ml/die</div><div class="text-[8px] text-slate-500">target impostato · modificabile</div></div></div>`;

      let totalKcal=0,totalP=0,totalC=0,totalF=0,totalSatFat=0,totalSugars=0,totalCalcium=0,totalMagnesium=0,totalZinc=0,totalFiber=0,totalSalt=0,totalIron=0,totalPotassium=0;
      dayLogs.forEach(l=>{totalKcal+=Number(l.kcal||0);totalP+=Number(l.p||0);totalC+=Number(l.c||0);totalF+=Number(l.f||0);totalSatFat+=Number(l.satFat||0);totalSugars+=Number(l.sugars||0);totalCalcium+=Number(l.calcium||0);totalMagnesium+=Number(l.magnesium||0);totalZinc+=Number(l.zinc||0);totalFiber+=Number(l.fiber||0);totalSalt+=Number(l.salt||0);totalIron+=Number(l.iron||0);totalPotassium+=Number(l.potassium||0);});
      const vitId=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsId),'id'),vitLip=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsLip),'lip');
      const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      setText('summary-calories',Math.round(totalKcal));setText('summary-p',Math.round(totalP));setText('summary-c',Math.round(totalC));setText('summary-f',Math.round(totalF));setText('summary-sat-fat',Number(totalSatFat.toFixed(1)));setText('summary-sugars',Number(totalSugars.toFixed(1)));setText('summary-calcium',Math.round(totalCalcium));setText('summary-magnesium',Math.round(totalMagnesium));setText('summary-zinc',Number(totalZinc.toFixed(1)));setText('summary-fiber',Number(totalFiber.toFixed(1)));setText('summary-salt',Number(totalSalt.toFixed(2)));setText('summary-iron',Number(totalIron.toFixed(1)));setText('summary-potassium',Math.round(totalPotassium));setText('summary-vitamins-id',vitId||'—');setText('summary-vitamins-lip',vitLip||'—');
      const target=appState.targets||{};const items=[['bar-p',totalP,target.p||150],['bar-c',totalC,target.c||250],['bar-f',totalF,target.f||70],['bar-sat-fat',totalSatFat,target.satFat||20],['bar-sugars',totalSugars,target.sugars||50],['bar-fiber',totalFiber,target.fiber||30],['bar-calcium',totalCalcium,target.calcium||1000],['bar-magnesium',totalMagnesium,target.magnesium||350],['bar-zinc',totalZinc,target.zinc||11],['bar-iron',totalIron,target.iron||11],['bar-potassium',totalPotassium,target.potassium||3500],['bar-salt',totalSalt,target.salt||5]];items.forEach(([id,v,t])=>{const e=document.getElementById(id);if(e)e.style.width=`${Math.min(100,t>0?(v/t)*100:0)}%`;});

      const weeklySummary = computeWeeklyNutritionSummary(selectedDate);
      const summaryCard = document.getElementById('nutrition-week-summary');
      if (summaryCard) {
        summaryCard.innerHTML = `
          <div class="text-[11px] text-slate-300">
            <div class="flex items-center justify-between gap-2">
              <div class="font-bold text-white">${tr('Riepilogo settimanale')}</div>
              <div class="text-[9px] text-slate-500">${weeklySummary.trackedDays}/7 ${tr('giorni registrati')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Equilibrio')}</div><div class="mt-1 text-xl font-black ${weeklySummary.compliance >= 70 ? 'text-emerald-300' : 'text-amber-300'}">${weeklySummary.compliance}%</div></div>
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Priorità')}</div><div class="mt-1 text-[10px] font-bold leading-relaxed text-slate-300">${weeklySummary.missing.join(' · ') || tr('Nessun deficit rilevato')}</div></div>
            </div>
          </div>`;
      }

      setText('summary-vitamins-id-count',`${vitId?vitId.split(/\s+/).filter(Boolean).length:0}/9`);
      setText('summary-vitamins-lip-count',`${vitLip?vitLip.split(/\s+/).filter(Boolean).length:0}/4`);
      renderNutritionAnalytics(
        weeklySummary,
        {kcal:totalKcal,p:totalP,c:totalC,f:totalF,satFat:totalSatFat,sugars:totalSugars,fiber:totalFiber,calcium:totalCalcium,magnesium:totalMagnesium,zinc:totalZinc,iron:totalIron,potassium:totalPotassium,salt:totalSalt},
        vitId,vitLip,waterVal,waterTarget
      );

      // Meal Groupings
      const meals = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
      meals.forEach(mealType => {
        const mealLogs = dayLogs.filter(l => l.meal === mealType);
        let mealKcal = 0;
        mealLogs.forEach(l => mealKcal += l.kcal);

        const card = document.createElement('div');
        card.className = "bg-darkcard border border-darkborder rounded-2xl p-4 space-y-3";
        card.innerHTML = `
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <span class="text-sm font-bold text-white flex items-center space-x-2">
              <i class="fa-solid fa-circle-dot text-[10px] text-emerald-400"></i>
              <span>${mealType}</span>
              <button type="button" onclick="openFoodForMeal('${mealType}')" class="meal-add-circle bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" aria-label="Aggiungi a ${mealType}"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </span>
            <span class="text-xs font-semibold text-emerald-400">${mealKcal} kcal</span>
          </div>

          <div class="space-y-2">
            ${mealLogs.length === 0 ? `<div class="text-[11px] text-slate-500 italic">${tk('nutrition.no_food','Nessun alimento')}</div>` : ''}
            ${mealLogs.map(l => `
              <div class="flex items-center justify-between text-xs bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <div>
                  <div class="font-bold text-slate-200">${l.name} <span class="text-[10px] text-slate-400 font-normal">(${l.grams}g)</span></div>
                  <div class="text-[10px] text-slate-400">P ${Number(l.p||0).toFixed(1)}g · C ${Number(l.c||0).toFixed(1)}g · G ${Number(l.f||0).toFixed(1)}g · Sat ${Number(l.satFat||0).toFixed(1)}g</div><div class="text-[9px] leading-relaxed text-slate-500">Ca ${Math.round(Number(l.calcium||0))}mg · Mg ${Math.round(Number(l.magnesium||0))}mg · Zn ${Number(l.zinc||0).toFixed(1)}mg · Fe ${Number(l.iron||0).toFixed(1)}mg · K ${Math.round(Number(l.potassium||0))}mg</div><div class="text-[9px] text-slate-500">Sale ${Number(l.salt||0).toFixed(2)}g · Vit ID ${l.vitaminsId||'—'} · Vit LIP ${l.vitaminsLip||'—'}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-300">${l.kcal} kcal</span>
                  <button onclick="deleteFoodLog('${l.id}')" class="text-slate-600 hover:text-red-400">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(card);
      });
    }

    // ----------------------------------------------------
    // FOOD PRESETS LOGIC
    // ----------------------------------------------------
    function normalizeFoodPreset(item){return {
      name:String(item?.name||'').trim(),kcal:Number(item?.kcal)||0,p:Number(item?.p)||0,c:Number(item?.c)||0,f:Number(item?.f)||0,
      satFat:Number(item?.satFat ?? item?.saturatedFat)||0,sugars:Number(item?.sugars)||0,calcium:Number(item?.calcium)||0,magnesium:Number(item?.magnesium)||0,zinc:Number(item?.zinc)||0,
      fiber:Number(item?.fiber)||0,salt:Number(item?.salt)||0,iron:Number(item?.iron)||0,potassium:Number(item?.potassium)||0,
      vitaminsId:normalizeVitaminCodes(item?.vitaminsId ?? item?.vitaminsID ?? '', 'id'),vitaminsLip:normalizeVitaminCodes(item?.vitaminsLip ?? '', 'lip')
    };}
    let editingFoodPresetIndex=null;
    const PRESET_FIELD_MAP=[['preset-name','name'],['preset-kcal','kcal'],['preset-p','p'],['preset-c','c'],['preset-f','f'],['preset-sat-fat','satFat'],['preset-sugars','sugars'],['preset-calcium','calcium'],['preset-magnesium','magnesium'],['preset-zinc','zinc'],['preset-fiber','fiber'],['preset-salt','salt'],['preset-iron','iron'],['preset-potassium','potassium'],['preset-vitamins-id','vitaminsId'],['preset-vitamins-lip','vitaminsLip']];
    function toggleFoodPresetForm(force){
      const form=document.getElementById('food-preset-form'); if(!form)return;
      const show=typeof force==='boolean'?force:form.classList.contains('hidden');
      const shell=form.closest('.food-db-shell');
      form.classList.toggle('hidden',!show);
      shell?.classList.toggle('food-form-open',show);
      if(show && editingFoodPresetIndex===null){
        const name=document.getElementById('preset-name');
        setTimeout(()=>name?.focus(),80);
      }
    }
    function resetFoodPresetForm(){editingFoodPresetIndex=null;PRESET_FIELD_MAP.forEach(([id])=>{const e=document.getElementById(id);if(e)e.value='';});}
    function editFoodPreset(index){const p=normalizeFoodPreset(appState.presets[index]);editingFoodPresetIndex=index;toggleFoodPresetForm(true);PRESET_FIELD_MAP.forEach(([id,key])=>{const e=document.getElementById(id);if(e)e.value=p[key]??'';});showToast('Modalità modifica attiva');}
    function applyPresetToForm(){
      const idx=document.getElementById('preset-select')?.value; if(idx===''||idx==null)return; const p=normalizeFoodPreset(appState.presets?.[Number(idx)]); if(!p.name)return;
      const pairs=[['food-name','name'],['food-kcal','kcal'],['food-p','p'],['food-c','c'],['food-f','f'],['food-sat-fat','satFat'],['food-sugars','sugars'],['food-calcium','calcium'],['food-magnesium','magnesium'],['food-zinc','zinc'],['food-fiber','fiber'],['food-salt','salt'],['food-iron','iron'],['food-potassium','potassium'],['food-vitamins-id','vitaminsId'],['food-vitamins-lip','vitaminsLip']];
      pairs.forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=p[key]??'';}); updateFoodDosePreview();
    }
    function recalcFoodMacros(){ applyPresetToForm(); }
    function saveFoodPreset(e){
      e.preventDefault(); const raw={}; PRESET_FIELD_MAP.forEach(([id,key])=>raw[key]=document.getElementById(id)?.value||''); const p=normalizeFoodPreset(raw); if(!p.name)return;
      if(editingFoodPresetIndex===null)appState.presets.push(p);else appState.presets[editingFoodPresetIndex]=p; persistFoodDatabase();renderPresets();resetFoodPresetForm();toggleFoodPresetForm(false);renderNutrition();renderHomeDashboard();showToast('Alimento salvato ✓ · sincronizzazione avviata','fa-bookmark');
    }
    function deletePreset(index){if(!confirm(`Eliminare ${appState.presets[index]?.name||'questo alimento'}?`))return;appState.presets.splice(index,1);saveStateToLocal();renderPresets();}
    function renderPresets(){
      const list=document.getElementById('presets-list'),selectContainer=document.getElementById('preset-select-container'),select=document.getElementById('preset-select');if(!list||!select)return;list.innerHTML='';select.innerHTML='<option value="">-- Seleziona un Preset --</option>';selectContainer?.classList.toggle('hidden',!(appState.presets||[]).length);
      (appState.presets||[]).forEach((raw,idx)=>{const p=normalizeFoodPreset(raw);appState.presets[idx]=p;const item=document.createElement('div');item.className='bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs';item.innerHTML=`<div class="flex justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-200">${p.name}</div><div class="text-[10px] text-slate-400">${p.kcal} kcal · P ${p.p}g · C ${p.c}g · G ${p.f}g · Sat ${p.satFat}g · Zuc ${p.sugars}g</div><div class="text-[10px] text-slate-500">Fibre ${p.fiber}g · Sale ${p.salt}g · Ca ${p.calcium}mg · Mg ${p.magnesium}mg · Zn ${p.zinc}mg · Fe ${p.iron}mg · K ${p.potassium}mg</div><div class="text-[10px] text-slate-500">Vit ID ${p.vitaminsId||'—'} · Vit LIP ${p.vitaminsLip||'—'} / 100g</div></div><div class="flex gap-1"><button onclick="editFoodPreset(${idx})" class="text-cyan-400 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="deletePreset(${idx})" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></div></div>`;list.appendChild(item);const opt=document.createElement('option');opt.value=idx;opt.textContent=`${p.name} (${p.kcal} kcal/100g)`;select.appendChild(opt);});
    }

    function saveTargets(e) {
      e.preventDefault();
      appState.targets = {
        calories: parseInt(document.getElementById('target-input-kcal').value) || 2000,
        p: parseInt(document.getElementById('target-input-p').value) || 150,
        c: parseInt(document.getElementById('target-input-c').value) || 200,
        f: parseInt(document.getElementById('target-input-f').value) || 60,
        satFat: parseFloat(document.getElementById('target-input-sat-fat').value) || 20,
        sugars: parseInt(document.getElementById('target-input-sugars').value) || 50,
        calcium: parseInt(document.getElementById('target-input-calcium').value) || 1000,
        magnesium: parseInt(document.getElementById('target-input-magnesium').value) || 350,
        zinc: parseFloat(document.getElementById('target-input-zinc').value) || 11,
        fiber: parseInt(document.getElementById('target-input-fiber').value) || 30,
        salt: parseFloat(document.getElementById('target-input-salt').value) || 5,
        iron: parseFloat(document.getElementById('target-input-iron').value) || 11,
        potassium: parseInt(document.getElementById('target-input-potassium').value) || 3500
      };
      appState.targetsConfirmed=true;
      saveStateToLocal();refreshProfileMessageCompletion();
      loadTargetsUI();
      renderNutrition();
      closeModal('target-modal');
      showToast('Obiettivi aggiornati!');
    }

    function loadTargetsUI() {
      const t = appState.targets;
      document.getElementById('target-calories').textContent = t.calories;
      document.getElementById('target-p').textContent = t.p;
      document.getElementById('target-c').textContent = t.c;
      document.getElementById('target-f').textContent = t.f;
      document.getElementById('target-sat-fat').textContent = t.satFat || 20;
      document.getElementById('target-sugars').textContent = t.sugars || 50;
      document.getElementById('target-calcium').textContent = t.calcium || 1000;
      document.getElementById('target-magnesium').textContent = t.magnesium || 350;
      document.getElementById('target-zinc').textContent = t.zinc || 11;
      document.getElementById('target-fiber').textContent = t.fiber || 30;
      document.getElementById('target-salt').textContent = t.salt || 5;
      document.getElementById('target-iron').textContent = t.iron || 11;
      document.getElementById('target-potassium').textContent = t.potassium || 3500;

      document.getElementById('target-input-kcal').value = t.calories;
      document.getElementById('target-input-p').value = t.p;
      document.getElementById('target-input-c').value = t.c;
      document.getElementById('target-input-f').value = t.f;
      document.getElementById('target-input-sat-fat').value = t.satFat || 20;
      document.getElementById('target-input-sugars').value = t.sugars || 50;
      document.getElementById('target-input-calcium').value = t.calcium || 1000;
      document.getElementById('target-input-magnesium').value = t.magnesium || 350;
      document.getElementById('target-input-zinc').value = t.zinc || 11;
      document.getElementById('target-input-fiber').value = t.fiber || 30;
      document.getElementById('target-input-salt').value = t.salt || 5;
      document.getElementById('target-input-iron').value = t.iron || 11;
      document.getElementById('target-input-potassium').value = t.potassium || 3500;
    }

    // Body/profile logic moved to js/body.js in v0.28.

    // ----------------------------------------------------
    // ANALYTICS & CHARTS (Chart.js)
    // ----------------------------------------------------
    let analyticsSelectedDate = new Date().toISOString().split('T')[0];
    function setAnalyticsDate(date){if(!date)return;analyticsSelectedDate=date;const p=document.getElementById('analytics-date-picker');if(p)p.value=date;const l=document.getElementById('analytics-date-label');if(l)l.textContent=weekdayLabel(date);renderWellnessSummary();updateAnalyticsCharts();}
    let chartEx = null;
    let chartWeight = null;
    let chartNutr = null;
    let chartWellness = null;
    let chartConsistency = null;
    let chartBodyMeasurements = null;

    function getWellnessSeries(range = 'week', metric = 'sleep') {
      const af=getAnalyticsFilter();
      const metricKey = metric === 'sleep' ? 'sleepHours' : metric;
      const entries = [...(appState.wellness || [])]
        .filter(e=>af.value==='all'||af.allowedDates.has(e.date))
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
      const endDate = new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T12:00:00');
      const iso=d=>d.toISOString().split('T')[0];
      const exactValue=date=>{const item=entries.find(e=>e.date===date);return item?Number(item[metricKey]||0):0;};
      if(range==='day'){
        const d=iso(endDate);return {labels:[new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})],values:[exactValue(d)]};
      }
      if(range==='week'){
        const dates=[];for(let i=6;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'short',day:'2-digit'})),values:dates.map(exactValue)};
      }
      if(range==='month'){
        const dates=[];for(let i=29;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})),values:dates.map(exactValue)};
      }
      const months=[];for(let i=11;i>=0;i--){months.push(new Date(endDate.getFullYear(),endDate.getMonth()-i,1));}
      return {labels:months.map(d=>d.toLocaleDateString(currentLocale(),{month:'short',year:'2-digit'})),values:months.map(d=>{const y=d.getFullYear(),m=d.getMonth();const batch=entries.filter(e=>{const x=new Date(e.date+'T12:00:00');return x.getFullYear()===y&&x.getMonth()===m;});return batch.length?Number((batch.reduce((a,e)=>a+Number(e[metricKey]||0),0)/batch.length).toFixed(1)):0;})};
    }

    function updateWellnessTrendChart() {
      const metric = document.getElementById('wellness-metric-filter')?.value || 'sleep';
      const range = document.getElementById('wellness-range-filter')?.value || 'week';
      const ctx = document.getElementById('wellnessTrendChart')?.getContext('2d');
      if (!ctx) return;

      const { labels, values } = getWellnessSeries(range, metric);
      const metricLabel = {
        sleep: 'Sonno (h)',
        stress: 'Stress (1-10)',
        recovery: 'Recupero (1-10)',
        mood: 'Umore (1-10)',
        readiness: 'Readiness (1-10)'
      }[metric] || 'Valore';

      const isSleep = metric === 'sleep';
      const yConfig = isSleep
        ? { min: 0, max: 12, ticks: { stepSize: 2, callback: (value) => `${value}h` } }
        : { min: 0, max: 10, ticks: { stepSize: 2, callback: (value) => `${value}` } };

      if (chartWellness) chartWellness.destroy();
      chartWellness = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: metricLabel,
            data: values,
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: {
              min: yConfig.min,
              max: yConfig.max,
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                stepSize: yConfig.ticks.stepSize,
                callback: yConfig.ticks.callback
              }
            }
          }
        }
      });
    }

    function getAnalyticsFilter(){
      const value=document.getElementById('chart-workout-filter')?.value||'all';
      const days=document.getElementById('chart-period-filter')?.value||'30';
      const end=new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T23:59:59'); const start=new Date(end);
      if(days!=='all') start.setDate(end.getDate()-Number(days)+1); else start.setTime(0);
      const periodDates=new Set(); for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) periodDates.add(d.toISOString().split('T')[0]);
      const allowedDates=new Set(value==='all' ? periodDates : (appState.workouts||[]).filter(w=>{
        if(!periodDates.has(w.date)) return false;
        const plan=(appState.workoutPlans||[]).find(p=>p.id===appState.workoutAssignments?.[w.date]);
        return w.category===value || plan?.name===value || w.name===value;
      }).map(w=>w.date));
      return {value,days,start,end,allowedDates,periodDates};
    }

    function populateAnalyticsFilter(){
      const select=document.getElementById('chart-workout-filter'); if(!select)return;
      const current=select.value||'all'; const values=new Set();
      (appState.workouts||[]).forEach(w=>{if(w.category)values.add(w.category);if(w.name)values.add(w.name); const p=appState.workoutPlans?.find(p=>p.id===appState.workoutAssignments?.[w.date]);if(p?.name)values.add(p.name);});
      select.innerHTML='<option value="all">Tutti gli allenamenti</option>'+[...values].sort().map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join('');
      if([...select.options].some(o=>o.value===current))select.value=current;
    }
    function updateAnalyticsCharts(){
      populateAnalyticsFilter();
      const f=getAnalyticsFilter(); const summary=document.getElementById('analytics-filter-summary');
      if(summary)summary.textContent=f.value==='all'?`Mostrati tutti i dati · periodo: ${f.days==='all'?'tutto':f.days+' giorni'}`:`Filtro: ${f.value} · ${f.allowedDates.size} giorni con allenamento`;
      updateExerciseChart(); updateWorkoutConsistencyChart(); updateWeightChart(); updateBodyMeasurementsChart(); updateNutritionChart(); updateWellnessTrendChart();
    }

    function updateExerciseChart(){
      const select=document.getElementById('chart-exercise-select'), ctx=document.getElementById('exerciseProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const pool=(appState.workouts||[]).filter(w=>f.value==='all'||f.allowedDates.has(w.date));
      const names=[...new Set(pool.map(w=>w.name))]; const current=select.value; select.innerHTML=names.length?names.map(n=>`<option value="${String(n).replace(/"/g,'&quot;')}">${n}</option>`).join(''):'<option value="">Nessun esercizio</option>'; if(names.includes(current))select.value=current;
      const exName=select.value; const filtered=pool.filter(w=>w.name===exName).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=filtered.map(w=>w.date), dataVolume=filtered.map(w=>(w.sets||[]).reduce((acc,s)=>acc+(Number(s.weight)||0)*(Number(s.reps)||0),0));
      if(chartEx)chartEx.destroy(); chartEx=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Volume totale (kg)',data:dataVolume,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,.15)',fill:true,tension:.3,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:(c)=>{const w=filtered[c.dataIndex];return w?.date===new Date().toISOString().split('T')[0]?'✓ Allenamento di oggi':'';}}}},scales:{x:{ticks:{color:'#64748b',font:{size:10}}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }
    function updateWorkoutConsistencyChart(){
      const ctx=document.getElementById('workoutConsistencyChart')?.getContext('2d');if(!ctx)return; const f=getAnalyticsFilter(); const labels=[],values=[];
      const days=f.days==='all'?30:Number(f.days); for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=d.toISOString().split('T')[0];labels.push(d.toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'}));const plan=getDayWorkoutPlan(iso);values.push(plan&&isWorkoutPlanCompleted(iso,plan.id)?1:((appState.workouts||[]).some(w=>w.date===iso)?0.6:0));}
      if(chartConsistency)chartConsistency.destroy(); chartConsistency=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Completamento',data:values,backgroundColor:values.map(v=>v===1?'rgba(16,185,129,.75)':v>0?'rgba(34,211,238,.55)':'rgba(71,85,105,.35)')} ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:1,ticks:{stepSize:.5,callback:v=>v===1?'Completato':v===.5?'Parziale':'—'}},x:{ticks:{color:'#64748b',font:{size:8},maxRotation:0}}}}});
    }

    function updateWeightChart() {
      const ctx = document.getElementById('weightProgressChart').getContext('2d');
      const f=getAnalyticsFilter(); const sorted = [...appState.bodyMetrics].filter(b=>f.value==='all'||f.allowedDates.has(b.date)).sort((a,b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map(b => b.date);
      const weights = sorted.map(b => b.weight);

      if (chartWeight) chartWeight.destroy();
      chartWeight = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Peso (kg)',
            data: weights,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: { ticks: { color: '#64748b', font: { size: 10 } } }
          }
        }
      });
    }

    function updateNutritionChart(){
      const ctx=document.getElementById('nutritionProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const dates=[...f.periodDates].sort(); const selected=dates.filter(d=>f.value==='all'||f.allowedDates.has(d));
      const kcalData=selected.map(d=>(appState.nutrition||[]).filter(n=>n.date===d).reduce((acc,l)=>acc+Number(l.kcal||0),0));
      if(chartNutr)chartNutr.destroy(); chartNutr=new Chart(ctx,{type:'bar',data:{labels:selected.map(d=>d.slice(5)),datasets:[{label:'Calorie assunte',data:kcalData,backgroundColor:'#10b981',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#64748b',font:{size:9},maxRotation:0}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }


    // Body history helpers moved to js/body.js in v0.28.
    function updateBodyMeasurementsChart(){
      const ctx=document.getElementById('bodyMeasurementsChart')?.getContext('2d'); if(!ctx)return;
      const selected=[...document.querySelectorAll('.body-chart-metric:checked')].map(x=>x.value);
      const f=getAnalyticsFilter();
      const rows=[...(appState.bodyMetrics||[])].filter(x=>f.periodDates.has(x.date)).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=rows.map(x=>x.date);
      const colors=['#e879f9','#22d3ee','#34d399','#f59e0b','#fb7185','#a78bfa','#60a5fa','#f472b6','#84cc16'];
      const datasets=selected.map((key,i)=>({label:bodyMetricLabel(key)+' (cm)',data:rows.map(r=>r[key]===null||r[key]===undefined?null:Number(r[key])),borderColor:colors[i%colors.length],backgroundColor:'transparent',spanGaps:true,tension:.28,pointRadius:3}));
      if(chartBodyMeasurements)chartBodyMeasurements.destroy();
      chartBodyMeasurements=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,labels:{color:'#cbd5e1',boxWidth:10,font:{size:9}}}},scales:{x:{ticks:{color:'#64748b',font:{size:9}}},y:{ticks:{color:'#64748b',font:{size:10},callback:v=>`${v} cm`}}}}});
    }

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
  
