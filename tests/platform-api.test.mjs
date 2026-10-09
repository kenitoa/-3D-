import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { deflateSync } from 'node:zlib';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, basename } from 'node:path';
import { createPlatform, loadDomain, CampusRepository } from '../server/platform.mjs';

const root=resolve('.');
const {domain,baseline}=loadDomain(root);
const copy=(value)=>JSON.parse(JSON.stringify(value));
async function fixture(options={}){
  const temporary=await mkdtemp(join(tmpdir(),'hanshin-platform-'));
  if(!resolve(temporary).startsWith(resolve(tmpdir())+sep)||!basename(temporary).startsWith('hanshin-platform-'))throw new Error('Unsafe test cleanup directory.');
  const databasePath=join(temporary,'test.sqlite');
  const server=http.createServer((request,response)=>platform.handle(request,response));
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const logs=[];
  const platform=await createPlatform({root,databasePath,origins:[origin],domain,baseline:copy(baseline),now:()=>new Date('2026-10-07T08:00:00Z'),log:(entry)=>logs.push(entry),...options});
  for(const role of ['admin','editor','reviewer'])platform.repository.createUser(role,`fixture-password-${role}`,role,role==='admin'?[]:['hanshin-gg']);
  async function request(path,method='GET',body,session,extra={}){
    const response=await fetch(origin+path,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),...extra},body:body!==undefined?JSON.stringify(body):undefined});
    const bytes=await response.arrayBuffer();let json=null;try{json=JSON.parse(Buffer.from(bytes).toString());}catch{/* Photo responses are intentionally binary. */}
    return {status:response.status,json,headers:response.headers,bytes:Buffer.from(bytes)};
  }
  async function login(role){const result=await request('/api/v1/session','POST',{username:role,password:`fixture-password-${role}`});assert.equal(result.status,200);return {cookie:result.headers.get('set-cookie').split(';')[0],csrf:result.json.data.csrfToken,user:result.json.data.user};}
  async function close(){server.closeAllConnections();await new Promise((accept)=>server.close(accept));platform.close();await rm(temporary,{recursive:true});}
  return {temporary,databasePath,server,platform,origin,logs,request,login,close};
}

test('API enforces session, CSRF, origin, role and campus scope while preserving public read access',async()=>{
  const app=await fixture();
  try{
    assert.equal((await app.request('/api/v1/catalog')).status,200);
    assert.equal((await app.request('/api/v1/admin/status')).status,401);
    const editor=await app.login('editor');
    assert.match(editor.cookie,/^campus_session=[a-f0-9]{64}$/);
    const session=await app.request('/api/v1/session','GET',undefined,editor);
    assert.equal(session.json.data.user.role,'editor');
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog:baseline,summary:'test',expectedRevision:1},editor,{'X-CSRF-Token':''})).status,403);
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog:baseline,summary:'test',expectedRevision:1},editor,{Origin:'https://unapproved.invalid'})).status,403);
    assert.equal((await app.request('/api/v1/admin/releases','POST',{draftId:'none',expectedRevision:1},editor)).status,403);
    app.platform.repository.createUser('outside','fixture-outside-password','editor',['outside-campus']);
    const outsideResponse=await app.request('/api/v1/session','POST',{username:'outside',password:'fixture-outside-password'});
    const outside={cookie:outsideResponse.headers.get('set-cookie').split(';')[0],csrf:outsideResponse.json.data.csrfToken};
    const changed=copy(baseline);changed.contentVersion+='-outside';changed.datasetVersion=changed.contentVersion;changed.entities.find((e)=>e.kind==='building').name+=' outside';
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog:changed,summary:'outside scope',expectedRevision:1},outside)).status,403);
    const logout=await app.request('/api/v1/session','DELETE',undefined,editor);assert.equal(logout.status,200);
    assert.equal((await app.request('/api/v1/admin/status','GET',undefined,editor)).status,401);
    assert.ok(app.logs.every((entry)=>!JSON.stringify(entry).includes('fixture-password')&&!JSON.stringify(entry).includes('csrf')));
  }finally{await app.close();}
});

test('draft changes stay private until reviewed, publication checks revisions, and immutable releases restore',async()=>{
  const app=await fixture();
  try{
    const editor=await app.login('editor'),reviewer=await app.login('reviewer'),admin=await app.login('admin');
    const previous=(await app.request('/api/v1/admin/status','GET',undefined,admin)).json.data.currentRelease;
    const catalog=copy(baseline);catalog.contentVersion+='-reviewed';catalog.datasetVersion=catalog.contentVersion;
    const building=catalog.entities.find((e)=>e.kind==='building');building.name='검토된 변경 이름';
    const hidden=catalog.entities.find((e)=>e.kind==='external-facility');hidden.name='PRIVATE_ONLY_MARKER';hidden.visibility='restricted';
    let draft=(await app.request('/api/v1/admin/drafts','POST',{catalog,summary:'명칭 변경 및 공개 범위 검토',expectedRevision:1},editor)).json.data;
    assert.equal(draft.status,'draft');
    assert.equal((await app.request('/api/v1/catalog')).json.data.entities.find((e)=>e.id===building.id).name,building.name.replace('검토된 변경 이름',baseline.entities.find((e)=>e.id===building.id).name));
    assert.equal((await app.request('/api/v1/admin/releases','POST',{draftId:draft.id,expectedRevision:1},reviewer)).status,409);
    assert.equal((await app.request(`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'submit',expectedRevision:99},editor)).status,409);
    draft=(await app.request(`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'submit',expectedRevision:draft.revision},editor)).json.data;
    assert.equal((await app.request(`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'approve',expectedRevision:draft.revision},editor)).status,403);
    draft=(await app.request(`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'approve',expectedRevision:draft.revision},reviewer)).json.data;
    const release=await app.request('/api/v1/admin/releases','POST',{draftId:draft.id,expectedRevision:1},reviewer);assert.equal(release.status,201);
    const publicCatalog=(await app.request('/api/v1/catalog')).json.data;
    assert.equal(publicCatalog.entities.find((e)=>e.id===building.id).name,'검토된 변경 이름');assert.ok(!JSON.stringify(publicCatalog).includes('PRIVATE_ONLY_MARKER'));
    assert.ok(JSON.stringify((await app.request('/api/v1/admin/catalog','GET',undefined,admin)).json.data).includes('PRIVATE_ONLY_MARKER'));
    assert.equal((await app.request('/api/v1/admin/releases','POST',{draftId:draft.id,expectedRevision:1},reviewer)).status,409);
    assert.equal((await app.request(`/api/v1/admin/releases/${previous}/restore`,'POST',{expectedRevision:2},reviewer)).status,403);
    assert.equal((await app.request(`/api/v1/admin/releases/${previous}/restore`,'POST',{expectedRevision:2},admin)).status,200);
    assert.equal((await app.request('/api/v1/catalog')).json.data.contentVersion,baseline.contentVersion);
    assert.equal((await app.request(`/api/v1/catalog?release=${release.json.data.id}`)).json.data.contentVersion,catalog.contentVersion);
    const audit=(await app.request('/api/v1/admin/audit','GET',undefined,admin)).json.data;
    assert.ok(audit.some((entry)=>entry.operation==='release.restored'));
  }finally{await app.close();}
});

test('feedback is private, idempotent, bounded, and processed by scoped staff',async()=>{
  const app=await fixture();
  try{
    const body={spaceId:'hanshin-gg:building:janggong',type:'location',description:'위치를 확인해 주세요.',idempotencyKey:'fixture-report-key'};
    const one=await app.request('/api/v1/reports','POST',body);assert.equal(one.status,201);
    const receipt=await app.request(`/api/v1/reports/${one.json.data.id}`,'GET',undefined,undefined,{'X-Report-Receipt':one.json.data.receiptToken});assert.equal(receipt.status,200);assert.equal(receipt.json.data.status,'received');assert.ok(!JSON.stringify(receipt.json).includes(body.description));
    assert.equal((await app.request(`/api/v1/reports/${one.json.data.id}`)).status,404);
    const retry=await app.request('/api/v1/reports','POST',body);assert.equal(retry.json.data.id,one.json.data.id);
    assert.equal((await app.request('/api/v1/reports','POST',{...body,description:'다른 내용'})).status,409);
    assert.equal((await app.request(`/api/v1/admin/reports/${one.json.data.id}`)).status,401);
    assert.ok(!JSON.stringify((await app.request('/api/v1/catalog')).json).includes(body.description));
    assert.equal((await app.request('/api/v1/reports','POST',{...body,idempotencyKey:'fixture-photo-bad',photo:{mimeType:'image/png',dataBase64:Buffer.from('<svg onload="alert(1)">').toString('base64')}})).status,422);
    const editor=await app.login('editor');
    const reports=await app.request('/api/v1/admin/reports','GET',undefined,editor);assert.equal(reports.json.data.length,1);
    const resolved=await app.request(`/api/v1/admin/reports/${one.json.data.id}`,'PATCH',{status:'resolved',responseNote:'현장 확인 후 반영'},editor);assert.equal(resolved.json.data.status,'resolved');
  }finally{await app.close();}
});

test('provider imports require configured scope and review, duplicate requests reuse a draft and failures preserve freshness',async()=>{
  const provider={id:'school-approved',url:'https://approved.example.invalid/catalog',sourceId:baseline.sources[0].id,campusId:'hanshin-gg',kind:'catalog',enabled:true,secretEnv:null};
  const incoming=copy(baseline);incoming.contentVersion+='-upstream';incoming.datasetVersion=incoming.contentVersion;
  let available=true;
  const app=await fixture({providers:[provider],providerTransport:async()=>{if(!available)throw new Error('PROVIDER_TIMEOUT');return copy(incoming);}});
  try{
    const editor=await app.login('editor');
    const one=await app.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},editor);assert.equal(one.status,201);assert.equal(one.json.data.requiresReview,true);
    const two=await app.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},editor);assert.equal(two.status,200);assert.equal(two.json.data.draftId,one.json.data.draftId);
    const healthy=(await app.request('/api/v1/admin/providers','GET',undefined,editor)).json.data[0];assert.equal(healthy.state,'success');assert.ok(!JSON.stringify(healthy).includes(provider.url));
    available=false;assert.equal((await app.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},editor)).status,503);
    const failed=(await app.request('/api/v1/admin/providers','GET',undefined,editor)).json.data[0];assert.equal(failed.state,'failed');assert.equal(failed.lastSuccessAt,healthy.lastSuccessAt);
    assert.equal((await app.request('/api/v1/catalog')).json.data.contentVersion,baseline.contentVersion);
    assert.equal((await app.request('/api/v1/admin/drafts','GET',undefined,editor)).json.data.length,1);
  }finally{await app.close();}
});

test('approved operations retain evidence and expire, restricted records never enter public output',async()=>{
  const app=await fixture();
  try{
    const reviewer=await app.login('reviewer'),editor=await app.login('editor');
    const body={entityId:'hanshin-gg:building:janggong',title:'출입 제한',owner:'테스트 검토 부서',status:'closed',startsAt:'2026-10-07T07:00:00Z',endsAt:'2026-10-07T09:00:00Z',sourceId:baseline.sources[0].id,visibility:'public'};
    assert.equal((await app.request('/api/v1/admin/operations','POST',body,editor)).status,403);
    const created=await app.request('/api/v1/admin/operations','POST',body,reviewer);assert.equal(created.status,201);assert.equal(created.json.data.revision,1);
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,title:'PRIVATE_OPERATION_MARKER',visibility:'restricted'},reviewer)).status,201);
    const catalog=(await app.request('/api/v1/catalog')).json.data;
    assert.equal(domain.operationStatus(catalog.operations,body.entityId,'2026-10-07T08:00:00Z').status,'closed');
    assert.equal(domain.operationStatus(catalog.operations,body.entityId,'2026-10-07T10:00:00Z').status,'expired');
    assert.ok(!JSON.stringify(catalog).includes('PRIVATE_OPERATION_MARKER'));assert.ok(!JSON.stringify(catalog.operations).includes('reviewerId'));
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,endsAt:body.startsAt},reviewer)).status,422);
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,id:created.json.data.id,title:'수정'},reviewer)).status,409);
    const changed=await app.request('/api/v1/admin/operations','POST',{...body,id:created.json.data.id,expectedRevision:1,title:'수정',endsAt:'2026-10-07T11:00:00Z'},reviewer);assert.equal(changed.status,200);assert.equal(changed.json.data.revision,2);
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,id:created.json.data.id,expectedRevision:1},reviewer)).status,409);
    const cancelled=await app.request('/api/v1/admin/operations','POST',{...body,id:created.json.data.id,expectedRevision:2,status:'cancelled'},reviewer);assert.equal(cancelled.status,200);
    assert.equal(domain.operationStatus((await app.request('/api/v1/operations')).json.data,body.entityId,'2026-10-07T08:00:01Z').status,'unknown');
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,startsAt:'2026-10-07 07:00'},reviewer)).status,422);
  }finally{await app.close();}
});

function pngChunk(kind,payload){
  const kindBytes=Buffer.from(kind),body=Buffer.concat([kindBytes,payload]);let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(payload.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([size,body,checksum]);
}
test('photo uploads accept decoded PNG structure, strip metadata, reject damage, and remain private',async()=>{
  const app=await fixture();
  try{
    const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
    const photo=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('tEXt',Buffer.from('Description\0PRIVATE_PHOTO_METADATA')),pngChunk('IDAT',deflateSync(Buffer.from([0,255,128,64,255]))),pngChunk('IEND',Buffer.alloc(0))]);
    const body={spaceId:'hanshin-gg:building:janggong',type:'location',description:'사진 확인',idempotencyKey:'valid-png-photo-key',photo:{mimeType:'image/png',dataBase64:photo.toString('base64')}};
    const receipt=await app.request('/api/v1/reports','POST',body);assert.equal(receipt.status,201);
    const reviewer=await app.login('reviewer');
    const listed=(await app.request('/api/v1/admin/reports','GET',undefined,reviewer)).json.data.find(row=>row.id===receipt.json.data.id);
    assert.equal(listed.hasPhoto,true);assert.ok(!Object.hasOwn(listed,'photo'));assert.ok(!Object.hasOwn(listed,'photo_mime'));
    const attachment=await app.request(`/api/v1/admin/reports/${receipt.json.data.id}/photo`,'GET',undefined,reviewer);assert.equal(attachment.status,200);assert.equal(attachment.headers.get('content-type'),'image/png');assert.match(attachment.headers.get('content-disposition'),/^attachment/);assert.ok(!attachment.bytes.includes(Buffer.from('PRIVATE_PHOTO_METADATA')));
    assert.equal((await app.request(`/api/v1/admin/reports/${receipt.json.data.id}/photo`)).status,401);
    const damaged=Buffer.from(photo);damaged[29]^=1;
    assert.equal((await app.request('/api/v1/reports','POST',{...body,idempotencyKey:'damaged-png-photo',photo:{...body.photo,dataBase64:damaged.toString('base64')}})).status,422);
    assert.equal((await app.request('/api/v1/reports','POST',{...body,idempotencyKey:'truncated-jpeg-photo',photo:{mimeType:'image/jpeg',dataBase64:Buffer.from([255,216,255,192,0,2,255,217]).toString('base64')}})).status,422);
  }finally{await app.close();}
});

test('forwarded client identity is used only through explicitly trusted proxies and refuses ambiguous chains',async()=>{
  for(const trusted of [false,true]){
    const app=await fixture(trusted?{trustedProxyIPs:['127.0.0.1']} : {});
    try{
      for(let i=0;i<9;i++){
        const result=await app.request('/api/v1/session','POST',{username:'unknown_user',password:'fixture-invalid-password'},undefined,{'X-Forwarded-For':`198.51.100.${i+1}`});
        assert.equal(result.status,!trusted&&i===8?429:401);
      }
      if(trusted)assert.equal((await app.request('/api/v1/health','GET',undefined,undefined,{'X-Forwarded-For':'198.51.100.1, 10.0.0.2'})).status,400);
    }finally{await app.close();}
  }
});

test('migration and online backup preserve records across application restart',async()=>{
  const app=await fixture();
  try{
    const backup=join(app.temporary,'backup.sqlite');
    await app.platform.repository.backup(backup);
    assert.ok((await readFile(backup)).length>0);
    const reopened=new CampusRepository(root,backup);
    try{assert.equal(reopened.current().contentVersion,baseline.contentVersion);assert.equal(reopened.db.prepare('SELECT COUNT(*) count FROM users').get().count,3);assert.equal(reopened.db.prepare('SELECT COUNT(*) count FROM migrations').get().count,4);}
    finally{reopened.close();}
    await assert.rejects(()=>app.platform.repository.backup(backup));
  }finally{await app.close();}
});

test('catalog contract and content version failures leave the current release unchanged',async()=>{
  const app=await fixture();
  try{
    const editor=await app.login('editor');const catalog=copy(baseline);catalog.entities[0].name+=' altered';
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog,summary:'same version forbidden',expectedRevision:1},editor)).status,422);
    catalog.contentVersion+='-invalid';catalog.entities.push(copy(catalog.entities[0]));
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog,summary:'duplicate rejected',expectedRevision:1},editor)).status,422);
    assert.equal((await app.request('/api/v1/catalog')).json.data.contentVersion,baseline.contentVersion);
  }finally{await app.close();}
});
