import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const compiled = await build({entryPoints:['src/ui/view-safe-area.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { viewSafeArea } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const rect = (left, top, width, height) => ({left,top,width,height,right:left+width,bottom:top+height});

test('compact top controls leave the full mobile width available at every render scale', () => {
  for (const scale of [1, 0.5, 2]) {
    const insets = viewSafeArea({canvas:rect(0,0,390,844),panel:rect(127,77,252,45),headerBottom:66,panelExpanded:false,renderWidth:390*scale,renderHeight:844*scale});
    assert.deepEqual(insets, {left:0,right:0,top:134*scale,bottom:55*scale});
  }
});

test('desktop side panels respect canvas coordinates while expanded mobile controls have no lateral inset', () => {
  const desktop=viewSafeArea({canvas:rect(100,20,1440,1000),panel:rect(1225,37,296,967),headerBottom:121,panelExpanded:true,renderWidth:1440,renderHeight:1000});
  assert.deepEqual(desktop,{left:0,right:327,top:113,bottom:55});
  const mobile=viewSafeArea({canvas:rect(0,0,390,844),panel:rect(127,77,252,650),headerBottom:66,panelExpanded:true,renderWidth:390,renderHeight:844});
  assert.equal(mobile.left,0);assert.equal(mobile.right,0);
  assert.ok(mobile.top+mobile.bottom<=844*.75);
});
