import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createPlatform, libsqlDatabase, AsyncRepository, passwordHash } from '../../server/platform.mjs';
import { createVercelHandler, vercelClientAddress } from '../../server/vercel.mjs';
import { createMigrationSnapshot, prepareUploadSnapshot, importSnapshot } from '../../server/database-transfer.mjs';

const root=resolve('.'),origin='https://campus.example.test';
const copy=value=>JSON.parse(JSON.stringify(value));
async function directory(){
  assert.ok(process.env.CAMPUS_TEST_DIRECTORY?.startsWith(resolve(tmpdir())+sep)&&basename(process.env.CAMPUS_TEST_DIRECTORY).startsWith('campus-serverless-'));
  const path=await mkdtemp(join(process.env.CAMPUS_TEST_DIRECTORY,'scenario-'));
  return path;
}
const clientAt=path=>createClient({url:pathToFileURL(path).href,intMode:'number'});
async function server(handler){
  const instance=http.createServer(handler);
  await new Promise(accept=>instance.listen(0,'127.0.0.1',accept));
  return {base:`http://127.0.0.1:${instance.address().port}`,close:async()=>{instance.closeAllConnections();await new Promise(accept=>instance.close(accept));}};
}
async function request(base,path,method='GET',body,session){
  return new Promise((accept,reject)=>{
    const outgoing=http.request(base+path,{method,headers:{Origin:origin,Host:'campus.example.test','X-Forwarded-For':'203.0.113.71',...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>{
        const bytes=Buffer.concat(chunks);let json;try{json=JSON.parse(bytes.toString());}catch{/* Immutable assets are binary. */}
        accept({status:response.statusCode,headers:{get:name=>{const value=response.headers[name];return Array.isArray(value)?value.join(', '):value;}},bytes,json});
      });
    });outgoing.on('error',reject);outgoing.end(body?JSON.stringify(body):undefined);
  });
}
async function login(base,role){
  const result=await request(base,'/api/v1/session','POST',{username:role,password:`fixture-password-${role}`});assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Path=\/api\/v1; Max-Age=28800; Secure/);
  return {cookie:result.headers.get('set-cookie').split(';')[0],csrf:result.json.data.csrfToken};
}

test('real libSQL adapter preserves BLOBs and rolls back nested asynchronous transactions',async()=>{
  const temporary=await directory(),db=libsqlDatabase(clientAt(join(temporary,'adapter.sqlite')));
  try{
    await db.exec('CREATE TABLE sample(id INTEGER PRIMARY KEY, body BLOB);');
    const bytes=Buffer.from([0,255,128,0,1]);
    await db.transaction(async()=>{await db.prepare('INSERT INTO sample VALUES(?,?)').run(1,bytes);await db.transaction(async()=>{assert.deepEqual((await db.prepare('SELECT body FROM sample').get()).body,bytes);});});
    await assert.rejects(db.transaction(async()=>{await db.prepare('INSERT INTO sample VALUES(?,?)').run(2,bytes);await Promise.resolve();throw new Error('fixture rollback');}),/fixture rollback/);
    assert.equal((await db.prepare('SELECT count(*) AS count FROM sample').get()).count,1);
  }finally{db.close();}
});

test('libSQL API persists reports, independent approvals, immutable assets and rate limits across instances',async()=>{
  const temporary=await directory(),path=join(temporary,'api.sqlite');let app,web;
  try{
    app=await createPlatform({root,sqlClient:clientAt(path),initializeDatabase:true,origins:[origin],secureCookies:true,clientAddress:vercelClientAddress});
    for(const role of ['admin','editor','reviewer'])await app.repository.createUser(role,passwordHash(`fixture-password-${role}`),role,role==='admin'?[]:['hanshin-gg']);
    web=await server((req,res)=>app.handle(req,res));
    const editor=await login(web.base,'editor'),reviewer=await login(web.base,'reviewer');
    const catalog=copy(await app.repository.current());catalog.contentVersion+='-remote';catalog.datasetVersion=catalog.contentVersion;
    let draft=(await request(web.base,'/api/v1/admin/drafts','POST',{catalog,summary:'Remote review',expectedRevision:1},editor)).json.data;
    assert.equal((await request(web.base,`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'approve',expectedRevision:1},editor)).status,403);
    draft=(await request(web.base,`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'submit',expectedRevision:1},editor)).json.data;
    draft=(await request(web.base,`/api/v1/admin/drafts/${draft.id}`,'PATCH',{action:'approve',expectedRevision:draft.revision},reviewer)).json.data;
    assert.equal((await request(web.base,'/api/v1/admin/releases','POST',{draftId:draft.id,expectedRevision:1},reviewer)).status,201);
    const report={spaceId:'hanshin-gg:building:janggong',type:'location',description:'Persistent private feedback',idempotencyKey:'serverless-persistent-report'};
    const first=await request(web.base,'/api/v1/reports','POST',report);assert.equal(first.status,201);
    const catalogResponse=await request(web.base,'/api/v1/catalog');assert.equal(catalogResponse.status,200);
    assert.ok(!JSON.stringify(catalogResponse.json).includes(report.description));
    const large=await app.repository.db.prepare('SELECT sha256,extension,body FROM public_asset_blobs ORDER BY bytes DESC LIMIT 1').get();
    assert.ok(large.body.byteLength>4.5*1024*1024,'Fixture exercises Vercel streaming response threshold');
    const asset=await request(web.base,`/assets/releases/${large.sha256}${large.extension}`);assert.equal(asset.status,200);assert.deepEqual(asset.bytes,large.body);
    await web.close();web=undefined;app.close();
    app=await createPlatform({root,sqlClient:clientAt(path),origins:[origin],secureCookies:true,clientAddress:vercelClientAddress});
    web=await server((req,res)=>app.handle(req,res));
    assert.equal((await request(web.base,'/api/v1/reports','POST',report)).json.data.id,first.json.data.id);
    assert.equal((await request(web.base,'/api/v1/admin/status','GET',undefined,editor)).status,200);
    for(let index=0;index<4;index++)assert.equal((await request(web.base,'/api/v1/reports','POST',{...report,idempotencyKey:'remote-rate-'+index})).status,201);
    assert.equal((await request(web.base,'/api/v1/reports','POST',{...report,idempotencyKey:'remote-rate-over'})).status,429);
    assert.equal((await app.repository.current()).contentVersion,catalog.contentVersion);
  }finally{if(web)await web.close();app?.close();}
});

test('Vercel adapter validates configuration, preserves raw JSON bodies and guards rewritten routes',async()=>{
  const temporary=await directory(),path=join(temporary,'vercel.sqlite');let web;
  try{
    const seed=await createPlatform({root,sqlClient:clientAt(path),initializeDatabase:true,origins:[origin]});seed.close();
    let connections=0;
    const handler=createVercelHandler({CAMPUS_PUBLIC_ORIGIN:origin,TURSO_DATABASE_URL:'libsql://fixture.turso.io',TURSO_AUTH_TOKEN:'fixture-token'},async()=>{connections++;return clientAt(path);});
    web=await server(handler);
    assert.equal((await request(web.base,'/api/campus?__campus_route=/api/v1/health')).json.data.schemaVersion,4);
    const result=await request(web.base,'/api/campus?__campus_route=/api/v1/reports','POST',{spaceId:'hanshin-gg:building:janggong',type:'other',description:'Raw body reaches platform',idempotencyKey:'rewritten-raw-report'});
    assert.equal(result.status,201);assert.equal(connections,1);
    assert.equal((await request(web.base,'/api/campus?__campus_route=/api/v1/health&__campus_route=/api/v1/session')).status,400);
    assert.equal((await request(web.base,'/api/campus?__campus_route=/private.sqlite')).status,400);
    assert.throws(()=>vercelClientAddress({headers:{'x-forwarded-for':'1.2.3.4, 5.6.7.8'}}));
    await web.close();web=undefined;
    web=await server(createVercelHandler({},async()=>{throw new Error('Secret should never reach output');}));
    const unavailable=await request(web.base,'/api/v1/health');assert.equal(unavailable.status,503);assert.equal(unavailable.json.error.code,'SERVICE_UNAVAILABLE');assert.ok(!unavailable.bytes.toString().includes('Secret'));
  }finally{if(web)await web.close();}
});

test('online upload snapshots preserve original schema and data; interrupted chunked imports safely resume',async()=>{
  const temporary=await directory(),path=join(temporary,'source.sqlite'),snapshot=join(temporary,'backup.sqlite'),upload=join(temporary,'upload.sqlite');
  const target=libsqlDatabase(clientAt(join(temporary,'target.sqlite')));let source;
  try{
    source=await createPlatform({root,databasePath:path,origins:[origin]});
    source.repository.createUser('fixture', 'fixture-password-admin','admin',[]);
    const photo=Buffer.alloc(1200*1024);for(let index=0;index<photo.length;index++)photo[index]=index%256;
    source.repository.db.prepare('INSERT INTO reports(id,space_id,type,description,status,photo,photo_mime,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('fixture-report','hanshin-gg:building:janggong','other','migration private data','received',photo,'image/png','migration-key','fixture-hash',new Date().toISOString(),new Date().toISOString());
    // Represent a pre-serverless production DB without editing the original migration files.
    source.repository.db.exec('DROP TABLE rate_limits; DROP TABLE provider_leases; DROP TABLE database_imports; DELETE FROM migrations WHERE version=4;');
    await createMigrationSnapshot(root,path,snapshot);
    await prepareUploadSnapshot(root,path,upload);
    assert.equal(source.repository.db.prepare('SELECT MAX(version) AS version FROM migrations').get().version,3);
    const check=new DatabaseSync(upload,{readOnly:true});assert.equal(check.prepare('SELECT MAX(version) AS version FROM migrations').get().version,4);assert.deepEqual(Buffer.from(check.prepare('SELECT photo FROM reports').get().photo),photo);check.close();
    const originalHash=createHash('sha256').update(await readFile(snapshot)).digest('hex');
    await assert.rejects(importSnapshot(root,snapshot,target,(table)=>{if(table==='reports')throw new Error('fixture interrupted');}),/fixture interrupted/);
    await assert.rejects(new AsyncRepository(root,target).assertReady(),/migration\/import/);
    const totals=await importSnapshot(root,snapshot,target);assert.equal(totals.reports,1);assert.equal(totals.users,1);
    assert.deepEqual((await target.prepare('SELECT photo FROM reports').get()).photo,photo);
    assert.equal(createHash('sha256').update(await readFile(snapshot)).digest('hex'),originalHash);
    await importSnapshot(root,snapshot,target); // completed import is verified, never duplicated
    await assert.rejects(createMigrationSnapshot(root,path,snapshot),/EEXIST/);
    const full=libsqlDatabase(clientAt(join(temporary,'occupied.sqlite')));
    try{await new AsyncRepository(root,full).migrate();await full.prepare('INSERT INTO settings VALUES(?,?)').run('occupied','preserve');await assert.rejects(importSnapshot(root,snapshot,full),/must be empty/);assert.equal((await full.prepare('SELECT value FROM settings').get()).value,'preserve');}finally{full.close();}
  }finally{source?.close();target.close();}
});
