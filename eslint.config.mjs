import js from '@eslint/js';

const globals = Object.fromEntries(['window','document','navigator','location','URL','Blob','Image','performance','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','AbortController','fetch','console','HTMLElement','HTMLInputElement','MessageChannel','BABYLON','CampusData','CampusHud','JanggongModel','PilheonModel','ManwooModel','ShalomModel','ImmanuelModel','GyeongsamModel','SongamModel','SotongModel','PracticeModel','HanulModel','SeongbinModel','SaeromModel','HaeoreumModel','JoonhaModel','NeutbomModel','ChildcareModel','SitePlanData','SiteGeometry'].map((name) => [name, 'readonly']));
export default [
  { ignores: ['node_modules/**','dist/**','vendor/**','test-results/**','playwright-report/**','src/app.js','src/models/*.js','server/platform.mjs','server/vercel.mjs','server/database-transfer.mjs'] },
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { sourceType: 'script', globals }, rules: { 'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }] } },
  { files: ['scripts/**/*.mjs','tests/**/*.mjs','*.mjs'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', AbortSignal: 'readonly' } } },
  { files:['scripts/qr-runtime.mjs'],languageOptions:{globals:{window:'readonly'}} },
  { files:['service-worker.js'],languageOptions:{sourceType:'script',globals:{self:'readonly',caches:'readonly',crypto:'readonly',fetch:'readonly',URL:'readonly',Response:'readonly'}} },
];
