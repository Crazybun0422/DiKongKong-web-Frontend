/* Isolated admin API fixtures; no production writes. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture'));
  const promotion={id:'partner',placement:'PARTNER_BUTTON',title:'低空研究猿',imageFileName:'partner.png',targetType:'CHANNELS',channelsFinderUserName:'sphW8PwCfzcysHB',channelsFeedId:null,miniProgramAppId:null,miniProgramOriginalId:null,miniProgramPath:null,miniProgramEnvVersion:null,articleUrl:null,customerServiceUrl:null,sortOrder:1,enabled:true,startsAt:null,endsAt:null};
  const product={id:7,revision:3,title:'SKYLANE 飞行帽',imageUrl:'hat.png',originalPrice:29,maxFlp:20,costPrice:5,supplier:'测试商家',stock:5,published:true,pinned:false};
  let saves=[],pins=[],fail=false;
  await page.route('**/api/**',r=>{if(r.request().resourceType()==='script')return r.fulfill({contentType:'text/javascript',body:''});const p=new URL(r.request().url()).pathname,method=r.request().method();let data={};
   if(p.includes('/admin/discovery-promotions')){
    if(method==='PUT'){const body=r.request().postDataJSON();saves.push(body);if(fail)return r.fulfill({status:400,json:{success:false,message:{zh:'测试：展示名称不可重复'}}});Object.assign(promotion,body);data=promotion;}else data=[promotion];
   }else if(p.endsWith('/market/admin/products/7/pin')){const body=r.request().postDataJSON();pins.push(body);Object.assign(product,body,{revision:product.revision+1});data=product;}
   else if(p.endsWith('/market/admin/products'))data={content:[product],totalElements:1};
   else if(p.endsWith('/market/admin/config'))data={closed:false};
   r.fulfill({json:{success:true,data}});
  });
  await page.goto('http://127.0.0.1:5191/admin/discovery-promotions');
  await page.getByRole('tab',{name:'生态伙伴按钮'}).click();await page.getByRole('button',{name:/编\s*辑/,exact:true}).click();
  await page.getByRole('button',{name:/保\s*存/,exact:true}).click();
  await page.getByText('配置已保存',{exact:true}).waitFor();assert.equal(saves.length,1);assert.equal(saves[0].channelsFinderUserName,promotion.channelsFinderUserName);assert.equal(saves[0].channelsFeedId,'');assert.equal(saves[0].miniProgramAppId,'');
  fail=true;await page.getByRole('button',{name:/编\s*辑/,exact:true}).click();await page.getByRole('button',{name:/保\s*存/,exact:true}).click();await page.getByText('测试：展示名称不可重复',{exact:true}).waitFor();assert.equal(saves.length,2);
  fs.mkdirSync('artifacts/market-fixes',{recursive:true});await page.screenshot({path:'artifacts/market-fixes/promotion-save-feedback.png'});
  await page.goto('http://127.0.0.1:5191/admin/planet-market');await page.getByRole('button',{name:/置\s*顶/,exact:true}).click();await page.getByRole('button',{name:'取消置顶',exact:true}).waitFor();
  assert.deepEqual(pins[0],{pinned:true,revision:3});await page.screenshot({path:'artifacts/market-fixes/admin-product-pinned.png'});
  await page.getByRole('button',{name:'取消置顶',exact:true}).click();await page.getByRole('button',{name:/置\s*顶/,exact:true}).waitFor();assert.deepEqual(pins[1],{pinned:false,revision:4});assert.deepEqual(errors,[]);
  console.log('PASS unchanged nullable promotion save, concrete server error, product pin/unpin and revision');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
