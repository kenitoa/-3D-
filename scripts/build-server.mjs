import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function buildServer(checkOnly = false) {
  const output=await build({entryPoints:['server/platform.ts'],bundle:true,platform:'node',format:'esm',target:'node22',write:false,legalComments:'none'});
  const code=`// Generated from server/platform.ts; run npm run build.\n${output.outputFiles[0].text}`;
  if(checkOnly){if(await readFile('server/platform.mjs','utf8')!==code)throw new Error('Generated server runtime is stale.');}
  else await writeFile('server/platform.mjs',code,'utf8');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/build-server.mjs'))await buildServer(process.argv.includes('--check'));
