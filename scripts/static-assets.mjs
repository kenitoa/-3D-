import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import vm from 'node:vm';

// Files intended for redistribution; raw captures and development files stay private.
const supportingFiles = [
  'evidence/README.md', 'evidence/official-campus-markers.json',
  'evidence/campus-map-digitization.json', 'evidence/legacy-spatial-snapshot.json',
  'evidence/source-manifest.json', 'evidence/spatial-verification.json',
  'docs/implementation-plan.md', 'docs/requirements-status.md',
  'docs/accuracy.md', 'docs/deployment.md',
  'docs/expansion-status.md', 'docs/data-contract.md', 'docs/api.md',
  'docs/database.md', 'docs/security.md', 'docs/validation.md', 'docs/operations.md',
  'docs/refinement-status.md', 'docs/refinement-assets.md', 'docs/refinement-acceptance.md',
  'vendor/NOTICE.txt', 'vendor/babylonjs-LICENSE.md', 'vendor/babylonjs-gui-LICENSE.md',
  'vendor/babylonjs-loaders-LICENSE.md', 'vendor/qr-LICENSE.txt', 'vendor/qr-LICENSE-MIT.txt',
  'src/data/model-manifest.json', 'admin.html', 'src/ui/admin.js', 'styles/admin.css',
  'src/domain/refinement.js', 'src/ui/refinement-controls.js', 'src/ui/refinement-scene-preview.js',
  'assets/media/manifest.json', 'assets/ar/manifest.json',
  'manifest.webmanifest', 'assets/app-icon.svg', 'service-worker.js', 'offline-manifest.json',
];

export async function publicFiles(root) {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const paths = new Set(['index.html', ...supportingFiles]);
  const manifest=JSON.parse(await readFile(resolve(root,'src/data/model-manifest.json'),'utf8'));
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.models))throw new Error('Invalid model asset manifest.');
  for(const model of manifest.models.flatMap(entry=>[entry,...(entry.variants||[])])){
    if(typeof model.source!=='string'||!(/^(?:src\/models\/[a-z0-9_-]+\.js|assets\/[a-zA-Z0-9_/-]+\.(?:glb|png|jpg|jpeg|webp|ktx2))$/).test(model.source)||model.source.split('/').some((part)=>part.startsWith('.')))throw new Error('Invalid registered model path.');
    paths.add(model.source);
    for(const asset of model.assets||[]){if(typeof asset!=='string'||!/^assets\/[a-zA-Z0-9_/-]+\.(?:glb|png|jpg|jpeg|webp|ktx2)$/.test(asset)||asset.split('/').some((part)=>part.startsWith('.')))throw new Error('Invalid registered texture path.');paths.add(asset);}
  }
  const media=JSON.parse(await readFile(resolve(root,'assets/media/manifest.json'),'utf8'));
  if(media.schemaVersion!==1||!Array.isArray(media.records)||media.records.length>200)throw new Error('Invalid public media manifest.');
  const ar=JSON.parse(await readFile(resolve(root,'assets/ar/manifest.json'),'utf8'));
  if(ar.schemaVersion!==1||!Array.isArray(ar.anchors)||ar.anchors.length>100)throw new Error('Invalid public AR registry.');
  let publicEntities=new Map(),publicSources=new Map();
  if(media.records.length||ar.anchors.length){
    const context=vm.createContext({window:{},URL,console:{log(){},warn(){},error(){}}});
    for(const path of ['src/data/campus-data.js','src/data/interior-data.js','src/domain/site-geometry.js','src/data/site-plan.js','src/domain/campus-platform.js'])vm.runInContext(await readFile(resolve(root,path),'utf8'),context,{timeout:5000});
    const domain=context.window.CampusPlatform,catalog=domain.publicCatalog(domain.createCatalog(context.SitePlanData,context.window.CampusData));
    publicEntities=new Map(catalog.entities.map(entity=>[entity.id,entity]));publicSources=new Map(catalog.sources.map(source=>[source.id,source]));
  }
  for(const entry of media.records){
    if(Object.keys(entry).some(key=>!['entityId','sourceId','license','path','kind','public','caption'].includes(key)))throw new Error('Public media cannot carry unreviewed raw metadata.');
    if(entry.public!==true||typeof entry.entityId!=='string'||typeof entry.sourceId!=='string'||typeof entry.license!=='string'||!entry.license.trim()||typeof entry.path!=='string'||!/^assets\/media\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|mp4|webm|mp3|ogg|wav)$/.test(entry.path)||entry.path.split('/').some(part=>part.startsWith('.')))throw new Error('Public media needs a local path, entity, source and reuse permission.');
    paths.add(entry.path);
    if(!publicEntities.has(entry.entityId)||!publicSources.has(entry.sourceId))throw new Error('Public media must reference a registered public space and source.');
  }
  for(const anchor of ar.anchors){
    if(Object.keys(anchor).some(key=>!['id','campusId','entityId','sourceIds','reviewedAt','validUntil','maxHorizontalErrorMeters','maxVerticalErrorMeters','landmarks'].includes(key))||anchor.landmarks?.some(point=>Object.keys(point).some(key=>!['id','role','siteMeters'].includes(key))))throw new Error('AR registry cannot carry unreviewed raw metadata.');
    if(!publicEntities.has(anchor.entityId)||publicEntities.get(anchor.entityId).campusId!==anchor.campusId||!Array.isArray(anchor.sourceIds)||!anchor.sourceIds.length||!anchor.sourceIds.every(sourceId=>publicSources.get(sourceId)?.confidence==='verified')||!Array.isArray(anchor.landmarks)||anchor.landmarks.length<5||!Number.isFinite(Date.parse(anchor.reviewedAt))||!Number.isFinite(Date.parse(anchor.validUntil)))throw new Error('AR registry must reference reviewed public spaces, sources and field landmarks.');
  }
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\.\/[^"?#]+)"/g)) {
    const path = match[1].slice(2);
    if (!/^(?:src\/[a-zA-Z0-9_/-]+\.js|styles\/[a-zA-Z0-9_/-]+\.css|vendor\/(?:babylon\.js|babylon\.gui\.min\.js|babylonjs\.loaders\.min\.js|share-code\.js)|manifest\.webmanifest)$/.test(path)) throw new Error(`Invalid public runtime asset: ${path}`);
    paths.add(path);
  }
  return paths;
}

export function isInside(root, file) {
  const local = relative(root, file);
  return local !== '' && local !== '..' && !local.startsWith('../') && !local.startsWith('..\\') && !isAbsolute(local);
}

export async function safePublicFile(root, name) {
  const actualRoot = await realpath(root);
  const target = await realpath(resolve(root, name));
  if (!isInside(actualRoot, target) || relative(actualRoot, target).replaceAll('\\', '/') !== name) return null;
  return target;
}
