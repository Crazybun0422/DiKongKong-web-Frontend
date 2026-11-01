const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const {chromium}=require('playwright');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/';
const runtime=fs.readFileSync(assets+'runtime.js','utf8');
const setup=`(()=>{window.marketClosedFixture=true;const old=AndroidMini.call;AndroidMini.call=(id,method,payload)=>{
 const args=JSON.parse(payload);let data;
 if(method!=='request')return old(id,method,payload);
 if(args.url.endsWith('/api/market/config'))data={closed:marketClosedFixture};
 else if(args.url.endsWith('/api/market/latest'))data={closed:marketClosedFixture,version:marketClosedFixture?0:10};
 else if(args.url.includes('/api/market/categories'))data=[];
 else if(args.url.includes('/api/market/products?'))data={content:[],last:true};
 else if(args.url.includes('/api/market/products/'))data={id:1,title:'测试商品',imageUrl:'item.png',imageUrls:['item.png'],originalPrice:10,maxFlp:2,cashPrice:8,stock:10,variants:[]};
 else return old(id,method,payload);
 setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data}}),0);
 };})();`;
async function checkMiniWatcher(){
 const source=fs.readFileSync('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/utils/market-settings.js','utf8');
 let reply,calls=0;const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:()=>({resolveApiBase:()=> 'https://test.invalid'}),Map,wx:{request:o=>{calls++;reply=o.success}},setInterval:()=>1,clearInterval:()=>{}});
 const page=()=>({data:{marketClosed:true},setData(v){Object.assign(this.data,v)}});
 const a=page(),b=page();const x=module.exports.sync(a),y=module.exports.sync(b);assert.equal(calls,1);
 module.exports.stop(a);reply({statusCode:200,data:{success:true,data:{closed:false}}});await Promise.all([x,y]);
 assert.equal(a.data.marketClosed,true);assert.equal(b.data.marketClosed,false);
 const z=module.exports.sync(b);reply({statusCode:200,data:{success:true,data:{closed:true}}});await z;assert.equal(b.data.marketClosed,true);
 console.log('PASS mini config deduplication, close refresh and late-response guard');
}
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 await checkMiniWatcher();browser=await chromium.launch({headless:true});
 for(const route of ['pages/discover/index','pages/profile/flp/index','packages/market/index/index','packages/market/detail/index']){
  const page=await browser.newPage({viewport:{width:393,height:852},bypassCSP:true});page.setDefaultTimeout(8000);
  await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+runtime}));await fixture(page,route);
  await page.evaluate(()=>miniDebug.require('utils/market-settings.js').sync(miniDebug.active));
  assert.equal(await page.evaluate(()=>miniDebug.active.data.marketClosed),true);
  if(route.includes('/discover/'))assert.equal(await page.locator('[data-action="market"]').count(),0);
  if(route.includes('/flp/'))assert.equal(await page.evaluate(()=>miniDebug.active.data.rights.some(r=>r.id==='market')),false);
  await page.evaluate(async()=>{marketClosedFixture=false;await miniDebug.require('utils/market-settings.js').sync(miniDebug.active)});
  assert.equal(await page.evaluate(()=>miniDebug.active.data.marketClosed),false);
  if(route.includes('/discover/'))await page.locator('[data-action="market"]').waitFor();
  if(route.includes('/flp/'))assert.equal(await page.evaluate(()=>miniDebug.active.data.rights.some(r=>r.id==='market')),true);
  await page.evaluate(async()=>{marketClosedFixture=true;await miniDebug.require('utils/market-settings.js').sync(miniDebug.active)});
  if(route.includes('/market/')){await page.getByText('星球有市暂未开放',{exact:true}).waitFor();}
  assert.equal(await page.evaluate(()=>miniDebug.active.data.marketClosed),true);
  console.log('PASS Android rendered closed/open/closed: '+route);await page.close();
 }
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}});
