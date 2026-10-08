import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export async function prepareRuntime(destination = resolve('vendor')) {
  await mkdir(destination, { recursive: true });
  const packages = [
    ['babylonjs', 'babylon.js', 'babylon.js'],
    ['babylonjs-gui', 'babylon.gui.min.js', 'babylon.gui.min.js'],
    ['babylonjs-loaders', 'babylonjs.loaders.min.js', 'babylonjs.loaders.min.js'],
  ];
  const notices = [];
  for (const [name, source, output] of packages) {
    const base = resolve('node_modules', name);
    await copyFile(resolve(base, source), resolve(destination, output));
    const metadata = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'));
    notices.push(`${name} ${metadata.version} — ${metadata.license}\nhttps://github.com/BabylonJS/Babylon.js\n`);
    try {
      await copyFile(resolve(base, 'license.md'), resolve(destination, `${name}-LICENSE.md`));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await copyFile(resolve(base, 'LICENSE'), resolve(destination, `${name}-LICENSE.md`));
    }
  }
  const qrCode=await build({entryPoints:[fileURLToPath(new URL('./qr-runtime.mjs',import.meta.url))],bundle:true,platform:'browser',format:'iife',target:'es2020',minify:true,write:false});
  await writeFile(resolve(destination,'share-code.js'),qrCode.outputFiles[0].text,'utf8');
  const qrRoot=fileURLToPath(new URL('../node_modules/qr/',import.meta.url));
  const qrMetadata=JSON.parse(await readFile(resolve(qrRoot,'package.json'),'utf8'));
  await copyFile(resolve(qrRoot,'LICENSE'),resolve(destination,'qr-LICENSE.txt'));
  await copyFile(resolve(qrRoot,'LICENSE-MIT'),resolve(destination,'qr-LICENSE-MIT.txt'));
  notices.push(`qr ${qrMetadata.version} — ${qrMetadata.license}\nhttps://github.com/paulmillr/qr\n`);
  await writeFile(resolve(destination, 'NOTICE.txt'), notices.join('\n'), 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/prepare-runtime.mjs')) {
  await prepareRuntime();
  process.stdout.write('Pinned Babylon.js runtime prepared in vendor/.\n');
}
