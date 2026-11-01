const fs=require('fs'),path=require('path'),vm=require('vm');
const compiler='D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const original=fs.readFileSync(compiler,'utf8');
const prefix=original.slice(0,original.indexOf('function addDefinition(route)'));
const tail=`
const route='pages/temporary-no-fly-announcement/index';
const bundle='/* Temporary no-fly map color legend. */\\nMiniSource.definitions['+JSON.stringify(route)+'].template='+template(route+'.wxml')+';\\nMiniSource.definitions['+JSON.stringify(route)+'].css='+JSON.stringify(css(route+'.wxss'))+';\\n';
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'temporary-zone-legend.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));
fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="temporary-zone-legend.js"'))html=html.replace('<script src="runtime.js">','<script src="temporary-zone-legend.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
console.log('Synced temporary zone legend template/styles to Android.');
`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
