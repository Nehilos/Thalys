
    document.addEventListener('DOMContentLoaded', () => {
      const welcome=document.getElementById('welcome-screen');
      const shell=document.getElementById('app-shell');
      if(welcome && !welcome.classList.contains('hidden')){
        shell?.classList.add('hidden');
      }
      ['workout','meditation','nutrition','body','analytics','settings'].forEach(t=>document.getElementById(`tab-${t}`)?.classList.add('hidden'));
      document.getElementById('tab-home')?.classList.remove('hidden');
      document.querySelectorAll('nav [id^="nav-"]').forEach(b=>{b.classList.remove('text-cyan-400');b.classList.add('text-slate-400');});
      const hb=document.getElementById('nav-home');if(hb){hb.classList.remove('text-slate-400');hb.classList.add('text-cyan-400');}
    }, { once:true });

/* ==========================================================
   THALYS V7
   ========================================================== */
let chartMacroV7=null,chartMicroV7=null;
/* Workout V7 helpers moved to js/workout.js in v0.30. */

async function loadExternalAvatarArtwork(force=false){
  if(window._thalysExternalAvatarLoaded&&!force)return true;
  try{
    const [mr,fr]=await Promise.all([fetch('./male.svg',{cache:'no-store'}),fetch('./female.svg',{cache:'no-store'})]);
    if(!mr.ok||!fr.ok)throw new Error('SVG_NOT_FOUND');
    const parser=new DOMParser();
    async function install(res,id){const doc=parser.parseFromString(await res.text(),'image/svg+xml'),svg=doc.documentElement,s=document.getElementById(id);if(!s)return;const vb=svg.getAttribute('viewBox');if(vb)s.setAttribute('viewBox',vb);s.replaceChildren(...Array.from(svg.children).filter(n=>n.tagName.toLowerCase()!=='script').map(n=>document.importNode(n,true)));}
    await install(mr,'avatar-male-art');await install(fr,'avatar-female-art');window._thalysExternalAvatarLoaded=true;
    const g=normalizeProfileGenderValue(appState.profile?.gender)==='female'?'femmina':'maschio';avatarSetArtwork(g);aggiornaAvatarDaUltimaMisura();renderHomeAvatar();return true;
  }catch(e){console.info('male.svg/female.svg non disponibili: fallback incorporato.');return false;}
}
const _saveProfileV6=saveProfile;
saveProfile=function(e){_saveProfileV6(e);const g=normalizeProfileGenderValue(appState.profile?.gender);loadExternalAvatarArtwork(true).finally(()=>{setProfileGender(g,{sync:false});avatarSetArtwork(g==='female'?'femmina':'maschio');aggiornaAvatarDaUltimaMisura();renderHomeAvatar();});};
function openFoodDatabaseForAdd(){openFoodDatabase();setTimeout(()=>toggleFoodPresetForm(true),180);}

/* Home: diet completed only with all four meals */
function mealsCompletedForDateV7(date){const have=new Set((appState.nutrition||[]).filter(x=>x.date===date).map(x=>String(x.meal||'')));return ['Colazione','Pranzo','Cena','Spuntino'].every(x=>have.has(x));}
function getDayGamification(date){
  const plan=getDayWorkoutPlan(date),c=plan?getWorkoutCompletion(date,plan.id):null,dayEx=plan?getExercisesForDate(plan,date):[];
  const exerciseTotal=dayEx.length,exerciseDone=plan?dayEx.filter(x=>c?.exercises?.[x.id]).length:0,workoutDone=exerciseTotal>0&&exerciseDone===exerciseTotal;
  const nutrition=(appState.nutrition||[]).filter(x=>x.date===date),kcal=nutrition.reduce((s,x)=>s+Number(x.kcal||0),0),water=Number(appState.water?.[date]||0),waterTarget=getWaterTarget(date),wellness=appState.wellness?.find(x=>x.date===date),meditation=(appState.meditation||[]).filter(x=>x.date===date).reduce((s,x)=>s+Number(x.minutes||0),0),active=getActiveWorkoutPlan(),scheduled=isPlanScheduledOnDate(active,date),mealDone=mealsCompletedForDateV7(date),mealCount=new Set(nutrition.map(x=>x.meal)).size;
  const steps=[];if(active)steps.push({label:scheduled?`${tr('Scheda')} ${active.name}`:tr('Riposo programmato'),done:scheduled?workoutDone:true,icon:scheduled?'fa-dumbbell':'fa-moon'});
  steps.push({label:tr('Check-in wellness'),done:!!wellness,icon:'fa-heart-pulse'},{label:tr('Idratazione'),done:water>=waterTarget*.8,icon:'fa-glass-water'},{label:mealDone?tr('Attività completata'):`${tr('Pasti')} ${mealCount}/4`,done:mealDone,icon:'fa-utensils'},{label:tr('Pausa mentale'),done:meditation>=5,icon:'fa-spa'});
  return {plan,exerciseDone,exerciseTotal,workoutDone,steps,done:steps.filter(x=>x.done).length,total:steps.length,water,waterTarget,kcal,wellness,meditation,mealDone};
}

/* Workout plan builder/history moved to js/workout.js in v0.30. */
function openMealHistory(){clearMealHistoryFilter(false);renderMealHistory();openModal('meal-history-modal');}
function clearMealHistoryFilter(r=true){for(const id of ['meal-history-from','meal-history-to']){const e=document.getElementById(id);if(e)e.value=''}if(r)renderMealHistory();}
function setMealHistoryToday(){const d=currentLocalDateStr();document.getElementById('meal-history-from').value=d;document.getElementById('meal-history-to').value=d;renderMealHistory();}
function renderMealHistory(){const box=document.getElementById('meal-history-list');if(!box)return;let a=document.getElementById('meal-history-from')?.value||'',b=document.getElementById('meal-history-to')?.value||'';if(a&&b&&a>b)[a,b]=[b,a];const rows=(appState.nutrition||[]).filter(x=>(!a||x.date>=a)&&(!b||x.date<=b)),dates=[...new Set(rows.map(x=>x.date))].sort().reverse();box.innerHTML=dates.length?dates.map(d=>`<div class="rounded-2xl bg-slate-900/60 p-3"><div class="flex justify-between"><b>${weekdayLabel(d)}</b><span class="text-[9px] text-emerald-300">${d}</span></div><div class="mt-2 space-y-2">${['Colazione','Pranzo','Cena','Spuntino'].map(m=>{const xs=rows.filter(x=>x.date===d&&x.meal===m);return `<div class="rounded-xl bg-slate-950 p-2"><b class="text-[9px] text-emerald-300">${tr(m)}</b>${xs.length?xs.map(x=>`<div class="mt-1 flex justify-between text-[9px]"><span>${escapeHTML(x.name)} · ${x.grams}g</span><span class="text-slate-500">${Math.round(x.kcal||0)} kcal</span></div>`).join(''):`<div class="mt-1 text-[9px] text-slate-600">${tr('Nessun alimento')}</div>`}</div>`}).join('')}</div></div>`).join(''):`<div class="p-5 text-center text-[10px] text-slate-500">${tr('Nessun pasto nel periodo selezionato.')}</div>`;}

/* Nutrition donuts */
function nutritionPeriodDataV7(){const mode=document.getElementById('nutrition-donut-period')?.value||'day',ref=document.getElementById('nutrition-date')?.value||currentLocalDateStr();let dates=[],mult=1,label='';if(mode==='day'){dates=[ref];label=tr('Target del giorno selezionato')}else if(mode==='7'){for(let i=6;i>=0;i--){const d=new Date(ref+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10))}mult=7;label=tr('Target × 7 giorni')}else{const d=new Date(ref+'T12:00:00'),n=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();for(let i=1;i<=n;i++)dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`);mult=n;label=`${tr('Target mensile')} × ${n} ${tr('giorni')}`}const logs=(appState.nutrition||[]).filter(x=>dates.includes(x.date)),sum=k=>logs.reduce((s,x)=>s+Number(x[k]||0),0);return {dates,mult,label,water:dates.reduce((s,d)=>s+Number(appState.water?.[d]||0),0),vitId:mergeVitaminCodes(logs.map(x=>x.vitaminsId),'id'),vitLip:mergeVitaminCodes(logs.map(x=>x.vitaminsLip),'lip'),v:{p:sum('p'),c:sum('c'),f:sum('f'),satFat:sum('satFat'),sugars:sum('sugars'),fiber:sum('fiber'),calcium:sum('calcium'),magnesium:sum('magnesium'),zinc:sum('zinc'),iron:sum('iron'),potassium:sum('potassium'),salt:sum('salt')}};}
function donutDefsV7(d){const t=appState.targets||{},m=d.mult;return {macro:[['p','Proteine','g',t.p||150,'251,113,133'],['c','Carboidrati','g',t.c||250,'251,191,36'],['f','Grassi','g',t.f||70,'96,165,250'],['satFat','Grassi saturi','g',t.satFat||20,'56,189,248',1],['sugars','Zuccheri','g',t.sugars||50,'167,139,250',1],['fiber','Fibre','g',t.fiber||30,'244,114,182']].map(x=>({key:x[0],label:x[1],unit:x[2],value:d.v[x[0]],target:Number(x[3])*m,rgb:x[4],max:!!x[5]})),micro:[['calcium','Calcio','mg',t.calcium||1000,'34,211,238'],['magnesium','Magnesio','mg',t.magnesium||350,'52,211,153'],['zinc','Zinco','mg',t.zinc||11,'45,212,191'],['iron','Ferro','mg',t.iron||11,'251,146,60'],['potassium','Potassio','mg',t.potassium||3500,'163,230,53'],['salt','Sale','g',t.salt||5,'232,121,249',1]].map(x=>({key:x[0],label:x[1],unit:x[2],value:d.v[x[0]],target:Number(x[3])*m,rgb:x[4],max:!!x[5]})).concat([{label:'Acqua',unit:'ml',value:d.water,target:getWaterTarget(d.dates.at(-1))*m,rgb:'96,165,250'},{label:'Vitamine ID',unit:'/9',value:d.vitId?d.vitId.split(/\s+/).filter(Boolean).length:0,target:9,rgb:'129,140,248'},{label:'Vitamine LIP',unit:'/4',value:d.vitLip?d.vitLip.split(/\s+/).filter(Boolean).length:0,target:4,rgb:'250,204,21'}])};}
function nutrientScoreV7(x){return Math.round(nutritionScore(x.value,x.target,x.max));}
function showDonutNutrientV7(kind,x){const e=document.getElementById(kind==='macro'?'macro-donut-selection-v7':'micro-donut-selection-v7'),s=nutrientScoreV7(x);if(e)e.innerHTML=`<b>${tr(x.label)}</b><div class="mt-1 text-slate-400">${Number(x.value.toFixed(1))} ${x.unit} / ${x.max?tr('limite'):tr('target')} ${x.target} ${x.unit} · ${s}%</div>`;}
function renderOneDonutV7(kind,defs){const cv=document.getElementById(kind==='macro'?'macroNutrientDonutV7':'microNutrientDonutV7');if(!cv||!window.Chart)return;const old=kind==='macro'?chartMacroV7:chartMicroV7;if(old)old.destroy();const ch=new Chart(cv.getContext('2d'),{type:'doughnut',data:{labels:defs.map(x=>tr(x.label)),datasets:[{data:defs.map(()=>1),backgroundColor:defs.map(x=>`rgba(${x.rgb},${(.28+.72*nutrientScoreV7(x)/100).toFixed(2)})`),borderColor:'rgba(15,23,42,.96)',borderWidth:4,hoverOffset:9}]},options:{responsive:true,maintainAspectRatio:false,cutout:'63%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const x=defs[c.dataIndex];return `${tr(x.label)} · ${Number(x.value.toFixed(1))}${x.unit} / ${x.target}${x.unit}`}}}},onClick:(evt,els)=>{if(els.length)showDonutNutrientV7(kind,defs[els[0].index])}}});if(kind==='macro')chartMacroV7=ch;else chartMicroV7=ch;const score=Math.round(defs.reduce((s,x)=>s+nutrientScoreV7(x),0)/defs.length),se=document.getElementById(kind==='macro'?'macro-donut-score-v7':'micro-donut-score-v7');if(se)se.textContent=`${tr('Equilibrio')} ${score}%`;const leg=document.getElementById(kind==='macro'?'macro-donut-legend-v7':'micro-donut-legend-v7');if(leg){leg.innerHTML='';defs.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='min-h-10 rounded-xl bg-slate-900/70 p-2 text-left text-[9px]';b.innerHTML=`<span class="inline-block h-2 w-2 rounded-full mr-1" style="background:rgb(${x.rgb})"></span>${tr(x.label)} <b class="float-right">${nutrientScoreV7(x)}%</b>`;b.onclick=()=>showDonutNutrientV7(kind,x);leg.appendChild(b)})}}
function renderNutritionDonutsV7(){const d=nutritionPeriodDataV7(),e=document.getElementById('nutrition-donut-period-label');if(e)e.textContent=d.label;const defs=donutDefsV7(d);renderOneDonutV7('macro',defs.macro);renderOneDonutV7('micro',defs.micro);}
const _renderNutritionV6=renderNutrition;renderNutrition=function(){_renderNutritionV6();requestAnimationFrame(renderNutritionDonutsV7)};

/* Analytics */
function shortWellnessIssueV7(entries){if(!entries?.length)return tr('Nessun dato');const av=k=>entries.reduce((s,x)=>s+Number(x[k]||0),0)/entries.length,issues=[];if(av('sleepHours')<7)issues.push(tr('sonno'));if(av('stress')>6)issues.push(tr('stress'));if(av('recovery')<6)issues.push(tr('recupero'));return issues.length?`${tr('Migliora')}: ${issues.join(', ')}`:tr('Parametri principali ok');}
const _renderWellnessSummaryV6=renderWellnessSummary;renderWellnessSummary=function(){_renderWellnessSummaryV6();const ref=analyticsSelectedDate||currentLocalDateStr(),dates=[];for(let i=0;i<7;i++){const d=new Date(ref+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10))}const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('health-daily-detail',shortWellnessIssueV7((appState.wellness||[]).filter(x=>x.date===ref)));set('health-weekly-detail',shortWellnessIssueV7((appState.wellness||[]).filter(x=>dates.includes(x.date))));set('health-monthly-detail',shortWellnessIssueV7((appState.wellness||[]).filter(x=>String(x.date).startsWith(ref.slice(0,7)))));}
function populatePlanHistoryAnalyticsV7(){const s=document.getElementById('chart-plan-history-select');if(!s)return;const cur=s.value,m=new Map();(appState.activeWorkoutPlanHistory||[]).forEach(x=>m.set(x.planId,x.planName||x.planId));(appState.workoutHistory||[]).forEach(x=>m.set(x.planId,x.planName||x.planId));s.innerHTML=`<option value="all">${tr('Tutte le schede')}</option>`+[...m].map(([id,n])=>`<option value="${id}">${escapeHTML(n)}</option>`).join('');if([...s.options].some(o=>o.value===cur))s.value=cur;}
function updateExerciseChartV7(){const ps=document.getElementById('chart-plan-history-select'),es=document.getElementById('chart-exercise-select'),ctx=document.getElementById('exerciseProgressChart')?.getContext('2d');if(!ctx)return;populatePlanHistoryAnalyticsV7();const pid=ps?.value||'all',day=document.getElementById('chart-specific-date')?.value||'';let rows=(appState.workouts||[]).filter(x=>x.planId);if(pid!=='all')rows=rows.filter(x=>x.planId===pid);if(day)rows=rows.filter(x=>x.date===day);const names=[...new Set(rows.map(x=>x.name))].sort(),old=es?.value;if(es){es.innerHTML=names.length?names.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join(''):`<option>${tr('Nessun esercizio')}</option>`;if(names.includes(old))es.value=old;}const n=es?.value||names[0],data=rows.filter(x=>x.name===n).sort((a,b)=>String(a.date).localeCompare(String(b.date))),max=data.map(x=>Math.max(0,...(x.sets||[]).map(s=>Number(s.weight||0)))),vol=data.map(x=>(x.sets||[]).reduce((s,q)=>s+Number(q.weight||0)*Number(q.reps||0),0));if(chartEx)chartEx.destroy();chartEx=new Chart(ctx,{type:'line',data:{labels:data.map(x=>x.date),datasets:[{label:tr('Peso massimo kg'),data:max,borderColor:'#22d3ee',tension:.3,yAxisID:'y'},{label:tr('Volume kg'),data:vol,borderColor:'#34d399',tension:.3,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd5e1',font:{size:9}}}},scales:{y1:{position:'right',grid:{drawOnChartArea:false}}}}});}
const _updateAnalyticsChartsV6=updateAnalyticsCharts;updateAnalyticsCharts=function(){_updateAnalyticsChartsV6();const d=document.getElementById('chart-specific-date')?.value,s=document.getElementById('analytics-filter-summary');if(d&&s)s.textContent+=` · ${tr('giorno')}: ${d}`;updateExerciseChartV7();renderWellnessSummary();};

/* Drive workspace/database implementation moved to js/drive.js in v0.25. */
function reorderSettingsV7(){const s=document.getElementById('tab-settings');if(!s)return;const cs=[...s.children],find=t=>cs.find(x=>x.textContent?.includes(t)),manual=find('Sincronizzazione manuale'),lang=find('Lingua'),focus=find('Modalità Focus'),help=find('Guida rapida');if(manual){let a=manual;[lang,focus,help].filter(Boolean).forEach(x=>{a.after(x);a=x})}}
document.addEventListener('DOMContentLoaded',()=>{appState.workoutHistory=Array.isArray(appState.workoutHistory)?appState.workoutHistory:[];appState.activeWorkoutPlanHistory=Array.isArray(appState.activeWorkoutPlanHistory)?appState.activeWorkoutPlanHistory:[];appState.workoutPlans=(appState.workoutPlans||[]).map(normalizeWorkoutPlanV7);loadExternalAvatarArtwork();reorderSettingsV7();setTimeout(()=>{renderNutritionDonutsV7();populatePlanHistoryAnalyticsV7()},350);});


const _getAnalyticsFilterV6=getAnalyticsFilter;
getAnalyticsFilter=function(){
  const specific=document.getElementById('chart-specific-date')?.value||'';
  if(!specific)return _getAnalyticsFilterV6();
  const value=document.getElementById('chart-workout-filter')?.value||'all';
  const periodDates=new Set([specific]);
  const allowedDates=new Set(value==='all'?[specific]:(appState.workouts||[]).filter(w=>w.date===specific&&(w.category===value||w.name===value||w.planName===value)).map(w=>w.date));
  const d=new Date(specific+'T12:00:00');
  return {value,days:'1',start:d,end:d,allowedDates,periodDates};
};


/* ==========================================================
   THALYS V8 PATCH
   ========================================================== */
const THALYS_EXERCISE_CATEGORIES_V8=['Petto','Dorso','Gambe','Spalle','Braccia','Bicipite','Tricipite','Quadricipiti','Femorali','Glutei','Polpaccio','Core','Cardio','Altro'];
const THALYS_DAY_SHORT_V8={Lunedì:'Lun',Martedì:'Mar',Mercoledì:'Mer',Giovedì:'Gio',Venerdì:'Ven',Sabato:'Sab',Domenica:'Dom'};

/* More reliable external avatar method: render male.svg/female.svg directly
   as an SVG <image>, and cache-bust when the user explicitly refreshes. */
let thalysAvatarRefreshSeqV8=0;
function avatarSetArtworkV8(gender,{force=false}={}){
  const female=gender==='femmina'||gender==='female';
  const group=document.getElementById('avatar-artwork-whole');
  if(!group)return false;
  const file=female?'female.svg':'male.svg';
  const ns='http://www.w3.org/2000/svg';
  const href=`./${file}${force?`?thalys_avatar=${Date.now()}_${++thalysAvatarRefreshSeqV8}`:''}`;
  const image=document.createElementNS(ns,'image');
  image.setAttribute('x','0');image.setAttribute('y','0');image.setAttribute('width','768');image.setAttribute('height','1536');
  image.setAttribute('preserveAspectRatio','xMidYMid meet');image.setAttribute('href',href);
  image.setAttributeNS('http://www.w3.org/1999/xlink','href',href);
  image.dataset.externalAvatar='1';
  const fallbackId=female?'avatar-female-art':'avatar-male-art';
  image.addEventListener('error',()=>{
    const symbol=document.getElementById(fallbackId);if(!symbol)return;
    group.replaceChildren(...Array.from(symbol.children).map(n=>n.cloneNode(true)));
    group.removeAttribute('transform');group.dataset.gender=female?'female':'male';
  },{once:true});
  group.replaceChildren(image);
  group.removeAttribute('transform');group.style.display='inline';group.dataset.gender=female?'female':'male';
  document.getElementById('avatar-gender-male')?.classList.toggle('active',!female);
  document.getElementById('avatar-gender-female')?.classList.toggle('active',female);
  const svg=document.getElementById('avatar-art-svg');if(svg)svg.dataset.gender=female?'female':'male';
  return true;
}
function forceAvatarRefreshV8(){
  const select=document.getElementById('prof-input-gender');
  const g=normalizeProfileGenderValue(select?.value||appState.profile?.gender);
  appState.profile={...(appState.profile||{}),gender:g,updatedAt:new Date().toISOString()};
  persistThalysStateLocally(appState);
  avatarSetArtworkV8(g==='female'?'femmina':'maschio',{force:true});
  requestAnimationFrame(()=>{aggiornaAvatarDaUltimaMisura();renderHomeAvatar();avatarSetArtworkV8(g==='female'?'femmina':'maschio',{force:true});});
  setTimeout(()=>{avatarSetArtworkV8(g==='female'?'femmina':'maschio',{force:true});aggiornaAvatarDaUltimaMisura();renderHomeAvatar();},120);
  saveStateToLocal();
  showToast(tr('Avatar aggiornato e forzato'),'fa-rotate');
}
const _saveProfileV8Base=saveProfile;
saveProfile=function(e){
  _saveProfileV8Base(e);
  setTimeout(forceAvatarRefreshV8,40);
};

/* Desktop wheel handling inside the plan editor. */
function installWorkoutBuilderWheelV8(){
  const modal=document.getElementById('workout-plans-modal');if(!modal||modal.dataset.wheelV8)return;modal.dataset.wheelV8='1';
  modal.addEventListener('wheel',e=>{
    const panel=document.getElementById('plan-builder-panel'),scroller=document.getElementById('plan-builder-exercises');
    if(panel?.classList.contains('hidden')||!scroller||!panel.contains(e.target))return;
    if(scroller.scrollHeight>scroller.clientHeight){
      scroller.scrollTop+=e.deltaY;
      e.preventDefault();
    }else if(panel.scrollHeight>panel.clientHeight){
      panel.scrollTop+=e.deltaY;e.preventDefault();
    }
  },{passive:false});
}

/* Horizontal day selector and larger plan fields. */
function renderPlanBuilderV7(){
  const days=document.getElementById('plan-builder-days'),box=document.getElementById('plan-builder-exercises');if(!days||!box)return;
  days.innerHTML=THALYS_WEEKDAYS.map(d=>`<button type="button" title="${tr(d)}" onclick="selectPlanBuilderDay('${d}')" class="v7-day-btn ${d===planBuilderDay?'active':''}"><div>${tr(THALYS_DAY_SHORT_V8[d]||d)}</div><div class="v8-day-count">${planBuilderRest.has(d)?'🌙':(planBuilderDraft[d]?.length||0)}</div></button>`).join('');
  const title=document.getElementById('plan-builder-day-title'),rest=document.getElementById('plan-day-rest'),add=document.getElementById('plan-builder-add-btn');
  if(title)title.textContent=tr(planBuilderDay);if(rest)rest.checked=planBuilderRest.has(planBuilderDay);if(add)add.classList.toggle('hidden',planBuilderRest.has(planBuilderDay));
  if(planBuilderRest.has(planBuilderDay)){box.innerHTML=`<div class="min-h-52 flex items-center justify-center rounded-2xl bg-violet-500/5 text-center"><div><div class="text-4xl">🌙</div><div class="mt-3 text-base font-black text-violet-200">${tr('Giorno di riposo')}</div><div class="mt-1 text-[11px] text-slate-500">${tr('Nessun esercizio previsto')}</div></div></div>`;return;}
  const arr=planBuilderDraft[planBuilderDay]||[];
  box.innerHTML=arr.length?arr.map((x,i)=>`<div class="v7-ex-card">
    <div class="flex gap-2"><input value="${escapeHTML(x.name)}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'name',this.value)" placeholder="${tr('Nome esercizio')}" class="v8-ex-name min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"><button type="button" onclick="removePlanExerciseV7('${planBuilderDay}',${i})" class="w-10 shrink-0 rounded-xl bg-rose-500/10 text-rose-300" title="${tr('Rimuovi esercizio')}"><i class="fa-solid fa-trash"></i></button></div>
    <div class="mt-3 grid grid-cols-2 gap-3">
      <label class="text-slate-500">${tr('Categoria')}<select onchange="updatePlanDraftFieldV7('${planBuilderDay}',${i},'category',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white">${THALYS_EXERCISE_CATEGORIES_V8.map(c=>`<option value="${c}" ${c===x.category?'selected':''}>${tr(c)}</option>`).join('')}</select></label>
      <label class="text-slate-500">${tr('Serie')}<input type="number" min="1" value="${x.series}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'series',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white"></label>
      <label class="text-slate-500">${tr('Ripetizioni')}<input type="number" min="1" value="${x.reps}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'reps',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white"></label>
      <label class="text-slate-500">${tr('Peso kg')}<input type="number" min="0" step=".5" value="${x.weight}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'weight',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white"></label>
      <label class="text-slate-500">RPE<input type="number" min="1" max="10" value="${x.rpe}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'rpe',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white"></label>
      <label class="text-slate-500">${tr('Recupero sec')}<input type="number" min="0" value="${x.recovery}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'recovery',this.value)" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-white"></label>
    </div>
  </div>`).join(''):`<div class="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-[12px] text-slate-500">${tr('Nessun esercizio. Aggiungine uno oppure imposta Riposo.')}</div>`;
}

/* AI/food numeric fields: normalize every numeric proposal to 1 decimal. */
function fillFoodPresetFromAI(d){
  const map={kcal:'preset-kcal',p:'preset-p',c:'preset-c',f:'preset-f',satFat:'preset-sat-fat',sugars:'preset-sugars',calcium:'preset-calcium',magnesium:'preset-magnesium',zinc:'preset-zinc',fiber:'preset-fiber',salt:'preset-salt',iron:'preset-iron',potassium:'preset-potassium',vitaminsId:'preset-vitamins-id',vitaminsLip:'preset-vitamins-lip'};
  Object.entries(map).forEach(([k,id])=>{
    const el=document.getElementById(id),v=d[k];if(!el||v===null||v===undefined||v==='')return;
    if(k==='vitaminsId'||k==='vitaminsLip')el.value=Array.isArray(v)?v.join(' '):v;
    else {const n=Number(v);el.value=Number.isFinite(n)?(Math.round(n*10)/10).toFixed(1):v;}
  });
}

/* Compact Workout DB: summary only; details open separately. */
function renderWorkoutHistory(){
  const box=document.getElementById('workout-history-list');if(!box)return;
  const d=document.getElementById('workout-history-date')?.value||'';
  const rows=[...(appState.workoutHistory||[])].filter(x=>!d||x.date===d).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  box.innerHTML=rows.length?rows.map(r=>`<button type="button" onclick="openWorkoutHistoryDetailV8('${escapeHTML(r.id)}')" class="w-full rounded-2xl border border-slate-800 bg-slate-900/65 p-3 text-left hover:border-cyan-500/30">
    <div class="flex items-center justify-between gap-3"><div class="min-w-0"><div class="truncate text-[12px] font-black text-white">${escapeHTML(r.planName||tr('Scheda'))}</div><div class="mt-1 text-[9px] text-slate-500">${weekdayLabel(r.date)}</div></div><div class="shrink-0 text-right"><div class="rounded-lg bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">✓ ${tr('Completata')}</div><div class="mt-1 text-[9px] text-slate-500">${r.date}</div></div></div>
  </button>`).join(''):`<div class="p-5 text-center text-[10px] text-slate-500">${tr('Nessun allenamento completato per il filtro scelto.')}</div>`;
}
function openWorkoutHistoryDetailV8(id){
  const r=(appState.workoutHistory||[]).find(x=>x.id===id);if(!r)return;
  const title=document.getElementById('workout-history-detail-title'),date=document.getElementById('workout-history-detail-date'),list=document.getElementById('workout-history-detail-list');
  if(title)title.textContent=r.planName||tr('Allenamento');if(date)date.textContent=`${weekdayLabel(r.date)} · ${r.date}`;
  if(list)list.innerHTML=(r.exercises||[]).map(x=>`<div class="rounded-2xl border border-slate-800 bg-slate-900/65 p-3"><div class="flex justify-between gap-2"><b class="text-[12px] text-white">${escapeHTML(x.name)}</b><span class="text-[9px] text-cyan-300">${tr(x.category||'')}</span></div><div class="mt-2 text-[10px] text-slate-400"><b class="text-slate-200">${x.series||x.sets?.length||0} ${tr('serie')}</b> × ${x.reps||'—'} reps · ${x.weight||0} kg · RPE ${x.rpe||'—'} · ${x.recovery||0}s</div></div>`).join('');
  openModal('workout-history-detail-modal');
}

/* Same exercise is the same key regardless of upper/lowercase and extra spaces. */
function normalizeExerciseNameV8(name){return String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('it-IT');}
function updateExerciseChartV7(){
  const planSel=document.getElementById('chart-plan-history-select'),exSel=document.getElementById('chart-exercise-select'),ctx=document.getElementById('exerciseProgressChart')?.getContext('2d');if(!ctx)return;
  populatePlanHistoryAnalyticsV7();
  const planId=planSel?.value||'all',specific=document.getElementById('chart-specific-date')?.value||'';
  let rows=[...(appState.workouts||[])].filter(x=>x.source==='plan'||x.planId);
  if(planId!=='all')rows=rows.filter(x=>x.planId===planId);if(specific)rows=rows.filter(x=>x.date===specific);
  const names=new Map();rows.forEach(x=>{const k=normalizeExerciseNameV8(x.name);if(k&&!names.has(k))names.set(k,String(x.name||'').trim())});
  const keys=[...names.keys()].sort((a,b)=>names.get(a).localeCompare(names.get(b),currentLocale()));
  const previous=normalizeExerciseNameV8(exSel?.value);
  if(exSel){exSel.innerHTML=keys.length?keys.map(k=>`<option value="${escapeHTML(k)}">${escapeHTML(names.get(k))}</option>`).join(''):`<option value="">${tr('Nessun esercizio')}</option>`;if(keys.includes(previous))exSel.value=previous;}
  const key=exSel?.value||keys[0]||'',data=rows.filter(x=>normalizeExerciseNameV8(x.name)===key).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const maxWeight=data.map(x=>Math.max(0,...(x.sets||[]).map(s=>Number(s.weight||0))));
  if(chartEx)chartEx.destroy();
  chartEx=new Chart(ctx,{type:'line',data:{labels:data.map(x=>x.date),datasets:[{label:tr('Peso massimo kg'),data:maxWeight,borderColor:'#22d3ee',backgroundColor:'rgba(34,211,238,.12)',fill:true,tension:.3,pointRadius:4,pointHoverRadius:6}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items?.[0]?.label||'',label:c=>`${tr('Peso massimo')}: ${c.raw} kg`}}},scales:{x:{ticks:{color:'#64748b',font:{size:9}}},y:{beginAtZero:false,ticks:{color:'#64748b',callback:v=>v+' kg'},title:{display:true,text:tr('Peso sollevato'),color:'#94a3b8'}}}}});
}

/* Reliable AI PDF export: keep export DOM inside the renderable viewport and cover it
   during capture instead of placing it at z-index:-1 (which can produce blank PDFs). */
async function exportAIConsultPDF(id){
  const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
  if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
  const cover=document.createElement('div');
  cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#090d16;display:flex;align-items:center;justify-content:center;color:#67e8f9;font:700 14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  cover.innerHTML=`<div style="text-align:center"><div style="font-size:24px;margin-bottom:10px">THALYS</div><div>${escapeHTML(tr('Creazione PDF…'))}</div></div>`;
  const root=document.createElement('div');
  root.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;width:794px;min-height:1120px;padding:42px;box-sizing:border-box;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  const response=record.response||{};
  const responseHTML=Object.entries(response).map(([k,v])=>consultPdfSection(tr(k),v)).join('')||consultPdfSection(tr('Risposta IA'),response);
  root.innerHTML=`<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
    <div style="margin-top:22px"><div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(tr('Risposta IA'))}</div>
    <div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">${escapeHTML(tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type))}</div>
    <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))}</div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div></div>
    ${responseHTML}${record.generatedWorkoutPlan?consultPdfSection(tr('Scheda generata'),record.generatedWorkoutPlan):''}
    <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal consulto IA salvato'))}</div>`;
  document.body.append(root,cover);
  try{
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await html2pdf().set({margin:[8,8,10,8],filename:`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#090d16',scrollX:0,scrollY:0,windowWidth:794},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(root).save();
    showToast(tr('Risposta IA esportata in PDF'),'fa-file-pdf');
  }catch(e){console.error('AI consult PDF V8',e);showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');}
  finally{cover.remove();root.remove();}
}

/* Make sure AI plans imported/generated always contain series and accepted categories. */
const _normalizeAIWorkoutPlanV8Base=normalizeAIWorkoutPlan;
normalizeAIWorkoutPlan=function(p){
  const out=_normalizeAIWorkoutPlanV8Base(p);if(!out)return out;
  out.exercises=out.exercises.map(x=>({...x,series:Math.max(1,Math.round(Number(x.series)||3)),category:THALYS_EXERCISE_CATEGORIES_V8.includes(x.category)?x.category:'Altro'}));
  out.schemaVersion=3;return out;
};

/* Route every legacy analytics refresh to the V8 weight-only chart. */
updateExerciseChart=updateExerciseChartV7;

document.addEventListener('DOMContentLoaded',()=>{
  installWorkoutBuilderWheelV8();
  setTimeout(()=>avatarSetArtworkV8(normalizeProfileGenderValue(appState.profile?.gender)==='female'?'femmina':'maschio'),180);
});


/* ==========================================================
   THALYS V9 — modal state + navigation + PDF reliability
   ========================================================== */
let thalysModalLockDepthV9=0;

function clearLegacyModalBodyLockV9(){
  document.body.classList.remove('modal-open');
  document.documentElement.classList.remove('modal-open');
  document.body.style.top='';
  document.body.style.position='';
  document.body.style.inset='';
  document.body.style.width='';
  document.body.style.height='';
  document.body.style.touchAction='';
  document.documentElement.style.position='';
  document.documentElement.style.inset='';
  document.documentElement.style.width='';
  document.documentElement.style.height='';
  document.documentElement.style.touchAction='';
}

function getOpenModalsV9(){
  return [...document.querySelectorAll('[data-thalys-modal-open="1"]')].filter(el=>!el.classList.contains('hidden'));
}
function updateModalScrollLock(){
  clearLegacyModalBodyLockV9();
  const any=getOpenModalsV9().length>0;
  document.body.classList.toggle('modal-open-v9',any);
  document.documentElement.classList.toggle('modal-open-v9',any);
  // Never freeze position/inset: only overflow is locked through the V9 CSS.
}
function openModal(modalId){
  const modal=document.getElementById(modalId);
  if(!modal)return;
  modal.classList.remove('hidden');
  modal.dataset.thalysModalOpen='1';
  modal.setAttribute('aria-hidden','false');
  modal.removeAttribute('inert');
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
function closeModal(modalId){
  const modal=document.getElementById(modalId);
  if(!modal)return;
  modal.classList.add('hidden');
  delete modal.dataset.thalysModalOpen;
  modal.setAttribute('aria-hidden','true');
  try{modal.setAttribute('inert','');}catch(_){}
  requestAnimationFrame(updateModalScrollLock);
}
function closeConsultViewerV9(ev){
  ev?.preventDefault?.();
  ev?.stopPropagation?.();
  const modal=document.getElementById('consult-snapshot-modal');
  if(modal){
    modal.classList.add('hidden');
    delete modal.dataset.thalysModalOpen;
    modal.setAttribute('aria-hidden','true');
    try{modal.setAttribute('inert','');}catch(_){}
  }
  clearLegacyModalBodyLockV9();
  document.body.classList.remove('modal-open-v9');
  document.documentElement.classList.remove('modal-open-v9');
  const main=document.querySelector('#app-shell > main');
  if(main)main.style.pointerEvents='';
}
function forceNavigationUnlockV9(){
  const consult=document.getElementById('consult-snapshot-modal');
  if(consult && !consult.classList.contains('hidden')){
    consult.classList.add('hidden');
    delete consult.dataset.thalysModalOpen;
    consult.setAttribute('aria-hidden','true');
    try{consult.setAttribute('inert','');}catch(_){}
  }
  // Clean stale modal flags only for elements that are actually hidden.
  document.querySelectorAll('[data-thalys-modal-open="1"].hidden').forEach(el=>delete el.dataset.thalysModalOpen);
  clearLegacyModalBodyLockV9();
  if(getOpenModalsV9().length===0){
    document.body.classList.remove('modal-open-v9');
    document.documentElement.classList.remove('modal-open-v9');
  }
}

/* Wrap tab changes so Consulto/Opzioni can never leave a stale invisible overlay
   or body lock behind. */
const _switchTabV9Base=switchTab;
switchTab=function(tabName){
  forceNavigationUnlockV9();
  _switchTabV9Base(tabName);
  requestAnimationFrame(()=>{
    forceNavigationUnlockV9();
    const main=document.querySelector('#app-shell > main');
    if(main)main.style.pointerEvents='';
  });
};

/* A dedicated opener for the Consult viewer; it uses the new modal state instead
   of relying on CSS class combinations. */
function openConsultViewerV9(){
  const modal=document.getElementById('consult-snapshot-modal');
  if(!modal)return;
  modal.classList.remove('hidden');
  modal.dataset.thalysModalOpen='1';
  modal.setAttribute('aria-hidden','false');
  modal.removeAttribute('inert');
  updateModalScrollLock();
}

/* Replace the generic call when a saved consultation/AI answer opens. */
const _openConsultSnapshotV9Base=openConsultSnapshot;
openConsultSnapshot=function(id){
  _openConsultSnapshotV9Base(id);
  // The base function calls openModal; reinforce the final state explicitly.
  openConsultViewerV9();
};
const _openAIConsultHistoryV9Base=openAIConsultHistory;
openAIConsultHistory=function(id){
  _openAIConsultHistoryV9Base(id);
  openConsultViewerV9();
};

/* Close the viewer with Escape and by tapping the dark backdrop, without closing
   when the user taps the actual content card. */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && !document.getElementById('consult-snapshot-modal')?.classList.contains('hidden')){
    closeConsultViewerV9(e);
  }
});
document.getElementById('consult-snapshot-modal')?.addEventListener('pointerdown',e=>{
  if(e.target===e.currentTarget)closeConsultViewerV9(e);
});

/* PDF stage: the element to be captured is actually rendered inside the viewport.
   Previous versions placed it off-screen / behind another layer, which can yield
   an empty canvas in Safari/Chromium. */
function createPdfStageV9(){
  const stage=document.createElement('div');
  stage.id='thalys-pdf-stage-v9';
  stage.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#090d16;overflow:auto;display:block;padding:0;margin:0;';
  const root=document.createElement('div');
  root.style.cssText='position:relative;width:794px;min-height:1120px;margin:0 auto;padding:42px;box-sizing:border-box;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;';
  const status=document.createElement('div');
  status.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483647;padding:9px 12px;border-radius:12px;background:#083344;color:#cffafe;font:700 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.35)';
  status.textContent=tr('Creazione PDF…');
  stage.append(root,status);
  document.body.appendChild(stage);
  return {stage,root};
}
async function waitPdfLayoutV9(){
  try{await document.fonts?.ready;}catch(_){}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await new Promise(r=>setTimeout(r,80));
}
async function exportAIConsultPDF(id){
  const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
  if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
  const {stage,root}=createPdfStageV9();
  const response=record.response||{};
  const responseHTML=Object.entries(response).map(([k,v])=>consultPdfSection(tr(k),v)).join('')||consultPdfSection(tr('Risposta IA'),response);
  root.innerHTML=`<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
    <div style="margin-top:22px">
      <div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(tr('Risposta IA'))}</div>
      <div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">${escapeHTML(tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type))}</div>
      <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))}</div>
      <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div>
    </div>
    ${responseHTML}
    ${record.generatedWorkoutPlan?consultPdfSection(tr('Scheda generata'),record.generatedWorkoutPlan):''}
    <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal consulto IA salvato'))}</div>`;
  try{
    await waitPdfLayoutV9();
    await html2pdf().set({
      margin:[8,8,10,8],
      filename:`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.pdf`,
      image:{type:'jpeg',quality:.98},
      html2canvas:{
        scale:2,
        useCORS:true,
        allowTaint:false,
        backgroundColor:'#090d16',
        scrollX:0,
        scrollY:0,
        windowWidth:794,
        logging:false
      },
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:['css','legacy']}
    }).from(root).save();
    showToast(tr('Risposta IA esportata in PDF'),'fa-file-pdf');
  }catch(e){
    console.error('AI consult PDF V9',e);
    showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');
  }finally{
    stage.remove();
    updateModalScrollLock();
  }
}

/* Apply the same safe visible-render strategy to saved snapshot PDFs. */
async function exportConsultSnapshotPDF(id){
  const record=(appState.consultations||[]).find(x=>x.id===id);if(!record)return;
  if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
  const {stage,root}=createPdfStageV9();
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
  try{
    await waitPdfLayoutV9();
    await html2pdf().set({
      margin:[8,8,10,8],
      filename:consultExportSafeName(record,'pdf'),
      image:{type:'jpeg',quality:.98},
      html2canvas:{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#090d16',scrollX:0,scrollY:0,windowWidth:794,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:['css','legacy']}
    }).from(root).save();
    showToast(tr('Consulto esportato in PDF'),'fa-file-pdf');
  }catch(e){
    console.error('Consult PDF V9',e);
    showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');
  }finally{
    stage.remove();
    updateModalScrollLock();
  }
}

/* Initial cleanup: recover from any stale modal/body state after app restoration. */
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.fixed.hidden').forEach(el=>{
    delete el.dataset.thalysModalOpen;
    el.setAttribute('aria-hidden','true');
  });
  forceNavigationUnlockV9();
});


/* ==========================================================
   THALYS V10 — iOS/WebKit robustness + full PDF export
   ========================================================== */
const THALYS_APP_VERSION_V10='0.21.0';
const THALYS_VERSION_KEY_V10='thalys_app_version';
const THALYS_RELOAD_KEY_V10='thalys_version_reload_guard';

function updateViewportUnitV10(){
  const h=(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0);
  if(h>0)document.documentElement.style.setProperty('--thalys-vh',`${h/100}px`);
}
updateViewportUnitV10();
window.addEventListener('resize',updateViewportUnitV10,{passive:true});
window.visualViewport?.addEventListener('resize',updateViewportUnitV10,{passive:true});
window.visualViewport?.addEventListener('scroll',updateViewportUnitV10,{passive:true});

function normalizeModalStateV10(){
  document.querySelectorAll('[id$="-modal"]').forEach(modal=>{
    if(modal.classList.contains('hidden')){
      modal.style.pointerEvents='none';
      modal.setAttribute('aria-hidden','true');
      try{modal.setAttribute('inert','');}catch(_){}
      delete modal.dataset.thalysModalOpen;
    }else{
      modal.style.pointerEvents='auto';
      modal.setAttribute('aria-hidden','false');
      modal.removeAttribute('inert');
    }
  });
  clearLegacyModalBodyLockV9?.();
  if(typeof getOpenModalsV9==='function' && getOpenModalsV9().length===0){
    document.documentElement.classList.remove('modal-open-v9');
    document.body.classList.remove('modal-open-v9');
  }
}
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){updateViewportUnitV10();normalizeModalStateV10();}
});
window.addEventListener('pageshow',()=>{updateViewportUnitV10();normalizeModalStateV10();},{passive:true});

/* Persistent version check: if an iPhone/Chrome tab kept an older bundle alive,
   do one cache-busted reload after a deployment version changes. */
function ensureFreshVersionV10(){
  try{
    const previous=localStorage.getItem(THALYS_VERSION_KEY_V10);
    if(previous!==THALYS_APP_VERSION_V10){
      localStorage.setItem(THALYS_VERSION_KEY_V10,THALYS_APP_VERSION_V10);
      const guard=sessionStorage.getItem(THALYS_RELOAD_KEY_V10);
      if(guard!==THALYS_APP_VERSION_V10){
        sessionStorage.setItem(THALYS_RELOAD_KEY_V10,THALYS_APP_VERSION_V10);
        const url=new URL(location.href);
        url.searchParams.set('thalys_v',THALYS_APP_VERSION_V10);
        location.replace(url.toString());
        return false;
      }
    }
  }catch(_){}
  return true;
}

/* Safer tab switching on WebKit: close overlays first and defer the actual tab
   mutation until the browser has released the old pointer target. */
const _switchTabV10Base=switchTab;
switchTab=function(tabName){
  forceNavigationUnlockV9?.();
  normalizeModalStateV10();
  requestAnimationFrame(()=>{
    _switchTabV10Base(tabName);
    requestAnimationFrame(()=>{
      normalizeModalStateV10();
      updateViewportUnitV10();
      const main=document.querySelector('#app-shell > main');
      if(main){main.style.pointerEvents='auto';main.style.touchAction='pan-y';}
    });
  });
};

/* More defensive consult close for Chrome/iOS. */
closeConsultViewerV9=function(ev){
  ev?.preventDefault?.();ev?.stopPropagation?.();
  const modal=document.getElementById('consult-snapshot-modal');
  if(modal){
    modal.classList.add('hidden');
    modal.style.display='none';
    modal.style.pointerEvents='none';
    modal.setAttribute('aria-hidden','true');
    try{modal.setAttribute('inert','');}catch(_){}
    delete modal.dataset.thalysModalOpen;
    setTimeout(()=>{modal.style.display='';normalizeModalStateV10();},0);
  }
  clearLegacyModalBodyLockV9?.();
  document.documentElement.classList.remove('modal-open-v9');
  document.body.classList.remove('modal-open-v9');
};

/* Full PDF export.
   Instead of capturing a fixed-width viewport that can clip on mobile, build a
   dedicated document-sized element in normal flow and let html2pdf paginate it. */
function createFullPdfDocumentV10(){
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;width:100vw;height:100vh;overflow:auto;background:#090d16;';
  const root=document.createElement('div');
  root.style.cssText='position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:14mm;box-sizing:border-box;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;overflow:visible;';
  const status=document.createElement('div');
  status.style.cssText='position:fixed;right:12px;top:12px;z-index:2147483647;padding:9px 12px;border-radius:12px;background:#083344;color:#cffafe;font:700 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;';
  status.textContent=tr('Creazione PDF…');
  host.append(root,status);
  document.body.appendChild(host);
  return {host,root};
}
async function waitFullPdfLayoutV10(root){
  try{await document.fonts?.ready;}catch(_){}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  // Force a complete layout pass before capture.
  void root.offsetHeight;
  await new Promise(r=>setTimeout(r,120));
}
function pdfOptionsV10(filename){
  return {
    margin:[8,8,10,8],
    filename,
    image:{type:'jpeg',quality:.98},
    html2canvas:{
      scale:2,
      useCORS:true,
      allowTaint:false,
      backgroundColor:'#090d16',
      logging:false,
      scrollX:0,
      scrollY:0,
      windowWidth:794,
      width:794
    },
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['css','legacy','avoid-all'],before:'.thalys-pdf-page-before'}
  };
}
function buildAIConsultPdfHTMLV10(record){
  const response=record.response||{};
  const sections=Object.entries(response).map(([k,v])=>`<section style="page-break-inside:avoid;margin-top:12px">${consultPdfSection(tr(k),v)}</section>`).join('')||consultPdfSection(tr('Risposta IA'),response);
  return `<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
    <div style="margin-top:22px">
      <div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(tr('Risposta IA'))}</div>
      <div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">${escapeHTML(tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type))}</div>
      <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))}</div>
      <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div>
    </div>
    ${sections}
    ${record.generatedWorkoutPlan?`<section style="page-break-inside:avoid;margin-top:12px">${consultPdfSection(tr('Scheda generata'),record.generatedWorkoutPlan)}</section>`:''}
    <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal consulto IA salvato'))}</div>`;
}
async function exportAIConsultPDF(id){
  const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
  if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
  const {host,root}=createFullPdfDocumentV10();
  root.innerHTML=buildAIConsultPdfHTMLV10(record);
  try{
    await waitFullPdfLayoutV10(root);
    await html2pdf().set(pdfOptionsV10(`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.pdf`)).from(root).save();
    showToast(tr('Risposta IA esportata in PDF'),'fa-file-pdf');
  }catch(e){
    console.error('AI consult PDF V10',e);
    showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');
  }finally{
    host.remove();normalizeModalStateV10();
  }
}
async function exportConsultSnapshotPDF(id){
  const record=(appState.consultations||[]).find(x=>x.id===id);if(!record)return;
  if(!window.html2pdf){showToast(tr('Modulo PDF in caricamento. Riprova tra un secondo.'),'fa-clock');return;}
  const {host,root}=createFullPdfDocumentV10();
  const sections=Object.entries(record.snapshot||{}).map(([k,v])=>`<section style="page-break-inside:avoid;margin-top:12px">${consultPdfSection(tr(k),v)}</section>`).join('');
  root.innerHTML=`<div style="border-bottom:2px solid #164e63;padding-bottom:18px">${thalysPdfLogoMarkup()}</div>
    <div style="margin-top:22px">
      <div style="font-size:9px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase">${escapeHTML(consultTypeLabel(record.type))}</div>
      <div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">${escapeHTML(tr('Quadro generale'))}</div>
      <div style="margin-top:8px;font-size:11px;color:#94a3b8">${escapeHTML(formatConsultDate(record.date))} · ${escapeHTML(record.period?.from||'—')} → ${escapeHTML(record.period?.to||'—')}</div>
      <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#083344;color:#cffafe;font-size:11px"><b>${escapeHTML(tr('Obiettivo'))}:</b> ${escapeHTML(record.goal||'—')}</div>
    </div>
    ${sections}
    <div style="margin-top:20px;border-top:1px solid #1e293b;padding-top:12px;font-size:8px;color:#64748b">Thalys · ${escapeHTML(tr('Dati esportati dal quadro salvato'))}</div>`;
  try{
    await waitFullPdfLayoutV10(root);
    await html2pdf().set(pdfOptionsV10(consultExportSafeName(record,'pdf'))).from(root).save();
    showToast(tr('Consulto esportato in PDF'),'fa-file-pdf');
  }catch(e){
    console.error('Consult PDF V10',e);
    showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');
  }finally{
    host.remove();normalizeModalStateV10();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  updateViewportUnitV10();
  normalizeModalStateV10();
  setTimeout(()=>ensureFreshVersionV10(),80);
});


/* ==========================================================
   THALYS V11 — native jsPDF exporter (no screenshot/canvas)
   Fixes iOS WebKit horizontal clipping.
   ========================================================== */
function pdfPlainTextV11(value,depth=0){
  if(value===null||value===undefined)return '—';
  if(typeof value==='string')return value;
  if(typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value)){
    return value.map((v,i)=>{
      if(typeof v==='object'&&v!==null)return `${i+1}. ${pdfPlainTextV11(v,depth+1)}`;
      return `• ${pdfPlainTextV11(v,depth+1)}`;
    }).join('\n');
  }
  if(typeof value==='object'){
    return Object.entries(value).map(([k,v])=>{
      const label=tr(k);
      if(typeof v==='object'&&v!==null)return `${label}:\n${pdfPlainTextV11(v,depth+1)}`;
      return `${label}: ${pdfPlainTextV11(v,depth+1)}`;
    }).join('\n');
  }
  return String(value);
}
function pdfSafeTextV11(value){
  return pdfPlainTextV11(value).replace(/\r/g,'').replace(/\t/g,'  ');
}
function getJsPDFV11(){
  return window.jspdf?.jsPDF || window.jsPDF;
}
function makeThalysPdfV11(title,metaLines=[]){
  const JsPDF=getJsPDFV11();if(!JsPDF)throw new Error('JSPDF_NOT_LOADED');
  const doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const W=210,H=297,M=16,CW=W-M*2;
  let y=18;
  function pageBase(){
    doc.setFillColor(9,13,22);doc.rect(0,0,W,H,'F');
    doc.setDrawColor(22,78,99);doc.setLineWidth(.5);doc.line(M,27,W-M,27);
    doc.setTextColor(103,232,249);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('THALYS',M,18);
    doc.setTextColor(148,163,184);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('WELLNESS INTELLIGENCE',M,23);
    y=35;
  }
  function newPage(){doc.addPage();pageBase();}
  function ensure(h=10){if(y+h>H-16)newPage();}
  function textBlock(text,{size=9,bold=false,color=[203,213,225],gap=4,indent=0}={}){
    text=pdfSafeTextV11(text);
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(text,Math.max(20,CW-indent));
    const lh=size*.40+1.15;
    for(const line of lines){ensure(lh+2);doc.text(String(line),M+indent,y);y+=lh;}
    y+=gap;
  }
  function heading(text){
    ensure(12);doc.setFillColor(15,23,42);doc.roundedRect(M,y-4,CW,9,2,2,'F');
    doc.setTextColor(103,232,249);doc.setFont('helvetica','bold');doc.setFontSize(9);
    doc.text(pdfSafeTextV11(text),M+3,y+1);y+=10;
  }
  function section(label,value){
    heading(label);
    textBlock(value,{size:8.5,color:[203,213,225],gap:5,indent:2});
  }
  pageBase();
  textBlock(title,{size:17,bold:true,color:[255,255,255],gap:3});
  metaLines.filter(Boolean).forEach(x=>textBlock(x,{size:8,color:[148,163,184],gap:2}));
  y+=3;
  return {doc,section,textBlock,heading,newPage,getY:()=>y};
}
async function ensureJsPdfV11(){
  if(getJsPDFV11())return true;
  // CDN may still be loading when the user taps immediately.
  await new Promise(r=>setTimeout(r,350));
  return !!getJsPDFV11();
}
async function exportAIConsultPDF(id){
  const record=(appState.aiConsults||[]).find(x=>x.id===id);if(!record)return;
  try{
    if(!await ensureJsPdfV11())throw new Error('JSPDF_NOT_LOADED');
    const type=tr({nutrition:'Alimentazione',workout:'Allenamenti',full:'Quadro completo',food:'Dati alimento'}[record.type]||record.type);
    const pdf=makeThalysPdfV11(`${tr('Risposta IA')} · ${type}`,[
      formatConsultDate(record.date),
      `${tr('Obiettivo')}: ${record.goal||'—'}`
    ]);
    const response=record.response||{};
    if(response && typeof response==='object' && !Array.isArray(response)){
      Object.entries(response).forEach(([k,v])=>pdf.section(tr(k),pdfSafeTextV11(v)));
    }else pdf.section(tr('Risposta IA'),pdfSafeTextV11(response));
    if(record.generatedWorkoutPlan)pdf.section(tr('Scheda generata'),pdfSafeTextV11(record.generatedWorkoutPlan));
    const pages=pdf.doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      pdf.doc.setPage(i);pdf.doc.setTextColor(100,116,139);pdf.doc.setFontSize(7);
      pdf.doc.text(`Thalys · ${i}/${pages}`,194,289,{align:'right'});
    }
    pdf.doc.save(`Thalys_AI_${record.type||'consulto'}_${record.date||currentLocalDateStr()}.pdf`);
    showToast(tr('Risposta IA esportata in PDF'),'fa-file-pdf');
  }catch(e){console.error('AI PDF V11',e);showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');}
}
async function exportConsultSnapshotPDF(id){
  const record=(appState.consultations||[]).find(x=>x.id===id);if(!record)return;
  try{
    if(!await ensureJsPdfV11())throw new Error('JSPDF_NOT_LOADED');
    const pdf=makeThalysPdfV11(`${tr('Quadro generale')} · ${consultTypeLabel(record.type)}`,[
      formatConsultDate(record.date),
      `${record.period?.from||'—'} → ${record.period?.to||'—'}`,
      `${tr('Obiettivo')}: ${record.goal||'—'}`
    ]);
    Object.entries(record.snapshot||{}).forEach(([k,v])=>pdf.section(tr(k),pdfSafeTextV11(v)));
    const pages=pdf.doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      pdf.doc.setPage(i);pdf.doc.setTextColor(100,116,139);pdf.doc.setFontSize(7);
      pdf.doc.text(`Thalys · ${i}/${pages}`,194,289,{align:'right'});
    }
    pdf.doc.save(consultExportSafeName(record,'pdf'));
    showToast(tr('Consulto esportato in PDF'),'fa-file-pdf');
  }catch(e){console.error('Snapshot PDF V11',e);showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation');}
}


/* ==========================================================
   THALYS V12 — PDF loader + desktop profile-photo modal
   ========================================================== */
const THALYS_APP_VERSION_V12='12.0.0';

function loadScriptV12(src,id){
  return new Promise((resolve,reject)=>{
    const existing=document.getElementById(id);
    if(existing){
      if(existing.dataset.loaded==='1')return resolve(true);
      existing.addEventListener('load',()=>resolve(true),{once:true});
      existing.addEventListener('error',()=>reject(new Error('SCRIPT_LOAD_FAILED')),{once:true});
      return;
    }
    const s=document.createElement('script');
    s.id=id;s.src=src;s.async=true;
    s.onload=()=>{s.dataset.loaded='1';resolve(true)};
    s.onerror=()=>reject(new Error('SCRIPT_LOAD_FAILED'));
    document.head.appendChild(s);
  });
}
async function ensureJsPdfV11(){
  if(getJsPDFV11())return true;
  const sources=[
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
  ];
  for(let i=0;i<sources.length;i++){
    try{
      await loadScriptV12(sources[i],`thalys-jspdf-fallback-${i}`);
      if(getJsPDFV11())return true;
    }catch(_){}
  }
  return false;
}

/* Profile photo source:
   1) custom Thalys photo synced in foto_profilo.json
   2) Google account picture as a visual fallback */
function profilePhotoSourceV12(){
  const custom=appState?.profilePhoto?.dataUrl||'';
  if(custom)return custom;
  try{
    const gp=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
    return gp?.picture||'';
  }catch(_){return '';}
}
function renderProfilePhotoUI(){
  const data=profilePhotoSourceV12();
  document.querySelectorAll('.profile-photo-img').forEach(img=>{
    if(data){
      if(img.src!==data)img.src=data;
      img.classList.remove('hidden');
      img.style.display='block';
      img.onerror=()=>{
        img.classList.add('hidden');
        img.style.display='none';
        img.closest('button,div')?.querySelector('.profile-photo-fallback')?.classList.remove('hidden');
      };
    }else{
      img.removeAttribute('src');
      img.classList.add('hidden');
      img.style.display='none';
    }
  });
  document.querySelectorAll('.profile-photo-fallback').forEach(el=>el.classList.toggle('hidden',!!data));
}
function openProfilePhotoMenu(){
  const modal=document.getElementById('profile-photo-modal');if(!modal)return;
  renderProfilePhotoUI();
  modal.classList.remove('hidden');
  modal.style.display='flex';
  modal.style.pointerEvents='auto';
  modal.style.visibility='visible';
  modal.dataset.thalysModalOpen='1';
  modal.removeAttribute('inert');
  modal.setAttribute('aria-hidden','false');
  clearLegacyModalBodyLockV9?.();
  updateModalScrollLock?.();
  requestAnimationFrame(renderProfilePhotoUI);
}
function openProfilePhotoSettings(){openProfilePhotoMenu();}
function closeProfilePhotoModalV12(ev){
  ev?.preventDefault?.();ev?.stopPropagation?.();
  const modal=document.getElementById('profile-photo-modal');if(!modal)return;
  modal.classList.add('hidden');
  modal.style.display='none';
  modal.style.pointerEvents='none';
  modal.style.visibility='hidden';
  delete modal.dataset.thalysModalOpen;
  modal.setAttribute('aria-hidden','true');
  try{modal.setAttribute('inert','');}catch(_){}
  clearLegacyModalBodyLockV9?.();
  document.documentElement.classList.remove('modal-open-v9','modal-open-v9');
  document.body.classList.remove('modal-open-v9','modal-open-v9');
  setTimeout(()=>{modal.style.display='';modal.style.visibility='';normalizeModalStateV10?.();},0);
}
/* Backdrop click + Escape */
document.getElementById('profile-photo-modal')?.addEventListener('pointerdown',e=>{
  if(e.target===e.currentTarget)closeProfilePhotoModalV12(e);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && !document.getElementById('profile-photo-modal')?.classList.contains('hidden')){
    closeProfilePhotoModalV12(e);
  }
});

/* Make generic closeModal reliable for this desktop modal too. */
const _closeModalV12Base=closeModal;
closeModal=function(modalId){
  if(modalId==='profile-photo-modal'){closeProfilePhotoModalV12();return;}
  _closeModalV12Base(modalId);
};

/* Refresh photo UI after cloud-driven state changes and page restoration. */
window.addEventListener('pageshow',()=>setTimeout(renderProfilePhotoUI,60),{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(renderProfilePhotoUI,40);});
document.addEventListener('DOMContentLoaded',()=>setTimeout(renderProfilePhotoUI,180));


/* ==========================================================
   THALYS V13 — Light/Dark mode + logo switching + persistence
   ========================================================== */
const THALYS_THEME_KEY_V13='thalys_theme';
const THALYS_THEME_FILES_V13={
  dark:'./Thalys Logo Dark.png?v=22',
  light:'./Thalys Logo Light.png?v=22'
};
function normalizeThalysThemeV13(v){return v==='light'?'light':'dark';}
function savedThalysThemeV13(){
  const local=localStorage.getItem(THALYS_THEME_KEY_V13);
  const state=appState?.settings?.theme;
  return normalizeThalysThemeV13(local||state||'dark');
}
function updateThemeLogosV13(theme){
  const src=THALYS_THEME_FILES_V13[theme]||THALYS_THEME_FILES_V13.dark;
  ['welcome-thalys-logo','header-thalys-logo'].forEach(id=>{
    const img=document.getElementById(id);if(img&&img.getAttribute('src')!==src)img.setAttribute('src',src);
  });
  let favicon=document.querySelector('link[data-thalys-favicon="1"]');
  if(!favicon){favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/png';favicon.dataset.thalysFavicon='1';document.head.appendChild(favicon)}
  favicon.href=src;
}
function updateThemeControlsV13(theme){
  const dark=document.getElementById('theme-dark-btn'),light=document.getElementById('theme-light-btn');
  dark?.setAttribute('aria-pressed',String(theme==='dark'));
  light?.setAttribute('aria-pressed',String(theme==='light'));
}
function applyThalysThemeV13(theme,{persist=false,sync=false}={}){
  theme=normalizeThalysThemeV13(theme);
  document.body.dataset.thalysTheme=theme;
  document.documentElement.dataset.thalysTheme=theme;
  document.documentElement.style.colorScheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4fbfb':'#090d16');
  updateThemeLogosV13(theme);
  updateThemeControlsV13(theme);
  if(persist){
    localStorage.setItem(THALYS_THEME_KEY_V13,theme);
    if(window.appState){
      appState.settings={...(appState.settings||{}),theme};
      try{saveStateToLocal();}catch(_){}
      if(sync){try{scheduleDriveSave?.();}catch(_){}}
    }
  }
  return theme;
}
function setThalysThemeV13(theme){
  const t=applyThalysThemeV13(theme,{persist:true,sync:true});
  showToast(t==='light'?tr('Modalità chiara attivata'):tr('Modalità scura attivata'),t==='light'?'fa-sun':'fa-moon');
}
function reorderThemeCardV13(){
  const card=document.getElementById('appearance-settings-card'),settings=document.getElementById('tab-settings');
  if(!card||!settings)return;
  const language=[...settings.children].find(x=>x.textContent?.includes('Lingua')||x.querySelector?.('#app-language-select'));
  if(language)language.after(card);
}
function initializeThemeV13(){
  const theme=savedThalysThemeV13();
  applyThalysThemeV13(theme);
  reorderThemeCardV13();
}
document.addEventListener('DOMContentLoaded',()=>{
  initializeThemeV13();
  setTimeout(()=>{reorderThemeCardV13();updateThemeControlsV13(savedThalysThemeV13())},250);
});
window.addEventListener('pageshow',()=>applyThalysThemeV13(savedThalysThemeV13()),{passive:true});

/* Keep theme state when Drive data replaces/merges appState. */
const _renderAllViewsV13Base=renderAllViews;
renderAllViews=function(){
  _renderAllViewsV13Base();
  applyThalysThemeV13(savedThalysThemeV13());
  reorderThemeCardV13();
};


/* ==========================================================
   THALYS V14 — one modal system for the whole app
   ========================================================== */
const THALYS_MODAL_SELECTOR_V14='[id$="-modal"]';
let thalysMainScrollV14=0;

function openModalsV14(){
  return [...document.querySelectorAll(THALYS_MODAL_SELECTOR_V14)]
    .filter(m=>m.classList.contains('thalys-modal-open')&&!m.classList.contains('hidden'));
}
function lockBackgroundV14(){
  const main=document.querySelector('#app-shell > main');
  if(main && !main.classList.contains('thalys-background-locked')){
    thalysMainScrollV14=main.scrollTop;
    main.classList.add('thalys-background-locked');
  }
  document.documentElement.classList.add('thalys-modal-active');
  document.body.classList.add('thalys-modal-active');
}
function unlockBackgroundV14(){
  if(openModalsV14().length)return;
  const main=document.querySelector('#app-shell > main');
  if(main){
    main.classList.remove('thalys-background-locked');
    main.style.pointerEvents='';
    main.style.touchAction='';
    if(Math.abs(main.scrollTop-thalysMainScrollV14)>2)main.scrollTop=thalysMainScrollV14;
  }
  document.documentElement.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.body.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.body.style.top='';
  document.body.style.position='';
}
function openModalV14(modalId){
  const modal=document.getElementById(modalId);if(!modal)return;
  modal.classList.remove('hidden');
  modal.classList.add('thalys-modal-open');
  modal.dataset.thalysModalOpen='1';
  modal.style.pointerEvents='auto';
  modal.style.visibility='visible';
  modal.setAttribute('aria-hidden','false');
  modal.removeAttribute('inert');
  lockBackgroundV14();
  if(modalId==='cloud-modal'){
    try{
      const p=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
      updateAuthUI?.(p);
    }catch(_){updateAuthUI?.(null)}
  }
}
function closeModalV14(modalId){
  const modal=document.getElementById(modalId);if(!modal)return;
  modal.classList.add('hidden');
  modal.classList.remove('thalys-modal-open');
  delete modal.dataset.thalysModalOpen;
  modal.style.pointerEvents='none';
  modal.style.visibility='hidden';
  modal.setAttribute('aria-hidden','true');
  try{modal.setAttribute('inert','')}catch(_){}
  requestAnimationFrame(()=>{
    modal.style.visibility='';
    unlockBackgroundV14();
  });
}
function closeAllModalsV14(){
  document.querySelectorAll(THALYS_MODAL_SELECTOR_V14).forEach(modal=>{
    if(!modal.classList.contains('hidden')){
      modal.classList.add('hidden');
      modal.classList.remove('thalys-modal-open');
      delete modal.dataset.thalysModalOpen;
      modal.style.pointerEvents='none';
      modal.setAttribute('aria-hidden','true');
      try{modal.setAttribute('inert','')}catch(_){}
    }
  });
  requestAnimationFrame(unlockBackgroundV14);
}

/* Replace every legacy modal entry point. */
openModal=openModalV14;
closeModal=closeModalV14;
updateModalScrollLock=function(){
  if(openModalsV14().length)lockBackgroundV14();else unlockBackgroundV14();
};

/* Scroll wheel is always consumed by the foreground modal. */
function findModalScrollerV14(target,modal){
  let el=target instanceof Element?target:null;
  while(el && el!==modal){
    const st=getComputedStyle(el);
    if((st.overflowY==='auto'||st.overflowY==='scroll') && el.scrollHeight>el.clientHeight+2)return el;
    el=el.parentElement;
  }
  const candidates=[...modal.querySelectorAll('*')].filter(x=>{
    const st=getComputedStyle(x);
    return (st.overflowY==='auto'||st.overflowY==='scroll')&&x.scrollHeight>x.clientHeight+2;
  });
  return candidates[0]||null;
}
document.addEventListener('wheel',e=>{
  const modal=e.target?.closest?.(`${THALYS_MODAL_SELECTOR_V14}.thalys-modal-open`);
  if(!modal)return;
  const scroller=findModalScrollerV14(e.target,modal);
  e.preventDefault();
  e.stopPropagation();
  if(scroller)scroller.scrollTop+=e.deltaY;
},{capture:true,passive:false});

/* Prevent touch gestures from leaking through the backdrop. */
document.addEventListener('touchmove',e=>{
  const modal=e.target?.closest?.(`${THALYS_MODAL_SELECTOR_V14}.thalys-modal-open`);
  if(!modal)return;
  const scroller=findModalScrollerV14(e.target,modal);
  if(!scroller && e.cancelable)e.preventDefault();
},{capture:true,passive:false});

/* Generic backdrop close, but never when interacting with the modal card. */
document.addEventListener('pointerdown',e=>{
  const modal=e.target instanceof Element?e.target.closest(THALYS_MODAL_SELECTOR_V14):null;
  if(modal?.classList.contains('thalys-modal-open') && e.target===modal){
    closeModalV14(modal.id);
  }
},{capture:true});

/* Escape always closes the topmost open modal. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const open=openModalsV14();
  if(open.length){
    const top=open.sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0)).pop();
    closeModalV14(top.id);
  }
});

/* Changing main section closes any foreground overlay first. */
const _switchTabV14Base=switchTab;
switchTab=function(tabName){
  closeAllModalsV14();
  requestAnimationFrame(()=>_switchTabV14Base(tabName));
};

/* Normalize stale modal states after browser restore/background. */
function normalizeAllModalsV14(){
  document.querySelectorAll(THALYS_MODAL_SELECTOR_V14).forEach(m=>{
    if(m.classList.contains('hidden')){
      m.classList.remove('thalys-modal-open');
      delete m.dataset.thalysModalOpen;
      m.style.pointerEvents='none';
      m.setAttribute('aria-hidden','true');
    }
  });
  if(openModalsV14().length)lockBackgroundV14();else unlockBackgroundV14();
}
window.addEventListener('pageshow',normalizeAllModalsV14,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)normalizeAllModalsV14()});
document.addEventListener('DOMContentLoaded',normalizeAllModalsV14);


/* ==========================================================
   THALYS V15 — iPhone navigation reset + Light refinements
   ========================================================== */

/* Mark cards that need more precise Light-mode styling. */
function markThemeTargetsV15(){
  const water=document.getElementById('water-amount')?.closest('.bg-darkcard');
  if(water){
    water.classList.add('nutrition-water-card-v15');
    const icon=water.querySelector('.fa-glass-water')?.parentElement;icon?.classList.add('water-icon-v15');
    const target=[...water.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Target');target?.classList.add('water-target-v15');
    const add=[...water.querySelectorAll('button')].find(b=>b.textContent?.includes('250 ml')&&b.querySelector('.fa-plus'));add?.classList.add('water-add-v15');
  }
  const consultHero=document.querySelector('#tab-consult > div:first-child');
  if(consultHero){
    const note=[...consultHero.querySelectorAll('.rounded-2xl')].find(x=>x.textContent?.includes('I dati vengono inviati'));
    note?.classList.add('consult-privacy-note-v15');
  }
}

/* Retone canvas charts in Light mode so amber/yellow/teal/violet remain readable. */
function themeChartColorV15(c){
  if(typeof c!=='string')return c;
  const light=document.body.dataset.thalysTheme==='light';
  if(!light)return c;
  const exact={
    '#f59e0b':'#a85f00','#fbbf24':'#9a6700','#facc15':'#8f6400','#fb923c':'#b84a0b',
    '#22d3ee':'#0f766e','#34d399':'#047857','#2dd4bf':'#0f766e','#a78bfa':'#6d4bb8',
    '#8b5cf6':'#6542a4','#c4b5fd':'#6d4bb8','#84cc16':'#53760f'
  };
  const low=c.toLowerCase();
  if(exact[low])return exact[low];
  return c
    .replace(/rgba?\(251,\s*191,\s*36(?:,\s*([.\d]+))?\)/gi,(_,a)=>a?`rgba(154,103,0,${a})`:'rgb(154,103,0)')
    .replace(/rgba?\(251,\s*146,\s*60(?:,\s*([.\d]+))?\)/gi,(_,a)=>a?`rgba(184,74,11,${a})`:'rgb(184,74,11)')
    .replace(/rgba?\(45,\s*212,\s*191(?:,\s*([.\d]+))?\)/gi,(_,a)=>a?`rgba(15,118,110,${a})`:'rgb(15,118,110)')
    .replace(/rgba?\(34,\s*211,\s*238(?:,\s*([.\d]+))?\)/gi,(_,a)=>a?`rgba(15,118,110,${a})`:'rgb(15,118,110)')
    .replace(/rgba?\(167,\s*139,\s*250(?:,\s*([.\d]+))?\)/gi,(_,a)=>a?`rgba(109,75,184,${a})`:'rgb(109,75,184)');
}
function retoneChartsV15(){
  if(!window.Chart)return;
  const instances=Chart.instances?Object.values(Chart.instances):[];
  instances.forEach(ch=>{
    (ch.data?.datasets||[]).forEach(ds=>{
      ['borderColor','backgroundColor','pointBackgroundColor','pointBorderColor'].forEach(k=>{
        if(Array.isArray(ds[k]))ds[k]=ds[k].map(themeChartColorV15);
        else ds[k]=themeChartColorV15(ds[k]);
      });
    });
    try{ch.update('none')}catch(_){}
  });
}

/* A single, synchronous tab switch for all platforms.
   This intentionally bypasses the V9/V10/V14 wrapper chain, which could leave
   WebKit/iPhone in an intermediate locked frame after entering Consulto. */
function hardUnlockNavigationV15(){
  document.querySelectorAll('[id$="-modal"]').forEach(modal=>{
    if(modal.classList.contains('hidden')){
      modal.classList.remove('thalys-modal-open');
      delete modal.dataset.thalysModalOpen;
      modal.style.pointerEvents='none';
      modal.setAttribute('aria-hidden','true');
    }
  });
  const main=document.querySelector('#app-shell > main');
  const nav=document.querySelector('#app-shell > nav');
  [main,nav].forEach(el=>{
    if(!el)return;
    el.removeAttribute('inert');
    el.style.pointerEvents='auto';
    el.style.touchAction=el===nav?'manipulation':'pan-y';
  });
  main?.classList.remove('thalys-background-locked');
  document.documentElement.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.body.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.body.style.top='';
  document.body.style.position='';
  document.body.style.inset='';
  document.body.style.width='';
}
function closeAllModalsImmediateV15(){
  document.querySelectorAll('[id$="-modal"]').forEach(modal=>{
    if(!modal.classList.contains('hidden')){
      modal.classList.add('hidden');
      modal.classList.remove('thalys-modal-open');
      delete modal.dataset.thalysModalOpen;
      modal.style.pointerEvents='none';
      modal.setAttribute('aria-hidden','true');
      try{modal.setAttribute('inert','')}catch(_){}
    }
  });
  hardUnlockNavigationV15();
}
function switchTabV15(tabName){
  closeAllModalsImmediateV15();
  const tabs=['home','workout','meditation','nutrition','body','analytics','consult','settings'];
  tabs.forEach(t=>{
    const section=document.getElementById(`tab-${t}`);
    const navBtn=document.getElementById(`nav-${t}`);
    if(!section)return;
    const active=t===tabName;
    section.classList.toggle('hidden',!active);
    if(navBtn){
      navBtn.classList.toggle('text-cyan-400',active);
      navBtn.classList.toggle('text-slate-400',!active);
      navBtn.setAttribute('aria-current',active?'page':'false');
    }
  });
  const main=document.querySelector('#app-shell > main');
  if(main)main.scrollTop=0;

  if(tabName==='home'){renderTodayDashboard();renderHomeAvatar();}
  if(tabName==='meditation'){renderMeditationStats();renderMeditationPage();}
  if(tabName==='body'){renderBodyMetrics();setTimeout(()=>{aggiornaAvatarDaUltimaMisura();renderHomeAvatar()},50);}
  if(tabName==='analytics'){updateAnalyticsCharts();setTimeout(retoneChartsV15,30);}
  if(tabName==='consult'){renderConsultations();renderAIConsultHistory();refreshConsultSelectors();}
  if(tabName==='settings'){updateOptionsFocusToggle?.();}

  markThemeTargetsV15();
  if(document.body.dataset.thalysTheme==='light')setTimeout(retoneChartsV15,20);
  hardUnlockNavigationV15();
}
/* Final authoritative override. No requestAnimationFrame wrapper. */
switchTab=switchTabV15;

/* Touch fallback for iPhone fixed bottom navigation.
   pointerup is used only as a recovery path when WebKit suppresses the synthetic click. */
document.querySelector('#app-shell > nav')?.addEventListener('pointerup',e=>{
  const btn=e.target?.closest?.('button[id^="nav-"]');if(!btn)return;
  if(e.pointerType==='touch'){
    const tab=btn.id.replace(/^nav-/,'');
    if(tab && !document.getElementById(`tab-${tab}`)?.classList.contains('hidden'))return;
    switchTabV15(tab);
  }
},{passive:true});

function applyV15ThemeFinishing(){
  markThemeTargetsV15();
  hardUnlockNavigationV15();
  if(document.body.dataset.thalysTheme==='light')setTimeout(retoneChartsV15,20);
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(applyV15ThemeFinishing,220));
window.addEventListener('pageshow',()=>setTimeout(applyV15ThemeFinishing,50),{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(applyV15ThemeFinishing,40)});

/* Retone newly rendered charts whenever theme changes. */
const _applyThalysThemeV15Base=applyThalysThemeV13;
applyThalysThemeV13=function(theme,opts={}){
  const out=_applyThalysThemeV15Base(theme,opts);
  setTimeout(()=>{markThemeTargetsV15();retoneChartsV15()},30);
  return out;
};


/* ==========================================================
   THALYS V16 — profile photo source consistency
   ========================================================== */
function googleProfilePictureV16(){
  try{
    const session=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
    if(session?.picture)return session.picture;
  }catch(_){}
  try{
    const token=localStorage.getItem('google_id_token')||sessionStorage.getItem('google_id_token');
    const payload=token&&typeof parseJwt==='function'?parseJwt(token):null;
    if(payload?.picture)return payload.picture;
  }catch(_){}
  return '';
}
function normalizeProfilePhotoStateV16(){
  const p=appState?.profilePhoto;
  if(p?.dataUrl && !p.mode){
    // Existing Thalys custom photos remain explicit overrides after migration.
    appState.profilePhoto={...p,mode:'custom'};
  }else if(!p){
    appState.profilePhoto={mode:'google',dataUrl:'',updatedAt:new Date(0).toISOString()};
  }else if(!p.mode){
    appState.profilePhoto={...p,mode:'google'};
  }
  return appState.profilePhoto;
}
function profilePhotoSourceV12(){
  const p=normalizeProfilePhotoStateV16();
  if(p?.mode==='custom' && p.dataUrl)return p.dataUrl;
  return googleProfilePictureV16();
}
function renderProfilePhotoUI(){
  const data=profilePhotoSourceV12();
  document.querySelectorAll('.profile-photo-img').forEach(img=>{
    if(data){
      if(img.src!==data)img.src=data;
      img.classList.remove('hidden');
      img.style.display='block';
      img.onerror=()=>{
        const google=googleProfilePictureV16();
        if(img.src!==google && google){img.src=google;return;}
        img.classList.add('hidden');img.style.display='none';
        img.closest('button,div')?.querySelector('.profile-photo-fallback')?.classList.remove('hidden');
      };
    }else{
      img.removeAttribute('src');img.classList.add('hidden');img.style.display='none';
    }
  });
  document.querySelectorAll('.profile-photo-fallback').forEach(el=>el.classList.toggle('hidden',!!data));
}
const _handleProfilePhotoChangeV16Base=handleProfilePhotoChange;
handleProfilePhotoChange=async function(event){
  const file=event?.target?.files?.[0];
  if(!file)return;
  if(!file.type.startsWith('image/')){showToast(tr('Seleziona un file immagine'),'fa-triangle-exclamation');event.target.value='';return;}
  try{
    const dataUrl=await resizeProfilePhoto(file);
    appState.profilePhoto={mode:'custom',dataUrl,updatedAt:new Date().toISOString()};
    saveStateToLocal();
    try{scheduleDriveSync?.(150)}catch(_){}
    renderProfilePhotoUI();
    showToast(tr('Foto Thalys salvata e sincronizzata'),'fa-user-check');
  }catch(e){
    console.warn('Profile photo V16',e);
    showToast(tr('Non riesco a elaborare questa foto'),'fa-triangle-exclamation');
  }finally{event.target.value='';}
};
removeProfilePhoto=function(){
  appState.profilePhoto={mode:'google',dataUrl:'',updatedAt:new Date().toISOString()};
  saveStateToLocal();
  try{scheduleDriveSync?.(150)}catch(_){}
  renderProfilePhotoUI();
  showToast(tr('Foto Google ripristinata'),'fa-brands fa-google');
};

/* Preserve the dedicated Drive photo choice against app_state.json's intentional null.
   Also normalize legacy state after each cloud/render pass. */
const _mergeCloudIntoLocalV16Base=mergeCloudIntoLocal;
mergeCloudIntoLocal=function(cloud){
  const result=_mergeCloudIntoLocalV16Base(cloud);
  const p=result.profilePhoto;
  if(p?.dataUrl&&!p.mode)result.profilePhoto={...p,mode:'custom'};
  else if(!p)result.profilePhoto={mode:'google',dataUrl:'',updatedAt:new Date(0).toISOString()};
  else if(!p.mode)result.profilePhoto={...p,mode:'google'};
  return result;
};
document.addEventListener('DOMContentLoaded',()=>{
  normalizeProfilePhotoStateV16();
  setTimeout(renderProfilePhotoUI,220);
});
window.addEventListener('pageshow',()=>setTimeout(renderProfilePhotoUI,70),{passive:true});


/* ==========================================================
   THALYS V17 — meal calendar, Apple donuts, final graphics
   ========================================================== */
function renderMealHistory(){
  const box=document.getElementById('meal-history-list');if(!box)return;
  let a=document.getElementById('meal-history-from')?.value||'',b=document.getElementById('meal-history-to')?.value||'';
  if(a&&b&&a>b)[a,b]=[b,a];
  const rows=(appState.nutrition||[]).filter(x=>(!a||x.date>=a)&&(!b||x.date<=b));
  const dates=[...new Set(rows.map(x=>x.date))].sort().reverse();
  box.innerHTML=dates.length?dates.map(d=>{
    const dayRows=rows.filter(x=>x.date===d);
    const kcal=Math.round(dayRows.reduce((s,x)=>s+Number(x.kcal||0),0));
    const meals=new Set(dayRows.map(x=>x.meal)).size;
    return `<button type="button" class="meal-day-row-v17" onclick="openMealHistoryDetailV17('${d}')">
      <div class="min-w-0"><div class="text-[12px] font-black text-white">${weekdayLabel(d)}</div><div class="mt-1 text-[9px] text-slate-500">${d}</div></div>
      <div class="shrink-0 text-right"><div class="text-[10px] font-black text-emerald-300">${meals} ${tr('pasti')}</div><div class="mt-1 text-[9px] text-slate-500">${kcal} kcal <i class="fa-solid fa-chevron-right ml-1"></i></div></div>
    </button>`;
  }).join(''):`<div class="p-5 text-center text-[10px] text-slate-500">${tr('Nessun pasto nel periodo selezionato.')}</div>`;
}
function openMealHistoryDetailV17(date){
  const rows=(appState.nutrition||[]).filter(x=>x.date===date);
  const title=document.getElementById('meal-history-detail-title');
  const dateEl=document.getElementById('meal-history-detail-date');
  const list=document.getElementById('meal-history-detail-list');
  if(title)title.textContent=weekdayLabel(date);
  if(dateEl)dateEl.textContent=date;
  if(list)list.innerHTML=['Colazione','Pranzo','Cena','Spuntino'].map(meal=>{
    const xs=rows.filter(x=>x.meal===meal);
    const kcal=Math.round(xs.reduce((s,x)=>s+Number(x.kcal||0),0));
    return `<div class="rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="flex items-center justify-between"><b class="text-[10px] text-emerald-300">${tr(meal)}</b><span class="text-[9px] text-slate-500">${kcal} kcal</span></div>
      ${xs.length?xs.map(x=>`<div class="mt-2 flex items-center justify-between gap-3 text-[10px]"><span class="min-w-0 truncate">${escapeHTML(x.name)} · ${Number(x.grams||0)}g</span><span class="shrink-0 text-slate-500">${Math.round(x.kcal||0)} kcal</span></div>`).join(''):`<div class="mt-2 text-[9px] text-slate-600">${tr('Nessun alimento')}</div>`}
    </div>`;
  }).join('');
  openModal('meal-history-detail-modal');
}

/* Minimal Apple-like doughnuts: slim ring, spacing between segments, no heavy borders. */
function appleDonutPaletteV17(kind){
  return kind==='macro'
    ? ['#e76f83','#b98222','#607ca6','#477f91','#7d62a8','#b65c8d']
    : ['#2c7f83','#3c8b70','#167c78','#b95b24','#68832e','#9a4b87','#397b92','#665aa5','#9a6a12'];
}
function renderOneDonutV7(kind,defs){
  const cv=document.getElementById(kind==='macro'?'macroNutrientDonutV7':'microNutrientDonutV7');
  if(!cv||!window.Chart)return;
  const old=kind==='macro'?chartMacroV7:chartMicroV7;if(old)old.destroy();
  const pal=appleDonutPaletteV17(kind);
  const colors=defs.map((x,i)=>{
    const score=Math.max(.24,Math.min(1,nutrientScoreV7(x)/100));
    const hex=pal[i%pal.length];
    return hex;
  });
  const ringBg=document.body.dataset.thalysTheme==='light'?'#e3ecec':'#172033';
  const ch=new Chart(cv.getContext('2d'),{
    type:'doughnut',
    data:{labels:defs.map(x=>tr(x.label)),datasets:[{
      data:defs.map(()=>1),
      backgroundColor:colors,
      borderColor:ringBg,
      borderWidth:3,
      borderRadius:8,
      spacing:2,
      hoverOffset:4
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'76%',
      animation:{duration:420},
      plugins:{
        legend:{display:false},
        tooltip:{displayColors:false,backgroundColor:'rgba(15,23,42,.92)',padding:10,cornerRadius:10,callbacks:{
          label:c=>{const x=defs[c.dataIndex];return `${tr(x.label)} · ${Number(x.value.toFixed(1))}${x.unit} / ${x.target}${x.unit}`}
        }}
      },
      onClick:(evt,els)=>{if(els.length)showDonutNutrientV7(kind,defs[els[0].index])}
    }
  });
  if(kind==='macro')chartMacroV7=ch;else chartMicroV7=ch;
  const score=Math.round(defs.reduce((s,x)=>s+nutrientScoreV7(x),0)/defs.length);
  const se=document.getElementById(kind==='macro'?'macro-donut-score-v7':'micro-donut-score-v7');
  if(se)se.textContent=`${score}%`;
  const leg=document.getElementById(kind==='macro'?'macro-donut-legend-v7':'micro-donut-legend-v7');
  if(leg){
    leg.innerHTML='';
    defs.forEach((x,i)=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='min-h-10 p-2 text-left text-[9px]';
      b.innerHTML=`<span class="inline-block h-2 w-2 rounded-full mr-1.5" style="background:${colors[i]}"></span><span>${tr(x.label)}</span><b class="float-right text-slate-400">${nutrientScoreV7(x)}%</b>`;
      b.onclick=()=>showDonutNutrientV7(kind,x);
      leg.appendChild(b);
    });
  }
}

/* Mark body-history cards generated dynamically so Light CSS always applies. */
function markV17DynamicUI(){
  document.querySelectorAll('#body-history-list > div,#body-history-list > button').forEach(x=>x.classList.add('body-history-card'));
  const cloud=document.getElementById('cloud-status-icon');if(cloud)cloud.title=tr('Google Drive connesso');
}
const _renderBodyMetricsV17Base=renderBodyMetrics;
renderBodyMetrics=function(){_renderBodyMetricsV17Base();requestAnimationFrame(markV17DynamicUI)};

document.addEventListener('DOMContentLoaded',()=>setTimeout(markV17DynamicUI,200));


/* ==========================================================
   THALYS V18 — robust barcode camera
   ========================================================== */
let barcodeNativeDetectorV18=null;
let barcodeNativeLoopV18=0;
let barcodeStartingV18=false;

function barcodeMessageV18(text,tone='normal'){
  const el=document.getElementById('barcode-camera-message-v18');if(!el)return;
  if(!text){el.classList.add('hidden');el.textContent='';return;}
  el.textContent=text;el.classList.remove('hidden');
  el.classList.toggle('text-rose-300',tone==='error');
  el.classList.toggle('border-rose-500/30',tone==='error');
  el.classList.toggle('text-slate-300',tone!=='error');
}
function openScanProductModal(){
  stopBarcodeCamera();
  openModal('scan-product-modal');
  const input=document.getElementById('barcode-input');
  if(input)setTimeout(()=>input.focus({preventScroll:true}),100);
  barcodeMessageV18('');
}
function closeScanProductModalV18(){
  stopBarcodeCameraV18();
  closeModal('scan-product-modal');
}
function closeScanProductModal(){closeScanProductModalV18();}

async function ensureZXingV18(){
  if(window.ZXing?.BrowserMultiFormatReader)return true;
  const sources=[
    'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js',
    'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js'
  ];
  for(let i=0;i<sources.length;i++){
    try{
      await loadScriptV12?.(sources[i],`thalys-zxing-v18-${i}`);
      if(window.ZXing?.BrowserMultiFormatReader)return true;
    }catch(_){}
  }
  return !!window.ZXing?.BrowserMultiFormatReader;
}
function barcodeSetRunningUIV18(running){
  const video=document.getElementById('barcode-video');
  const empty=document.getElementById('barcode-camera-empty');
  const start=document.getElementById('start-camera-btn');
  const stop=document.getElementById('stop-camera-btn');
  if(video)video.classList.toggle('hidden',!running);
  if(empty)empty.classList.toggle('hidden',running);
  if(start){start.classList.toggle('hidden',running);start.disabled=barcodeStartingV18;}
  if(stop)stop.classList.toggle('hidden',!running);
}
async function startNativeBarcodeLoopV18(video){
  if(!('BarcodeDetector' in window))return false;
  try{
    const formats=await BarcodeDetector.getSupportedFormats?.();
    const wanted=['ean_13','ean_8','upc_a','upc_e','code_128'].filter(x=>!formats||formats.includes(x));
    barcodeNativeDetectorV18=new BarcodeDetector(wanted.length?{formats:wanted}:undefined);
  }catch(_){
    try{barcodeNativeDetectorV18=new BarcodeDetector()}catch(e){return false}
  }
  const scan=async()=>{
    if(!barcodeScanActive||!barcodeNativeDetectorV18||!video)return;
    try{
      if(video.readyState>=2){
        const found=await barcodeNativeDetectorV18.detect(video);
        const raw=found?.[0]?.rawValue;
        if(raw){handleBarcodeScanResult(raw);return;}
      }
    }catch(_){}
    barcodeNativeLoopV18=requestAnimationFrame(scan);
  };
  barcodeNativeLoopV18=requestAnimationFrame(scan);
  return true;
}
async function startZXingLoopV18(video){
  if(!await ensureZXingV18())return false;
  try{
    barcodeCameraReader=new ZXing.BrowserMultiFormatReader();
    const cb=(result,error)=>{
      if(!barcodeScanActive)return;
      if(result){
        const text=result.getText?result.getText():String(result.text||'');
        if(text)handleBarcodeScanResult(text);
      }else if(error && error.name && !/NotFound/i.test(error.name)){
        console.debug('Barcode scan',error.name);
      }
    };
    if(typeof barcodeCameraReader.decodeFromVideoElementContinuously==='function'){
      barcodeCameraReader.decodeFromVideoElementContinuously(video,cb);
      return true;
    }
    if(typeof barcodeCameraReader.decodeFromVideoElement==='function'){
      barcodeCameraReader.decodeFromVideoElement(video,cb);
      return true;
    }
    if(typeof barcodeCameraReader.decodeFromStream==='function'){
      barcodeCameraReader.decodeFromStream(barcodeCameraStream,video,cb);
      return true;
    }
  }catch(e){console.warn('ZXing V18',e)}
  return false;
}
async function requestCameraStreamV18(){
  const attempts=[
    {video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:{facingMode:'environment'},audio:false},
    {video:true,audio:false}
  ];
  let last=null;
  for(const constraints of attempts){
    try{return await navigator.mediaDevices.getUserMedia(constraints)}
    catch(e){last=e;if(e?.name==='NotAllowedError'||e?.name==='SecurityError')break}
  }
  throw last||new Error('CAMERA_FAILED');
}
async function startBarcodeCameraV18(){
  if(barcodeStartingV18||barcodeCameraStream)return;
  if(!window.isSecureContext && !['localhost','127.0.0.1'].includes(location.hostname)){
    barcodeMessageV18(tr('La fotocamera richiede HTTPS.'),'error');return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    barcodeMessageV18(tr('Fotocamera non disponibile nel browser.'),'error');return;
  }

  barcodeStartingV18=true;
  barcodeScanActive=false;
  barcodeSetRunningUIV18(false);
  barcodeMessageV18(tr('Apertura fotocamera…'));
  try{
    /* getUserMedia is requested immediately from the user gesture.
       This matters on iOS/Chrome, where delaying it behind library loading can fail. */
    const stream=await requestCameraStreamV18();
    barcodeCameraStream=stream;
    barcodeScanActive=true;

    const video=document.getElementById('barcode-video');
    if(!video)throw new Error('VIDEO_MISSING');
    video.srcObject=stream;
    video.setAttribute('playsinline','');
    video.playsInline=true;video.muted=true;
    barcodeSetRunningUIV18(true);

    try{await video.play()}catch(e){
      console.warn('Video play V18',e);
      await new Promise(r=>setTimeout(r,100));
      await video.play();
    }

    barcodeMessageV18(tr('Inquadra il codice a barre nel riquadro.'));
    const nativeStarted=await startNativeBarcodeLoopV18(video);
    if(!nativeStarted){
      const zxingStarted=await startZXingLoopV18(video);
      if(!zxingStarted){
        barcodeMessageV18(tr('Fotocamera attiva. Scanner automatico non disponibile: puoi inserire il codice manualmente.'));
      }
    }
  }catch(err){
    console.error('Camera V18',err);
    stopBarcodeCameraV18();
    const name=err?.name||'';
    if(name==='NotAllowedError'||name==='SecurityError'){
      barcodeMessageV18(tr('Permesso fotocamera negato. Abilitalo nelle impostazioni del browser e riprova.'),'error');
    }else if(name==='NotFoundError'||name==='DevicesNotFoundError'){
      barcodeMessageV18(tr('Nessuna fotocamera disponibile.'),'error');
    }else{
      barcodeMessageV18(tr('Non riesco ad aprire la fotocamera. Riprova o inserisci il codice manualmente.'),'error');
    }
  }finally{
    barcodeStartingV18=false;
    const start=document.getElementById('start-camera-btn');if(start)start.disabled=false;
  }
}
function stopBarcodeCameraV18(){
  barcodeScanActive=false;
  barcodeStartingV18=false;
  if(barcodeNativeLoopV18){cancelAnimationFrame(barcodeNativeLoopV18);barcodeNativeLoopV18=0}
  barcodeNativeDetectorV18=null;
  if(barcodeCameraControls?.stop){try{barcodeCameraControls.stop()}catch(_){}}
  barcodeCameraControls=null;
  if(barcodeCameraReader?.reset){try{barcodeCameraReader.reset()}catch(_){}}
  barcodeCameraReader=null;
  if(barcodeCameraStream){
    try{barcodeCameraStream.getTracks().forEach(t=>t.stop())}catch(_){}
    barcodeCameraStream=null;
  }
  const video=document.getElementById('barcode-video');
  if(video){try{video.pause()}catch(_){} video.srcObject=null}
  barcodeFlashEnabled=false;
  barcodeSetRunningUIV18(false);
  const flash=document.getElementById('flash-camera-btn');
  if(flash){
    flash.classList.remove('bg-amber-500','text-slate-950');
    flash.classList.add('bg-slate-800','text-slate-200');
    flash.innerHTML='<i class="fa-solid fa-bolt mr-1"></i> Flash';
  }
}
stopBarcodeCamera=stopBarcodeCameraV18;

/* If the generic modal system closes the scanner, release the camera too. */
const _closeModalV18Base=closeModal;
closeModal=function(id){
  if(id==='scan-product-modal')stopBarcodeCameraV18();
  return _closeModalV18Base(id);
};
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && barcodeCameraStream)stopBarcodeCameraV18();
});


/* ==========================================================
   THALYS V19 — photo manager + tab swipe
   ========================================================== */
function photoSafeTokenV19(v){
  return String(v||'').trim().replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')||'NA';
}
function photoExtV19(file){
  const type=String(file?.type||'').toLowerCase();
  if(type.includes('png'))return 'png';
  if(type.includes('webp'))return 'webp';
  if(type.includes('heic')||type.includes('heif'))return 'heic';
  return 'jpg';
}
function photoFilenameV19(date,view,part,ext='jpg'){
  return `${date}_${photoSafeTokenV19(view)}_${photoSafeTokenV19(part)}.${ext}`;
}
function normalizePhotoV19(p){
  return {
    ...p,
    date:p.date||String(p.createdAt||p.updatedAt||new Date().toISOString()).slice(0,10),
    view:p.view||'Fronte',
    part:p.part||'Full',
    favorite:!!p.favorite,
    filename:p.filename||p.driveName||photoFilenameV19(p.date||currentLocalDateStr(),p.view||'Fronte',p.part||'Full','jpg')
  };
}
function normalizeAllPhotosV19(){
  appState.photos=Array.isArray(appState.photos)?appState.photos.map(normalizePhotoV19):[];
}
function updatePhotoCounterV19(){
  normalizeAllPhotosV19();
  const n=appState.photos.length;
  const c=document.getElementById('photo-count-v19');if(c)c.textContent=n;
  const m=document.getElementById('photo-manager-count-v19');if(m)m.textContent=`${n} ${n===1?tr('foto'):tr('foto')}`;
}
function openPhotoManagerV19(){
  updatePhotoCounterV19();
  updatePhotoFilterUIV19();
  renderPhotos();
  openModal('photo-manager-modal');
}
function openAddPhotoModalV19(){
  const d=document.getElementById('photo-add-date-v19');if(d)d.value=currentLocalDateStr();
  openModal('add-photo-modal-v19');
}
function updatePhotoFilterUIV19(){
  const t=document.getElementById('photo-filter-type')?.value||'all';
  ['date','month','year'].forEach(x=>document.getElementById(`photo-filter-${x}-wrap-v19`)?.classList.toggle('hidden',t!==x));
}
function photoFiltersV19(){
  return {
    type:document.getElementById('photo-filter-type')?.value||'all',
    date:document.getElementById('photo-filter-date')?.value||'',
    month:document.getElementById('photo-filter-month')?.value||'',
    year:document.getElementById('photo-filter-year')?.value||'',
    view:document.getElementById('photo-filter-view-v19')?.value||'all',
    part:document.getElementById('photo-filter-part-v19')?.value||'all',
    favorites:!!document.getElementById('photo-filter-favorites-v19')?.checked
  };
}
function visiblePhotosV19(){
  normalizeAllPhotosV19();
  const f=photoFiltersV19();
  return appState.photos.filter(p=>{
    const dateOK=f.type==='all'||(f.type==='date'&&p.date===f.date)||(f.type==='month'&&String(p.date).startsWith(f.month))||(f.type==='year'&&String(p.date).startsWith(String(f.year)));
    return dateOK&&(f.view==='all'||p.view===f.view)&&(f.part==='all'||p.part===f.part)&&(!f.favorites||p.favorite);
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
function renderPhotos(){
  updatePhotoCounterV19();
  const gallery=document.getElementById('photo-gallery');if(!gallery)return;
  const photos=visiblePhotosV19();
  gallery.innerHTML=photos.length?photos.map(photo=>`
    <button type="button" onclick="openPhotoViewerV19('${photo.id}')" class="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left">
      <img src="${photo.base64||''}" alt="${escapeHTML(photo.filename||'Foto progresso')}" class="h-full w-full object-cover">
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent px-2.5 pb-2 pt-7">
        <div class="flex items-end justify-between gap-2">
          <div class="min-w-0"><div class="truncate text-[10px] font-black text-white">${escapeHTML(photo.view)} · ${escapeHTML(photo.part)}</div><div class="mt-0.5 text-[8px] text-slate-300">${photo.date}</div></div>
          ${photo.favorite?'<i class="fa-solid fa-star text-amber-300"></i>':''}
        </div>
      </div>
    </button>`).join(''):`<div class="col-span-2 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-[10px] text-slate-500">${tr('Nessuna foto per i filtri selezionati.')}</div>`;
}
async function handlePhotoUploadV19(event){
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')){showToast(tr('Seleziona un’immagine valida'));event.target.value='';return;}
  const date=document.getElementById('photo-add-date-v19')?.value||currentLocalDateStr();
  const view=document.getElementById('photo-add-view-v19')?.value||'Fronte';
  const part=document.getElementById('photo-add-part-v19')?.value||'Full';
  const filename=photoFilenameV19(date,view,part,photoExtV19(file));
  try{
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const photo={id:'photo_'+Date.now(),date,view,part,favorite:false,filename,base64,updatedAt:new Date().toISOString()};
    appState.photos=Array.isArray(appState.photos)?appState.photos:[];
    appState.photos.unshift(photo);
    saveStateToLocal();
    closeModal('add-photo-modal-v19');
    updatePhotoCounterV19();renderPhotos();
    showToast(getAccessToken()?tr('Foto salvata · sincronizzazione Drive…'):tr('Foto salvata'),'fa-camera');

    if(getAccessToken()){
      try{
        await initializeDriveWorkspace();
        const folder=driveFolders?.photoFolderId||(await ensureFolderAfterConsent('foto',driveFolders.appFolderId,'La cartella foto non esiste. Vuoi crearla in Thalys App?'))?.id;
        if(folder){
          driveFolders.photoFolderId=folder;
          const uploadFile=new File([file],filename,{type:file.type||'image/jpeg'});
          const uploaded=await uploadDriveFile(filename,uploadFile,uploadFile.type,folder,true);
          photo.driveFileId=uploaded.id;photo.driveName=filename;photo.updatedAt=new Date().toISOString();
          saveStateToLocal();scheduleDriveSync?.(200);
        }
      }catch(e){console.warn('Photo Drive V19',e);showSyncError?.(classifyDriveError?.(e)||e);}
    }
  }catch(e){console.error(e);showToast(tr('Impossibile caricare la foto'))}
  finally{event.target.value='';}
}
handlePhotoUpload=handlePhotoUploadV19;
function photoByIdV19(id){normalizeAllPhotosV19();return appState.photos.find(p=>p.id===id)}
function openPhotoViewerV19(id){
  const p=photoByIdV19(id);if(!p)return;
  const img=document.getElementById('photo-viewer-img-v19');if(img)img.src=p.base64||'';
  const title=document.getElementById('photo-viewer-title-v19');if(title)title.textContent=p.filename||'Foto progresso';
  const meta=document.getElementById('photo-viewer-meta-v19');if(meta)meta.textContent=`${p.date} · ${p.view} · ${p.part}`;
  const fav=document.getElementById('photo-viewer-fav-v19');
  if(fav){
    fav.innerHTML=p.favorite?'<i class="fa-solid fa-star mr-1"></i>Preferito':'<i class="fa-regular fa-star mr-1"></i>Preferito';
    fav.onclick=()=>togglePhotoFavoriteV19(id);
  }
  const share=document.getElementById('photo-viewer-share-v19');if(share)share.onclick=()=>sharePhotoV19(id);
  const save=document.getElementById('photo-viewer-save-v19');if(save)save.onclick=()=>savePhotoToDeviceV19(id);
  openModal('photo-viewer-modal-v19');
}
function togglePhotoFavoriteV19(id){
  const p=photoByIdV19(id);if(!p)return;p.favorite=!p.favorite;p.updatedAt=new Date().toISOString();saveStateToLocal();scheduleDriveSync?.(250);renderPhotos();openPhotoViewerV19(id);
}
function dataUrlToBlobV19(dataUrl){
  const [head,data]=String(dataUrl||'').split(',');const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg';
  const bin=atob(data||''),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function sharePhotoV19(id){
  const p=photoByIdV19(id);if(!p?.base64)return;
  const blob=dataUrlToBlobV19(p.base64);
  const file=new File([blob],p.filename||'thalys-photo.jpg',{type:blob.type});
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:'Thalys',text:`${p.date} · ${p.view} · ${p.part}`});
      return;
    }
  }catch(e){if(e?.name==='AbortError')return}
  savePhotoToDeviceV19(id);
  showToast(tr('Condivisione diretta non disponibile: foto pronta per il salvataggio.'));
}
function savePhotoToDeviceV19(id){
  const p=photoByIdV19(id);if(!p?.base64)return;
  const a=document.createElement('a');a.href=p.base64;a.download=p.filename||'thalys-photo.jpg';document.body.appendChild(a);a.click();a.remove();
}
const _deletePhotoV19Base=deletePhoto;
deletePhoto=function(id){
  appState.photos=(appState.photos||[]).filter(p=>p.id!==id);saveStateToLocal();scheduleDriveSync?.(250);renderPhotos();updatePhotoCounterV19();showToast(tr('Foto eliminata'));
};

/* Swipe among the seven bottom-navigation sections.
   User convention: swipe RIGHT => next section. LEFT => previous section.
   Limits stop at Home and Consulto. */
const THALYS_SWIPE_TABS_V19=['home','workout','meditation','nutrition','body','analytics','consult'];
let swipeStartV19=null;
function currentMainTabV19(){
  return THALYS_SWIPE_TABS_V19.find(t=>!document.getElementById(`tab-${t}`)?.classList.contains('hidden'))||'home';
}
function swipeExcludedV19(target){
  return !!target?.closest?.('[id$="-modal"],input,textarea,select,button,a,canvas,[contenteditable="true"],.overflow-x-auto,.overflow-y-auto');
}
function installTabSwipeV19(){
  const main=document.querySelector('#app-shell > main');if(!main||main.dataset.swipeV19)return;main.dataset.swipeV19='1';
  main.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||swipeExcludedV19(e.target)){swipeStartV19=null;return}
    const t=e.touches[0];swipeStartV19={x:t.clientX,y:t.clientY,time:Date.now()};
  },{passive:true});
  main.addEventListener('touchend',e=>{
    if(!swipeStartV19||!e.changedTouches?.length){swipeStartV19=null;return}
    const t=e.changedTouches[0],dx=t.clientX-swipeStartV19.x,dy=t.clientY-swipeStartV19.y,dt=Date.now()-swipeStartV19.time;
    swipeStartV19=null;
    if(dt>800||Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.25)return;
    const current=currentMainTabV19(),i=THALYS_SWIPE_TABS_V19.indexOf(current);
    const next=dx>0?i+1:i-1;
    if(next<0||next>=THALYS_SWIPE_TABS_V19.length)return;
    switchTab(THALYS_SWIPE_TABS_V19[next]);
  },{passive:true});
}

/* Photo count follows all renders and cloud restores. */
const _renderAllViewsV19Base=renderAllViews;
renderAllViews=function(){
  _renderAllViewsV19Base();
  normalizeAllPhotosV19();updatePhotoCounterV19();
};
document.addEventListener('DOMContentLoaded',()=>{
  normalizeAllPhotosV19();updatePhotoCounterV19();installTabSwipeV19();
});


/* ==========================================================
   THALYS V20 — modal flow, swipe, photo manager, scroll recovery
   ========================================================== */
function unlockAppScrollV20(){
  const main=document.querySelector('#app-shell > main');
  const nav=document.querySelector('#app-shell > nav');
  document.documentElement.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.body.classList.remove('thalys-modal-active','modal-open','modal-open-v9');
  document.documentElement.style.overflow='';
  document.body.style.overflow='';
  document.body.style.position='';
  document.body.style.top='';
  document.body.style.inset='';
  document.body.style.width='';
  if(main){
    main.classList.remove('thalys-background-locked');
    main.removeAttribute('inert');
    main.style.overflowY='';
    main.style.pointerEvents='auto';
    main.style.touchAction='pan-y';
  }
  if(nav){
    nav.removeAttribute('inert');
    nav.style.pointerEvents='auto';
    nav.style.touchAction='manipulation';
  }
}
function forceHideModalV20(id){
  const m=document.getElementById(id);if(!m)return;
  m.classList.add('hidden');
  m.classList.remove('thalys-modal-open');
  delete m.dataset.thalysModalOpen;
  m.style.pointerEvents='none';
  m.style.visibility='';
  m.setAttribute('aria-hidden','true');
  try{m.setAttribute('inert','')}catch(_){}
}
function forceShowModalV20(id){
  const m=document.getElementById(id);if(!m)return;
  m.classList.remove('hidden');
  m.classList.add('thalys-modal-open');
  m.dataset.thalysModalOpen='1';
  m.style.pointerEvents='auto';
  m.style.visibility='visible';
  m.removeAttribute('inert');
  m.setAttribute('aria-hidden','false');
  lockBackgroundV14?.();
}

/* Meal database: child detail is truly above the dates page; X closes the whole database. */
function openMealHistory(){
  const a=document.getElementById('meal-history-from'),b=document.getElementById('meal-history-to');
  if(a&&!a.value)a.value='';if(b&&!b.value)b.value='';
  renderMealHistory();
  forceShowModalV20('meal-history-modal');
}
function openMealHistoryDetailV17(date){
  const rows=(appState.nutrition||[]).filter(x=>x.date===date);
  const title=document.getElementById('meal-history-detail-title');
  const dateEl=document.getElementById('meal-history-detail-date');
  const list=document.getElementById('meal-history-detail-list');
  if(title)title.textContent=weekdayLabel(date);
  if(dateEl)dateEl.textContent=date;
  if(list)list.innerHTML=['Colazione','Pranzo','Cena','Spuntino'].map(meal=>{
    const xs=rows.filter(x=>x.meal===meal);
    const kcal=Math.round(xs.reduce((s,x)=>s+Number(x.kcal||0),0));
    return `<div class="rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="flex items-center justify-between"><b class="text-[10px] text-emerald-300">${tr(meal)}</b><span class="text-[9px] text-slate-500">${kcal} kcal</span></div>
      ${xs.length?xs.map(x=>`<div class="mt-2 flex items-center justify-between gap-3 text-[10px]"><span class="min-w-0 truncate">${escapeHTML(x.name)} · ${Number(x.grams||0)}g</span><span class="shrink-0 text-slate-500">${Math.round(x.kcal||0)} kcal</span></div>`).join(''):`<div class="mt-2 text-[9px] text-slate-600">${tr('Nessun alimento')}</div>`}
    </div>`;
  }).join('');
  forceShowModalV20('meal-history-detail-modal');
}
function closeMealHistoryAllV20(){
  forceHideModalV20('meal-history-detail-modal');
  forceHideModalV20('meal-history-modal');
  unlockAppScrollV20();
}

/* Photo manager: never leave one hidden sheet underneath another. */
function openPhotoManagerV19(){
  forceHideModalV20('add-photo-modal-v19');
  forceHideModalV20('photo-viewer-modal-v19');
  updatePhotoCounterV19();updatePhotoFilterUIV19();renderPhotos();
  forceShowModalV20('photo-manager-modal');
}
function openAddPhotoModalV20(){
  forceHideModalV20('photo-manager-modal');
  const d=document.getElementById('photo-add-date-v19');if(d)d.value=currentLocalDateStr();
  forceShowModalV20('add-photo-modal-v19');
}
function closeAddPhotoModalV20(){
  forceHideModalV20('add-photo-modal-v19');
  unlockAppScrollV20();
  openPhotoManagerV19();
}
function openPhotoViewerV19(id){
  const p=photoByIdV19(id);if(!p)return;
  forceHideModalV20('photo-manager-modal');
  const img=document.getElementById('photo-viewer-img-v19');if(img)img.src=p.base64||'';
  const title=document.getElementById('photo-viewer-title-v19');if(title)title.textContent=p.filename||tr('Foto progresso');
  const meta=document.getElementById('photo-viewer-meta-v19');if(meta)meta.textContent=`${p.date} · ${p.view} · ${p.part}`;
  const fav=document.getElementById('photo-viewer-fav-v19');
  if(fav){fav.innerHTML=p.favorite?'<i class="fa-solid fa-star mr-1"></i>Preferito':'<i class="fa-regular fa-star mr-1"></i>Preferito';fav.onclick=()=>togglePhotoFavoriteV19(id)}
  const share=document.getElementById('photo-viewer-share-v19');if(share)share.onclick=()=>sharePhotoV19(id);
  const save=document.getElementById('photo-viewer-save-v19');if(save)save.onclick=()=>savePhotoToDeviceV19(id);
  forceShowModalV20('photo-viewer-modal-v19');
}
function closePhotoViewerV20(){
  forceHideModalV20('photo-viewer-modal-v19');
  unlockAppScrollV20();
  openPhotoManagerV19();
}

/* After a successful photo save, return to the gallery. */
const _handlePhotoUploadV20Base=handlePhotoUploadV19;
handlePhotoUploadV19=async function(event){
  await _handlePhotoUploadV20Base(event);
  forceHideModalV20('add-photo-modal-v19');
  unlockAppScrollV20();
  setTimeout(()=>openPhotoManagerV19(),30);
};
handlePhotoUpload=handlePhotoUploadV19;

/* Preserve V19 metadata in the dedicated Drive photo index. */
const _databasePayloadsV20Base=databasePayloads;
databasePayloads=function(){
  const out=_databasePayloadsV20Base();
  out['foto_index.json']=Object.fromEntries((appState.photos||[]).filter(p=>p.driveFileId).map(p=>[p.driveFileId,{
    id:p.driveFileId,
    name:p.driveName||p.filename||'',
    filename:p.filename||p.driveName||'',
    date:p.date,
    view:p.view||'Fronte',
    part:p.part||'Full',
    favorite:!!p.favorite,
    updatedAt:p.updatedAt||null
  }]));
  return out;
};

/* Rebuild photos from Drive while applying metadata from foto_index.json when present. */
loadPhotosFromDriveFolder=async function(){
  if(!getAccessToken()||!driveFolders?.appFolderId)return 0;
  const folder=await findDriveFolder('foto',driveFolders.appFolderId);if(!folder)return 0;driveFolders.photoFolderId=folder.id;
  const files=await listDriveImageFiles(folder.id,100);
  const idx=JSON.parse(localStorage.getItem('photo_index')||'{}');
  const byDrive=new Map((appState.photos||[]).filter(x=>x.driveFileId).map(x=>[x.driveFileId,x]));
  let added=0;
  for(const f of files){
    const meta=idx[f.id]||{};
    if(byDrive.has(f.id)){
      Object.assign(byDrive.get(f.id),normalizePhotoV19({...meta,driveFileId:f.id,driveName:f.name}));
      continue;
    }
    try{
      const blob=await downloadDriveFileBlob(f.id),base64=await blobToDataURL(blob);
      const parsed=String(f.name||'').replace(/\.[^.]+$/,'').split('_');
      const fallback={date:parsed[0]||String(f.createdTime||f.modifiedTime||'').slice(0,10),view:parsed[1]||'Fronte',part:parsed.slice(2).join('_')||'Full'};
      appState.photos=Array.isArray(appState.photos)?appState.photos:[];
      appState.photos.push(normalizePhotoV19({id:'drive_'+f.id,driveFileId:f.id,driveName:f.name,filename:f.name,base64,updatedAt:f.modifiedTime||f.createdTime,...fallback,...meta}));
      added++;
    }catch(e){console.warn('photo restore V20',f.name,e)}
  }
  updatePhotoCounterV19?.();
  return added;
};

/* Consult saved response close: immediately restore scroll on the same tab. */
function closeConsultViewerV20(ev){
  ev?.preventDefault?.();ev?.stopPropagation?.();
  forceHideModalV20('consult-snapshot-modal');
  unlockAppScrollV20();
  requestAnimationFrame(unlockAppScrollV20);
  setTimeout(unlockAppScrollV20,40);
}
closeConsultViewerV9=closeConsultViewerV20;
const _closeModalV20Base=closeModal;
closeModal=function(id){
  if(id==='consult-snapshot-modal'){closeConsultViewerV20();return}
  const out=_closeModalV20Base(id);
  requestAnimationFrame(()=>{
    const any=[...document.querySelectorAll('[id$="-modal"].thalys-modal-open')].some(m=>!m.classList.contains('hidden'));
    if(!any)unlockAppScrollV20();
  });
  return out;
};

/* Swipe fix: V19 excluded every target inside main because main itself is overflow-y-auto.
   Only truly interactive/horizontal regions are excluded now. */
swipeExcludedV19=function(target){
  return !!target?.closest?.('[id$="-modal"],input,textarea,select,button,a,canvas,[contenteditable="true"],.overflow-x-auto');
};

/* Additional iOS-safe swipe recognizer. The old V19 handler now also works because
   swipeExcludedV19 was fixed; this layer guards against WebKit dropping touchend. */
let swipe20={active:false,x:0,y:0,lastX:0,lastY:0,t:0};
function installSwipeV20(){
  const main=document.querySelector('#app-shell > main');if(!main||main.dataset.swipeV20)return;main.dataset.swipeV20='1';
  main.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||swipeExcludedV19(e.target)){swipe20.active=false;return}
    const p=e.touches[0];swipe20={active:true,x:p.clientX,y:p.clientY,lastX:p.clientX,lastY:p.clientY,t:Date.now()};
  },{passive:true});
  main.addEventListener('touchmove',e=>{
    if(!swipe20.active||e.touches.length!==1)return;const p=e.touches[0];swipe20.lastX=p.clientX;swipe20.lastY=p.clientY;
  },{passive:true});
  main.addEventListener('touchend',e=>{
    if(!swipe20.active)return;
    const dx=swipe20.lastX-swipe20.x,dy=swipe20.lastY-swipe20.y,dt=Date.now()-swipe20.t;swipe20.active=false;
    if(dt>1000||Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.15)return;
    const current=currentMainTabV19(),i=THALYS_SWIPE_TABS_V19.indexOf(current),next=dx>0?i+1:i-1;
    if(next>=0&&next<THALYS_SWIPE_TABS_V19.length)switchTab(THALYS_SWIPE_TABS_V19[next]);
  },{passive:true});
}

/* Bicipite only as the default body-measure chart selection. */
function enforceBodyChartDefaultV20(){
  const boxes=[...document.querySelectorAll('.body-chart-metric')];
  if(!boxes.length)return;
  boxes.forEach(b=>b.checked=b.value==='biceps');
  updateBodyMeasurementsChart?.();
}

document.addEventListener('DOMContentLoaded',()=>{
  installSwipeV20();
  setTimeout(()=>{
    enforceBodyChartDefaultV20();
    unlockAppScrollV20();
  },260);
});
window.addEventListener('pageshow',()=>setTimeout(unlockAppScrollV20,40),{passive:true});


/* ==========================================================
   THALYS V21 — Diet order + target-fill donuts + chart legend
   ========================================================== */

/* Water tracker belongs before breakfast/meals. */
function moveWaterBeforeMealsV21(){
  const meals=document.getElementById('meals-container');
  const water=document.getElementById('water-amount')?.closest('.bg-darkcard');
  if(meals&&water&&meals.parentElement===water.parentElement&&water.nextElementSibling!==meals){
    meals.parentElement.insertBefore(water,meals);
  }
  if(water)water.classList.add('nutrition-water-card-v15');
}

/* Donut helpers: every nutrient always occupies the same angular slice.
   Its slice is internally split into reached and missing target percentages. */
function donutProgressPctV21(x){
  const target=Number(x?.target||0),value=Number(x?.value||0);
  if(!target||target<=0)return 0;
  return Math.max(0,Math.min(100,value/target*100));
}
function hexRgbV21(hex){
  const h=String(hex||'#64748b').replace('#','');
  const s=h.length===3?h.split('').map(x=>x+x).join(''):h.padEnd(6,'0').slice(0,6);
  return [parseInt(s.slice(0,2),16)||0,parseInt(s.slice(2,4),16)||0,parseInt(s.slice(4,6),16)||0];
}
function shadeHexV21(hex,factor){
  const [r,g,b]=hexRgbV21(hex);
  const f=v=>Math.max(0,Math.min(255,Math.round(v*factor)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgbaHexV21(hex,a){
  const [r,g,b]=hexRgbV21(hex);return `rgba(${r},${g},${b},${a})`;
}
function donutGradientV21(ctx,base,reached){
  const area=ctx.chart?.chartArea;
  if(!area)return reached?base:shadeHexV21(base,.47);
  const g=ctx.chart.ctx.createLinearGradient(area.left,area.top,area.right,area.bottom);
  if(reached){
    g.addColorStop(0,rgbaHexV21(base,.98));
    g.addColorStop(.58,rgbaHexV21(base,.84));
    g.addColorStop(1,shadeHexV21(base,.80));
  }else{
    g.addColorStop(0,shadeHexV21(base,.46));
    g.addColorStop(.55,shadeHexV21(base,.38));
    g.addColorStop(1,rgbaHexV21(base,.30));
  }
  return g;
}
function renderOneDonutV7(kind,defs){
  const cv=document.getElementById(kind==='macro'?'macroNutrientDonutV7':'microNutrientDonutV7');
  if(!cv||!window.Chart)return;
  const old=kind==='macro'?chartMacroV7:chartMicroV7;if(old)old.destroy();

  const palette=appleDonutPaletteV17(kind);
  const values=[],labels=[];
  defs.forEach((x,i)=>{
    const pct=donutProgressPctV21(x);
    values.push(pct,100-pct);
    labels.push(`${tr(x.label)} · ${tr('raggiunto')}`,`${tr(x.label)} · ${tr('mancante')}`);
  });
  const ringBg=document.body.dataset.thalysTheme==='light'?'#e8f0f0':'#111827';

  const ch=new Chart(cv.getContext('2d'),{
    type:'doughnut',
    data:{
      labels,
      datasets:[{
        data:values,
        backgroundColor:ctx=>{
          const nutrient=Math.floor(ctx.dataIndex/2);
          const reached=ctx.dataIndex%2===0;
          return donutGradientV21(ctx,palette[nutrient%palette.length],reached);
        },
        borderColor:ringBg,
        borderWidth:2,
        borderRadius:5,
        spacing:1,
        hoverOffset:3
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      cutout:'76%',
      animation:{duration:450},
      interaction:{mode:'nearest',intersect:true},
      plugins:{
        legend:{display:false},
        tooltip:{
          displayColors:false,
          backgroundColor:'rgba(15,23,42,.94)',
          padding:10,
          cornerRadius:10,
          callbacks:{
            title:items=>{
              const idx=Math.floor((items?.[0]?.dataIndex||0)/2);
              return tr(defs[idx]?.label||'');
            },
            label:c=>{
              const i=Math.floor(c.dataIndex/2),x=defs[i],pct=donutProgressPctV21(x);
              return c.dataIndex%2===0
                ? `${tr('Raggiunto')}: ${pct.toFixed(0)}%`
                : `${tr('Mancante')}: ${(100-pct).toFixed(0)}%`;
            },
            afterLabel:c=>{
              const x=defs[Math.floor(c.dataIndex/2)];
              return `${Number(x.value.toFixed(1))}${x.unit} / ${x.target}${x.unit}`;
            }
          }
        }
      },
      onClick:(evt,els)=>{
        if(!els.length)return;
        const idx=Math.floor(els[0].index/2);
        showDonutNutrientV7(kind,defs[idx]);
      }
    }
  });
  if(kind==='macro')chartMacroV7=ch;else chartMicroV7=ch;

  const avg=Math.round(defs.reduce((s,x)=>s+donutProgressPctV21(x),0)/Math.max(1,defs.length));
  const se=document.getElementById(kind==='macro'?'macro-donut-score-v7':'micro-donut-score-v7');
  if(se)se.textContent=`${avg}%`;

  const leg=document.getElementById(kind==='macro'?'macro-donut-legend-v7':'micro-donut-legend-v7');
  if(leg){
    leg.innerHTML='';
    defs.forEach((x,i)=>{
      const pct=Math.round(donutProgressPctV21(x));
      const base=palette[i%palette.length];
      const b=document.createElement('button');
      b.type='button';
      b.className='min-h-10 p-2 text-left text-[9px]';
      b.innerHTML=`<span class="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style="background:${base}"></span><span>${tr(x.label)}</span><b class="float-right text-slate-400">${pct}%</b>`;
      b.onclick=()=>showDonutNutrientV7(kind,x);
      leg.appendChild(b);
    });
  }
}

/* Body measurements chart: filled circular legend markers, darker Light-mode text. */
updateBodyMeasurementsChart=function(){
  const ctx=document.getElementById('bodyMeasurementsChart')?.getContext('2d');if(!ctx)return;
  const selected=[...document.querySelectorAll('.body-chart-metric:checked')].map(x=>x.value);
  const f=getAnalyticsFilter();
  const rows=[...(appState.bodyMetrics||[])].filter(x=>f.periodDates.has(x.date)).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=rows.map(x=>x.date);
  const colors=['#b04fba','#2d7d83','#318464','#a85f00','#b84a68','#7050a8','#3f6d9d','#a94f82','#667b18'];
  const datasets=selected.map((key,i)=>({
    label:bodyMetricLabel(key)+' (cm)',
    data:rows.map(r=>r[key]===null||r[key]===undefined?null:Number(r[key])),
    borderColor:colors[i%colors.length],
    backgroundColor:colors[i%colors.length],
    pointBackgroundColor:colors[i%colors.length],
    pointBorderColor:colors[i%colors.length],
    spanGaps:true,tension:.28,pointRadius:3.2,pointHoverRadius:5,
    borderWidth:2
  }));
  if(chartBodyMeasurements)chartBodyMeasurements.destroy();
  const light=document.body.dataset.thalysTheme==='light';
  chartBodyMeasurements=new Chart(ctx,{
    type:'line',
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          display:true,
          labels:{
            color:light?'#314e53':'#cbd5e1',
            usePointStyle:true,
            pointStyle:'circle',
            boxWidth:8,
            boxHeight:8,
            padding:12,
            font:{size:9,weight:'600'}
          }
        }
      },
      scales:{
        x:{ticks:{color:light?'#516b70':'#64748b',font:{size:9}}},
        y:{ticks:{color:light?'#516b70':'#64748b',font:{size:10},callback:v=>`${v} cm`}}
      }
    }
  });
};

/* Re-apply order and chart style after app/theme renders. */
const _renderNutritionV21Base=renderNutrition;
renderNutrition=function(){
  _renderNutritionV21Base();
  moveWaterBeforeMealsV21();
};
const _applyThemeV21Base=applyThalysThemeV13;
applyThalysThemeV13=function(theme,opts={}){
  const out=_applyThemeV21Base(theme,opts);
  setTimeout(()=>{
    moveWaterBeforeMealsV21();
    renderNutritionDonutsV7?.();
    updateBodyMeasurementsChart?.();
  },40);
  return out;
};

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    moveWaterBeforeMealsV21();
    renderNutritionDonutsV7?.();
    updateBodyMeasurementsChart?.();
  },300);
});


/* ==========================================================
   THALYS V22 — Target calculator / database / donut single-slice
   ========================================================== */

const THALYS_TARGET_SOURCES_V22=[
  {name:'SINU · LARN V Revisione',url:'https://sinu.it/larn/',note:'Riferimenti italiani per energia e nutrienti; V Revisione 2024.'},
  {name:'SINU · Tabelle LARN',url:'https://sinu.it/materiale-supplementare-larn/',note:'Tabelle riassuntive e materiale supplementare LARN.'},
  {name:'CREA · Linee guida sana alimentazione',url:'https://www.crea.gov.it/web/alimenti-e-nutrizione',note:'Indicazioni pratiche italiane per una sana alimentazione.'},
  {name:'Ministero della Salute',url:'https://www.salute.gov.it/new/it/tema/nutrizione/',note:'Indicazioni nazionali per condizioni fisiologiche e salute pubblica.'},
  {name:'EFSA · Dietary Reference Values',url:'https://multimedia.efsa.europa.eu/drvs/index.htm',note:'DRV europei per energia e nutrienti.'},
  {name:'WHO · Healthy diet',url:'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',note:'Principi globali di adeguatezza, equilibrio, moderazione e diversità.'},
  {name:'FAO · Nutrition requirements',url:'https://www.fao.org/nutrition/requirements/en',note:'Riferimenti internazionali su fabbisogni energetici e nutrienti.'}
];

function ensureTargetStateV22(){
  if(!Array.isArray(appState.nutritionTargetPlans))appState.nutritionTargetPlans=[];
  if(appState.activeNutritionTargetPlanId===undefined)appState.activeNutritionTargetPlanId=null;
}
function latestBodyForTargetsV22(){
  return [...(appState.bodyMetrics||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;
}
function targetAutoDataV22(){
  const p=appState.profile||{},m=latestBodyForTargetsV22();
  const sex=normalizeProfileGenderValue(p.gender);
  const age=Number(p.age||0),height=Number(p.height||0),weight=Number(m?.weight||0);
  const missing=[];
  if(!['male','female'].includes(sex))missing.push(tr('sesso'));
  if(age<=0)missing.push(tr('età'));
  if(height<=0)missing.push(tr('altezza'));
  if(weight<=0)missing.push(tr('peso attuale'));
  if(missing.length)return {missing,sex,age,height,weight,bodyDate:m?.date||null};

  // Boer lean body mass. Height is in centimetres.
  let leanKg=sex==='male'
    ? .407*weight+.267*height-19.2
    : .252*weight+.473*height-48.3;
  // Keep the estimate physiologically bounded against obvious input errors.
  leanKg=Math.max(weight*.45,Math.min(weight*.96,leanKg));
  const fatKg=Math.max(0,weight-leanKg),leanPct=leanKg/weight*100,fatPct=fatKg/weight*100;
  const bmi=weight/Math.pow(height/100,2);
  const mifflin=sex==='male'
    ? 10*weight+6.25*height-5*age+5
    : 10*weight+6.25*height-5*age-161;
  const katch=370+21.6*leanKg;
  const mergedBmr=(mifflin+katch)/2;
  return {missing:[],sex,age,height,weight,leanKg,fatKg,leanPct,fatPct,bmi,mifflin,katch,mergedBmr,bodyDate:m?.date||null,
    bodyContext:{neck:m?.neck||null,waist:m?.waist||null,hips:m?.hips||null,biceps:m?.biceps||null,thigh:m?.thigh||null,calf:m?.calf||null,bfRecorded:m?.bf||null}};
}
function setTargetAutoUIV22(d){
  const tx=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  tx('target-auto-sex-v22',d.sex==='female'?tr('Donna'):tr('Uomo'));
  tx('target-auto-age-v22',d.age?`${d.age} ${tr('anni')}`:'—');
  tx('target-auto-height-v22',d.height?`${d.height} cm`:'—');
  tx('target-auto-weight-v22',d.weight?`${d.weight.toFixed(1)} kg`:'—');
  tx('target-auto-lean-v22',d.leanPct?`${d.leanPct.toFixed(1)}% · ${d.leanKg.toFixed(1)} kg`:'—');
  tx('target-auto-fat-v22',d.fatPct!==undefined?`${d.fatPct.toFixed(1)}% · ${d.fatKg.toFixed(1)} kg`:'—');
  tx('target-auto-bmi-v22',d.bmi?d.bmi.toFixed(1):'—');
  tx('target-auto-bmr-v22',d.mergedBmr?`${Math.round(d.mergedBmr)} kcal`:'—');
  tx('target-body-date-v22',d.bodyDate?`${tr('Misura')}: ${d.bodyDate}`:'—');
  const wrap=document.getElementById('target-missing-data-v22'),msg=document.getElementById('target-missing-data-text-v22');
  if(wrap)wrap.classList.toggle('hidden',!d.missing?.length);
  if(msg&&d.missing?.length)msg.textContent=`${tr('Completa in Corpo')}: ${d.missing.join(', ')}.`;
}
function activityFactorV22(v){return v==='sportivo'?1.725:v==='attivo'?1.55:1.2}
function goalFactorV22(v){return v==='loss'?.85:v==='gain'?1.10:1}
function physiologyEnergyV22(v){
  return v==='pregnancy1'?70:v==='pregnancy2'?350:v==='pregnancy3'?460:v==='lactation'?500:0;
}
function targetContextLabelV22(kind,v){
  const maps={
    activity:{sedentario:'Sedentario',attivo:'Attivo',sportivo:'Sportivo'},
    physiology:{none:'Nessuno',pregnancy1:'Gravidanza · 1° trimestre',pregnancy2:'Gravidanza · 2° trimestre',pregnancy3:'Gravidanza · 3° trimestre',lactation:'Allattamento',menopause:'Menopausa',older:'Terza età'},
    goal:{loss:'Dimagrimento',maintain:'Mantenimento',gain:'Aumento massa'}
  };
  return tr(maps[kind]?.[v]||v||'—');
}
function calculateTargetNumbersV22(d,activity,physiology,goal){
  const af=activityFactorV22(activity);
  const baseTdee=d.mergedBmr*af;
  let calories=baseTdee*goalFactorV22(goal)+physiologyEnergyV22(physiology);
  calories=Math.round(Math.max(1200,calories)/10)*10;

  // Protein: LARN adult baseline (0.9 g/kg); older adult SDT 1.1 g/kg.
  // Activity/goal multipliers are Thalys planning heuristics, bounded against energy share.
  let pk=activity==='sportivo'?1.6:activity==='attivo'?1.2:.9;
  if(goal==='loss')pk=Math.max(pk,1.6);
  if(goal==='gain')pk=Math.max(pk,1.6);
  if(physiology==='older'||d.age>=65)pk=Math.max(pk,1.1);
  let protein=pk*d.weight;
  if(physiology==='pregnancy1')protein+=1;
  if(physiology==='pregnancy2')protein+=8;
  if(physiology==='pregnancy3')protein+=26;
  if(physiology==='lactation')protein+=21;

  const proteinFloor=calories*.12/4;
  const proteinCeil=calories*(activity==='sportivo'||goal!=='maintain'?.25:.20)/4;
  protein=Math.round(Math.max(proteinFloor,Math.min(protein,proteinCeil)));

  // Fats kept inside WHO/LARN compatible energy envelope; carbohydrates use the remaining energy.
  let fatPct=physiology.startsWith('pregnancy')||physiology==='lactation'?.30:.28;
  let fat=Math.round(calories*fatPct/9);
  let carbs=Math.round((calories-protein*4-fat*9)/4);
  let carbPct=carbs*4/calories;
  if(carbPct<.45){
    fatPct=.22;fat=Math.round(calories*fatPct/9);carbs=Math.round((calories-protein*4-fat*9)/4);
  }
  if(carbs*4/calories>.70){
    fatPct=.30;fat=Math.round(calories*fatPct/9);carbs=Math.round((calories-protein*4-fat*9)/4);
  }

  const satFat=Math.round((calories*.10/9)*10)/10;
  const sugars=Math.round(calories*.10/4);
  const fiber=calories>=2400?30:25;
  const salt=5;

  let waterBase=d.sex==='male'?2500:2000;
  let water=Math.max(waterBase,d.weight*30);
  if(activity==='attivo')water+=300;
  if(activity==='sportivo')water+=600;
  if(physiology==='lactation')water+=700;
  water=Math.round(water/50)*50;

  let calcium=1000;
  if(physiology==='menopause'||physiology==='older'||d.age>=65)calcium=1200;
  let magnesium=d.sex==='male'?350:300;
  let zinc=d.sex==='male'?11:8;
  let iron=d.sex==='male'?11:16;
  if(physiology==='menopause'||physiology==='older')iron=11;
  if(physiology.startsWith('pregnancy')){iron=27;zinc=11;}
  if(physiology==='lactation'){iron=11;zinc=12;}
  const potassium=3500;

  return {
    calories, p:protein, c:Math.max(0,carbs), f:fat, satFat, sugars, fiber, salt,
    calcium, magnesium, zinc, iron, potassium, water,
    calculations:{
      boerLeanKg:Number(d.leanKg.toFixed(2)),
      boerFatKg:Number(d.fatKg.toFixed(2)),
      boerLeanPct:Number(d.leanPct.toFixed(2)),
      boerFatPct:Number(d.fatPct.toFixed(2)),
      mifflinBmr:Math.round(d.mifflin),
      katchBmr:Math.round(d.katch),
      mergedBmr:Math.round(d.mergedBmr),
      activityFactor:af,
      baseTdee:Math.round(baseTdee),
      goalFactor:goalFactorV22(goal),
      physiologicalEnergyAdd:physiologyEnergyV22(physiology),
      proteinCoefficient:pk
    }
  };
}
function setTargetValueInputsV22(t){
  const map={
    'target-input-kcal':t.calories,'target-input-p':t.p,'target-input-c':t.c,'target-input-f':t.f,
    'target-input-sat-fat':t.satFat,'target-input-sugars':t.sugars,'target-input-fiber':t.fiber,
    'target-input-water-v22':t.water||getWaterTarget(currentLocalDateStr()),
    'target-input-calcium':t.calcium,'target-input-magnesium':t.magnesium,'target-input-zinc':t.zinc,
    'target-input-iron':t.iron,'target-input-potassium':t.potassium,'target-input-salt':t.salt
  };
  Object.entries(map).forEach(([id,v])=>{const e=document.getElementById(id);if(e&&v!==undefined)e.value=v});
}
function readTargetValueInputsV22(){
  const n=id=>Number(document.getElementById(id)?.value||0);
  return {
    calories:Math.round(n('target-input-kcal')),p:Math.round(n('target-input-p')),c:Math.round(n('target-input-c')),f:Math.round(n('target-input-f')),
    satFat:Number(n('target-input-sat-fat').toFixed(1)),sugars:Math.round(n('target-input-sugars')),fiber:Math.round(n('target-input-fiber')),
    water:Math.round(n('target-input-water-v22')),calcium:Math.round(n('target-input-calcium')),magnesium:Math.round(n('target-input-magnesium')),
    zinc:Number(n('target-input-zinc').toFixed(1)),iron:Number(n('target-input-iron').toFixed(1)),potassium:Math.round(n('target-input-potassium')),
    salt:Number(n('target-input-salt').toFixed(1))
  };
}
let targetLastCalcV22=null;

function openTargetManagerV22(){
  ensureTargetStateV22();
  const d=targetAutoDataV22();
  setTargetAutoUIV22(d);
  setTargetValueInputsV22({...appState.targets,water:getWaterTarget(currentLocalDateStr())});
  const name=document.getElementById('target-plan-name-v22');
  if(name&&!name.value)name.value=`Target ${currentLocalDateStr()}`;
  const act=document.getElementById('target-calc-activity-v22');
  if(act&&!act.value){
    const life=String(appState.profile?.lifestyle||'').toLowerCase();
    act.value=life.includes('sed')?'sedentario':life.includes('att')?'sportivo':'attivo';
  }
  renderTargetPlanLibraryV22();
  openModal('target-modal');
}
function calculateNutritionTargetsV22(){
  const d=targetAutoDataV22();setTargetAutoUIV22(d);
  if(d.missing.length){showToast(tr('Completa prima i dati necessari nella sezione Corpo'),'fa-triangle-exclamation');return}
  const activity=document.getElementById('target-calc-activity-v22')?.value||'';
  const physiology=document.getElementById('target-calc-physiology-v22')?.value||'none';
  const goal=document.getElementById('target-calc-goal-v22')?.value||'';
  if(!activity||!goal){showToast(tr('Seleziona livello attività e obiettivo'),'fa-list-check');return}
  const t=calculateTargetNumbersV22(d,activity,physiology,goal);
  setTargetValueInputsV22(t);
  targetLastCalcV22={...t,anthropometry:d,context:{activity,physiology,goal},calculatedAt:new Date().toISOString()};
  const c=document.getElementById('target-calc-confidence-v22');
  if(c){c.textContent=tr('Stima personalizzata');c.className='rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[8px] font-black text-teal-300'}
}
function normalizeTargetPlanV22(p={}){
  return {
    id:p.id||`target_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name:p.name||`Target ${p.date||currentLocalDateStr()}`,
    date:p.date||currentLocalDateStr(),
    createdAt:p.createdAt||new Date().toISOString(),
    updatedAt:p.updatedAt||p.createdAt||new Date().toISOString(),
    anthropometry:p.anthropometry||{},
    context:p.context||{},
    calculations:p.calculations||{},
    targets:{...DEFAULT_STATE.targets,...(p.targets||{}),water:Number(p.targets?.water||p.water||2500)},
    sources:Array.isArray(p.sources)?p.sources:THALYS_TARGET_SOURCES_V22.map(x=>x.name),
    calculatorVersion:p.calculatorVersion||'22.0'
  };
}
function saveNutritionTargetPlanV22(){
  ensureTargetStateV22();
  const d=targetAutoDataV22();
  if(d.missing.length){setTargetAutoUIV22(d);showToast(tr('Completa prima i dati necessari nella sezione Corpo'),'fa-triangle-exclamation');return}
  const activity=document.getElementById('target-calc-activity-v22')?.value||'';
  const physiology=document.getElementById('target-calc-physiology-v22')?.value||'none';
  const goal=document.getElementById('target-calc-goal-v22')?.value||'';
  if(!activity||!goal){showToast(tr('Seleziona livello attività e obiettivo'),'fa-list-check');return}
  const targets=readTargetValueInputsV22();
  if(!targets.calories||!targets.p||!targets.c||!targets.f){showToast(tr('Calcola o compila i target prima di salvare'),'fa-calculator');return}
  const name=(document.getElementById('target-plan-name-v22')?.value||'').trim()||`Target ${currentLocalDateStr()}`;
  const calc=targetLastCalcV22?.context?.activity===activity&&targetLastCalcV22?.context?.goal===goal
    ? targetLastCalcV22
    : {calculations:calculateTargetNumbersV22(d,activity,physiology,goal).calculations};
  const plan=normalizeTargetPlanV22({
    name,date:currentLocalDateStr(),anthropometry:{
      sex:d.sex,age:d.age,height:d.height,weight:d.weight,leanKg:d.leanKg,leanPct:d.leanPct,fatKg:d.fatKg,fatPct:d.fatPct,bmi:d.bmi,bodyDate:d.bodyDate,bodyContext:d.bodyContext
    },
    context:{activity,physiology,goal},
    calculations:calc.calculations||{},
    targets,
    sources:THALYS_TARGET_SOURCES_V22.map(x=>x.name)
  });
  appState.nutritionTargetPlans.unshift(plan);
  if(document.getElementById('target-save-active-v22')?.checked)activateNutritionTargetPlanV22(plan.id,false);
  saveStateToLocal();scheduleDriveSync?.(180);renderTargetPlanLibraryV22();renderNutrition();
  showToast(tr('Scheda target salvata'),'fa-bullseye');
}
function activateNutritionTargetPlanV22(id,toast=true){
  ensureTargetStateV22();
  const p=appState.nutritionTargetPlans.find(x=>x.id===id);if(!p)return;
  appState.activeNutritionTargetPlanId=id;
  appState.targets={...appState.targets,...p.targets};
  if(p.targets.water)appState.settings={...(appState.settings||{}),waterTargetMl:Number(p.targets.water)};
  appState.targetsConfirmed=true;
  saveStateToLocal();scheduleDriveSync?.(180);
  loadTargetsUI();renderNutrition();renderTargetPlanLibraryV22();
  if(toast)showToast(tr('Scheda target attivata'),'fa-circle-check');
}
function deactivateNutritionTargetPlanV22(id){
  if(appState.activeNutritionTargetPlanId===id)appState.activeNutritionTargetPlanId=null;
  saveStateToLocal();scheduleDriveSync?.(180);renderTargetPlanLibraryV22();
  showToast(tr('Scheda target disattivata'),'fa-circle');
}
function targetPlanMatchesV22(p){
  const q=(document.getElementById('target-filter-search-v22')?.value||'').trim().toLowerCase();
  const st=document.getElementById('target-filter-status-v22')?.value||'all';
  const dt=document.getElementById('target-filter-date-v22')?.value||'';
  const active=p.id===appState.activeNutritionTargetPlanId;
  if(st==='active'&&!active)return false;if(st==='inactive'&&active)return false;
  if(dt&&p.date!==dt)return false;
  if(q&&!`${p.name} ${targetContextLabelV22('goal',p.context?.goal)} ${targetContextLabelV22('physiology',p.context?.physiology)} ${targetContextLabelV22('activity',p.context?.activity)}`.toLowerCase().includes(q))return false;
  return true;
}
function renderTargetPlanLibraryV22(){
  ensureTargetStateV22();
  appState.nutritionTargetPlans=appState.nutritionTargetPlans.map(normalizeTargetPlanV22);
  const box=document.getElementById('target-plan-list-v22');if(!box)return;
  const plans=appState.nutritionTargetPlans.filter(targetPlanMatchesV22);
  const active=appState.nutritionTargetPlans.find(x=>x.id===appState.activeNutritionTargetPlanId);
  const sum=document.getElementById('target-active-summary-v22');if(sum)sum.textContent=active?`${tr('Attiva')}: ${active.name}`:tr('Nessuna scheda attiva');
  box.innerHTML=plans.length?plans.map(p=>{
    const isActive=p.id===appState.activeNutritionTargetPlanId;
    return `<button type="button" onclick="openNutritionTargetPlanV22('${p.id}')" class="target-plan-card-v22 ${isActive?'active':''} w-full text-left">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-[11px] font-black text-white">${escapeHTML(p.name)}</div>
          <div class="mt-1 text-[9px] text-slate-500">${p.date} · ${escapeHTML(targetContextLabelV22('goal',p.context?.goal))} · ${escapeHTML(targetContextLabelV22('activity',p.context?.activity))}</div>
        </div>
        ${isActive?'<span class="rounded-full bg-teal-500/10 border border-teal-500/25 px-2 py-1 text-[8px] font-black text-teal-300">ATTIVA</span>':'<i class="fa-solid fa-chevron-right mt-1 text-slate-600"></i>'}
      </div>
      <div class="mt-2 grid grid-cols-4 gap-1 text-center"><span class="rounded-lg bg-slate-900/55 p-1.5 text-[8px] text-slate-400"><b class="block text-slate-200">${p.targets.calories}</b>kcal</span><span class="rounded-lg bg-slate-900/55 p-1.5 text-[8px] text-slate-400"><b class="block text-slate-200">${p.targets.p}g</b>P</span><span class="rounded-lg bg-slate-900/55 p-1.5 text-[8px] text-slate-400"><b class="block text-slate-200">${p.targets.c}g</b>C</span><span class="rounded-lg bg-slate-900/55 p-1.5 text-[8px] text-slate-400"><b class="block text-slate-200">${p.targets.f}g</b>G</span></div>
    </button>`;
  }).join(''):`<div class="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-[10px] text-slate-500">${tr('Nessuna scheda target trovata')}</div>`;
}
function targetPlanBodyHtmlV22(p){
  const a=p.anthropometry||{},t=p.targets||{},c=p.calculations||{};
  const physical=[
    ['Sesso',a.sex==='female'?'Donna':'Uomo'],['Età',a.age?`${a.age} anni`:'—'],['Altezza',a.height?`${a.height} cm`:'—'],['Peso',a.weight?`${Number(a.weight).toFixed(1)} kg`:'—'],
    ['Massa magra',a.leanPct?`${Number(a.leanPct).toFixed(1)}%`:'—'],['Massa grassa',a.fatPct!==undefined?`${Number(a.fatPct).toFixed(1)}%`:'—'],['BMI',a.bmi?Number(a.bmi).toFixed(1):'—'],['BMR',c.mergedBmr?`${c.mergedBmr} kcal`:'—']
  ];
  const values=[
    ['Calorie',`${t.calories} kcal`],['Proteine',`${t.p} g`],['Carboidrati',`${t.c} g`],['Grassi',`${t.f} g`],['Saturi max',`${t.satFat} g`],['Zuccheri max',`${t.sugars} g`],['Fibre',`${t.fiber} g`],['Acqua',`${t.water||'—'} ml`],
    ['Calcio',`${t.calcium} mg`],['Magnesio',`${t.magnesium} mg`],['Zinco',`${t.zinc} mg`],['Ferro',`${t.iron} mg`],['Potassio',`${t.potassium} mg`],['Sale max',`${t.salt} g`]
  ];
  return `<div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
    <div class="text-[9px] font-black uppercase tracking-[.14em] text-teal-300">Situazione fisica</div>
    <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">${physical.map(x=>`<div class="rounded-xl bg-slate-950/45 p-2"><div class="text-[8px] text-slate-500">${tr(x[0])}</div><div class="mt-1 text-[10px] font-black text-slate-200">${x[1]}</div></div>`).join('')}</div>
  </div>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
    <div class="text-[9px] font-black uppercase tracking-[.14em] text-teal-300">Contesto</div>
    <div class="mt-2 text-[10px] text-slate-300">${targetContextLabelV22('activity',p.context?.activity)} · ${targetContextLabelV22('physiology',p.context?.physiology)} · ${targetContextLabelV22('goal',p.context?.goal)}</div>
  </div>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
    <div class="text-[9px] font-black uppercase tracking-[.14em] text-teal-300">Target</div>
    <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">${values.map(x=>`<div class="rounded-xl bg-slate-950/45 p-2"><div class="text-[8px] text-slate-500">${tr(x[0])}</div><div class="mt-1 text-[10px] font-black text-slate-200">${x[1]}</div></div>`).join('')}</div>
  </div>`;
}
function openNutritionTargetPlanV22(id){
  ensureTargetStateV22();const p=appState.nutritionTargetPlans.find(x=>x.id===id);if(!p)return;
  const title=document.getElementById('target-view-title-v22'),date=document.getElementById('target-view-date-v22'),body=document.getElementById('target-view-body-v22');
  if(title)title.textContent=p.name;if(date)date.textContent=p.date;if(body)body.innerHTML=targetPlanBodyHtmlV22(p);
  const active=p.id===appState.activeNutritionTargetPlanId,ab=document.getElementById('target-view-active-btn-v22');
  if(ab){ab.textContent=active?tr('Disattiva'):tr('Rendi attiva');ab.onclick=()=>{active?deactivateNutritionTargetPlanV22(p.id):activateNutritionTargetPlanV22(p.id);closeModal('target-plan-viewer-modal-v22')}}
  const ib=document.getElementById('target-view-info-btn-v22');if(ib)ib.onclick=()=>openTargetInfoV22(p.id);
  const jb=document.getElementById('target-view-json-btn-v22');if(jb)jb.onclick=()=>exportTargetPlanJSONV22(p.id);
  const pb=document.getElementById('target-view-pdf-btn-v22');if(pb)pb.onclick=()=>exportTargetPlanPDFV22(p.id);
  openModal('target-plan-viewer-modal-v22');
}
function openTargetInfoV22(id=null){
  const p=id?(appState.nutritionTargetPlans||[]).find(x=>x.id===id):null;
  const info=document.getElementById('target-info-body-v22');if(!info)return;
  const calc=p?.calculations||targetLastCalcV22?.calculations||{};
  const live=p?.anthropometry||targetAutoDataV22();
  info.innerHTML=`
    <div class="target-source-card-v22 rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="font-black text-teal-300">Composizione corporea · Boer</div>
      <p class="mt-1">Uomo: LBM = 0,407×peso + 0,267×altezza(cm) − 19,2.<br>Donna: LBM = 0,252×peso + 0,473×altezza(cm) − 48,3.</p>
      <p class="mt-1 text-slate-500">Massa grassa = peso − massa magra. Le percentuali sono rapportate al peso totale. Boer usa sesso, altezza e peso; le circonferenze registrate in Corpo restano contesto antropometrico ma non entrano direttamente nella formula.</p>
    </div>
    <div class="target-source-card-v22 rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="font-black text-teal-300">Energia</div>
      <p class="mt-1">Thalys combina Mifflin–St Jeor con Katch–McArdle (quest'ultima usa la massa magra Boer) e usa la media come BMR operativo. Il BMR viene moltiplicato per il livello di attività; l'obiettivo applica un aggiustamento moderato (−15% dimagrimento, 0% mantenimento, +10% aumento massa).</p>
      ${calc.mergedBmr?`<p class="mt-1 text-slate-500">Questa scheda: Mifflin ${calc.mifflinBmr||'—'} kcal · Katch ${calc.katchBmr||'—'} kcal · media ${calc.mergedBmr||'—'} kcal · fattore attività ${calc.activityFactor||'—'}.</p>`:''}
      <p class="mt-1 text-slate-500">Per gravidanza/allattamento vengono applicati surplus energetici di riferimento; nelle condizioni speciali il risultato è da considerare solo orientativo.</p>
    </div>
    <div class="target-source-card-v22 rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="font-black text-teal-300">Macronutrienti e prevenzione</div>
      <p class="mt-1">Proteine: base LARN adulto 0,9 g/kg; Thalys aumenta il coefficiente quando selezioni attività/sport o obiettivi che richiedono maggiore tutela della massa magra. Per la terza età usa almeno 1,1 g/kg. Grassi restano normalmente entro ~20–30% dell'energia. Carboidrati ricevono l'energia residua mantenendo una quota compatibile con gli intervalli generali WHO. Saturi e zuccheri sono limitati al 10% dell'energia; sale max 5 g/die; fibra almeno 25 g/die.</p>
    </div>
    <div class="target-source-card-v22 rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div class="font-black text-teal-300">Enti e riferimenti utilizzati</div>
      <div class="mt-2 space-y-2">${THALYS_TARGET_SOURCES_V22.map(s=>`<div><a href="${s.url}" target="_blank" rel="noopener" class="font-bold underline">${escapeHTML(s.name)}</a><div class="text-slate-500">${escapeHTML(s.note)}</div></div>`).join('')}</div>
    </div>
    <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100">
      <b>${tr('Importante')}:</b> ${tr('questo calcolatore fornisce stime orientative per persone sane. Non sostituisce un piano dietetico professionale o una valutazione medica, soprattutto in gravidanza, allattamento, patologie, terapia farmacologica o fragilità geriatrica.')}
    </div>`;
  openModal('target-info-modal-v22');
}
function exportTargetPlanJSONV22(id){
  const p=(appState.nutritionTargetPlans||[]).find(x=>x.id===id);if(!p)return;
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=`Thalys_Target_${photoSafeTokenV19(p.name)}_${p.date}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
}
function exportAllTargetPlansJSONV22(){
  ensureTargetStateV22();
  const blob=new Blob([JSON.stringify({version:22,activeId:appState.activeNutritionTargetPlanId,plans:appState.nutritionTargetPlans},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=`Thalys_Targets_${currentLocalDateStr()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
}
async function importTargetPlansJSONV22(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    const raw=JSON.parse(await file.text());
    const arr=Array.isArray(raw)?raw:Array.isArray(raw.plans)?raw.plans:[raw];
    const incoming=arr.filter(x=>x&&typeof x==='object'&&(x.targets||x.calories)).map(x=>{
      if(!x.targets&&x.calories)x={...x,targets:{calories:x.calories,p:x.p,c:x.c,f:x.f,satFat:x.satFat,sugars:x.sugars,fiber:x.fiber,calcium:x.calcium,magnesium:x.magnesium,zinc:x.zinc,iron:x.iron,potassium:x.potassium,salt:x.salt,water:x.water}};
      return normalizeTargetPlanV22(x);
    });
    ensureTargetStateV22();
    const map=new Map(appState.nutritionTargetPlans.map(x=>[x.id,x]));incoming.forEach(x=>map.set(x.id,x));appState.nutritionTargetPlans=[...map.values()];
    saveStateToLocal();scheduleDriveSync?.(180);renderTargetPlanLibraryV22();showToast(`${tr('Schede target importate')}: ${incoming.length}`,'fa-file-import');
  }catch(e){console.error(e);showToast(tr('JSON target non valido'),'fa-triangle-exclamation')}
  finally{event.target.value=''}
}
async function exportTargetPlanPDFV22(id){
  const p=(appState.nutritionTargetPlans||[]).find(x=>x.id===id);if(!p)return;
  try{
    if(!await ensureJsPdfV11())throw new Error('JSPDF_NOT_LOADED');
    const pdf=makeThalysPdfV11(`Target nutrizionali · ${p.name}`,[
      p.date,
      `${tr('Attività')}: ${targetContextLabelV22('activity',p.context?.activity)}`,
      `${tr('Stato fisiologico')}: ${targetContextLabelV22('physiology',p.context?.physiology)}`,
      `${tr('Obiettivo')}: ${targetContextLabelV22('goal',p.context?.goal)}`
    ]);
    const a=p.anthropometry||{},t=p.targets||{},c=p.calculations||{};
    pdf.section(tr('Situazione fisica'),[
      `Sesso: ${a.sex==='female'?'Donna':'Uomo'}`,`Età: ${a.age||'—'} anni`,`Altezza: ${a.height||'—'} cm`,`Peso: ${a.weight||'—'} kg`,
      `Massa magra Boer: ${a.leanPct?Number(a.leanPct).toFixed(1):'—'}% (${a.leanKg?Number(a.leanKg).toFixed(1):'—'} kg)`,
      `Massa grassa stimata: ${a.fatPct!==undefined?Number(a.fatPct).toFixed(1):'—'}% (${a.fatKg?Number(a.fatKg).toFixed(1):'—'} kg)`,
      `BMI: ${a.bmi?Number(a.bmi).toFixed(1):'—'}`,`BMR combinato: ${c.mergedBmr||'—'} kcal`
    ].join('\n'));
    pdf.section(tr('Target consigliati'),[
      `Energia: ${t.calories} kcal`,`Proteine: ${t.p} g`,`Carboidrati: ${t.c} g`,`Grassi: ${t.f} g`,`Grassi saturi max: ${t.satFat} g`,`Zuccheri max: ${t.sugars} g`,
      `Fibre: ${t.fiber} g`,`Acqua: ${t.water||'—'} ml`,`Calcio: ${t.calcium} mg`,`Magnesio: ${t.magnesium} mg`,`Zinco: ${t.zinc} mg`,`Ferro: ${t.iron} mg`,`Potassio: ${t.potassium} mg`,`Sale max: ${t.salt} g`
    ].join('\n'));
    pdf.section(tr('Metodo di calcolo'),`Boer per massa magra; massa grassa per sottrazione. BMR operativo = media Mifflin–St Jeor e Katch–McArdle. Energia adattata a livello di attività, obiettivo e stato fisiologico. Target preventivi confrontati con LARN/SINU, CREA, Ministero della Salute, EFSA, WHO e FAO. Le stime restano orientative e modificabili.`);
    pdf.section(tr('Fonti'),THALYS_TARGET_SOURCES_V22.map(x=>`${x.name} — ${x.url}`).join('\n'));
    const pages=pdf.doc.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.doc.setPage(i);pdf.doc.setTextColor(100,116,139);pdf.doc.setFontSize(7);pdf.doc.text(`Thalys · ${i}/${pages}`,194,289,{align:'right'})}
    pdf.doc.save(`Thalys_Target_${photoSafeTokenV19(p.name)}_${p.date}.pdf`);
  }catch(e){console.error('Target PDF V22',e);showToast(tr('Esportazione PDF non riuscita'),'fa-triangle-exclamation')}
}

/* Existing saveTargets now creates a target plan instead of bypassing history. */
saveTargets=function(e){e?.preventDefault?.();saveNutritionTargetPlanV22()};

/* Existing loader remains compatible and also populates water. */
const _loadTargetsUIV22Base=loadTargetsUI;
loadTargetsUI=function(){
  _loadTargetsUIV22Base();
  const w=document.getElementById('target-input-water-v22');if(w)w.value=getWaterTarget(currentLocalDateStr());
};

/* Dedicated nutrition target database. */
ensureTargetStateV22();
const _databasePayloadsV22Base=databasePayloads;
databasePayloads=function(){
  const out=_databasePayloadsV22Base();
  out['nutrition_targets.json']={
    version:22,
    activeId:appState.activeNutritionTargetPlanId||null,
    plans:(appState.nutritionTargetPlans||[]).map(normalizeTargetPlanV22),
    updatedAt:new Date().toISOString()
  };
  if(out['thalys_manifest.json']){
    out['thalys_manifest.json']={...out['thalys_manifest.json'],schemaVersion:9,databaseVersion:7};
  }
  return out;
};
const _loadDatabasesFromDriveV22Base=loadDatabasesFromDrive;
loadDatabasesFromDrive=async function(consolidate=false){
  const ok=await _loadDatabasesFromDriveV22Base(consolidate);
  if(!ok||!getAccessToken()||!driveFolders?.databaseFolderId)return ok;
  try{
    const d=await readDriveJSON('nutrition_targets.json',driveFolders.databaseFolderId);
    if(d){
      ensureTargetStateV22();
      const incoming=Array.isArray(d)?d:(d.plans||[]);
      const map=new Map(appState.nutritionTargetPlans.map(x=>[x.id,normalizeTargetPlanV22(x)]));
      incoming.map(normalizeTargetPlanV22).forEach(x=>map.set(x.id,x));
      appState.nutritionTargetPlans=[...map.values()];
      if(d.activeId&&appState.nutritionTargetPlans.some(x=>x.id===d.activeId))appState.activeNutritionTargetPlanId=d.activeId;
      const active=appState.nutritionTargetPlans.find(x=>x.id===appState.activeNutritionTargetPlanId);
      if(active){
        appState.targets={...appState.targets,...active.targets};
        if(active.targets.water)appState.settings={...(appState.settings||{}),waterTargetMl:Number(active.targets.water)};
      }
      persistThalysStateLocally(appState);
      renderTargetPlanLibraryV22();
      loadTargetsUI();renderNutrition();
    }
  }catch(e){console.warn('nutrition_targets load V22',e)}
  return ok;
};

/* One slice per nutrient. The missing percentage is striped inside the same arc. */
function donutSlicePathV22(ctx,arc,start,end,innerPad=1.5,outerPad=1.5){
  const ir=Math.max(0,arc.innerRadius+innerPad),or=Math.max(ir+1,arc.outerRadius-outerPad);
  ctx.beginPath();
  ctx.arc(arc.x,arc.y,or,start,end,false);
  ctx.arc(arc.x,arc.y,ir,end,start,true);
  ctx.closePath();
}
const targetStripePluginV22={
  id:'thalysTargetStripeV22',
  afterDatasetDraw(chart,args,opts){
    if(args.index!==0)return;
    const defs=chart.$thalysDefsV22||[],meta=chart.getDatasetMeta(0),ctx=chart.ctx;
    meta.data.forEach((arc,i)=>{
      const x=defs[i];if(!x)return;
      const pct=donutProgressPctV21(x)/100;
      const start=arc.startAngle,end=arc.endAngle,split=start+(end-start)*pct;
      const base=chart.$thalysPaletteV22?.[i]||'#64748b';

      // Completed portion: solid/soft gradient.
      if(pct>0){
        ctx.save();
        donutSlicePathV22(ctx,arc,start,split);
        const g=ctx.createLinearGradient(arc.x-arc.outerRadius,arc.y-arc.outerRadius,arc.x+arc.outerRadius,arc.y+arc.outerRadius);
        g.addColorStop(0,rgbaHexV21(base,1));g.addColorStop(.6,rgbaHexV21(base,.88));g.addColorStop(1,shadeHexV21(base,.82));
        ctx.fillStyle=g;ctx.fill();
        ctx.restore();
      }

      // Missing portion: same hue, darker base plus soft diagonal bars.
      if(pct<1){
        ctx.save();
        donutSlicePathV22(ctx,arc,split,end);
        ctx.clip();
        ctx.fillStyle=shadeHexV21(base,.42);
        ctx.fillRect(arc.x-arc.outerRadius,arc.y-arc.outerRadius,arc.outerRadius*2,arc.outerRadius*2);
        ctx.globalAlpha=.26;
        ctx.strokeStyle=rgbaHexV21(base,.95);
        ctx.lineWidth=3;
        const r=arc.outerRadius*2.8;
        for(let k=-r;k<r;k+=10){
          ctx.beginPath();
          ctx.moveTo(arc.x-r,arc.y+k);
          ctx.lineTo(arc.x+r,arc.y+k+r);
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }
};
function renderOneDonutV7(kind,defs){
  const cv=document.getElementById(kind==='macro'?'macroNutrientDonutV7':'microNutrientDonutV7');if(!cv||!window.Chart)return;
  const old=kind==='macro'?chartMacroV7:chartMicroV7;if(old)old.destroy();
  const palette=appleDonutPaletteV17(kind);
  const ringBg=document.body.dataset.thalysTheme==='light'?'#e8f0f0':'#111827';
  const ch=new Chart(cv.getContext('2d'),{
    type:'doughnut',
    data:{labels:defs.map(x=>tr(x.label)),datasets:[{
      data:defs.map(()=>1),
      backgroundColor:defs.map((x,i)=>shadeHexV21(palette[i%palette.length],.42)),
      borderColor:ringBg,
      borderWidth:3,
      borderRadius:7,
      spacing:2,
      hoverOffset:4
    }]},
    plugins:[targetStripePluginV22],
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'76%',animation:{duration:430},
      plugins:{
        legend:{display:false},
        tooltip:{displayColors:false,backgroundColor:'rgba(15,23,42,.94)',padding:10,cornerRadius:10,callbacks:{
          title:items=>tr(defs[items?.[0]?.dataIndex||0]?.label||''),
          label:c=>{const x=defs[c.dataIndex],pct=donutProgressPctV21(x);return `${tr('Raggiunto')}: ${pct.toFixed(0)}% · ${Number(x.value.toFixed(1))}${x.unit} / ${x.target}${x.unit}`},
          afterLabel:c=>`${tr('Mancante')}: ${(100-donutProgressPctV21(defs[c.dataIndex])).toFixed(0)}%`
        }}
      },
      onClick:(evt,els)=>{if(els.length)showDonutNutrientV7(kind,defs[els[0].index])}
    }
  });
  ch.$thalysDefsV22=defs;ch.$thalysPaletteV22=palette;ch.update('none');
  if(kind==='macro')chartMacroV7=ch;else chartMicroV7=ch;
  const avg=Math.round(defs.reduce((s,x)=>s+donutProgressPctV21(x),0)/Math.max(1,defs.length));
  const se=document.getElementById(kind==='macro'?'macro-donut-score-v7':'micro-donut-score-v7');if(se)se.textContent=`${avg}%`;
  const leg=document.getElementById(kind==='macro'?'macro-donut-legend-v7':'micro-donut-legend-v7');
  if(leg){
    leg.innerHTML='';
    defs.forEach((x,i)=>{
      const pct=Math.round(donutProgressPctV21(x)),base=palette[i%palette.length];
      const b=document.createElement('button');b.type='button';b.className='min-h-10 p-2 text-left text-[9px]';
      b.innerHTML=`<span class="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style="background:${base}"></span><span>${tr(x.label)}</span><b class="float-right text-slate-400">${pct}%</b>`;
      b.onclick=()=>showDonutNutrientV7(kind,x);leg.appendChild(b);
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  ensureTargetStateV22();
  setTimeout(()=>{
    renderTargetPlanLibraryV22();
    const d=targetAutoDataV22();setTargetAutoUIV22(d);
  },350);
});
