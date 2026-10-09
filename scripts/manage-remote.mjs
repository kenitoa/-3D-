import { resolve } from 'node:path';
import { AsyncRepository, remoteClient, libsqlDatabase } from '../server/platform.mjs';
import { createMigrationSnapshot, prepareUploadSnapshot, importSnapshot } from '../server/database-transfer.mjs';

const command=process.argv[2],root=resolve('.');
try{
  if(command==='snapshot'||command==='prepare-upload'){
    const source=process.argv[3],destination=process.argv[4];
    if(!source||!destination)throw new Error('Supply source.sqlite and a new private backup.sqlite path.');
    await (command==='prepare-upload'?prepareUploadSnapshot:createMigrationSnapshot)(root,source,destination);
    process.stdout.write('Created a new private online snapshot. The source was not modified.\n');
  }else{
    const client=await remoteClient(process.env.TURSO_DATABASE_URL,process.env.TURSO_AUTH_TOKEN),db=libsqlDatabase(client),repository=new AsyncRepository(root,db);
    try{
      if(command==='migrate'){await repository.migrate();process.stdout.write('External database schema migrated.\n');}
      else if(command==='import'){
        const snapshot=process.argv[3];if(!snapshot)throw new Error('Supply an immutable private snapshot.sqlite path.');
        const totals=await importSnapshot(root,snapshot,db,(table,rows)=>process.stdout.write(JSON.stringify({operation:'database.import',table,rows})+'\n'));
        process.stdout.write(JSON.stringify({operation:'database.import.verified',tables:totals})+'\n');
      }else if(command==='check'){await repository.assertReady();process.stdout.write('External database is ready.\n');}
      else throw new Error('Commands: snapshot | prepare-upload | migrate | import | check');
    }finally{db.close();}
  }
}catch{
  process.stderr.write('Database operation failed. Check command, credentials, snapshot integrity and an empty matching target. Private details were not logged.\n');process.exitCode=1;
}
