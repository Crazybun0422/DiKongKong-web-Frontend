const fs=require('fs');
const file='E:/source_code/wechat/DiKongKong-wechat-mini/scripts/check-no-fly-announcement.cjs';
let s=fs.readFileSync(file,'utf8');
s=s.replace('call({_enabled:true,_center:','call({_enabled:true,_ready:true,_center:');
s+=`\n// Pending/failed reads must never report a safe area or expose stale card links.\nfor (const failed of [false,true]) {\n  const value=definition.methods.describeTemporaryStatus.call({_enabled:true,_ready:false,_loadFailed:failed});\n  assert.equal(value.temporaryNoFlyZoneInfo,null);\n  assert.equal(value.temporaryNoFlyTone,failed?'warn':'neutral');\n}\nconsole.log('PASS: pending and failed queries do not report safe airspace');\n`;
fs.writeFileSync(file,s);
