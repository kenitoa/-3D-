import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile, mkdir, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, basename } from 'node:path';
import { createPlatform, loadDomain, CampusRepository } from '../server/platform.mjs';

const root=resolve('.');
const {domain,baseline}=loadDomain(root);
const copy=(value)=>JSON.parse(JSON.stringify(value));
const secondCampusId='scope-fixture';
const retiredId='hanshin-gg:external-facility:retired-fixture';
const foreignId=`${secondCampusId}:building:private-fixture`;
const privateMarker='PRIVATE_OTHER_CAMPUS_FIXTURE';
// These synthetic scope fixtures test authorization; they are never campus production data.
function multiCampus(){
  const catalog=copy(baseline),campus=copy(baseline.campuses[0]);
  campus.id=secondCampusId;campus.name=privateMarker;campus.origin={lat:38,lon:128};campus.terrain=null;campus.visualizationPlan=null;
  for(const boundary of Object.values(campus.boundaries))if(boundary)boundary.originId=secondCampusId;
  const campusEntity=copy(baseline.entities.find((entity)=>entity.kind==='campus'));
  Object.assign(campusEntity,{id:secondCampusId,campusId:secondCampusId,name:privateMarker,displayTitle:privateMarker,visibility:'restricted'});
  campusEntity.geometry.originId=secondCampusId;
  const foreign=copy(baseline.entities.find((entity)=>entity.kind==='building'));
  Object.assign(foreign,{id:foreignId,campusId:secondCampusId,parentId:secondCampusId,owningBuildingId:foreignId,legacyId:null,legacyKey:null,name:privateMarker,displayTitle:privateMarker,visibility:'restricted',interior:null,feature:null});
  foreign.geometry.originId=secondCampusId;
  const retired=copy(baseline.entities.find((entity)=>entity.kind==='external-facility'));
  Object.assign(retired,{id:retiredId,parentId:'hanshin-gg',owningBuildingId:null,legacyId:null,legacyKey:null,geometry:null,position:null,interior:null,feature:null,modelPose:null});
  catalog.campuses.push(campus);catalog.entities.push(campusEntity,foreign,retired);
  assert.equal(domain.validateCatalog(catalog).valid,true,JSON.stringify(domain.validateCatalog(catalog).errors));
  return catalog;
}
async function fixture(options={}){
  const temporary=await mkdtemp(join(tmpdir(),'hanshin-list-'));
  if(!resolve(temporary).startsWith(resolve(tmpdir())+sep)||!basename(temporary).startsWith('hanshin-list-'))throw new Error('Unsafe cleanup directory.');
  let platform;
  const server=http.createServer((request,response)=>platform.handle(request,response));
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    platform=createPlatform({root,databasePath:join(temporary,'test.sqlite'),origins:[origin],domain,baseline:multiCampus(),now:()=>new Date('2026-10-07T08:00:00Z'),...options});
    for(const [username,role,scopes] of [['admin','admin',[]],['editor','editor',['hanshin-gg']],['allstaff','reviewer',['hanshin-gg',secondCampusId]],['foreign','editor',[secondCampusId]]])platform.repository.createUser(username,`scope-fixture-password-${username}`,role,scopes);
  }catch(error){server.closeAllConnections();await new Promise((accept)=>server.close(accept));platform?.close();await rm(temporary,{recursive:true});throw error;}
  async function request(path,method='GET',body,session){
    const response=await fetch(origin+path,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,json:await response.json()};
  }
  async function login(username){
    const response=await fetch(origin+'/api/v1/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password:`scope-fixture-password-${username}`})});
    assert.equal(response.status,200);const json=await response.json();return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:json.data.csrfToken,user:json.data.user};
  }
  const db=platform.repository.db;
  function draft(catalog,author,summary,time){const id=randomUUID();db.prepare('INSERT INTO drafts(id,catalog,summary,status,author_id,revision,base_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,JSON.stringify(catalog),summary,'draft',author,1,1,time,time);return id;}
  function release(catalog,summary,time){const id=randomUUID();db.prepare('INSERT INTO releases(id,catalog,summary,created_at) VALUES(?,?,?,?)').run(id,JSON.stringify(catalog),summary,time);return id;}
  function report(entityId,time,description='scope fixture report'){const id=randomUUID();db.prepare('INSERT INTO reports(id,space_id,type,description,status,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,entityId,'other',description,'received',id,id,time,time);return id;}
  function operation(entityId,time,visibility='restricted',sourceId=baseline.sources[0].id){
    const id=randomUUID(),payload={id,entityId,state:'closed',label:'scope fixture operation',visibility,verification:'verified',sourceIds:[sourceId],observedAt:time,validFrom:'2026-10-07T00:00:00Z',validUntil:'2026-10-08T00:00:00Z'};
    const actor=db.prepare("SELECT id FROM users WHERE username='admin'").get().id;
    db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?)').run(id,entityId,JSON.stringify(payload),actor,time,time);return id;
  }
  async function close(){server.closeAllConnections();await new Promise((accept)=>server.close(accept));platform.close();await rm(temporary,{recursive:true});}
  return {temporary,platform,db,request,login,draft,release,report,operation,close};
}

test('whole private catalog and draft payloads require every campus scope; status and summaries filter in SQL',async()=>{
  const app=await fixture();
  try{
    const editor=await app.login('editor'),allstaff=await app.login('allstaff'),admin=await app.login('admin');
    const full=app.platform.repository.current();
    const hiddenDraft=app.draft(full,admin.user.id,privateMarker,'2026-10-07T08:00:00Z');
    const visibleDraft=app.draft(baseline,editor.user.id,'owned campus draft','2026-10-07T07:00:00Z');
    app.release(baseline,'owned campus release','2026-10-07T07:00:00Z');
    app.report('hanshin-gg:building:janggong','2026-10-07T07:00:00Z');app.report(foreignId,'2026-10-07T08:00:00Z',privateMarker);
    assert.equal((await app.request('/api/v1/admin/catalog','GET',undefined,editor)).status,403);
    for(const staff of [allstaff,admin])assert.ok(JSON.stringify((await app.request('/api/v1/admin/catalog','GET',undefined,staff)).json.data).includes(privateMarker));
    const status=(await app.request('/api/v1/admin/status','GET',undefined,editor)).json.data;
    assert.equal(status.catalogReadable,false);assert.equal(status.reportCount,1);assert.deepEqual(status.sources,[]);assert.deepEqual(status.integrations,[]);assert.deepEqual(status.metrics,{});assert.deepEqual(status.drafts.map((row)=>row.id),[visibleDraft]);assert.ok(!JSON.stringify(status).includes(privateMarker));
    const drafts=await app.request('/api/v1/admin/drafts?limit=1','GET',undefined,editor);
    assert.deepEqual(drafts.json.data.map((row)=>row.id),[visibleDraft]);assert.equal(drafts.json.meta.pagination.hasMore,false);
    assert.equal((await app.request('/api/v1/admin/drafts?limit=1','GET',undefined,allstaff)).json.data[0].id,hiddenDraft);
    assert.equal((await app.request('/api/v1/admin/drafts','POST',{catalog:full,summary:'attempt',expectedRevision:1},editor)).status,403);
    assert.equal((await app.request(`/api/v1/admin/drafts/${hiddenDraft}`,'PATCH',{action:'submit',expectedRevision:1},editor)).status,403);
    assert.equal((await app.request(`/api/v1/admin/drafts/${visibleDraft}`,'PATCH',{action:'submit',expectedRevision:1},editor)).status,403);
    assert.ok(!JSON.stringify((await app.request('/api/v1/admin/releases?limit=1','GET',undefined,editor)).json).includes(privateMarker));
  }finally{await app.close();}
});

test('provider imports cannot bypass whole-catalog scope or introduce an unassigned campus',async()=>{
  let transportCalls=0;
  const provider={id:'scope-fixture',url:'https://approved.example.invalid/catalog',sourceId:baseline.sources[0].id,campusId:'hanshin-gg',kind:'catalog',enabled:true,secretEnv:null};
  const app=await fixture({providers:[provider],providerTransport:async()=>{transportCalls++;return multiCampus();}});
  try{
    const editor=await app.login('editor'),allstaff=await app.login('allstaff');
    assert.equal((await app.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},editor)).status,403);assert.equal(transportCalls,0);
    const imported=await app.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},allstaff);assert.equal(imported.status,201);assert.equal(transportCalls,1);
    assert.ok(!JSON.stringify(imported.json).includes(privateMarker));
    assert.equal((await app.request('/api/v1/admin/drafts','GET',undefined,editor)).json.data.length,0);
    assert.equal((await app.request('/api/v1/admin/providers','GET',undefined,editor)).json.data[0].draftId,null);
  }finally{await app.close();}
  const single=await fixture({baseline:copy(baseline),providers:[provider],providerTransport:async()=>multiCampus()});
  try{
    const editor=await single.login('editor');const response=await single.request(`/api/v1/admin/providers/${provider.id}/sync`,'POST',{expectedRevision:1},editor);
    assert.ok([403,503].includes(response.status));assert.ok(!JSON.stringify(response.json).includes(privateMarker));assert.equal(Number(single.db.prepare('SELECT COUNT(*) count FROM drafts').get().count),0);
  }finally{await single.close();}
});

test('retired or removed entity records retain permanent campus authorization for counts, list and processing',async()=>{
  const app=await fixture();
  try{
    const editor=await app.login('editor'),foreign=await app.login('foreign'),allstaff=await app.login('allstaff');
    const canonical=await app.request('/api/v1/admin/operations','POST',{entityId:'janggong',title:'legacy identity fixture',owner:'fixture reviewer',status:'closed',startsAt:'2026-10-07T00:00:00Z',endsAt:'2026-10-08T00:00:00Z',sourceId:baseline.sources[0].id},allstaff);
    assert.equal(canonical.status,201);assert.equal(canonical.json.data.entityId,'hanshin-gg:building:janggong');
    const ownedReport=app.report(retiredId,'2026-10-07T07:00:00Z'),outsideReport=app.report(foreignId,'2026-10-07T08:00:00Z');
    const ownedOperation=app.operation(retiredId,'2026-10-07T07:00:00Z');app.operation(foreignId,'2026-10-07T08:00:00Z');
    const changed=app.platform.repository.current();changed.entities=changed.entities.filter((entity)=>entity.id!==retiredId);assert.equal(domain.validateCatalog(changed).valid,true);
    app.db.prepare('UPDATE releases SET catalog=? WHERE id=?').run(JSON.stringify(changed),app.platform.repository.setting('currentRelease'));app.db.prepare('UPDATE identities SET retired=1 WHERE id=?').run(retiredId);
    assert.equal((await app.request('/api/v1/admin/status','GET',undefined,editor)).json.data.reportCount,1);
    assert.deepEqual((await app.request('/api/v1/admin/reports?limit=1','GET',undefined,editor)).json.data.map((row)=>row.id),[ownedReport]);
    const ownOperations=(await app.request('/api/v1/admin/operations','GET',undefined,editor)).json.data;
    assert.ok(ownOperations.some((row)=>row.id===ownedOperation));assert.ok(ownOperations.some((row)=>row.id===canonical.json.data.id));assert.equal(ownOperations.length,2);
    assert.equal((await app.request(`/api/v1/admin/reports/${ownedReport}`,'GET',undefined,editor)).status,200);
    assert.equal((await app.request(`/api/v1/admin/reports/${ownedReport}`,'PATCH',{status:'resolved',responseNote:'retired fixture processed'},editor)).status,200);
    assert.equal((await app.request(`/api/v1/admin/reports/${outsideReport}`,'GET',undefined,editor)).status,403);
    assert.equal((await app.request(`/api/v1/admin/reports/${ownedReport}`,'GET',undefined,foreign)).status,403);
  }finally{await app.close();}
});

test('SQL paging keeps array responses, stable ordering, scoped hasMore and bounded query validation',async()=>{
  const app=await fixture();
  try{
    const editor=await app.login('editor'),admin=await app.login('admin');
    for(let index=0;index<3;index++){
      const time=`2026-10-07T0${index+1}:00:00Z`;
      app.draft(baseline,editor.user.id,`owned-${index}`,time);app.release(baseline,`owned-${index}`,time);app.report('hanshin-gg:building:janggong',time);app.operation('hanshin-gg:building:janggong',time,'public');app.platform.repository.audit(null,'fixture.paging',String(index),time);
    }
    app.draft(app.platform.repository.current(),admin.user.id,privateMarker,'2026-10-07T09:00:00Z');app.report(foreignId,'2026-10-07T09:00:00Z');app.operation(foreignId,'2026-10-07T09:00:00Z','public');
    const current=app.platform.repository.current(),privateSource={...copy(baseline.sources[0]),id:'private-source-fixture',visibility:'restricted'};current.sources.push(privateSource);
    app.db.prepare('UPDATE releases SET catalog=? WHERE id=?').run(JSON.stringify(current),app.platform.repository.setting('currentRelease'));
    app.operation('hanshin-gg:building:janggong','2026-10-07T09:30:00Z','public',privateSource.id);
    for(const path of ['/api/v1/admin/drafts','/api/v1/admin/releases','/api/v1/admin/reports','/api/v1/admin/operations','/api/v1/admin/audit','/api/v1/releases','/api/v1/operations']){
      const staff=path.endsWith('/audit')?admin:editor;
      const first=await app.request(`${path}?limit=2&offset=0`,'GET',undefined,staff);assert.equal(first.status,200,path);assert.equal(first.json.data.length,2,path);assert.deepEqual(first.json.meta.pagination,{limit:2,offset:0,hasMore:true,nextOffset:2});
      const next=await app.request(`${path}?limit=2&offset=2`,'GET',undefined,staff);assert.equal(next.status,200);assert.ok(!next.json.data.some((row)=>first.json.data.some((previous)=>previous.id===row.id)),path);
      if(!['/api/v1/admin/audit','/api/v1/admin/operations','/api/v1/releases'].includes(path))assert.deepEqual(next.json.meta.pagination,{limit:2,offset:2,hasMore:false,nextOffset:null});
      const empty=await app.request(`${path}?limit=2&offset=100000`,'GET',undefined,staff);assert.deepEqual(empty.json.data,[]);assert.equal(empty.json.meta.pagination.nextOffset,null);
      for(const query of ['limit=0','limit=-1','limit=1.5','limit=1e2','limit=2&limit=3','offset=-1','offset=100001','offset=0x10','offset=99999999999999999999','limit=']){
        const invalid=await app.request(`${path}?${query}`,'GET',undefined,staff);assert.equal(invalid.status,422,`${path}?${query}`);assert.equal(invalid.json.error.code,'INVALID_PAGINATION');
      }
      assert.equal((await app.request(`${path}?limit=${path.endsWith('/audit')?201:101}`,'GET',undefined,staff)).status,422);
    }
    assert.equal((await app.request('/api/v1/admin/audit?limit=200','GET',undefined,admin)).status,200);
    assert.equal((await app.request('/api/v1/admin/reports','GET',undefined,editor)).json.meta.pagination.limit,100);
  }finally{await app.close();}
});

test('backup uses database private-path and real-parent policy while valid backup preserves data',async()=>{
  const app=await fixture();
  try{
    for(const directory of ['dist','src','styles','vendor','evidence','docs','server'])await assert.rejects(()=>app.platform.repository.backup(join(root,directory,`scope-backup-${randomUUID()}.sqlite`)),/public or source directory/);
    await assert.rejects(()=>app.platform.repository.backup(join(app.temporary,'not-sqlite.json')),/\.sqlite/);
    const path=join(app.temporary,'private','backup.sqlite');await app.platform.repository.backup(path);assert.ok((await readFile(path)).length>0);
    const reopened=new CampusRepository(root,path);try{assert.equal(reopened.current().campuses.length,2);}finally{reopened.close();}
    await assert.rejects(()=>app.platform.repository.backup(path),/new \.sqlite/);
    const alias=join(app.temporary,'public-alias');
    // Junctions on Windows avoid developer-mode symlink privileges and exercise resolved parent checks.
    await symlink(resolve(root,'src'),alias,process.platform==='win32'?'junction':'dir');assert.equal((await lstat(alias)).isSymbolicLink(),true);
    await assert.rejects(()=>app.platform.repository.backup(join(alias,'blocked.sqlite')),/public or source directory/);
    const directory=join(app.temporary,'directory.sqlite');await mkdir(directory);await assert.rejects(()=>app.platform.repository.backup(directory),/link or directory/);
  }finally{await app.close();}
});

test('operation periods validate calendar dates and clock values before timezone normalization',async()=>{
  const app=await fixture();
  try{
    const staff=await app.login('allstaff');
    const body={entityId:'hanshin-gg:building:janggong',title:'calendar fixture',owner:'fixture reviewer',status:'closed',startsAt:'2026-02-28T09:00:00+09:00',endsAt:'2026-03-01T09:00:00+09:00',sourceId:baseline.sources[0].id};
    for(const invalid of ['2026-02-31T09:00:00+09:00','2026-02-29T09:00:00Z','2026-04-31T09:00:00Z','2026-13-01T09:00:00Z','2026-00-01T09:00:00Z','2026-02-00T09:00:00Z','2026-02-28T24:00:00Z','2026-02-28T09:60:00Z','2026-02-28T09:00:60Z','2026-02-28T09:00:00+24:00','2026-02-28T09:00:00+09:60','2026-02-28T09:00:00']){
      const result=await app.request('/api/v1/admin/operations','POST',{...body,startsAt:invalid},staff);assert.equal(result.status,422,invalid);assert.equal(result.json.error.code,'INVALID_PERIOD');
    }
    assert.equal((await app.request('/api/v1/admin/operations','POST',{...body,endsAt:'2026-02-31T09:00:00+09:00'},staff)).status,422);
    const normal=await app.request('/api/v1/admin/operations','POST',body,staff);assert.equal(normal.status,201);assert.equal(normal.json.data.startsAt,'2026-02-28T00:00:00.000Z');assert.equal(normal.json.data.endsAt,'2026-03-01T00:00:00.000Z');
    const leap=await app.request('/api/v1/admin/operations','POST',{...body,startsAt:'2028-02-29T23:59:59.999-04:30',endsAt:'2028-03-01T01:00:00-04:30'},staff);assert.equal(leap.status,201);assert.equal(leap.json.data.startsAt,'2028-03-01T04:29:59.999Z');
    const cancelled=await app.request('/api/v1/admin/operations','POST',{...body,id:leap.json.data.id,expectedRevision:1,status:'cancelled',startsAt:'2028-02-29T23:59:59.999-04:30',endsAt:'2028-03-01T01:00:00-04:30'},staff);assert.equal(cancelled.status,200);
    assert.ok(Date.parse(cancelled.json.data.validFrom)>Date.parse(cancelled.json.data.validUntil));
    const publicCatalog=(await app.request('/api/v1/catalog')).json.data;assert.equal(domain.validateCatalog(publicCatalog).valid,true,JSON.stringify(domain.validateCatalog(publicCatalog).errors));assert.ok(!publicCatalog.operations.some((operation)=>operation.id===leap.json.data.id));
    const publicOperations=await app.request('/api/v1/operations?limit=1');assert.equal(publicOperations.json.data.length,1);assert.equal(publicOperations.json.data[0].id,normal.json.data.id);assert.equal(publicOperations.json.meta.pagination.hasMore,false);
    assert.ok((await app.request('/api/v1/admin/operations','GET',undefined,staff)).json.data.some((operation)=>operation.id===leap.json.data.id&&operation.status==='cancelled'));
    assert.ok((await app.request('/api/v1/admin/audit','GET',undefined,await app.login('admin'))).json.data.some((entry)=>entry.operation==='operation.published'&&entry.resource_id===leap.json.data.id));
    assert.equal(Number(app.db.prepare('SELECT COUNT(*) count FROM operations').get().count),2);
  }finally{await app.close();}
});
