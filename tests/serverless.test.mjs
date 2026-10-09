import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';

test('serverless adapter, persisted workflows and data migration integration scenarios',async context=>{
  const directory=await mkdtemp(join(tmpdir(),'campus-serverless-'));
  assert.ok(directory.startsWith(resolve(tmpdir())+sep)&&basename(directory).startsWith('campus-serverless-'));
  try{
    // The libSQL native Windows library holds file mappings until process exit.
    // Run real-client scenarios in a child; the parent then removes all fixtures.
    const environment={...process.env,CAMPUS_TEST_DIRECTORY:directory};delete environment.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,['--test','tests/fixtures/serverless-scenarios.mjs'],{env:environment,encoding:'utf8',timeout:120_000,windowsHide:true});
    context.diagnostic(result.stdout);
    assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
    assert.match(result.stdout,/# tests 4\s/);
    assert.match(result.stdout,/# pass 4\s/);
  }finally{await rm(directory,{recursive:true});}
});
