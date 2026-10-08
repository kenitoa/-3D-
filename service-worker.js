/* Public static assets and approved release snapshots. API responses, admin and credentials are never cached. */
/* global TextEncoder, Headers */
'use strict';
const PREFIX='hanshin-public-v1-';
const CONTROL='hanshin-offline-control-v1';
const POINTER=new URL('__offline_current__',self.registration.scope).href;
let downloading=null;
async function current(){const control=await caches.open(CONTROL);const entry=await control.match(POINTER);return entry?entry.json():null;}
async function status(){const saved=await current();return {supported:true,saved:!!saved,version:saved?.version||null,bytes:saved?.bytes||0,updatedAt:saved?.updatedAt||null,details:saved?.details||false,...(saved?.kind==='bundle'?{kind:'bundle',releaseId:saved.releaseId,assetsVersion:saved.assetsVersion,scope:saved.scope}: {})};}
function approvedPath(path){return typeof path==='string'&&/^(?:index\.html|manifest\.webmanifest|service-worker\.js|assets\/(?:media|ar)\/manifest\.json|assets\/[a-zA-Z0-9_/-]+\.(?:svg|glb|png|jpg|jpeg|webp|ktx2|mp3|ogg|wav|mp4|webm)|src\/[a-zA-Z0-9_/-]+\.(?:js|json)|styles\/[a-zA-Z0-9_/-]+\.css|vendor\/[a-zA-Z0-9_.-]+\.(?:js|md|txt))$/.test(path)&&!path.split('/').some(p=>p.startsWith('.'))&&!path.includes('admin')&&path!=='src/ui/refinement-scene-preview.js';}
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const sha=async body=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',body))].map(value=>value.toString(16).padStart(2,'0')).join('');
function publicCatalog(catalog){
  if(!object(catalog)||catalog.schemaVersion!==1||typeof catalog.contentVersion!=='string'||catalog.contentVersion.length>128||typeof catalog.assetsVersion!=='string'||catalog.datasetVersion!==catalog.contentVersion||!Array.isArray(catalog.entities)||catalog.entities.length>10000||!Array.isArray(catalog.sources)||!Array.isArray(catalog.campuses)||!catalog.campuses.length)throw new Error('공개 자료판 구조를 확인해 주세요.');
  const entities=new Map();
  for(const entity of catalog.entities){if(!object(entity)||typeof entity.id!=='string'||entities.has(entity.id)||entity.sensitive||entity.visibility!=='public')throw new Error('비공개 공간은 오프라인 묶음에 포함할 수 없습니다.');entities.set(entity.id,entity);}
  for(const entity of entities.values()){const seen=new Set();let parent=entity;while(parent){if(seen.has(parent.id))throw new Error('공간 계층이 순환합니다.');seen.add(parent.id);if(!parent.parentId)break;parent=entities.get(parent.parentId);if(!parent)throw new Error('공개되지 않은 상위 공간을 참조합니다.');}}
  const check=value=>{if(!value||typeof value!=='object')return;if(value.visibility!==undefined&&value.visibility!=='public'||value.sensitive===true)throw new Error('비공개 정보는 오프라인 묶음에 포함할 수 없습니다.');for(const child of Object.values(value))check(child);};check(catalog);
  return entities;
}
async function loadBundle(options){
  const expected=options.bundle,releaseId=typeof expected==='string'?expected:expected?.releaseId;
  if(typeof releaseId!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(releaseId))throw new Error('승인 공개판 번호가 필요합니다.');
  const url=new URL('api/v1/bundle',self.registration.scope);url.searchParams.set('release',releaseId);const response=await fetch(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok||response.redirected)throw new Error('승인 공개판 묶음을 가져오지 못했습니다. 기존 저장판은 유지됩니다.');
  const text=await response.text();if(text.length>3*1024*1024)throw new Error('승인 공개판 응답이 허용 크기를 초과합니다.');const payload=JSON.parse(text),bundle=payload.data;
  if(payload.error||!object(bundle)||bundle.schemaVersion!==1||bundle.releaseId!==releaseId||!Array.isArray(bundle.assets)||!bundle.assets.length||bundle.assets.length>1000||!object(bundle.manifest)||!Array.isArray(bundle.manifest.models)||!/^[a-f0-9]{64}$/.test(bundle.catalogHash)||typeof bundle.createdAt!=='string'||!Number.isFinite(Date.parse(bundle.createdAt)))throw new Error('승인 공개판 묶음의 구조가 올바르지 않습니다.');
  publicCatalog(bundle.catalog);
  if(bundle.contentVersion!==bundle.catalog.contentVersion||bundle.assetsVersion!==bundle.catalog.assetsVersion||object(expected)&&(expected.catalogHash!==bundle.catalogHash||expected.contentVersion!==bundle.contentVersion||expected.assetsVersion!==bundle.assetsVersion))throw new Error('요청한 자료판과 승인 공개판이 일치하지 않습니다.');
  const catalogBytes=new TextEncoder().encode(JSON.stringify(bundle.catalog));if(catalogBytes.byteLength>2*1024*1024||await sha(catalogBytes)!==bundle.catalogHash)throw new Error('공개 자료판의 내용과 SHA가 일치하지 않습니다.');
  const original=new Set(),paths=new Map();let total=0;
  for(const asset of bundle.assets){if(!object(asset)||typeof asset.path!=='string'||!/^assets\/releases\/[a-f0-9]{64}\.(?:js|json|html|css|svg|glb|png|jpg|jpeg|webp|ktx2|webmanifest|md|txt|mp3|ogg|wav|mp4|webm)$/.test(asset.path)||!approvedPath(asset.originalPath)||original.has(asset.originalPath)||typeof asset.detail!=='boolean'||!/^[a-f0-9]{64}$/.test(asset.sha256)||!asset.path.includes('/'+asset.sha256+'.')||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>128*1024*1024||paths.has(asset.path)&&paths.get(asset.path).bytes!==asset.bytes)throw new Error('공개 자산의 경로·SHA·용량을 확인해 주세요.');original.add(asset.originalPath);if(!paths.has(asset.path))total+=asset.bytes;paths.set(asset.path,asset);if(total>200*1024*1024)throw new Error('공개 자료판 묶음이 200MiB를 초과합니다.');}
  const assetMap=new Map(bundle.assets.map(asset=>[asset.path,asset]));
  for(const model of bundle.manifest.models){if(!object(model)||typeof model.id!=='string'||!assetMap.has(model.source)||!assetMap.get(model.source).detail||model.bytes!==assetMap.get(model.source).bytes||model.sha256!==assetMap.get(model.source).sha256)throw new Error('모델과 승인 자산 목록이 일치하지 않습니다.');for(const variant of Array.isArray(model.variants)?model.variants:[])if(!object(variant)||!assetMap.has(variant.source)||!assetMap.get(variant.source).detail||variant.bytes!==assetMap.get(variant.source).bytes||variant.sha256!==assetMap.get(variant.source).sha256)throw new Error('모델 단계와 승인 자산 목록이 일치하지 않습니다.');}
  if(bundle.catalog.assetManifest&&JSON.stringify(bundle.catalog.assetManifest)!==JSON.stringify(bundle.manifest))throw new Error('자료판과 모델 자산판이 일치하지 않습니다.');
  if(bundle.mediaRecords!==undefined){if(!Array.isArray(bundle.mediaRecords)||bundle.mediaRecords.length>200)throw new Error('공개 미디어 목록을 확인해 주세요.');const entityIds=new Set(bundle.catalog.entities.map(item=>item.id)),sourceIds=new Set(bundle.catalog.sources.map(item=>item.id)),extensions={image:/\.(?:png|jpg|jpeg|webp)$/,audio:/\.(?:mp3|ogg|wav)$/,video:/\.(?:mp4|webm)$/};for(const media of bundle.mediaRecords)if(!object(media)||media.public!==true||!entityIds.has(media.entityId)||!sourceIds.has(media.sourceId)||typeof media.license!=='string'||!media.license.trim()||media.license.length>300||!Object.hasOwn(extensions,media.kind)||!assetMap.has(media.path)||!assetMap.get(media.path).detail||!extensions[media.kind].test(media.path))throw new Error('공개 미디어에 공간·출처·사용권 근거가 필요합니다.');}
  return bundle;
}
function selectBundleAssets(bundle,options){
  const scope=options.scope||'all';if(!['basic','selected','all'].includes(scope))throw new Error('저장 범위를 확인해 주세요.');
  let entity=null;
  if(scope==='selected'){const entities=new Map(bundle.catalog.entities.map(item=>[item.id,item]));entity=entities.get(options.selectedId);const seen=new Set();while(entity&&entity.kind!=='building'&&!seen.has(entity.id)){seen.add(entity.id);entity=entities.get(entity.owningBuildingId)||entities.get(entity.parentId);}if(!entity||entity.kind!=='building')throw new Error('현재 공개판의 건물을 선택해 주세요.');}
  const selected=new Set();for(const model of bundle.manifest.models){const campusId=model.campusId||bundle.manifest.campusId;if(scope==='all'||entity&&campusId===entity.campusId&&[entity.id,entity.legacyKey,entity.legacyId].some(id=>id&&[model.id,model.buildingId,model.legacyId].includes(id))){selected.add(model.source);for(const variant of Array.isArray(model.variants)?model.variants:[])selected.add(variant.source);}}
  const entities=new Map(bundle.catalog.entities.map(item=>[item.id,item]));for(const media of bundle.mediaRecords||[]){let owner=entities.get(media.entityId),seen=new Set();while(owner&&owner.kind!=='building'&&!seen.has(owner.id)){seen.add(owner.id);owner=entities.get(owner.owningBuildingId)||entities.get(owner.parentId);}if(scope==='all'||scope==='selected'&&owner?.id===entity?.id)selected.add(media.path);}
  const assets=[...new Map(bundle.assets.filter(asset=>!asset.detail||scope!=='basic'&&selected.has(asset.path)).map(asset=>[asset.path,asset])).values()];if(!assets.length)throw new Error('저장할 공개 자산이 없습니다.');
  return {scope,assets,bytes:assets.reduce((sum,asset)=>sum+asset.bytes,0),selectedId:entity?.id||null};
}
async function inspectBundle(options){const bundle=await loadBundle(options),selected=selectBundleAssets(bundle,options);return {supported:true,releaseId:bundle.releaseId,version:bundle.contentVersion,assetsVersion:bundle.assetsVersion,createdAt:bundle.createdAt,scope:selected.scope,selectedId:selected.selectedId,bytes:selected.bytes,assets:selected.assets.length};}
async function readCatalog(){const saved=await current();if(saved?.kind!=='bundle'||!saved.catalogPath)return null;const response=await (await caches.open(saved.cacheName)).match(saved.catalogPath);return response?response.json():null;}
async function downloadBundle(options){
  const bundle=await loadBundle(options),selected=selectBundleAssets(bundle,options),staging=PREFIX+'stage-'+crypto.randomUUID(),staged=await caches.open(staging);let committed=null;
  try{
    for(const asset of selected.assets){const url=new URL(asset.path,self.registration.scope),response=await fetch(url,{cache:'no-store',credentials:'omit'});if(!response.ok||response.redirected)throw new Error('승인 자산을 받지 못했습니다. 기존 저장판은 유지됩니다.');const body=await response.clone().arrayBuffer();if(body.byteLength!==asset.bytes||await sha(body)!==asset.sha256)throw new Error('승인 자산의 내용과 SHA가 일치하지 않습니다.');await staged.put(url,response);}
    const availablePaths=new Set(selected.assets.map(asset=>asset.path)),availableModelIds=bundle.manifest.models.filter(model=>[model.source,...(Array.isArray(model.variants)?model.variants.map(variant=>variant.source):[])].some(path=>availablePaths.has(path))).map(model=>model.id),mediaRecords=(bundle.mediaRecords||[]).filter(media=>availablePaths.has(media.path));
    const catalogPath=new URL('__offline_catalog__',self.registration.scope).href,savedAt=new Date().toISOString();await staged.put(catalogPath,new Response(JSON.stringify({catalog:bundle.catalog,manifest:bundle.manifest,availableModelIds,mediaRecords,releaseId:bundle.releaseId,version:bundle.contentVersion,assetsVersion:bundle.assetsVersion,savedAt,scope:selected.scope,selectedId:selected.selectedId}),{headers:{'Content-Type':'application/json'}}));
    const aliases=Object.fromEntries(bundle.assets.map(asset=>[asset.originalPath,asset.path]));const next={kind:'bundle',version:bundle.contentVersion,assetsVersion:bundle.assetsVersion,releaseId:bundle.releaseId,scope:selected.scope,selectedId:selected.selectedId,cacheName:staging,bytes:selected.bytes,details:selected.scope!=='basic',updatedAt:savedAt,catalogPath,aliases,paths:[...new Set(bundle.assets.flatMap(asset=>[asset.path,asset.originalPath]))]};const control=await caches.open(CONTROL);await control.put(POINTER,new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json'}}));committed=next;
    let cleanupPending=0;for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==staging){try{await caches.delete(key);}catch{cleanupPending++;}}const result=await status();return cleanupPending?{...result,cleanupPending,warning:'새 공개판은 저장되었습니다. 이전 자료 정리가 남아 있습니다.'}:result;
  }catch(error){if(committed)return {...await status(),cleanupPending:true,warning:'새 공개판은 저장되었습니다. 이전 자료 정리를 확인하지 못했습니다.'};try{await caches.delete(staging);}catch{throw new Error('저장에 실패했고 임시 자료 정리가 남았습니다. 이전 공개판은 유지됩니다.');}throw error;}
}
async function download(options){
  const manifestResponse=await fetch(new URL('offline-manifest.json',self.registration.scope),{cache:'no-store',credentials:'omit'});
  if(!manifestResponse.ok)throw new Error('저장할 공개 자료 목록을 가져오지 못했습니다.');
  const manifest=await manifestResponse.json();
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.assets)||!(/^[a-f0-9]{20}$/).test(manifest.version)||manifest.assets.length>500)throw new Error('공개 자료 목록을 확인해 주세요.');
  const assets=manifest.assets.filter(asset=>options.details!==false||!asset.detail);
  if(!assets.length||assets.some(asset=>!approvedPath(asset.path)||!(/^[a-f0-9]{64}$/).test(asset.sha256)||!Number.isInteger(asset.bytes)||asset.bytes<=0||asset.bytes>50000000))throw new Error('공개 자료 목록을 확인해 주세요.');
  const bytes=assets.reduce((sum,asset)=>sum+asset.bytes,0);
  if(bytes>200000000)throw new Error('저장 자료가 200MB를 초과합니다. 상세 모델을 제외해 주세요.');
  const staging=PREFIX+'stage-'+crypto.randomUUID(),staged=await caches.open(staging);
  let committed=null;
  try{
    for(const asset of assets){
      const url=new URL(asset.path,self.registration.scope);const response=await fetch(url,{cache:'no-store',credentials:'omit'});
      if(!response.ok||response.redirected)throw new Error('일부 공개 자료를 받지 못했습니다. 기존 저장판은 유지됩니다.');
      const body=await response.clone().arrayBuffer();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',body))].map(value=>value.toString(16).padStart(2,'0')).join('');
      if(body.byteLength!==asset.bytes||digest!==asset.sha256)throw new Error('자료 개정판이 일치하지 않습니다. 배포 완료 후 다시 저장해 주세요.');
      await staged.put(url,response);
    }
    const next={version:manifest.version,cacheName:staging,bytes,details:options.details!==false,updatedAt:new Date().toISOString(),paths:manifest.assets.map(asset=>asset.path)};
    const control=await caches.open(CONTROL);await control.put(POINTER,new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json'}}));
    committed=next;
    let cleanupPending=0;
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==staging){try{await caches.delete(key);}catch{cleanupPending++;}}
    const result={supported:true,saved:true,version:next.version,bytes:next.bytes,updatedAt:next.updatedAt,details:next.details};
    return cleanupPending?{...result,cleanupPending,warning:'새 저장판은 완료되었습니다. 이전 임시 자료 일부를 정리하지 못했습니다. 다음 저장 또는 삭제 때 다시 시도해 주세요.'}:result;
  }catch(error){
    if(committed)return {supported:true,saved:true,version:committed.version,bytes:committed.bytes,updatedAt:committed.updatedAt,details:committed.details,cleanupPending:true,warning:'새 저장판은 완료되었지만 이전 자료 정리를 확인하지 못했습니다. 새 저장판은 유지됩니다.'};
    try{await caches.delete(staging);}catch{throw new Error('저장에 실패했고 임시 자료 정리를 확인하지 못했습니다. 기존 저장판은 유지됩니다.');}
    throw error;
  }
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  event.waitUntil((async()=>{
    try{
      let result;
      if(event.data?.action==='STATUS')result=await status();
      else if(event.data?.action==='DOWNLOAD'){if(!downloading)downloading=download(event.data.options||{}).finally(()=>{downloading=null;});result=await downloading;}
      else if(event.data?.action==='INSPECT_BUNDLE')result=await inspectBundle(event.data.options||{});
      else if(event.data?.action==='READ_CATALOG')result=await readCatalog();
      else if(event.data?.action==='DOWNLOAD_BUNDLE'){if(!downloading)downloading=downloadBundle(event.data.options||{}).finally(()=>{downloading=null;});result=await downloading;}
      else if(event.data?.action==='CLEAR'){if(downloading)throw new Error('저장이 끝난 뒤 삭제해 주세요.');for(const key of await caches.keys())if(key.startsWith(PREFIX)||key===CONTROL)await caches.delete(key);result=await status();}
      else throw new Error('지원하지 않는 오프라인 작업입니다.');
      event.ports[0]?.postMessage(result);
    }catch(error){event.ports[0]?.postMessage({error:error instanceof Error?error.message:'오프라인 저장을 완료하지 못했습니다.'});}
  })());
});
function appEntryResponse(response,saved,path){
  if(saved.kind!=='bundle'||path!=='index.html'||!response.ok)return response;
  const headers=new Headers(response.headers);headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");headers.delete('Content-Disposition');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.pathname.includes('/api/')||url.pathname.includes('admin')||url.pathname.endsWith('/src/ui/refinement-scene-preview.js')||url.pathname.endsWith('/offline-manifest.json')||url.pathname.endsWith('/service-worker.js'))return;
  event.respondWith((async()=>{
    const saved=await current();const path=url.pathname.slice(scope.pathname.length)||'index.html';
    if(saved&&saved.paths.includes(path)){
      const target=new URL(saved.aliases?.[path]||path,scope),cached=await (await caches.open(saved.cacheName)).match(target);
      if(cached)return appEntryResponse(cached,saved,path);
      try{return appEntryResponse(await fetch(target,{credentials:'omit',cache:'no-store'}),saved,path);}
      catch{return new Response('이 상세 자산은 저장되지 않았습니다. 기본 부지와 문자 안내를 사용해 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
    }
    return fetch(event.request);
  })());
});
