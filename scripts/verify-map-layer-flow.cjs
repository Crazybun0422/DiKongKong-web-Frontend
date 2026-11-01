const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini';
const checks=[
 [mini,'scripts/check-map-layer-flow.cjs'],
 [process.cwd(),'scripts/check-uom-overlay-swap.cjs'],
 [process.cwd(),'scripts/check-uom-idle-guards.cjs'],
 [mini,'scripts/check-layer-setting-independence.cjs'],
 [mini,'scripts/check-pixel-layout.cjs'],
 [mini,'scripts/check-desktop-map.cjs']
];
const report={checkedAt:new Date().toISOString(),scope:'WeChat mini-program layer request and rendering flow',deviceValidation:false,checks:[],sources:[]};
for(const [cwd,file]of checks){const res=cp.spawnSync(process.execPath,[file],{cwd,encoding:'utf8',windowsHide:true});
 report.checks.push({file:path.join(cwd,file),exitCode:res.status,output:res.stdout+res.stderr});
 process.stdout.write(res.stdout);process.stderr.write(res.stderr);
 if(res.status!==0){process.exitCode=1;break;}}
const backup=path.resolve('artifacts/map-layer-flow-before');
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{
 const source=path.join(mini,'miniprogram',path.relative(backup,file));
 const res=cp.spawnSync(process.execPath,['--check',source],{encoding:'utf8',windowsHide:true});
 if(res.status!==0)throw Error(res.stderr);
 report.sources.push({file:source,sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')});
 }}}
walk(backup);
report.passed=!process.exitCode;
report.diagnostics={
 consolePrefixes:['[uom-overlay]','[uom5-overlay]','[uom-handoff]','[uom-graphics-clear]'],
 nativeTrace:'UOM component instance._overlayTrace (last 80 events; clear reason, native failures, batch IDs and overlay IDs)',
 pageTrace:'Map page instance._mapGraphicsTrace (last 40 view submissions; counts separated by owner)',
 noCoordinatesOrTokensInTrace:true
};
fs.writeFileSync('artifacts/map-layer-flow-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(`Checked ${report.sources.length} changed source files; physical-device verification is still required.`);
