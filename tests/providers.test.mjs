import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,sep,basename } from 'node:path';
import { publicNetworkAddress,loadProviders } from '../server/platform.mjs';

test('provider network policy rejects private, loopback, link-local, mapped and translation addresses',()=>{
  for(const address of ['127.0.0.1','10.2.3.4','172.16.2.3','192.168.0.2','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','64:ff9b::a00:1','2002:a00:1::1','2001:db8::1'])assert.equal(publicNetworkAddress(address),false,address);
  for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(publicNetworkAddress(address),true,address);
});
test('provider configuration requires explicit public HTTPS endpoint, unique IDs and secret prefix',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'hanshin-providers-'));if(!resolve(folder).startsWith(resolve(tmpdir())+sep)||!basename(folder).startsWith('hanshin-providers-'))throw new Error('Unsafe test directory.');
  const path=join(folder,'providers.json');const valid={id:'school',url:'https://approved.example.invalid/data',sourceId:'source',campusId:'campus',kind:'catalog',enabled:false,secretEnv:'CAMPUS_PROVIDER_TOKEN'};
  try{
    await writeFile(path,JSON.stringify([valid]));assert.equal(loadProviders(path)[0].enabled,false);
    for(const patch of [{url:'http://approved.example.invalid/data'},{url:'https://127.0.0.1/private'},{url:'https://user:password@approved.example.invalid/data'},{secretEnv:'PATH'}]){await writeFile(path,JSON.stringify([{...valid,...patch}]));assert.throws(()=>loadProviders(path));}
    await writeFile(path,JSON.stringify([valid,valid]));assert.throws(()=>loadProviders(path));
  }finally{await rm(folder,{recursive:true});}
});
