/* Thalys v0.31 - Home domain module */
function setHomeDate(date){
      if(!date) return;
      homeSelectedDate=date;
      const hp=document.getElementById('home-date-picker'); if(hp) hp.value=date;
      const wd=document.getElementById('workout-date'); if(wd) wd.value=date;
      const nd=document.getElementById('nutrition-date'); if(nd) nd.value=date;
      updateDateLabels();renderHomeDashboard(); renderWorkouts(); renderWorkoutPlans(); renderNutrition();
      updateAnalyticsCharts();
    }

    // Workout plan/completion helpers moved to js/workout.js in v0.30.
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
        const preferred=String(window.appState?.profile?.preferredName||'').trim();
        if(preferred)return preferred;
      }catch(_){}
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
      const sb=document.getElementById('home-sync-badge');if(sb){const driveLive=navigator.onLine&&!!getAccessToken();sb.textContent=driveLive?'Drive':'Locale';sb.className=`rounded-full px-2.5 py-1 text-[9px] ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-900/70 text-slate-400'}`;}
      renderHomeAvatar();
      renderPremiumCoach(d);
    }
    function renderTodayDashboard(){ renderHomeDashboard(); }


    function renderTodayDashboard(){const d=new Date().toISOString().split('T')[0];const workouts=(appState.workouts||[]).filter(x=>x.date===d);const kcal=(appState.nutrition||[]).filter(x=>x.date===d).reduce((s,x)=>s+Number(x.kcal||0),0);const water=Number((appState.water||{})[d]||0);const w=(appState.wellness||[]).find(x=>x.date===d);document.getElementById('dash-workout')?.replaceChildren(document.createTextNode(`${workouts.length} ${workouts.length===1?'sessione':'esercizi'}`));document.getElementById('dash-kcal')?.replaceChildren(document.createTextNode(`${Math.round(kcal)} kcal`));document.getElementById('dash-water')?.replaceChildren(document.createTextNode(`${water} ml`));document.getElementById('dash-readiness')?.replaceChildren(document.createTextNode(w?`${w.readiness} / 10`:'— / 10'));const b=document.getElementById('today-sync-badge');if(b){const driveLive=navigator.onLine&&!!getAccessToken();b.textContent=driveLive?'Drive':'Locale';b.className=`text-[9px] px-2 py-1 rounded-full ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}`;} renderHomeDashboard();}

// v0.37.8: keep Home source badges aligned with the physical network immediately.
function updateHomeSourceBadgesV0376(){
  const driveLive=navigator.onLine&&typeof getAccessToken==='function'&&!!getAccessToken();
  const sb=document.getElementById('home-sync-badge');if(sb){sb.textContent=driveLive?'Drive':'Locale';sb.className=`rounded-full px-2.5 py-1 text-[9px] ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-900/70 text-slate-400'}`;}
  const tb=document.getElementById('today-sync-badge');if(tb){tb.textContent=driveLive?'Drive':'Locale';tb.className=`text-[9px] px-2 py-1 rounded-full ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}`;}
}
window.addEventListener('offline',updateHomeSourceBadgesV0376,{passive:true});
window.addEventListener('online',()=>setTimeout(updateHomeSourceBadgesV0376,100),{passive:true});
window.addEventListener('thalys:network-resync-complete',updateHomeSourceBadgesV0376);

// v0.37.8: Home source badges follow the PHYSICAL network state immediately.
function updateHomeSourceBadgesV0377(){
  const driveLive=navigator.onLine&&typeof getAccessToken==='function'&&!!getAccessToken();
  const sb=document.getElementById('home-sync-badge');
  if(sb){sb.textContent=driveLive?'Drive':'Locale';sb.className=`rounded-full px-2.5 py-1 text-[9px] ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-900/70 text-slate-400'}`;}
  const tb=document.getElementById('today-sync-badge');
  if(tb){tb.textContent=driveLive?'Drive':'Locale';tb.className=`text-[9px] px-2 py-1 rounded-full ${driveLive?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}`;}
}
window.updateHomeSourceBadgesV0377=updateHomeSourceBadgesV0377;
window.addEventListener('offline',updateHomeSourceBadgesV0377,{passive:true});
window.addEventListener('online',()=>setTimeout(updateHomeSourceBadgesV0377,100),{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateHomeSourceBadgesV0377();});
