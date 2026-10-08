(function attachOfflineControls(){
  'use strict';
  let registration=null;
  let pending=null;
  let statusRevision=0;
  const unavailable={supported:false,saved:false,version:null,bytes:0,updatedAt:null};
  function displayWarning(value){
    const revision=++statusRevision;
    const warning=typeof value?.warning==='string'?value.warning:value?.cleanupPending?'새 저장판은 유지됩니다. 이전 자료 정리가 남아 있습니다. 다음 저장 또는 삭제 때 다시 시도해 주세요.':'';
    if(warning)window.setTimeout(()=>{
      if(revision!==statusRevision)return;
      document.querySelectorAll('#campusPlatform [data-output="offline"],#campusRefinement [data-ref-output="offline"]').forEach(target=>{if(!target.textContent.includes(warning))target.append(document.createTextNode(` ${warning}`));});
    },0);
    return value;
  }
  async function initialize(){
    if(!('serviceWorker' in navigator)||!window.isSecureContext||location.protocol==='file:')return {...unavailable,error:'이 환경에서는 파일 묶음으로 실행할 수 있습니다. 웹 오프라인 저장은 지원하지 않습니다.'};
    try{
      const known=typeof navigator.serviceWorker.getRegistration==='function'?await navigator.serviceWorker.getRegistration('./'):null;
      registration=navigator.onLine===false&&known?.active?.scriptURL===new URL('./service-worker.js',location.href).href?known:await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
      await navigator.serviceWorker.ready;return await status();
    }
    catch{return {...unavailable,error:'오프라인 저장을 준비하지 못했습니다. 온라인 안내는 계속 사용할 수 있습니다.'};}
  }
  async function request(action,options={}){
    if(!registration){const state=await initialize();if(!state.supported)return state;}
    const worker=registration?.active||navigator.serviceWorker.controller;
    if(!worker)return {...unavailable,error:'오프라인 저장 준비 중입니다. 잠시 후 다시 시도해 주세요.'};
    return new Promise((accept,reject)=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(new Error('오프라인 저장 응답 시간이 초과되었습니다. 기존 저장판은 유지됩니다.'));},120000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();if(event.data?.error){statusRevision++;reject(new Error(event.data.error));}else accept(displayWarning(event.data));};
      worker.postMessage({action,options},[channel.port2]);
    });
  }
  async function status(){if(!registration)return {...unavailable};return request('STATUS');}
  async function download(options={details:true}){if(pending)return pending;pending=request(options.bundle?'DOWNLOAD_BUNDLE':'DOWNLOAD',options);try{return await pending;}finally{pending=null;}}
  async function inspect(options){if(!options?.bundle)throw new Error('승인 공개판을 먼저 확인해 주세요.');return request('INSPECT_BUNDLE',options);}
  async function readCatalog(){const result=await request('READ_CATALOG');if(!result)return null;if(result.supported===false||result.error)return null;if(!result.catalog||!window.CampusPlatform?.validateCatalog)return null;const checked=window.CampusPlatform.validateCatalog(result.catalog);if(!checked.valid)throw new Error('저장된 공개판 구조가 올바르지 않습니다. 온라인 자료를 다시 확인해 주세요.');return result;}
  async function clear(){return request('CLEAR');}
  window.CampusOffline={initialize,status,download,inspect,readCatalog,clear};
}());
