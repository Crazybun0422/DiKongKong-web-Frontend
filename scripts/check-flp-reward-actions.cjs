const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/';
const backend='E:/source_code/wechat/DiKongKong-Backend/';
const actions=require(mini+'utils/flp-reward-actions');
const resolve=actions.resolveFlpRewardAction;
const keys=[...fs.readFileSync(backend+'src/main/java/com/example/dikongkongbackend/util/FlpReasonKeys.java','utf8').matchAll(/= "(FLP_REASON_[A-Z0-9_]+)"/g)].map(m=>m[1]);
const consumption=new Set(['FLP_REASON_MEMBER_RECHARGE_MONTHLY','FLP_REASON_MEMBER_RECHARGE_YEARLY','FLP_REASON_PLANET_BROADCAST_GOVERNANCE_VOTE']);
const config=JSON.parse(fs.readFileSync(mini+'app.json','utf8'));
const routes=new Set([...config.pages,...config.subpackages.flatMap(p=>p.pages.map(r=>p.root+'/'+r))]);
const translations=Object.fromEntries([...fs.readFileSync(backend+'src/main/resources/i18n/messages_zh.yml','utf8').matchAll(/^(FLP_REASON_\w+): "(.+)"/gm)].map(m=>[m[1],m[2]]));
for(const key of keys){
 const action=resolve({operation:consumption.has(key)?'DECREASE':'INCREASE',reasonKey:key});
 assert(routes.has(action.url.slice(1)),action.url);
 assert.equal(action.label==='了解规则',consumption.has(key),key);
 if(translations[key])assert.deepEqual(resolve({operation:consumption.has(key)?'DECREASE':'INCREASE',reason:translations[key]}),action,key+' legacy compatibility');
}
assert.equal(resolve({operation:'INCREASE',reason:'社群口令福利'}).label,'兑换口令');
for(const record of [{operation:'DECREASE',reasonKey:'FLP_REASON_CHECKIN_REWARD'},
 {operation:'INCREASE',reasonKey:'unrecognized',reason:'每日签到奖励'},
 {operation:'INCREASE',reason:'constructor'}, {operation:'INCREASE',reason:'__proto__'},
 {operation:'INCREASE',reason:'后台调整'},{}])assert.equal(resolve(record).label,'了解规则');
const calls=[];global.getApp=()=>({globalData:{}});global.wx={navigateTo:o=>{calls.push(o.url);o.complete?.()},showToast:()=>{}};
actions.navigateFlpRewardAction({operation:'INCREASE',reason:'每日签到奖励'});
assert.equal(calls[0],'/pages/profile/checkin/index');
const moduleTest={exports:{}};let pending;const app={globalData:{}};let failed=false;
vm.runInNewContext(fs.readFileSync(mini+'utils/flp-reward-actions.js','utf8'),{module:moduleTest,getApp:()=>app,wx:{navigateTo:o=>{pending=o},showToast:()=>{failed=true}}});
moduleTest.exports.navigateFlpRewardAction({operation:'INCREASE',reasonKey:'FLP_REASON_PIN_REVIEW_APPROVED_A'});
assert.equal(app.globalData.targetMarkersCenterTab,'MY_MARKERS');pending.fail();assert.equal(app.globalData.targetMarkersCenterTab,undefined);assert(failed);
console.log('PASS all backend reason keys, legacy text, registered routes and navigation failure cleanup');

const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const {chromium}=require('playwright');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/';
const runtime=fs.readFileSync(assets+'runtime.js','utf8');
const sampleKeys=['FLP_REASON_CHECKIN_REWARD','社群口令福利','FLP_REASON_FRIEND_REGISTER_REWARD','FLP_REASON_PIN_REVIEW_APPROVED_A',
 'FLP_REASON_MAKEUP_CHECKIN_REWARD','FLP_REASON_LOTTERY_REWARD','FLP_REASON_PLANET_BROADCAST_LIKE_OVER_10_REWARD',
 'FLP_REASON_PLANET_BROADCAST_COMMENT_LIKE_REWARD','FLP_REASON_OFFICIAL_ACCOUNT_MATERIAL_PUBLISH_REWARD','manual'];
const samples=sampleKeys.map((key,i)=>({id:i+1,operation:'INCREASE',reasonKey:key,reason:translations[key]||({'社群口令福利':'社群口令福利',manual:'后台奖励调整'})[key]||'贴图素材发布奖励',
 createdAt:'2026-10-11T14:43:46',username:i===2?'这是一个较长的测试用户名称':'测试飞友',featureCode:'ABC123',memberActive:i%2===0,avatarUrl:'/assets/pilot-avatar-male.png',amount:.1}));
const setup=`(()=>{const old=AndroidMini.call;AndroidMini.call=(id,method,payload)=>{
 const args=JSON.parse(payload);
 if(method==='request'&&args.url.includes('/api/flp/pool/logs')){setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data:{content:${JSON.stringify(samples)},totalPages:1}}}),0);return;}
 return old(id,method,payload);
};})();`;
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 fs.mkdirSync('artifacts/flp-reward-actions',{recursive:true});
 for(const width of [320,393,1024]){
  const page=await browser.newPage({viewport:{width,height:1000},bypassCSP:true});page.setDefaultTimeout(10000);
  await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+runtime}));
  await fixture(page,'pages/profile/flp/global/index');
  await page.locator('.global-flp-action').first().waitFor();
  assert.equal(await page.locator('.global-flp-action').count(),samples.length);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
   overlaps:[...document.querySelectorAll('.global-flp-detail')].some(el=>{
    const reason=el.querySelector('.global-flp-reason').getBoundingClientRect(),link=el.querySelector('.global-flp-action').getBoundingClientRect();
    return reason.right>link.left+1||link.right>innerWidth||link.width<35;
   }),vip:getComputedStyle(document.querySelector('.global-flp-avatar.is-member')).borderTopWidth}));
  assert.equal(layout.overflow,false);assert.equal(layout.overlaps,false);assert.equal(layout.vip,'2px');
  if(width===393)await page.screenshot({path:'artifacts/flp-reward-actions/android-393.png'});
  if(width===393)for(let i=0;i<samples.length;i++){
   await page.locator('.global-flp-action').nth(i).click();
   const target=resolve(samples[i]).url.slice(1);
   await page.waitForFunction(target=>miniDebug.active.route===target,target);
   if(target==='pages/markers/index')assert.equal(await page.evaluate(()=>miniDebug.active.data.activeCenterTab),'MY_MARKERS');
   await page.evaluate(()=>wx.navigateBack({delta:1}));
   await page.waitForFunction(()=>miniDebug.active.route==='pages/profile/flp/global/index');
   await page.locator('.global-flp-action').first().waitFor();
  }
  console.log('PASS Android rendered '+width+'px: layout, VIP ring'+(width===393?', all 10 action destinations and return navigation':''));
  await page.close();
 }
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}});
