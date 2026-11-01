const fs=require('fs'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const backend='E:/source_code/wechat/DiKongKong-Backend/src';
for(const [from,to] of [
 ['FlightMeetupOnlineService.java',backend+'/main/java/com/example/dikongkongbackend/service/FlightMeetupOnlineService.java'],
 ['FlightMeetupOnlineServiceTest.java',backend+'/test/java/com/example/dikongkongbackend/service/FlightMeetupOnlineServiceTest.java'],
 ['online-people.js',mini+'/packages/flight-meetups/online-people.js']
])fs.copyFileSync(path.join(__dirname,'online-feature',from),to);
const entry=mini+'/packages/flight-meetups/index/index.js';let source=fs.readFileSync(entry,'utf8');
const before='onShow(){this._visible=true;this.loadOnlinePreview();';
const after="onShow(){this._visible=true;this.loadOnlinePreview();onlinePeople.locateIfAuthorized().then(point=>{if(point&&this._visible){this._onlinePoint=point;this.loadOnlinePreview();}});";
if(!source.includes(before))throw Error('Entry onShow anchor missing');
source=source.replace(before,after).replace('onlinePeople.list(0,5)','onlinePeople.list(0,5,this._onlinePoint)');fs.writeFileSync(entry,source);
console.log('Distance now uses ordinary saved locations and independent location reporting.');
