import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function buildServer(checkOnly = false) {
  for (const name of ['platform','vercel','database-transfer']) {
    const output=await build({entryPoints:[`server/${name}.ts`],bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',write:false,legalComments:'none'});
    const code=`// Generated from server/${name}.ts; run npm run build.\n${output.outputFiles[0].text}`;
    if(checkOnly){if(await readFile(`server/${name}.mjs`,'utf8')!==code)throw new Error('Generated server runtime is stale.');}
    else await writeFile(`server/${name}.mjs`,code,'utf8');
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/build-server.mjs'))await buildServer(process.argv.includes('--check'));
