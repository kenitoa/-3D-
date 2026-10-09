import { readFileSync, realpathSync, lstatSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { createHash } from 'node:crypto';
import type { SqlDatabase } from './database';
import { validateModelManifest, validateSelfContainedGlb } from '../src/scene/model-loader';
import type { ModelManifest, ModelEntry } from '../src/scene/model-loader';

type RecordValue = Record<string,unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const pick=(value:object,keys:string[]):RecordValue=>Object.fromEntries(keys.filter(key=>Reflect.get(value,key)!==undefined).map(key=>[key,Reflect.get(value,key)]));
const publicPlacement=(value:object)=>pick(value,['units','upAxis','origin','anchorMeters','yawRadians','altitudeDatum','mode']);
function publicModel(model:ModelEntry):ModelEntry {
  return {...pick(model,['id','campusId','buildingId','legacyId','kind','source','global','export','status','bytes','sha256']),...(model.placement?{placement:publicPlacement(model.placement)}:{}),...(model.provenance?{provenance:pick(model.provenance,['sourceId','license','creator','tool','settings','sourceHash'])}:{}),...(model.variants?{variants:model.variants.map(value=>({...pick(value,['id','source','kind','global','export','minScreenCoverage','maxDistanceMeters','bytes','sha256']),...(value.placement?{placement:publicPlacement(value.placement)}:{})}))}:{})} as unknown as ModelEntry;
}
const extensions: Record<string,string> = {'.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ktx2':'image/ktx2','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
export interface AssetSnapshot {path:string;originalPath:string;bytes:number;sha256:string;detail:boolean}
export interface ReleaseBundle {schemaVersion:1;releaseId:string;contentVersion:string;assetsVersion:string;catalogHash:string;catalog:RecordValue;manifest:ModelManifest;assets:AssetSnapshot[];mediaRecords:RecordValue[];createdAt:string}
interface StoredAsset { snapshot:AssetSnapshot; body:Buffer; extension:string; mime:string }
function safeRead(root:string,path:string):Buffer {
  if (!/^(?:index\.html|manifest\.webmanifest|service-worker\.js|src\/[a-zA-Z0-9_/-]+\.(?:js|json)|styles\/[a-zA-Z0-9_/-]+\.css|vendor\/[a-zA-Z0-9_.-]+\.(?:js|md|txt)|assets\/(?:media|ar)\/manifest\.json|assets\/[a-zA-Z0-9_/-]+\.(?:svg|glb|png|jpg|jpeg|webp|ktx2|mp4|webm|mp3|ogg|wav))$/.test(path) || path.includes('admin') || path.split('/').some(part=>part.startsWith('.')) || path==='src/ui/refinement-scene-preview.js') throw new Error('Only explicitly public runtime assets may enter a release bundle.');
  const actualRoot=realpathSync(root),file=resolve(actualRoot,path);
  if(lstatSync(file).isSymbolicLink()||!lstatSync(file).isFile())throw new Error('Public assets cannot be links or directories.');
  const actual=realpathSync(file),local=relative(actualRoot,actual);
  if(isAbsolute(local)||local.startsWith('..')||local.split('\\').join('/')!==path)throw new Error('Public asset escapes its registered directory.');
  const size=lstatSync(actual).size;if(size<1||size>128*1024*1024)throw new Error('Public asset exceeds the registered file limit.');
  return readFileSync(actual);
}
function referencesPublicBuilding(model:ModelEntry,manifest:ModelManifest,catalog:RecordValue):boolean {
  return Array.isArray(catalog.entities)&&catalog.entities.some((item:unknown)=>object(item)&&item.kind==='building'&&item.visibility==='public'&&!item.sensitive&&item.campusId===(model.campusId||manifest.campusId)&&[item.id,item.legacyId,item.legacyKey].some(key=>typeof key==='string'&&[model.id,model.buildingId,model.legacyId].includes(key)));
}
export async function prepareReleaseBundle(root:string,releaseId:string,catalog:RecordValue,createdAt:string,db:SqlDatabase):Promise<{bundle:ReleaseBundle;assets:StoredAsset[]}> {
  const input:unknown=catalog.assetManifest||JSON.parse(readFileSync(resolve(root,'src/data/model-manifest.json'),'utf8'));
  validateModelManifest(input);
  const sourceIds=new Set((Array.isArray(catalog.sources)?catalog.sources:[]).filter(item=>object(item)&&item.visibility==='public').map(item=>(item as RecordValue).id));
  const manifest:ModelManifest={schemaVersion:1,version:input.version,...(input.campusId&&Array.isArray(catalog.campuses)&&catalog.campuses.some(item=>object(item)&&item.id===input.campusId)?{campusId:input.campusId}:{}),models:input.models.filter(model=>referencesPublicBuilding(model,input,catalog)&&(!model.provenance||sourceIds.has(model.provenance.sourceId))).map(publicModel)};
  const paths=new Map<string,{bytes?:number;sha256?:string;detail:boolean}>();
  const baselinePath=resolve(root,'offline-manifest.json');
  if(existsSync(baselinePath)){
    const baseline:unknown=JSON.parse(readFileSync(baselinePath,'utf8'));
    if(!object(baseline)||baseline.schemaVersion!==1||!Array.isArray(baseline.assets)||baseline.assets.length>1000)throw new Error('Invalid offline base asset manifest.');
    for(const item of baseline.assets){if(!object(item)||typeof item.path!=='string'||typeof item.sha256!=='string'||!Number.isSafeInteger(item.bytes))throw new Error('Invalid public base integrity metadata.');if(!item.detail)paths.set(item.path,{bytes:Number(item.bytes),sha256:item.sha256,detail:false});}
  }
  const registered=(entry:ModelEntry)=>{paths.set(entry.source,{bytes:entry.bytes,sha256:entry.sha256,detail:true});for(const variant of entry.variants||[])paths.set(variant.source,{bytes:variant.bytes,sha256:variant.sha256,detail:true});};
  manifest.models.forEach(registered);
  const mediaValue:unknown=JSON.parse(safeRead(root,'assets/media/manifest.json').toString('utf8'));
  if(!object(mediaValue)||mediaValue.schemaVersion!==1||!Array.isArray(mediaValue.records)||mediaValue.records.length>200)throw new Error('Invalid public media registry.');
  const publicEntityIds=new Set((Array.isArray(catalog.entities)?catalog.entities:[]).filter(object).map(item=>item.id)),publicSourceIds=new Set((Array.isArray(catalog.sources)?catalog.sources:[]).filter(object).map(item=>item.id));
  const mediaRecords=mediaValue.records.map((value:unknown)=>{
    if(!object(value)||value.public!==true||typeof value.path!=='string'||!/^assets\/media\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|mp4|webm|mp3|ogg|wav)$/.test(value.path)||!publicEntityIds.has(value.entityId)||!publicSourceIds.has(value.sourceId)||typeof value.license!=='string'||!value.license.trim()||!['image','audio','video'].includes(String(value.kind)))throw new Error('Media needs a public space, public source and explicit reuse permission.');
    paths.set(value.path,{detail:true});return {entityId:value.entityId,path:value.path,kind:value.kind,sourceId:value.sourceId,license:value.license,public:true,...(typeof value.caption==='string'?{caption:value.caption.slice(0,500)}:{})};
  });
  const assets:StoredAsset[]=[];let total=0;
  for(const [path,expected] of paths){
    const previous=path.match(/^assets\/releases\/([a-f0-9]{64})\.([a-z0-9]+)$/),stored=previous?await db.prepare('SELECT body,extension FROM public_asset_blobs WHERE sha256=? AND extension=?').get(previous[1],'.'+previous[2]):null;
    const body=stored?Buffer.from(stored.body as Uint8Array):safeRead(root,path),sha256=digest(body),extension=extname(path),mime=extensions[extension];
    if(!mime||expected.bytes!==undefined&&expected.bytes!==body.length||expected.sha256!==undefined&&expected.sha256!==sha256)throw new Error('Published asset bytes or SHA do not match their manifest.');
    if(extension==='.glb'){
      validateSelfContainedGlb(body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength) as ArrayBuffer);
      const json=JSON.parse(body.subarray(20,20+body.readUInt32LE(12)).toString('utf8')) as RecordValue;
      const entities=new Set((Array.isArray(catalog.entities)?catalog.entities:[]).filter(item=>object(item)&&item.visibility==='public'&&!item.sensitive).map(item=>(item as RecordValue).id));
      const inspect=(value:unknown):void=>{if(!value||typeof value!=='object')return;if(object(value)){
        if(value.visibility!==undefined&&value.visibility!=='public'||value.sensitive===true)throw new Error('Private geometry cannot enter a public GLB.');
        for(const key of ['entityId','spaceId','floorId'])if(value[key]!==undefined&&!entities.has(value[key]))throw new Error('GLB semantics reference a private or unknown space.');
      }for(const child of Object.values(value))inspect(child);};inspect(json);
    }
    total+=body.length;if(total>200*1024*1024)throw new Error('A public release bundle exceeds the 200 MiB limit.');
    assets.push({snapshot:{path:`assets/releases/${sha256}${extension}`,originalPath:path,bytes:body.length,sha256,detail:expected.detail},body,extension,mime});
  }
  const renamed=new Map(assets.map(asset=>[asset.snapshot.originalPath,asset.snapshot]));
  const models=manifest.models.map(model=>({...model,source:renamed.get(model.source)!.path,bytes:renamed.get(model.source)!.bytes,sha256:renamed.get(model.source)!.sha256,...(model.variants?{variants:model.variants.map(variant=>({...variant,source:renamed.get(variant.source)!.path,bytes:renamed.get(variant.source)!.bytes,sha256:renamed.get(variant.source)!.sha256}))}:{})}));
  const publicManifest={...manifest,models},publicCatalog={...catalog,assetsVersion:manifest.version,assetManifest:publicManifest};
  const bundle:ReleaseBundle={schemaVersion:1,releaseId,contentVersion:String(catalog.contentVersion),assetsVersion:manifest.version,catalogHash:digest(JSON.stringify(publicCatalog)),catalog:publicCatalog,manifest:publicManifest,assets:assets.map(asset=>asset.snapshot),mediaRecords:mediaRecords.map(record=>({...record,path:renamed.get(record.path)!.path})),createdAt};
  return {bundle,assets};
}
export async function storeReleaseBundle(db:SqlDatabase,prepared:Awaited<ReturnType<typeof prepareReleaseBundle>>):Promise<void> {
  const {bundle,assets}=prepared;
  await db.prepare('INSERT INTO release_bundles VALUES(?,?,?)').run(bundle.releaseId,JSON.stringify(bundle),bundle.createdAt);
  const existing = new Set((await db.prepare('SELECT sha256,extension FROM public_asset_blobs').all()).map(row => `${String(row.sha256)}${String(row.extension)}`));
  for(const asset of assets){
    const key=`${asset.snapshot.sha256}${asset.extension}`;
    if(existing.has(key))continue;
    // Bound each outbound SQL payload, including large Babylon.js snapshots.
    const chunk=512*1024;
    await db.prepare('INSERT INTO public_asset_blobs VALUES(?,?,?,?,?)').run(asset.snapshot.sha256,asset.extension,asset.mime,asset.body.length,asset.body.subarray(0,chunk));
    for(let offset=chunk;offset<asset.body.length;offset+=chunk)await db.prepare('UPDATE public_asset_blobs SET body=CAST(body || ? AS BLOB) WHERE sha256=? AND extension=?').run(asset.body.subarray(offset,offset+chunk),asset.snapshot.sha256,asset.extension);
    existing.add(key);
  }
  await db.batch(assets.map(asset=>({sql:'INSERT INTO release_asset_links VALUES(?,?,?,?)',args:[bundle.releaseId,asset.snapshot.sha256,asset.extension,asset.snapshot.originalPath]})));
}
export async function readReleaseBundle(db:SqlDatabase,id:string):Promise<ReleaseBundle|null> {const row=await db.prepare('SELECT payload FROM release_bundles WHERE release_id=?').get(id);return row?JSON.parse(String(row.payload)) as ReleaseBundle:null;}
