import { DatabaseSync, backup } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, lstatSync, realpathSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { AsyncRepository } from './async-repository';
import type { SqlDatabase, SqlRow } from './database';
import { localDatabase } from './database';

const tables=['settings','users','sessions','identities','drafts','releases','reports','operations','audit','provider_runs','public_asset_blobs','release_bundles','release_asset_links'];
const quote=(name:string):string=>'"'+name.replace(/"/g,'""')+'"';
function privatePath(root:string,path:string):string {
  const target=resolve(path),parent=realpathSync(dirname(target));
  if(!target.endsWith('.sqlite')||existsSync(target)&&lstatSync(target).isSymbolicLink())throw new Error('Use an unlinked .sqlite file.');
  for(const name of ['dist','src','styles','vendor','evidence','docs','server','api']){
    const forbidden=resolve(root,name),actual=existsSync(forbidden)?realpathSync(forbidden):forbidden,local=relative(actual,parent);
    if(!local||!local.startsWith('..')&&!isAbsolute(local))throw new Error('Database snapshots must stay outside public/source directories.');
  }
  return resolve(parent,target.split(/[\\/]/).pop()!);
}
export async function createMigrationSnapshot(root:string,sourcePath:string,destination:string):Promise<void> {
  const source=privatePath(root,sourcePath),target=privatePath(root,destination);
  if(source===target)throw new Error('Snapshot cannot replace its source.');
  // Reserve a new private file; never replace an existing backup.
  const descriptor=openSync(target,'wx',0o600);closeSync(descriptor);
  const database=new DatabaseSync(source,{readOnly:true});
  try{await backup(database,target);}finally{database.close();}
}
export async function prepareUploadSnapshot(root:string,sourcePath:string,destination:string):Promise<void> {
  await createMigrationSnapshot(root,sourcePath,destination);
  const snapshot=new DatabaseSync(privatePath(root,destination));
  try {
    snapshot.exec('PRAGMA foreign_keys=ON;');
    await new AsyncRepository(root,localDatabase(snapshot)).migrate();
    if(snapshot.prepare('PRAGMA quick_check').get()?.quick_check!=='ok'||snapshot.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Upload snapshot integrity check failed.');
    snapshot.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');
  }finally{snapshot.close();}
}
const digest=(row:SqlRow,columns:string[]):string=>createHash('sha256').update(JSON.stringify(columns.map(key=>{
  const value=row[key];return value instanceof Uint8Array?{blob:createHash('sha256').update(value).digest('hex'),bytes:value.byteLength}:value;
}))).digest('hex');

export async function importSnapshot(root:string,snapshotPath:string,target:SqlDatabase,onProgress:(table:string,rows:number)=>void=()=>{}):Promise<Record<string,number>> {
  const path=privatePath(root,snapshotPath),fingerprint=createHash('sha256').update(readFileSync(path)).digest('hex');
  const source=new DatabaseSync(path,{readOnly:true});
  try{
    if(source.prepare('PRAGMA quick_check').get()?.quick_check!=='ok'||source.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Snapshot integrity check failed.');
    const sourceVersion=Number(source.prepare('SELECT MAX(version) AS version FROM migrations').get()?.version);
    if(!Number.isInteger(sourceVersion)||sourceVersion<1||sourceVersion>4)throw new Error('Unsupported snapshot schema.');
    const repository=new AsyncRepository(root,target);await repository.migrate();
    const available=new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name)));
    await target.transaction(async()=>{
      const prior=await target.prepare('SELECT * FROM database_imports').all();
      if(prior.some(row=>row.fingerprint!==fingerprint))throw new Error('Target belongs to a different import. Use a new empty database.');
      if(prior.length)return;
      for(const table of tables)if(Number((await target.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get())?.count))throw new Error('Import target must be empty.');
      await target.prepare("INSERT INTO database_imports(fingerprint,state,created_at) VALUES(?,'importing',?)").run(fingerprint,new Date().toISOString());
    });
    const progress=await target.prepare('SELECT * FROM database_imports WHERE fingerprint=?').get(fingerprint);
    const totals:Record<string,number>={};
    for(let index=0;index<tables.length;index++){
      const table=tables[index],columns=source.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row=>String(row.name));
      const sourceCount=available.has(table)?Number(source.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get()?.count):0;totals[table]=sourceCount;
      if(!available.has(table))continue;
      if(index<Number(progress?.cursor_table)||progress?.state==='complete')continue;
      let cursor=index===Number(progress?.cursor_table)?Number(progress?.cursor_row):0;
      for(;;){
        const rows=source.prepare(`SELECT rowid AS __rowid,* FROM ${quote(table)} WHERE rowid>? ORDER BY rowid LIMIT 25`).all(cursor);
        if(!rows.length)break;
        for(const row of rows){
          await target.transaction(async()=>{
            const blobs=columns.filter(column=>row[column] instanceof Uint8Array && (row[column] as Uint8Array).byteLength>512*1024);
            const values:SQLInputValue[]=columns.map(column=>blobs.includes(column)?(row[column] as Uint8Array).subarray(0,512*1024):row[column]);
            await target.prepare(`INSERT INTO ${quote(table)}(rowid,${columns.map(quote).join(',')}) VALUES(${Array(columns.length+1).fill('?').join(',')})`).run(Number(row.__rowid),...values);
            for(const column of blobs){
              const bytes=row[column] as Uint8Array;
              for(let offset=512*1024;offset<bytes.byteLength;offset+=512*1024)await target.prepare(`UPDATE ${quote(table)} SET ${quote(column)}=CAST(${quote(column)} || ? AS BLOB) WHERE rowid=?`).run(bytes.subarray(offset,offset+512*1024),Number(row.__rowid));
            }
            await target.prepare('UPDATE database_imports SET cursor_table=?,cursor_row=? WHERE fingerprint=?').run(index,Number(row.__rowid),fingerprint);
          });
          cursor=Number(row.__rowid);
        }
        onProgress(table,cursor);
      }
      await target.prepare('UPDATE database_imports SET cursor_table=?,cursor_row=0 WHERE fingerprint=?').run(index+1,fingerprint);
    }
    // Check every row and BLOB through bounded individual reads, not a giant export.
    for(const table of tables){
      if(Number((await target.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get())?.count)!==totals[table])throw new Error(`Import row count mismatch (${table}).`);
      if(!available.has(table))continue;
      const columns=source.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row=>String(row.name));
      let cursor=0;
      for(;;){const rows=source.prepare(`SELECT rowid AS __rowid,* FROM ${quote(table)} WHERE rowid>? ORDER BY rowid LIMIT 25`).all(cursor);if(!rows.length)break;
        for(const row of rows){const actual=await target.prepare(`SELECT * FROM ${quote(table)} WHERE rowid=?`).get(Number(row.__rowid));if(!actual||digest(actual,columns)!==digest(row,columns))throw new Error(`Import integrity mismatch (${table}).`);cursor=Number(row.__rowid);}
      }
    }
    if((await target.prepare('PRAGMA foreign_key_check').all()).length)throw new Error('Target foreign key verification failed.');
    await target.prepare("UPDATE database_imports SET state='complete',completed_at=? WHERE fingerprint=?").run(new Date().toISOString(),fingerprint);
    await repository.assertReady();return totals;
  }finally{source.close();}
}
