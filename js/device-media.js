(function(){
  'use strict';

  const activeStreams=new Set();
  let recognition=null;
  let recognitionTarget='';
  let recognitionListening=false;

  function secureEnough(){
    return window.isSecureContext===true || ['localhost','127.0.0.1'].includes(location.hostname);
  }

  function mediaSupported(){
    return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
  }

  async function permissionState(kind){
    const name=kind==='camera'?'camera':'microphone';
    try{
      if(!navigator.permissions?.query)return 'unknown';
      const result=await navigator.permissions.query({name});
      return result?.state||'unknown';
    }catch(_){return 'unknown';}
  }

  async function requestStream(kind,constraints){
    if(!secureEnough()){
      const e=new Error('SECURE_CONTEXT_REQUIRED');e.name='SecurityError';throw e;
    }
    if(!mediaSupported()){
      const e=new Error('MEDIA_NOT_SUPPORTED');e.name='NotSupportedError';throw e;
    }
    const defaultConstraints=kind==='camera'?{video:true,audio:false}:{audio:true,video:false};
    const stream=await navigator.mediaDevices.getUserMedia(constraints||defaultConstraints);
    activeStreams.add(stream);
    return stream;
  }

  function releaseStream(stream){
    if(!stream)return;
    try{stream.getTracks().forEach(track=>track.stop())}catch(_){}
    activeStreams.delete(stream);
  }

  async function requestCameraStream(preferEnvironment=true){
    const attempts=preferEnvironment?[
      {video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},
      {video:{facingMode:'environment'},audio:false},
      {video:true,audio:false}
    ]:[{video:true,audio:false}];
    let last=null;
    for(const constraints of attempts){
      try{return await requestStream('camera',constraints)}
      catch(err){
        last=err;
        if(err?.name==='NotAllowedError'||err?.name==='SecurityError')break;
      }
    }
    throw last||new Error('CAMERA_FAILED');
  }

  async function probe(kind){
    const constraints=kind==='camera'?{video:true,audio:false}:{audio:true,video:false};
    const stream=await requestStream(kind,constraints);
    releaseStream(stream);
    await refreshPermissionUI();
    return true;
  }

  function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null;}
  function speechSupported(){return !!speechCtor();}

  function languageForSpeech(){
    const lang=String(window.appLanguage||document.documentElement.lang||'it').toLowerCase();
    const map={it:'it-IT',en:'en-US',es:'es-ES',pt:'pt-PT',ro:'ro-RO'};
    return map[lang]||'it-IT';
  }

  function micButtonFor(targetId){return document.querySelector(`[data-thalys-mic-target="${targetId}"]`);}

  function setMicButtonState(targetId,on){
    const btn=micButtonFor(targetId);if(!btn)return;
    btn.classList.toggle('bg-rose-500/20',on);
    btn.classList.toggle('text-rose-300',on);
    btn.classList.toggle('bg-slate-800',!on);
    btn.classList.toggle('text-cyan-300',!on);
    btn.innerHTML=on?'<i class="fa-solid fa-stop mr-1"></i>Stop':'<i class="fa-solid fa-microphone mr-1"></i>Detta';
  }

  function stopDictation(){
    if(recognition){try{recognition.stop()}catch(_){} }
  }

  function startDictation(targetId){
    const target=document.getElementById(targetId);
    if(!target)return;
    const Ctor=speechCtor();
    if(!Ctor){
      window.showToast?.('Dettatura vocale non supportata da questo browser');
      return;
    }
    if(recognitionListening){
      if(recognitionTarget===targetId)stopDictation();
      else{stopDictation();setTimeout(()=>startDictation(targetId),120);}
      return;
    }
    try{
      recognition=new Ctor();
      recognition.lang=languageForSpeech();
      recognition.interimResults=true;
      recognition.continuous=false;
      recognition.maxAlternatives=1;
      recognitionTarget=targetId;
      recognitionListening=true;
      setMicButtonState(targetId,true);
      const original=String(target.value||'').trim();
      let finalText='';
      recognition.onresult=(event)=>{
        let interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
          const text=event.results[i][0]?.transcript||'';
          if(event.results[i].isFinal)finalText+=(finalText?' ':'')+text.trim();
          else interim+=text;
        }
        const spoken=[finalText.trim(),interim.trim()].filter(Boolean).join(' ');
        target.value=[original,spoken].filter(Boolean).join(original&&spoken?' ':'');
        target.dispatchEvent(new Event('input',{bubbles:true}));
      };
      recognition.onerror=(event)=>{
        const code=event?.error||'';
        if(code==='not-allowed'||code==='service-not-allowed')window.showToast?.('Permesso microfono negato');
        else if(code!=='no-speech'&&code!=='aborted')window.showToast?.('Dettatura vocale non disponibile');
      };
      recognition.onend=()=>{
        setMicButtonState(recognitionTarget,false);
        recognitionListening=false;recognitionTarget='';recognition=null;
      };
      recognition.start();
    }catch(err){
      recognitionListening=false;recognitionTarget='';recognition=null;
      setMicButtonState(targetId,false);
      console.warn('Thalys dictation',err);
      window.showToast?.('Impossibile avviare la dettatura');
    }
  }

  async function refreshPermissionUI(){
    const caps=window.ThalysCapabilities?.snapshot?.()||{};
    const cam=await permissionState('camera');
    const mic=await permissionState('microphone');
    const rows=[
      ['device-camera-status','Fotocamera',caps.camera,cam],
      ['device-microphone-status','Microfono',caps.microphone,mic],
      ['device-speech-status','Dettatura',speechSupported(),''],
      ['device-push-status','Push',caps.push,'']
    ];
    for(const [id,label,supported,state] of rows){
      const el=document.getElementById(id);if(!el)continue;
      let text=supported?'Disponibile':'Non supportato';
      if(supported&&state&&state!=='unknown')text=state==='granted'?'Consentito':state==='denied'?'Negato':'Da chiedere';
      el.textContent=text;
      el.dataset.state=supported?(state||'available'):'unsupported';
    }
  }

  async function requestPermissionFromOptions(kind){
    try{
      await probe(kind);
      window.showToast?.(`${kind==='camera'?'Fotocamera':'Microfono'} disponibile`,'fa-circle-check');
    }catch(err){
      const label=kind==='camera'?'fotocamera':'microfono';
      if(err?.name==='NotAllowedError'||err?.name==='SecurityError')window.showToast?.(`Permesso ${label} negato`);
      else window.showToast?.(`${label.charAt(0).toUpperCase()+label.slice(1)} non disponibile`);
      await refreshPermissionUI();
    }
  }

  function releaseAll(){for(const stream of [...activeStreams])releaseStream(stream);stopDictation();}
  window.addEventListener('pagehide',releaseAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDictation();});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshPermissionUI,0));

  window.ThalysDeviceMedia=Object.freeze({
    secureEnough,mediaSupported,permissionState,requestStream,requestCameraStream,releaseStream,
    probe,speechSupported,startDictation,stopDictation,refreshPermissionUI,requestPermissionFromOptions
  });
  window.startThalysDictation=startDictation;
  window.requestThalysDevicePermission=requestPermissionFromOptions;
  window.refreshThalysPermissionUI=refreshPermissionUI;
})();
