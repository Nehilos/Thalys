// Thalys v0.28.2 - Language engine
// Loaded before Drive so language state is initialized before automatic Drive reconnect.

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
