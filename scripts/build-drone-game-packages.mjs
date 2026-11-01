import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, cp, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const staging = path.join(root, '.game-build');
const output = path.join(staging, 'resource-packages');
const source = path.join(root, 'src/games/drone-race');
const miniRoot = process.env.DRONE_MINI_ROOT || path.resolve(root, '../DiKongKong-wechat-mini/miniprogram');
const androidRoot = process.env.DRONE_ANDROID_ASSETS || 'D:/Workspace/LowLatitudePlanet/app/src/main/assets/drone-game';
const miniEngineOnly = process.argv.includes('--mini-engine-only');
const androidOnly = process.argv.includes('--android-only');
if (miniEngineOnly && androidOnly) throw new Error('Choose either --mini-engine-only or --android-only.');
const digest = (buffer, algorithm = 'sha256') => createHash(algorithm).update(buffer).digest('hex');
const exists = async target => access(target).then(() => true, () => false);
async function filesIn(directory, prefix = '') {
  const result = [];
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + item.name;
    if (item.isDirectory()) result.push(...await filesIn(path.join(directory, item.name), name + '/'));
    else result.push({ path: name, bytes: await readFile(path.join(directory, item.name)) });
  }
  return result;
}
async function pack(files, stem, extra = {}) {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.bytes, { date: new Date('2026-01-01T00:00:00Z'), createFolders: false });
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const sha256 = digest(bytes), name = `${stem}-${sha256.slice(0, 16)}.zip`;
  await writeFile(path.join(output, name), bytes);
  return { version: '21-' + sha256.slice(0, 16), url: name, engineVersion: 21, uiRevision: 2, apiContract: 'java-jwt-v1', sha256, md5: digest(bytes, 'md5'), size: bytes.length,
    files: files.map(file => ({ path: file.path, sha256: digest(file.bytes), md5: digest(file.bytes, 'md5'), size: file.bytes.length })), ...extra };
}
await mkdir(staging, { recursive: true });
await mkdir(output, { recursive: true });
// Standalone relative URLs allow the same bundle to run entirely inside Android's local origin.
let mobileManifest;
if (!miniEngineOnly) {
const mobileDir = path.join(staging, 'mobile');
await viteBuild({ configFile: false, root, publicDir: false, base: './', logLevel: 'warn',
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  build: { outDir: mobileDir, emptyOutDir: true, rollupOptions: { input: path.join(root, 'games/drone-race/index.html') } },
});
const html = (await readFile(path.join(mobileDir, 'games/drone-race/index.html'), 'utf8')).replaceAll('../../assets/', './assets/');
const mobileFiles = [{ path: 'index.html', bytes: Buffer.from(html) }, ...await filesIn(path.join(mobileDir, 'assets'), 'assets/')];
// An older downloaded V21 package may still use the retired ticket/Node API.
// Native clients require this contract before replacing their APK fallback.
mobileManifest = await pack(mobileFiles, 'drone-mobile', { entry: 'index.html', apiContract: 'java-jwt-v1', uiRevision: 4, inputRevision: 3 });
await writeFile(path.join(output, 'mobile-manifest.json'), JSON.stringify(mobileManifest, null, 2) + '\n');
if (await exists(path.dirname(androidRoot))) {
  await mkdir(androidRoot, { recursive: true });
  for (const file of mobileFiles) { const target = path.join(androidRoot, file.path); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, file.bytes); }
  const expected = new Set(mobileFiles.map(file => file.path));
  for (const old of await filesIn(androidRoot)) {
    if (!expected.has(old.path) && /^assets\/[A-Za-z0-9._-]+\.(js|css|mp3|webp|svg)$/.test(old.path)) {
      const target = path.resolve(androidRoot, old.path);
      if (!target.startsWith(path.resolve(androidRoot) + path.sep)) throw new Error('Generated asset outside Android game directory');
      await unlink(target);
    }
  }
  await writeFile(path.join(androidRoot, 'manifest.json'), JSON.stringify(mobileManifest, null, 2) + '\n');
  console.log(`Android V21 fallback copied to ${androidRoot}`);
} else console.log('Android checkout not present; deployable ZIP generated in dist. Set DRONE_ANDROID_ASSETS to copy the APK fallback.');
}

if (androidOnly) {
  const publicationDir = path.join(root, 'dist/resource-packages');
  await mkdir(publicationDir, { recursive: true });
  await cp(path.join(output, mobileManifest.url), path.join(publicationDir, mobileManifest.url));
  await cp(path.join(output, 'mobile-manifest.json'), path.join(publicationDir, 'mobile-manifest.json'));
  console.log(`Android-only V21 package: ${path.join(publicationDir, mobileManifest.url)}`);
  process.exit(0);
}

let miniManifest;
if (!miniEngineOnly) {
const miniFiles = (await filesIn(path.join(source, 'assets'), 'assets/')).filter(file => /^assets\/(audio\/.*\.mp3|textures\/.*\.webp)$/.test(file.path));
miniManifest = await pack(miniFiles, 'drone-mini-assets');
await writeFile(path.join(output, 'mini-assets-manifest.json'), JSON.stringify(miniManifest, null, 2) + '\n');
}
// Mini-program renderers use lexical bindings: browser globals are not available in the WeChat VM.
const platform = path.join(staging, 'mini-platform.js');
await writeFile(platform, `export let document, window, Image, performance, devicePixelRatio, Worker, ImageData;
export function bindPlatform(p) { document=p.document; window=p.window; Image=p.Image; performance=p.performance; devicePixelRatio=p.devicePixelRatio; Worker=p.Worker; ImageData=p.ImageData; }\n`);
const engineDir = path.join(staging, 'mini-engine');
await mkdir(engineDir, { recursive: true });
await esbuild({
  stdin: { contents: `export { AIRFRAMES as airframes, createAirframe, airframeSketch, buildFromSketch } from './src/games/drone-race/lib/airframes';
export { COURSES as courses, course, COURSE_LENGTH } from './src/games/drone-race/lib/courses';
export { COLORS, initialFlight, stepFlight } from './src/games/drone-race/lib/drone';
export { drawRace, drawPreview } from './src/games/drone-race/lib/render';
export { disposeDroneRenderer } from './src/games/drone-race/lib/drone-renderer';
export { bindRaceWorldCanvas, setRaceResolutionScale, disposeRaceWorld } from './src/games/drone-race/lib/race-world';
export { resetSceneryAssets } from './src/games/drone-race/lib/scenery';
export { resetObstacleAssets } from './src/games/drone-race/lib/obstacle-art';
export { bindPlatform } from './.game-build/mini-platform';`, resolveDir: root, loader: 'ts' },
  outfile: path.join(engineDir, 'engine.js'), bundle: true, format: 'cjs', platform: 'neutral', target: 'es2018', minify: true,
  inject: [platform], plugins: [{ name: 'mini-assets', setup(build) {
    build.onLoad({ filter: /\.webp$/ }, args => ({ contents: `export default ${JSON.stringify('assets/textures/' + path.basename(args.path))}`, loader: 'js' }));
    build.onLoad({ filter: /black-hole\.ts$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')).replace("new URL('../assets/black-hole-worker.js',import.meta.url)", "'assets/black-hole-worker.js'"), loader: 'ts' }));
    // Native GLES validates precision across shader stages. The original
    // preview uniform inherited highp in vertex and mediump in fragment.
    build.onLoad({ filter: /drone-renderer\.ts$/ }, async args => ({ contents: (await readFile(args.path, 'utf8'))
      .replaceAll('uniform vec2 uTilt;', 'uniform mediump vec2 uTilt;')
      .replace('initialize();ctx.imageSmoothingEnabled=true;', "initialize();ctx.canvas.dataset.previewRenderer=gl&&surface&&program?'webgl':'canvas';ctx.imageSmoothingEnabled=true;"), loader: 'ts' }));
    // The mini-program race uses a visible WebGL canvas. Keep the browser build
    // unchanged while removing the native GL -> 2D full-frame copy on WeChat.
    build.onLoad({ filter: /race-world\.ts$/ }, async args => {
      let contents = await readFile(args.path, 'utf8');
      contents = contents
        .replace('let world:World|null=null,unavailable=false;', 'let world:World|null=null,unavailable=false,directCanvas:HTMLCanvasElement|null=null;let nativeResolutionScale=1;')
        .replace("const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl'", "const canvas=directCanvas??document.createElement('canvas'),gl=canvas.getContext('webgl'")
        .replace('Math.max(.85,w.quality)', '(directCanvas?Math.max(1/(devicePixelRatio||1),nativeResolutionScale):Math.max(.85,w.quality))')
        .replace('ctx.drawImage(w.canvas,0,0,width,height);', 'if(w.canvas!==directCanvas)ctx.drawImage(w.canvas,0,0,width,height);')
        .replace('export function disposeRaceWorld(){', 'export function setRaceResolutionScale(scale:number){nativeResolutionScale=Number.isFinite(scale)?Math.max(.65,Math.min(1,scale)):1;}\nexport function bindRaceWorldCanvas(canvas:HTMLCanvasElement|null){if(canvas===directCanvas)return;if(world)disposeRaceWorld();directCanvas=canvas;unavailable=false;}\nexport function disposeRaceWorld(){');
      if (!contents.includes('export function bindRaceWorldCanvas')) throw new Error('Mini direct WebGL transform did not apply');
      return { contents, loader: 'ts' };
    });
  } }],
});
if (!miniEngineOnly) {
  await cp(path.join(source, 'assets/textures'), path.join(engineDir, 'assets/textures'), { recursive: true });
  await writeFile(path.join(engineDir, 'pack-config.js'), 'module.exports = ' + JSON.stringify({ ...miniManifest, configPath: '/api/config/drone-flight-resources/current?platform=mini&engineVersion=21' }, null, 2) + ';\n');
}
if (await exists(miniRoot)) {
  const target = path.join(miniRoot, 'packages/drone-game/engine');
  await mkdir(target, { recursive: true });
  if (miniEngineOnly) await cp(path.join(engineDir, 'engine.js'), path.join(target, 'engine.js'));
  else await cp(engineDir, target, { recursive: true });
  console.log(`Mini-program V21 ${miniEngineOnly ? 'engine' : 'engine and fallback textures'} copied to ${target}`);
} else console.log('Mini-program checkout not present; engine staged in .game-build/mini-engine. Set DRONE_MINI_ROOT to copy it.');
if (!miniEngineOnly) {
console.log(`Offline packages: Android ${(mobileManifest.size / 1048576).toFixed(2)} MB; mini media ${(miniManifest.size / 1048576).toFixed(2)} MB.`);

const release = { schema: 1, game: 'drone-flight', packages: { android: mobileManifest, mini: miniManifest } };
const publication = new JSZip(), date = new Date('2026-01-01T00:00:00Z');
publication.file('release.json', JSON.stringify(release), { date });
publication.file('android.zip', await readFile(path.join(output, mobileManifest.url)), { date });
publication.file('mini.zip', await readFile(path.join(output, miniManifest.url)), { date });
const publicationBytes = await publication.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
const publicationDir = path.join(root, 'dist/resource-packages');
await mkdir(publicationDir, { recursive: true });
const publicationName = `drone-flight-v21-${digest(publicationBytes).slice(0, 12)}.zip`;
await writeFile(path.join(publicationDir, publicationName), publicationBytes);
console.log(`Upload in admin > system settings > 涂鸦飞行资源: ${path.join(publicationDir, publicationName)}`);
}
