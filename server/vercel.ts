import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPlatform } from './platform';
import { remoteClient } from './database';

export function vercelClientAddress(request: IncomingMessage): string {
  // Vercel overwrites this header at its ingress. This adapter is used only by
  // the Vercel function, never by the standalone/local HTTP server.
  const address = request.headers['x-forwarded-for'];
  if (typeof address !== 'string' || !isIP(address)) throw new Error('Vercel client address is unavailable.');
  return address;
}

export function createVercelHandler(environment: NodeJS.ProcessEnv = process.env, connect = remoteClient) {
  let ready: ReturnType<typeof createPlatform> | undefined;
  async function initialize() {
    const origin = environment.CAMPUS_PUBLIC_ORIGIN;
    if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://')) throw new Error('CAMPUS_PUBLIC_ORIGIN must be an explicit HTTPS origin.');
    if (!environment.TURSO_DATABASE_URL || !environment.TURSO_AUTH_TOKEN) throw new Error('Database configuration is required.');
    const client = await connect(environment.TURSO_DATABASE_URL, environment.TURSO_AUTH_TOKEN);
    try {
      const root=resolve('.');
      return await createPlatform({root,assetRoot:resolve(root,'dist'),sqlClient:client,origins:[origin],secureCookies:true,clientAddress:vercelClientAddress,log:record=>process.stdout.write(JSON.stringify(record)+'\n')});
    } catch(error) { client.close(); throw error; }
  }
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestId=randomUUID();
    try {
      const url=new URL(request.url||'/',environment.CAMPUS_PUBLIC_ORIGIN||'https://invalid.local');
      const routes=url.searchParams.getAll('__campus_route');
      if(routes.length){
        const route=routes[0];
        if(routes.length!==1||!/^\/(?:api\/v1(?:\/[^?#\\\0]*)?|assets\/releases\/[a-f0-9]{64}\.[a-z0-9]+)$/.test(route)) {
          response.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'});
          response.end(JSON.stringify({data:null,error:{code:'INVALID_ROUTE',message:'요청 경로를 확인해 주세요.'},meta:{requestId}}));return;
        }
        url.searchParams.delete('__campus_route');
        request.url=route+(url.searchParams.size?'?'+url.searchParams.toString():'');
      }
      ready ||= initialize();
      const platform=await ready;
      if(!await platform.handle(request,response)){
        response.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});
        response.end(JSON.stringify({data:null,error:{code:'RESOURCE_NOT_FOUND',message:'요청한 리소스를 찾을 수 없습니다.'},meta:{requestId}}));
      }
    } catch {
      ready=undefined;
      if(!response.headersSent){
        response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Retry-After':'30'});
        response.end(JSON.stringify({data:null,error:{code:'SERVICE_UNAVAILABLE',message:'서비스 연결을 확인 중입니다. 잠시 후 다시 시도해 주세요.'},meta:{requestId}}));
      }else response.end();
      process.stderr.write(JSON.stringify({level:'error',service:'campus-api',requestId,errorCode:'SERVERLESS_INITIALIZATION_FAILED'})+'\n');
    }
  };
}
