// Thalys v0.29 - Nutrition domain extracted from app-core.js
// Food logging, water, nutrition targets, presets and nutrition rendering.

    function persistFoodDatabase(){appState.presets=sortFoodPresetsNewestFirst((appState.presets||[]).map(normalizeFoodPreset).filter(x=>x.name));saveStateToLocal({source:'nutrition-presets'}); }

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

    let mealPresetTarget = 'Colazione';
    let mealPresetPlannedContextV0504 = null;

    const FOOD_CATEGORIES=['Spuntino','Primo','Secondo','Contorno','Bevande','Altro'];
    const FOOD_UNITS=['Piatto','Fetta/Pz','Bicchiere'];
    function foodUnitMeasure(unitType,category=''){return category==='Bevande'||unitType==='Bicchiere'?'ml':'g';}
    function isFoodPresetComplete(p){return !!(p?.name && p?.category && p?.unitType && Number(p?.unitAmount)>0);}
    function updateFoodUnitMeasureUI(){const category=document.getElementById('preset-category')?.value||'',unitEl=document.getElementById('preset-unit');if(category==='Bevande'&&unitEl&&unitEl.value!=='Bicchiere')unitEl.value='Bicchiere';const unit=unitEl?.value||'Piatto',m=foodUnitMeasure(unit,category),label=document.getElementById('preset-unit-measure-label'),input=document.getElementById('preset-unit-amount');if(label)label.textContent=m;if(input)input.placeholder=m==='ml'?`ml per ${unit==='Bicchiere'?'bicchiere':'unità'}`:unit==='Piatto'?`Grammi per piatto`:`Grammi per fetta/pezzo`; }

    function openFoodForMeal(meal){
      mealPresetPlannedContextV0504=null;
      mealPresetTarget = meal || 'Colazione';
      const mode=document.getElementById('meal-preset-mode-label');if(mode)mode.textContent='Aggiungi pasto';
      const title=document.getElementById('meal-preset-target-label');
      if(title)title.textContent=mealPresetTarget;
      const search=document.getElementById('meal-preset-search');
      if(search)search.value='';
      const category=document.getElementById('meal-preset-category');if(category)category.value='Tutte';
      renderMealPresetPicker();
      openModal('add-food-modal');
      setTimeout(()=>search?.focus(),100);
    }

    function openFoodForPlannedMealV0504(date,meal){
      mealPresetPlannedContextV0504={date,meal:meal||'Pranzo'};
      mealPresetTarget=meal||'Pranzo';
      const mode=document.getElementById('meal-preset-mode-label');if(mode)mode.textContent='Aggiungi al Pianificato';
      const title=document.getElementById('meal-preset-target-label');if(title)title.textContent=mealPresetTarget;
      const search=document.getElementById('meal-preset-search');if(search)search.value='';
      const category=document.getElementById('meal-preset-category');if(category)category.value='Tutte';
      renderMealPresetPicker();
      openModal('add-food-modal');
      setTimeout(()=>search?.focus(),100);
    }

    function renderMealPresetPicker(){
      const list=document.getElementById('meal-preset-list');
      const empty=document.getElementById('meal-preset-empty');
      const count=document.getElementById('meal-preset-count');
      if(!list)return;
      appState.presets=sortFoodPresetsNewestFirst(appState.presets||[]);
      const search=(document.getElementById('meal-preset-search')?.value||'').trim().toLocaleLowerCase('it');
      const category=document.getElementById('meal-preset-category')?.value||'Tutte';
      const visible=[];
      (appState.presets||[]).forEach((raw,idx)=>{
        const p=normalizeFoodPreset(raw);appState.presets[idx]=p;
        const matchSearch=!search||p.name.toLocaleLowerCase('it').includes(search);
        const matchCategory=category==='Tutte'||p.category===category;
        if(matchSearch&&matchCategory)visible.push({p,idx});
      });
      if(count)count.textContent=(search||category!=='Tutte')?`${visible.length} risultati`:`${visible.length} alimenti`;
      if(empty)empty.classList.toggle('hidden',visible.length!==0);
      list.innerHTML=visible.map(({p,idx})=>{
        const complete=isFoodPresetComplete(p), unitLabel=p.unitType==='Fetta/Pz'?'fette/pz':p.unitType==='Bicchiere'?'bicchieri':'piatti';
        return `<div class="rounded-2xl border border-slate-800 bg-slate-900/75 p-3">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0 flex-1">
            <div class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-full ${complete?'bg-emerald-400':'bg-rose-500'}"></span><div class="truncate text-sm font-black text-white">${escapeHTML(p.name)}</div></div>
            <div class="mt-1 text-[10px] text-slate-400">${escapeHTML(p.category||'Categoria da compilare')} · ${p.unitType?`${escapeHTML(p.unitType)} = ${Number(p.unitAmount)||0} ${p.unitMeasure}`:'Unità da compilare'}</div>
            <div class="mt-1 text-[10px] text-slate-500">${Math.round(p.kcal)} kcal · P ${Number(p.p.toFixed(1))}g · C ${Number(p.c.toFixed(1))}g · G ${Number(p.f.toFixed(1))}g / 100${p.unitMeasure==='ml'?'ml':'g'}</div>
          </div></div>
          <div class="mt-3 grid ${complete?'grid-cols-2':'grid-cols-1'} gap-2">
            <label class="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><span class="text-[10px] font-bold text-slate-500">${p.unitMeasure==='ml'?'ml':'g'}</span><input id="meal-preset-grams-${idx}" type="number" min="0" step="0.01" value="${complete?'':'100'}" placeholder="Quantità" inputmode="decimal" class="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none"></label>
            ${complete?`<label class="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><span class="text-[10px] font-bold text-slate-500">${unitLabel}</span><input id="meal-preset-units-${idx}" type="number" min="0" step="0.01" value="1" inputmode="decimal" class="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none"></label>`:''}
          </div>
          <button type="button" onclick="addPresetToCurrentMeal(${idx})" class="mt-2 min-h-10 w-full rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950">Aggiungi</button>
        </div>`;
      }).join('');
    }

    function addPresetToCurrentMeal(index){
      const p=normalizeFoodPreset(appState.presets?.[Number(index)]);if(!p.name)return;
      const direct=Number(document.getElementById(`meal-preset-grams-${index}`)?.value||0);
      const units=Number(document.getElementById(`meal-preset-units-${index}`)?.value||0);
      let amount=direct>0?direct:(isFoodPresetComplete(p)&&units>0?units*Number(p.unitAmount):100);
      amount=Math.max(0.01,amount);
      if(mealPresetPlannedContextV0504){
        const {date,meal}=mealPresetPlannedContextV0504;
        const d=ensurePlannedOverrideV0500(date);
        d.items.push(mealPlanItemFromPresetV0500(p,meal,amount));
        d.updatedAt=new Date().toISOString();
        saveStateToLocal({source:'meal-plan-day'});
        scheduleDriveSync?.(180);
        mealPresetPlannedContextV0504=null;
        closeModal('add-food-modal');
        renderNutrition();
        showToast(`${p.name} aggiunto al Pianificato · ${meal} ✓`,'fa-circle-check');
        return;
      }
      const ratio=amount/100;
      const date=document.getElementById('nutrition-date')?.value||homeSelectedDate||new Date().toISOString().split('T')[0];
      const scaled=key=>(Number(p[key])||0)*ratio,protein=scaled('p'),carbs=scaled('c'),fat=scaled('f');
      const kcal=p.kcal>0?Math.round(p.kcal*ratio):Math.round((protein*4)+(carbs*4)+(fat*9));
      const newLog={id:'food_'+Date.now(),date,name:p.name,meal:mealPresetTarget,grams:amount,quantity:amount,quantityUnit:p.unitMeasure||'g',unitType:p.unitType||'',unitCount:direct>0?null:(units||null),category:p.category||'',p:protein,c:carbs,f:fat,satFat:scaled('satFat'),sugars:scaled('sugars'),calcium:scaled('calcium'),magnesium:scaled('magnesium'),zinc:scaled('zinc'),fiber:scaled('fiber'),salt:scaled('salt'),iron:scaled('iron'),potassium:scaled('potassium'),vitaminsId:p.vitaminsId||'',vitaminsLip:p.vitaminsLip||'',kcal};
      appState.nutrition.push(newLog);saveStateToLocal({source:'nutrition-meal-preset'});closeModal('add-food-modal');renderNutrition();updateAnalyticsCharts();renderHomeDashboard();showToast(`${p.name} aggiunto a ${mealPresetTarget} ✓`,'fa-circle-check');
    }

    function updateFoodDosePreview(){ /* v0.36.4: legacy no-op, manual meal entry removed */ }
    function saveFoodLog(e){ e?.preventDefault?.(); }

    function deleteFoodLog(id) {
      const log=(appState.nutrition||[]).find(n=>n.id===id);
      if(!confirm('Eliminare questo alimento dal diario?')) return;
      appState.nutrition = (appState.nutrition||[]).filter(n => n.id !== id);
      // v0.50.2: if the food came from Pianificato, removing it from Reale
      // must also remove the completion check in Pianificato.
      if(log?.source==='meal-plan' && log?.date && log?.plannedItemId){
        ensureMealPlanStateV0500?.();
        if(appState.mealPlanCompletions?.[log.date]){
          delete appState.mealPlanCompletions[log.date][log.plannedItemId];
          if(!Object.keys(appState.mealPlanCompletions[log.date]).length) delete appState.mealPlanCompletions[log.date];
        }
      }
      saveStateToLocal({source:log?.source==='meal-plan'?'meal-plan-completion':'nutrition-delete'});
      renderNutrition();
      renderHomeDashboard?.();
      updateAnalyticsCharts();
      showToast(log?.source==='meal-plan'?'Rimosso da Reale e Pianificato':'Alimento rimosso');
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

    function foodLogQuantityLabelV0500(log){
      const unit=(log?.category==='Bevande'||log?.quantityUnit==='ml'||log?.unitType==='Bicchiere')?'ml':'g';
      const value=Number(log?.quantity ?? log?.grams ?? 0);
      const n=Number.isInteger(value)?value:Number(value.toFixed(2));
      return `${n}${unit}`;
    }

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
              <div class="flex items-center justify-between text-xs ${l.source==='meal-plan'?'bg-violet-950/20 border-violet-500/20 opacity-80':'bg-slate-900/40 border-slate-800/60'} p-2 rounded-xl border">
                <div>
                  <div class="font-bold text-slate-200">${l.name} <span class="text-[10px] text-slate-400 font-normal">(${foodLogQuantityLabelV0500(l)})</span>${l.source==='meal-plan'?'<span class="ml-1 text-[8px] font-bold text-violet-300">dal piano</span>':''}</div>
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
      renderNutritionModeV0500();
    }

    function normalizeFoodPreset(item){const unitType=FOOD_UNITS.includes(item?.unitType)?item.unitType:'';return {
      name:String(item?.name||'').trim(),category:FOOD_CATEGORIES.includes(item?.category)?item.category:'',unitType,unitAmount:Number(item?.unitAmount)||0,unitMeasure:foodUnitMeasure(unitType,FOOD_CATEGORIES.includes(item?.category)?item.category:''),
      kcal:Number(item?.kcal)||0,p:Number(item?.p)||0,c:Number(item?.c)||0,f:Number(item?.f)||0,satFat:Number(item?.satFat ?? item?.saturatedFat)||0,sugars:Number(item?.sugars)||0,calcium:Number(item?.calcium)||0,magnesium:Number(item?.magnesium)||0,zinc:Number(item?.zinc)||0,
      fiber:Number(item?.fiber)||0,salt:Number(item?.salt)||0,iron:Number(item?.iron)||0,potassium:Number(item?.potassium)||0,vitaminsId:normalizeVitaminCodes(item?.vitaminsId ?? item?.vitaminsID ?? '', 'id'),vitaminsLip:normalizeVitaminCodes(item?.vitaminsLip ?? '', 'lip'),
      ...((item?.createdAt||item?.ts)?{createdAt:item.createdAt||item.ts}:{}),...((item?.updatedAt||item?.createdAt||item?.ts)?{updatedAt:item.updatedAt||item.createdAt||item.ts}:{})
    };}

    function sortFoodPresetsNewestFirst(items){
      return (items||[]).map((raw,index)=>({preset:normalizeFoodPreset(raw),index})).sort((a,b)=>{
        const at=Date.parse(a.preset.createdAt||a.preset.updatedAt||0)||0, bt=Date.parse(b.preset.createdAt||b.preset.updatedAt||0)||0;
        if(at!==bt)return bt-at;
        return a.index-b.index;
      }).map(x=>x.preset);
    }

    let editingFoodPresetIndex=null;

    const PRESET_FIELD_MAP=[['preset-name','name'],['preset-category','category'],['preset-unit','unitType'],['preset-unit-amount','unitAmount'],['preset-kcal','kcal'],['preset-p','p'],['preset-c','c'],['preset-f','f'],['preset-sat-fat','satFat'],['preset-sugars','sugars'],['preset-calcium','calcium'],['preset-magnesium','magnesium'],['preset-zinc','zinc'],['preset-fiber','fiber'],['preset-salt','salt'],['preset-iron','iron'],['preset-potassium','potassium'],['preset-vitamins-id','vitaminsId'],['preset-vitamins-lip','vitaminsLip']];

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

    function resetFoodPresetForm(){editingFoodPresetIndex=null;PRESET_FIELD_MAP.forEach(([id])=>{const e=document.getElementById(id);if(e)e.value='';});const c=document.getElementById('preset-category'),u=document.getElementById('preset-unit'),a=document.getElementById('preset-unit-amount');if(c)c.value='Altro';if(u)u.value='Piatto';if(a)a.value='100';updateFoodUnitMeasureUI();}

    function editFoodPreset(index){const p=normalizeFoodPreset(appState.presets[index]);editingFoodPresetIndex=index;toggleFoodPresetForm(true);PRESET_FIELD_MAP.forEach(([id,key])=>{const e=document.getElementById(id);if(e)e.value=p[key]??'';});updateFoodUnitMeasureUI();showToast('Modalità modifica attiva');}

    function applyPresetToForm(){ renderMealPresetPicker(); }

    function recalcFoodMacros(){ renderMealPresetPicker(); }

    function saveFoodPreset(e){
      e.preventDefault(); const raw={}; PRESET_FIELD_MAP.forEach(([id,key])=>raw[key]=document.getElementById(id)?.value||''); const now=new Date().toISOString();
      const existing=editingFoodPresetIndex===null?null:normalizeFoodPreset(appState.presets?.[editingFoodPresetIndex]);
      const p=normalizeFoodPreset({...raw,unitMeasure:foodUnitMeasure(raw.unitType,raw.category),createdAt:existing?.createdAt||now,updatedAt:now}); if(!p.name)return;if(!p.category||!p.unitType||p.unitAmount<=0){showToast('Completa Categoria, Unità e misura','fa-circle-exclamation');return;}
      if(editingFoodPresetIndex===null)appState.presets.unshift(p);else appState.presets[editingFoodPresetIndex]=p; persistFoodDatabase();renderPresets();resetFoodPresetForm();toggleFoodPresetForm(false);renderNutrition();renderHomeDashboard();showToast('Alimento salvato ✓ · sincronizzazione avviata','fa-bookmark');
    }

    function deletePreset(index){if(!confirm(`Eliminare ${appState.presets[index]?.name||'questo alimento'}?`))return;appState.presets.splice(index,1);saveStateToLocal();renderPresets();}

    function renderPresets(){
      const list=document.getElementById('presets-list');if(!list)return;appState.presets=sortFoodPresetsNewestFirst(appState.presets||[]);
      const search=(document.getElementById('food-preset-search')?.value||'').trim().toLocaleLowerCase('it'),category=document.getElementById('food-preset-category')?.value||'Tutte';list.innerHTML='';let visible=0;
      (appState.presets||[]).forEach((raw,idx)=>{const p=normalizeFoodPreset(raw);appState.presets[idx]=p;const matches=(!search||p.name.toLocaleLowerCase('it').includes(search))&&(category==='Tutte'||p.category===category);if(matches){visible++;const item=document.createElement('div'),complete=isFoodPresetComplete(p);item.className='bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs';item.innerHTML=`<div class="flex justify-between gap-2"><div class="min-w-0"><div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full ${complete?'bg-emerald-400':'bg-rose-500'}" title="${complete?'Completo':'Da completare'}"></span><div class="font-bold text-slate-200">${escapeHTML(p.name)}</div></div><div class="mt-1 text-[10px] ${p.category?'text-amber-300':'text-rose-300'}">${p.category||'Categoria da compilare'} · ${p.unitType?`${p.unitType} = ${p.unitAmount} ${p.unitMeasure}`:'Unità da compilare'}</div><div class="text-[10px] text-slate-400">${p.kcal} kcal · P ${p.p}g · C ${p.c}g · G ${p.f}g · Sat ${p.satFat}g · Zuc ${p.sugars}g</div><div class="text-[10px] text-slate-500">Fibre ${p.fiber}g · Sale ${p.salt}g · Ca ${p.calcium}mg · Mg ${p.magnesium}mg · Zn ${p.zinc}mg · Fe ${p.iron}mg · K ${p.potassium}mg</div><div class="text-[10px] text-slate-500">Vit ID ${p.vitaminsId||'—'} · Vit LIP ${p.vitaminsLip||'—'} / 100${p.unitMeasure==='ml'?'ml':'g'}</div></div><div class="flex gap-1"><button onclick="editFoodPreset(${idx})" class="text-cyan-400 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="deletePreset(${idx})" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></div></div>`;list.appendChild(item);}});
      const empty=document.getElementById('food-preset-search-empty');if(empty)empty.classList.toggle('hidden',visible!==0||(!search&&category==='Tutte'));const count=document.getElementById('food-preset-search-count');if(count)count.textContent=(search||category!=='Tutte')?`${visible} risultati`:`${(appState.presets||[]).length} alimenti`;if(document.getElementById('meal-preset-list'))renderMealPresetPicker();
    }

    // Thalys v0.50.0 - Reale / Pianificato nutrition plans
    const MEAL_PLAN_WEEKDAYS_V0500=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
    const MEAL_PLAN_MEALS_V0500=['Colazione','Pranzo','Cena','Spuntino'];
    let nutritionModeV0500='real', mealPlanBuilderIdV0500=null, mealPlanBuilderDayV0500='Lunedì', mealPlanBuilderSearchV0502='', mealPlanBuilderCategoryV0502='Tutti';

    function ensureMealPlanStateV0500(){
      appState.mealPlans=Array.isArray(appState.mealPlans)?appState.mealPlans:[];
      appState.mealPlanDailyOverrides=appState.mealPlanDailyOverrides&&typeof appState.mealPlanDailyOverrides==='object'?appState.mealPlanDailyOverrides:{};
      appState.mealPlanCompletions=appState.mealPlanCompletions&&typeof appState.mealPlanCompletions==='object'?appState.mealPlanCompletions:{};
    }
    function mealPlanWeekdayV0500(date){return MEAL_PLAN_WEEKDAYS_V0500[(new Date(`${date}T12:00:00`).getDay()+6)%7];}
    function getActiveMealPlanV0500(){ensureMealPlanStateV0500();return appState.mealPlans.find(p=>p.id===appState.activeMealPlanId)||null;}
    function normalizeMealPlanV0500(raw){
      const days={};MEAL_PLAN_WEEKDAYS_V0500.forEach(d=>days[d]=Array.isArray(raw?.days?.[d])?raw.days[d].map(x=>({...x,id:x.id||`mpi_${Date.now()}_${Math.random().toString(16).slice(2)}`})):[]);
      return {id:raw?.id||`mealplan_${Date.now()}`,name:String(raw?.name||'Piano alimentare').trim()||'Piano alimentare',days,createdAt:raw?.createdAt||new Date().toISOString(),updatedAt:raw?.updatedAt||new Date().toISOString()};
    }
    function mealPlanItemFromPresetV0500(p,meal,amount){
      p=normalizeFoodPreset(p);const q=Math.max(.01,Number(amount)||Number(p.unitAmount)||100);
      return {id:`mpi_${Date.now()}_${Math.random().toString(16).slice(2)}`,meal,name:p.name,amount:q,quantityUnit:p.category==='Bevande'?'ml':(p.unitMeasure||'g'),unitType:p.unitType||'',category:p.category||'',kcal:Number(p.kcal)||0,p:Number(p.p)||0,c:Number(p.c)||0,f:Number(p.f)||0,satFat:Number(p.satFat)||0,sugars:Number(p.sugars)||0,calcium:Number(p.calcium)||0,magnesium:Number(p.magnesium)||0,zinc:Number(p.zinc)||0,fiber:Number(p.fiber)||0,salt:Number(p.salt)||0,iron:Number(p.iron)||0,potassium:Number(p.potassium)||0,vitaminsId:p.vitaminsId||'',vitaminsLip:p.vitaminsLip||''};
    }
    function plannedItemToNutritionLogV0500(item,date,planId){
      const amount=Math.max(.01,Number(item.amount)||100),ratio=amount/100,scaled=k=>(Number(item[k])||0)*ratio;
      const protein=scaled('p'),carbs=scaled('c'),fat=scaled('f');
      return {id:`planned_${date}_${item.id}`,date,name:item.name,meal:item.meal,grams:amount,quantity:amount,quantityUnit:item.category==='Bevande'?'ml':(item.quantityUnit||'g'),unitType:item.unitType||'',unitCount:null,category:item.category||'',p:protein,c:carbs,f:fat,satFat:scaled('satFat'),sugars:scaled('sugars'),calcium:scaled('calcium'),magnesium:scaled('magnesium'),zinc:scaled('zinc'),fiber:scaled('fiber'),salt:scaled('salt'),iron:scaled('iron'),potassium:scaled('potassium'),vitaminsId:item.vitaminsId||'',vitaminsLip:item.vitaminsLip||'',kcal:Number(item.kcal)>0?Math.round(Number(item.kcal)*ratio):Math.round(protein*4+carbs*4+fat*9),source:'meal-plan',mealPlanId:planId,plannedItemId:item.id,updatedAt:new Date().toISOString()};
    }
    function getPlannedDayV0500(date,create=false){
      ensureMealPlanStateV0500();const plan=getActiveMealPlanV0500();if(!plan)return null;const current=appState.mealPlanDailyOverrides[date];if(current?.planId===plan.id)return current;
      const day=mealPlanWeekdayV0500(date),copy={planId:plan.id,day,items:(plan.days?.[day]||[]).map(x=>({...x})),updatedAt:new Date().toISOString()};
      if(create)appState.mealPlanDailyOverrides[date]=copy;return copy;
    }
    function setNutritionModeV0500(mode){nutritionModeV0500=mode==='planned'?'planned':'real';renderNutritionModeV0500();}
    function renderNutritionModeV0500(){
      const real=document.getElementById('nutrition-real-view'),planned=document.getElementById('nutrition-planned-view'),rb=document.getElementById('nutrition-mode-real'),pb=document.getElementById('nutrition-mode-planned');if(!real||!planned)return;
      const isPlanned=nutritionModeV0500==='planned';real.classList.toggle('hidden',isPlanned);planned.classList.toggle('hidden',!isPlanned);
      rb.className=`min-h-11 rounded-2xl border text-xs font-black ${!isPlanned?'border-emerald-500/30 bg-emerald-500/15 text-emerald-200':'border-slate-700 bg-slate-900 text-slate-400'}`;
      pb.className=`min-h-11 rounded-2xl border text-xs font-black ${isPlanned?'border-violet-500/30 bg-violet-500/15 text-violet-200':'border-slate-700 bg-slate-900 text-slate-400'}`;
      if(isPlanned)renderPlannedNutritionV0500();
    }
    function mealPlanItemKcalV0502(item){
      const amount=Math.max(0,Number(item?.amount)||0),ratio=amount/100;
      const base=Number(item?.kcal)||((Number(item?.p)||0)*4+(Number(item?.c)||0)*4+(Number(item?.f)||0)*9);
      return Math.round(base*ratio);
    }
    function mealPlanItemMacroTextV0502(item){
      const ratio=Math.max(0,Number(item?.amount)||0)/100;
      const n=v=>Math.round((Number(v)||0)*ratio*10)/10;
      return `${n(item?.p)}g P · ${n(item?.c)}g C · ${n(item?.f)}g G`;
    }
    function renderPlannedNutritionV0500(){
      ensureMealPlanStateV0500();
      const date=document.getElementById('nutrition-date')?.value||currentLocalDateStr(),head=document.getElementById('meal-plan-active-card'),box=document.getElementById('meal-plan-day-list');
      if(!head||!box)return;
      const plan=getActiveMealPlanV0500();
      if(!plan){head.innerHTML=`<div class="text-center py-5"><div class="text-3xl">🥗</div><div class="mt-2 text-sm font-black text-white">Nessun piano alimentare attivo</div><div class="mt-1 text-[10px] text-slate-500">Crea il tuo primo piano settimanale e rendilo attivo.</div><button onclick="openMealPlanManagerV0500()" class="mt-4 rounded-xl bg-violet-500 px-4 py-2 text-xs font-black text-slate-950">Gestisci piani</button></div>`;box.innerHTML='';return;}
      const dayData=getPlannedDayV0500(date,false),items=dayData?.items||[],weekday=mealPlanWeekdayV0500(date),completed=appState.mealPlanCompletions[date]||{};
      const done=items.filter(x=>completed[x.id]).length,total=items.length,pct=total?Math.round(done*100/total):0,totalKcal=items.reduce((a,x)=>a+mealPlanItemKcalV0502(x),0);
      head.innerHTML=`<div class="flex min-w-0 items-start justify-between gap-3"><div class="min-w-0"><div class="text-[9px] uppercase tracking-[.16em] text-violet-300">Piano attivo · ${weekday}</div><div class="mt-1 truncate text-lg font-black text-white">${escapeHTML(plan.name)}</div><div class="mt-1 text-[10px] text-slate-500">Le modifiche di oggi non cambiano il piano originale.</div></div><button onclick="openMealPlanManagerV0500()" class="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-black text-violet-200">Piani</button></div><div class="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3"><div class="flex items-end justify-between gap-3"><div><div class="text-[9px] uppercase tracking-[.14em] text-violet-300">Progresso di oggi</div><div class="mt-1 text-2xl font-black text-white">${done}<span class="text-sm text-slate-500"> / ${total}</span></div></div><div class="text-right"><div class="text-lg font-black text-violet-200">${pct}%</div><div class="text-[9px] text-slate-500">piatti rispettati</div></div></div><div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-900"><div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-emerald-400 transition-all" style="width:${pct}%"></div></div></div>`;
      box.innerHTML=MEAL_PLAN_MEALS_V0500.map(meal=>{
        const xs=items.filter(x=>x.meal===meal),mealKcal=xs.reduce((a,x)=>a+mealPlanItemKcalV0502(x),0);
        return `<div class="rounded-2xl border border-slate-800 bg-darkcard p-3"><div class="flex items-center justify-between gap-3"><div class="flex min-w-0 items-center gap-2"><b class="text-xs text-white">${meal}</b><button type="button" onclick="openFoodForPlannedMealV0504('${date}','${meal}')" class="meal-add-circle bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" aria-label="Aggiungi a ${meal} nel Pianificato"><i class="fa-solid fa-plus text-[10px]"></i></button></div><div class="text-right"><div class="text-[10px] font-black text-amber-300">${mealKcal} kcal</div><div class="text-[9px] text-slate-500">${xs.filter(x=>completed[x.id]).length}/${xs.length} completati</div></div></div><div class="mt-2 space-y-2">${xs.length?xs.map(x=>`<div class="rounded-xl border ${completed[x.id]?'border-emerald-500/25 bg-emerald-500/5':'border-slate-800 bg-slate-950/50'} p-2"><div class="flex items-start gap-2"><input type="checkbox" ${completed[x.id]?'checked':''} onchange="togglePlannedFoodConsumedV0500('${date}','${x.id}',this.checked)" class="mt-1 h-5 w-5 accent-emerald-500"><div class="min-w-0 flex-1"><div class="truncate text-xs font-bold ${completed[x.id]?'line-through text-emerald-300':'text-slate-200'}">${escapeHTML(x.name)}</div><div class="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500"><input type="number" min="0.01" step="0.01" value="${Number(x.amount)||100}" onchange="updatePlannedDayAmountV0500('${date}','${x.id}',this.value)" class="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-white"><span>${x.category==='Bevande'?'ml':(x.quantityUnit||'g')}</span><span class="text-amber-300">${mealPlanItemKcalV0502(x)} kcal</span></div><div class="mt-1 text-[9px] text-slate-600">${mealPlanItemMacroTextV0502(x)}</div></div><button onclick="removePlannedDayItemV0500('${date}','${x.id}')" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button></div></div>`).join(''):`<div class="py-2 text-[10px] italic text-slate-600">Nessun alimento previsto</div>`}</div></div>`;
      }).join('')+`<div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center"><div class="text-[9px] uppercase tracking-[.16em] text-amber-300">Calorie pianificate oggi</div><div class="mt-1 text-3xl font-black text-white">${totalKcal}<span class="ml-1 text-sm text-slate-500">kcal</span></div></div>`;
    }
    function ensurePlannedOverrideV0500(date){const x=getPlannedDayV0500(date,true);saveStateToLocal({source:'meal-plan-day'});return x;}
    function updatePlannedDayAmountV0500(date,id,value){const d=ensurePlannedOverrideV0500(date),x=d?.items.find(i=>i.id===id);if(!x)return;x.amount=Math.max(.01,Number(value)||.01);d.updatedAt=new Date().toISOString();if(appState.mealPlanCompletions?.[date]?.[id]){appState.nutrition=(appState.nutrition||[]).filter(n=>!(n.source==='meal-plan'&&n.date===date&&n.plannedItemId===id));appState.nutrition.push(plannedItemToNutritionLogV0500(x,date,d.planId));}saveStateToLocal({source:'meal-plan-day'});renderNutrition();}
    function removePlannedDayItemV0500(date,id){if(!confirm('Rimuovere questo alimento solo dal pianificato di questo giorno?'))return;const d=ensurePlannedOverrideV0500(date);if(!d)return;d.items=d.items.filter(x=>x.id!==id);if(appState.mealPlanCompletions?.[date])delete appState.mealPlanCompletions[date][id];appState.nutrition=(appState.nutrition||[]).filter(n=>!(n.source==='meal-plan'&&n.date===date&&n.plannedItemId===id));saveStateToLocal({source:'meal-plan-day'});renderNutrition();renderHomeDashboard();}
    function togglePlannedFoodConsumedV0500(date,id,on){const d=ensurePlannedOverrideV0500(date),x=d?.items.find(i=>i.id===id);if(!x)return;appState.mealPlanCompletions[date]=appState.mealPlanCompletions[date]||{};appState.mealPlanCompletions[date][id]=!!on;appState.nutrition=(appState.nutrition||[]).filter(n=>!(n.source==='meal-plan'&&n.date===date&&n.plannedItemId===id));if(on)appState.nutrition.push(plannedItemToNutritionLogV0500(x,date,d.planId));saveStateToLocal({source:'meal-plan-completion'});renderNutrition();renderHomeDashboard();updateAnalyticsCharts();showToast(on?'Aggiunto a Reale ✓':'Rimosso da Reale','fa-circle-check');}

    function openMealPlanManagerV0500(){ensureMealPlanStateV0500();mealPlanBuilderIdV0500=null;mealPlanBuilderDayV0500='Lunedì';mealPlanBuilderSearchV0502='';mealPlanBuilderCategoryV0502='Tutti';renderMealPlanManagerV0500();openModal('meal-plan-manager-modal');}
    function renderMealPlanManagerV0500(){
      const list=document.getElementById('meal-plan-library-v0500'),builder=document.getElementById('meal-plan-builder-v0500');if(!list||!builder)return;const active=appState.activeMealPlanId;
      list.innerHTML=(appState.mealPlans||[]).length?(appState.mealPlans||[]).map(p=>`<div class="meal-plan-saved-row-v0502 flex min-w-0 items-center gap-1.5 rounded-xl border ${p.id===active?'border-emerald-500/30':'border-slate-800'} bg-slate-950 px-2 py-2"><b class="min-w-0 flex-1 truncate text-[10px] text-white">${escapeHTML(p.name)}</b><button onclick="activateMealPlanV0500('${p.id}')" class="shrink-0 rounded-lg ${p.id===active?'bg-emerald-500/15 text-emerald-300':'bg-emerald-500 text-slate-950'} px-2 py-1.5 text-[9px] font-black">${p.id===active?'Attivo':'Rendi attivo'}</button><button onclick="editMealPlanV0500('${p.id}')" class="shrink-0 rounded-lg bg-cyan-500/10 px-2 py-1.5 text-[9px] font-black text-cyan-300">Modifica</button><button onclick="deleteMealPlanV0500('${p.id}')" class="shrink-0 rounded-lg bg-rose-500/10 px-2 py-1.5 text-[9px] font-black text-rose-300">Elimina</button></div>`).join(''):`<div class="text-[10px] text-slate-500">Nessun piano salvato.</div>`;
      if(!mealPlanBuilderIdV0500){builder.innerHTML=`<div class="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div class="text-sm font-black text-white">Crea un piano alimentare</div><div class="mt-1 text-[10px] text-slate-500">Costruiscilo giorno per giorno scegliendo gli alimenti già presenti nel database.</div><button onclick="newMealPlanV0500()" class="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-xs font-black text-slate-950"><i class="fa-solid fa-plus mr-1"></i> Nuovo piano alimentare</button></div>`;return;}
      const p=appState.mealPlans.find(x=>x.id===mealPlanBuilderIdV0500);if(!p){mealPlanBuilderIdV0500=null;return renderMealPlanManagerV0500();}
      const arr=p.days[mealPlanBuilderDayV0500]||[];
      builder.innerHTML=`<div class="rounded-2xl border border-violet-500/20 bg-slate-950 p-3"><label class="text-[9px] text-slate-500">Nome piano<input id="meal-plan-name-v0500" value="${escapeHTML(p.name)}" onchange="renameMealPlanV0500(this.value)" class="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"></label><div class="mt-3 grid grid-cols-7 gap-1">${MEAL_PLAN_WEEKDAYS_V0500.map(d=>`<button onclick="selectMealPlanBuilderDayV0500('${d}')" class="rounded-lg px-1 py-2 text-[8px] font-black ${d===mealPlanBuilderDayV0500?'bg-violet-500 text-slate-950':'bg-slate-900 text-slate-400'}">${d.slice(0,3)}</button>`).join('')}</div><div class="mt-4 space-y-2">${arr.length?arr.map(x=>`<div class="rounded-xl border border-slate-800 bg-slate-900 p-2"><div class="flex items-start gap-2"><select onchange="updateMealPlanOfficialItemV0500('${x.id}','meal',this.value)" class="rounded-lg bg-slate-950 px-2 py-1 text-[9px] text-white">${MEAL_PLAN_MEALS_V0500.map(m=>`<option ${m===x.meal?'selected':''}>${m}</option>`).join('')}</select><div class="min-w-0 flex-1"><div class="truncate text-[10px] font-black text-white">${escapeHTML(x.name)}</div><div class="mt-1 text-[9px] text-slate-500">${mealPlanItemKcalV0502(x)} kcal · ${mealPlanItemMacroTextV0502(x)}</div></div><div class="flex items-center gap-1"><input type="number" min=".01" step=".01" value="${x.amount}" onchange="updateMealPlanOfficialItemV0500('${x.id}','amount',this.value)" class="w-16 rounded-lg bg-slate-950 px-2 py-1 text-[10px] text-white"><span class="text-[9px] text-slate-500">${x.category==='Bevande'?'ml':x.quantityUnit||'g'}</span></div><button onclick="removeMealPlanOfficialItemV0500('${x.id}')" class="p-1 text-rose-400"><i class="fa-solid fa-trash"></i></button></div></div>`).join(''):`<div class="rounded-xl border border-dashed border-slate-800 py-5 text-center text-[10px] text-slate-600">Nessun alimento inserito in ${mealPlanBuilderDayV0500}</div>`}</div><div class="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3"><div class="text-[9px] font-black uppercase tracking-[.15em] text-violet-300">Aggiungi alimento</div><div class="mt-2 grid gap-2 sm:grid-cols-[1fr_150px]"><div class="relative"><i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-[10px] text-slate-500"></i><input id="meal-plan-food-search-v0502" value="${escapeHTML(mealPlanBuilderSearchV0502)}" oninput="mealPlanBuilderSearchV0502=this.value;renderMealPlanFoodSearchV0502()" placeholder="Cerca nel database alimenti…" class="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-[10px] text-white"></div><select id="meal-plan-food-category-v0502" onchange="mealPlanBuilderCategoryV0502=this.value;renderMealPlanFoodSearchV0502()" class="rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"><option value="Tutti">Tutte le categorie</option>${FOOD_CATEGORIES.map(c=>`<option ${c===mealPlanBuilderCategoryV0502?'selected':''}>${c}</option>`).join('')}</select></div><div class="mt-2"><select id="meal-plan-add-meal-v0500" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white">${MEAL_PLAN_MEALS_V0500.map(m=>`<option>${m}</option>`).join('')}</select></div><div id="meal-plan-food-results-v0502" class="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1"></div></div><button onclick="finishMealPlanEditV0500()" class="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-[10px] font-black text-slate-950">Salva piano</button></div>`;
      renderMealPlanFoodSearchV0502();
    }
    function renderMealPlanFoodSearchV0502(){
      const box=document.getElementById('meal-plan-food-results-v0502');if(!box)return;
      const q=String(document.getElementById('meal-plan-food-search-v0502')?.value||mealPlanBuilderSearchV0502||'').trim().toLocaleLowerCase('it'),cat=document.getElementById('meal-plan-food-category-v0502')?.value||mealPlanBuilderCategoryV0502||'Tutti';
      const rows=(appState.presets||[]).map((raw,i)=>({p:normalizeFoodPreset(raw),i})).filter(({p})=>(!q||String(p.name||'').toLocaleLowerCase('it').includes(q))&&(cat==='Tutti'||p.category===cat)).slice(0,40);
      box.innerHTML=rows.length?rows.map(({p,i})=>{const unit=p.category==='Bevande'?'ml':'g',def=Math.max(.01,Number(p.unitAmount)||100),rid=`meal-plan-qty-v0502-${i}`;return `<div class="rounded-xl border border-slate-800 bg-slate-950 p-2.5"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="truncate text-xs font-black text-white">${escapeHTML(p.name)}</div><div class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-slate-500"><span>${escapeHTML(p.category||'Altro')}</span><span>${Math.round(Number(p.kcal)||0)} kcal / 100 ${unit}</span><span>${Number(p.p)||0}g P</span><span>${Number(p.c)||0}g C</span><span>${Number(p.f)||0}g G</span></div></div><div class="shrink-0 text-right"><div class="flex items-center gap-1"><input id="${rid}" type="number" min=".01" step=".01" value="${def}" class="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[10px] text-white"><span class="text-[9px] text-slate-500">${unit}</span></div><button onclick="addMealPlanOfficialItemV0502(${i},'${rid}')" class="mt-1.5 w-full rounded-lg bg-violet-500 px-2 py-1.5 text-[9px] font-black text-slate-950">Aggiungi</button></div></div></div>`;}).join(''):`<div class="py-5 text-center text-[10px] text-slate-600">Nessun alimento trovato.</div>`;
    }
    function newMealPlanV0500(){const p=normalizeMealPlanV0500({id:`mealplan_${Date.now()}`,name:'Nuovo piano',days:{}});appState.mealPlans.push(p);mealPlanBuilderIdV0500=p.id;mealPlanBuilderSearchV0502='';mealPlanBuilderCategoryV0502='Tutti';renderMealPlanManagerV0500();}
    function editMealPlanV0500(id){mealPlanBuilderIdV0500=id;mealPlanBuilderDayV0500='Lunedì';mealPlanBuilderSearchV0502='';mealPlanBuilderCategoryV0502='Tutti';renderMealPlanManagerV0500();}
    function selectMealPlanBuilderDayV0500(day){mealPlanBuilderDayV0500=day;renderMealPlanManagerV0500();}
    function renameMealPlanV0500(name){const p=appState.mealPlans.find(x=>x.id===mealPlanBuilderIdV0500);if(p){p.name=String(name||'Piano alimentare').trim()||'Piano alimentare';p.updatedAt=new Date().toISOString();}}
    function addMealPlanOfficialItemV0502(idx,qtyId){const p=appState.mealPlans.find(x=>x.id===mealPlanBuilderIdV0500),preset=appState.presets?.[Number(idx)];if(!p||!preset)return;const meal=document.getElementById('meal-plan-add-meal-v0500')?.value||'Pranzo',amount=Math.max(.01,Number(document.getElementById(qtyId)?.value)||Number(normalizeFoodPreset(preset).unitAmount)||100);p.days[mealPlanBuilderDayV0500].push(mealPlanItemFromPresetV0500(preset,meal,amount));p.updatedAt=new Date().toISOString();renderMealPlanManagerV0500();}
    function updateMealPlanOfficialItemV0500(id,key,value){const p=appState.mealPlans.find(x=>x.id===mealPlanBuilderIdV0500),x=p?.days?.[mealPlanBuilderDayV0500]?.find(i=>i.id===id);if(!x)return;x[key]=key==='amount'?Math.max(.01,Number(value)||.01):value;p.updatedAt=new Date().toISOString();if(key==='amount')renderMealPlanManagerV0500();}
    function removeMealPlanOfficialItemV0500(id){const p=appState.mealPlans.find(x=>x.id===mealPlanBuilderIdV0500);if(!p)return;p.days[mealPlanBuilderDayV0500]=p.days[mealPlanBuilderDayV0500].filter(x=>x.id!==id);p.updatedAt=new Date().toISOString();renderMealPlanManagerV0500();}
    function finishMealPlanEditV0500(){saveStateToLocal({source:'meal-plan-library'});scheduleDriveSync?.(180);mealPlanBuilderIdV0500=null;renderMealPlanManagerV0500();renderNutrition();showToast('Piano alimentare salvato ✓','fa-circle-check');}
    function activateMealPlanV0500(id){appState.activeMealPlanId=id;saveStateToLocal({source:'meal-plan-active'});scheduleDriveSync?.(180);renderMealPlanManagerV0500();renderNutrition();showToast('Piano alimentare attivato ✓','fa-circle-check');}

    function deleteMealPlanV0500(id){const p=appState.mealPlans.find(x=>x.id===id);if(!p||!confirm(`Eliminare il piano ${p.name}?`))return;appState.mealPlans=appState.mealPlans.filter(x=>x.id!==id);if(appState.activeMealPlanId===id)appState.activeMealPlanId=null;saveStateToLocal({source:'meal-plan-library'});scheduleDriveSync?.(180);mealPlanBuilderIdV0500=null;renderMealPlanManagerV0500();renderNutrition();}

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
