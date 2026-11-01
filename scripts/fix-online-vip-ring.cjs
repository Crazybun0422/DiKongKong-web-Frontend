const fs=require('fs'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/flight-meetups';
const backend='E:/source_code/wechat/DiKongKong-Backend/src';
for(const [name,target] of [
 ['FlightMeetupOnlineService.java',backend+'/main/java/com/example/dikongkongbackend/service/FlightMeetupOnlineService.java'],
 ['FlightMeetupOnlineServiceTest.java',backend+'/test/java/com/example/dikongkongbackend/service/FlightMeetupOnlineServiceTest.java'],
 ['online-index.wxml',mini+'/online/index.wxml'],['online-index.wxss',mini+'/online/index.wxss']
])fs.copyFileSync(path.join(__dirname,'online-feature',name),target);
const template=mini+'/index/index.wxml';let source=fs.readFileSync(template,'utf8');
const before='class="yf-online-avatar"';if(!source.includes(before))throw Error('Preview avatar anchor missing');
source=source.replace(before,`class="yf-online-avatar {{item.member ? 'yf-online-avatar--member' : ''}}"`);
fs.writeFileSync(template,source);
fs.appendFileSync(mini+'/index/index.wxss','\n.yf-online-avatar--member{border-color:#f59e0b;box-shadow:0 0 10px rgba(245,158,11,.42)}\n');
console.log('Restored active VIP membership flag and gold avatar rings for preview and list.');
