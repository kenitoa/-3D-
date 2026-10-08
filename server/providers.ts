import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { readFileSync } from 'node:fs';

export interface CampusProvider { id:string; url:string; sourceId:string; campusId:string; kind:'catalog'|'operations'|'assistant'; enabled:boolean; secretEnv:string|null }
export type ProviderPayload = Record<string, unknown>;
export type ProviderTransport = (provider: CampusProvider, payload?: ProviderPayload) => Promise<unknown>;
export interface ProviderNetwork { lookup: typeof lookup; request: typeof https.request; timeoutMs?: number }
const runtimeNetwork: ProviderNetwork = { lookup, request: https.request };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function validateProvider(item: unknown): CampusProvider {
  if (!record(item)) throw new Error('Invalid provider configuration.');
  const entry = item;
  if(typeof entry.id!=='string'||!/^[a-z0-9_-]{1,64}$/.test(entry.id)||typeof entry.url!=='string'||typeof entry.sourceId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(entry.sourceId)||typeof entry.campusId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(entry.campusId)||!['catalog','operations','assistant'].includes(String(entry.kind))||typeof entry.enabled!=='boolean')throw new Error('Invalid provider contract.');
  const url=new URL(entry.url);if(url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443')||['localhost','.local','.internal'].some(value=>url.hostname===value||url.hostname.endsWith(value))||(isIP(url.hostname.replace(/^\[|\]$/g,''))&&!publicNetworkAddress(url.hostname.replace(/^\[|\]$/g,''))))throw new Error('Providers need an explicitly approved public HTTPS endpoint.');
  if(entry.secretEnv!==undefined&&entry.secretEnv!==null&&(typeof entry.secretEnv!=='string'||!/^CAMPUS_PROVIDER_[A-Z0-9_]{1,64}$/.test(entry.secretEnv)))throw new Error('Provider secret keys must use CAMPUS_PROVIDER_ prefix.');
  return {id:entry.id,url:url.href,sourceId:entry.sourceId,campusId:entry.campusId,kind:entry.kind as CampusProvider['kind'],enabled:entry.enabled,secretEnv:typeof entry.secretEnv==='string'?entry.secretEnv:null};
}
export function publicNetworkAddress(address:string):boolean {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0));}
  if(isIP(address)===6){let value:string;try{value=new URL(`http://[${address}]/`).hostname.slice(1,-1).toLowerCase();}catch{return false;}const prefix=parseInt(value.split(':')[0],16);return prefix>=0x2000&&prefix<=0x3fff&&!value.startsWith('2002:')&&!value.startsWith('2001:0:')&&!value.startsWith('2001::')&&!value.startsWith('2001:db8:')&&!/^2001:(?:2|1[0-9a-f]|2[0-9a-f]):/.test(value);}
  return false;
}
export function loadProviders(filename?:string):CampusProvider[] {
  if(!filename)return [];
  const text=readFileSync(filename,'utf8');if(Buffer.byteLength(text)>32768)throw new Error('Provider configuration is too large.');
  const value:unknown=JSON.parse(text);if(!Array.isArray(value)||value.length>20)throw new Error('Provider configuration must be an array of at most 20 providers.');
  const ids=new Set<string>();
  return value.map((item:unknown)=>{
    const entry=validateProvider(item);
    if(ids.has(entry.id))throw new Error('Invalid provider contract.');
    ids.add(entry.id);
    return entry;
  });
}
export async function fetchProvider(input:CampusProvider,payload?:ProviderPayload,network:ProviderNetwork=runtimeNetwork):Promise<unknown> {
  const provider=validateProvider(input);
  if(!provider.enabled)throw new Error('PROVIDER_DISABLED');
  if (provider.kind==='assistant' && payload===undefined) throw new Error('PROVIDER_PAYLOAD_REQUIRED');
  let body:string|undefined;
  if(payload!==undefined){if(!record(payload))throw new Error('PROVIDER_PAYLOAD_REJECTED');body=JSON.stringify(payload);if(Buffer.byteLength(body)>32768)throw new Error('PROVIDER_PAYLOAD_TOO_LARGE');}
  const timeoutMs=network.timeoutMs??8000;
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw new Error('Invalid provider deadline.');
  const deadline=Date.now()+timeoutMs;
  const url=new URL(provider.url);let dnsTimer:ReturnType<typeof setTimeout>|undefined;
  const addresses=await Promise.race([network.lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true}),new Promise<never>((_accept,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('PROVIDER_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(dnsTimer));
  if(!addresses.length||addresses.some(item=>!publicNetworkAddress(item.address)))throw new Error('PROVIDER_NETWORK_REJECTED');
  const selected=addresses[0];const token=provider.secretEnv?process.env[provider.secretEnv]:null;
  if(provider.secretEnv&&(!token||token.length>4096||/[\r\n]/.test(token)))throw new Error('PROVIDER_SECRET_MISSING');
  const attempt=()=>new Promise<unknown>((accept,reject)=>{
    const remaining=deadline-Date.now();if(remaining<=0){reject(new Error('PROVIDER_TIMEOUT'));return;}
    let settled=false;let timer:ReturnType<typeof setTimeout>|undefined;
    const finish=(error:Error|null,result?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else if(Date.now()>=deadline)reject(new Error('PROVIDER_TIMEOUT'));else accept(result);};
    // Pin the validated DNS result for this TLS request; redirects are never followed.
    const request=network.request(url,{method:body===undefined?'GET':'POST',timeout:remaining,family:selected.family,lookup:(_host,_options,callback)=>callback(null,selected.address,selected.family),headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}),...(token?{Authorization:`Bearer ${token}`}:{})}},response=>{
      if((response.statusCode||500)<200||(response.statusCode||500)>=300){response.destroy();finish(new Error((response.statusCode||500)>=500?'PROVIDER_TEMPORARY_FAILURE':'PROVIDER_RESPONSE_REJECTED'));return;}
      if(!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(String(response.headers['content-type']||''))){response.destroy();finish(new Error('PROVIDER_FORMAT_REJECTED'));return;}
      const chunks:Buffer[]=[];let bytes=0;
      response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2*1024*1024){request.destroy(new Error('PROVIDER_RESPONSE_TOO_LARGE'));return;}chunks.push(chunk);});
      response.once('error',(error:Error)=>finish(error));response.once('end',()=>{try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{finish(new Error('PROVIDER_INVALID_JSON'));}});
    });
    timer=setTimeout(()=>request.destroy(new Error('PROVIDER_TIMEOUT')),remaining);
    request.once('timeout',()=>request.destroy(new Error('PROVIDER_TIMEOUT')));request.once('error',(error:Error)=>finish(error));request.end(body);
  });
  try{return await attempt();}catch(error){if(body===undefined&&Date.now()<deadline&&error instanceof Error&&(['PROVIDER_TEMPORARY_FAILURE','PROVIDER_TIMEOUT','ECONNRESET'].includes(error.message)||('code' in error&&error.code==='ECONNRESET')))return attempt();throw error;}
}
