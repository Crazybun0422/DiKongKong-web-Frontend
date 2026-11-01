const fs = require('fs'), path = require('path'), vm = require('vm');
const compiler = 'D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const source = fs.readFileSync(compiler, 'utf8');
const prefix = source.slice(0, source.indexOf('function addDefinition(route)'));
const tail = `
let bundle = '/* Temporary no-fly path navigation: focus the original start point. */\\n';
for (const file of ['utils/no-fly-zones.js', 'pages/temporary-no-fly-announcement/index.js',
  'packages/preflight/index/index.js', 'pages/map/utils/pin-preview.js']) {
  bundle += 'MiniSource.modules[' + JSON.stringify(file) + ']=function(require,module,exports,Page,Component,App,_t){\\n'
    + localize(read(file)) + '\\n};\\n';
}
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out, 'temporary-path-focus.js'), bundle);
const zh = JSON.parse(fs.readFileSync(path.join(out, 'zh.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'zh.json'), JSON.stringify({...zh, ...messages}));
const entry = path.join(out, 'index.html');
let html = fs.readFileSync(entry, 'utf8');
if (!html.includes('src="temporary-path-focus.js"')) {
  html = html.replace('<script src="runtime.js">', '<script src="temporary-path-focus.js"></script><script src="runtime.js">');
}
fs.writeFileSync(entry, html);
fs.writeFileSync(path.join(out, 'temporary-path-focus-manifest.json'), JSON.stringify({files:manifest}, null, 2));
console.log('Synced temporary path navigation to Android assets.');
`;
vm.runInNewContext(prefix + tail, {require, __dirname:path.dirname(compiler), process:{argv:[]}, console}, {filename:compiler});
