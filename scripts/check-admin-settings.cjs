const BASE_URL = process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5186';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const out=path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/admin-responsive');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('dikongkong_token','isolated-layout-fixture'));
 const product={id:1,revision:1,title:'飞行便携收纳包',brand:'星球好物',category:'飞行配件',imageUrl:'/fixture-product.png',originalPrice:10,maxFlp:2,costPrice:7,supplier:'测试供应商',stock:20,published:true,presale:true};let saves=0;
 await context.route('**/*',r=>{
  const u=new URL(r.request().url()),p=u.pathname;
  if(u.origin!==new URL(BASE_URL).origin)return r.abort();
  if(!p.startsWith('/api/'))return r.continue();
  let data={content:[],records:[],items:[],rows:[],list:[],totalElements:0,total:0,page:1,size:20,config:{},releases:[]};
  if(p.includes('/auth/profile'))data={username:'星球管理员',email:'admin@example.com'};
  if(p.includes('/market/admin/products')){if(r.request().method()!=='GET'){saves++;Object.assign(product,r.request().postDataJSON());data=product;}else data={content:[product],totalElements:1};}
  if(p.includes('/market/admin/orders'))data={content:[{id:'order1',title:product.title,recipient:'测试飞友',phone:'13800138000',address:'测试地址',cash:8,flp:2,cost:7,supplier:product.supplier,status:'PAID',quantity:1}],totalElements:1};
  return r.fulfill({json:{success:true,code:200,data}});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto(BASE_URL + '/admin/planet-market');
 await page.getByRole('button',{name:'编辑',exact:true}).click();
 await page.getByPlaceholder('如：星球好物').fill('星球甄选');
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,'admin-mobile-product-edit.png'),fullPage:true});
 await page.getByRole('button',{name:/^保\s*存$/}).click();
 await page.waitForFunction(()=>!document.querySelector('.ant-modal-wrap')||getComputedStyle(document.querySelector('.ant-modal-wrap')).display==='none');
 assert.equal(saves,1);assert.equal(product.brand,'星球甄选');
 await page.getByRole('tab',{name:'订单 / 发货 / 结算'}).click();
 await page.getByRole('button',{name:'录入发货'}).click();
 await page.locator('.ant-modal-content:visible').waitFor();
 await page.waitForTimeout(200);
 await page.screenshot({path:path.join(out,'admin-mobile-shipping.png'),fullPage:true});
 await page.locator('.ant-modal-content:visible').getByRole('button',{name:/取\s*消/}).click();
 await page.getByRole('button',{name:'账户菜单'}).click();
 await page.getByRole('menuitem').first().click();
 await page.waitForTimeout(350);
 await page.screenshot({path:path.join(out,'admin-mobile-profile.png'),fullPage:true});
 await page.goto(BASE_URL + '/admin/settings');
 await page.locator('.settings-wrapper').waitFor();
 const tabs=page.locator('.settings-card > .ant-card-body > .ant-tabs > .ant-tabs-nav .ant-tabs-tab-btn');
 const topIds=await tabs.evaluateAll(es=>es.map(e=>e.id));
 const results=[];
 async function measure(label){await page.waitForTimeout(100);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);const offenders = overflow>1 ? await page.evaluate(()=>[...document.querySelectorAll(".ant-tabs-tabpane-active *")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&!e.closest(".ant-table, .ant-tabs-nav");}).slice(0,18).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))) : []; results.push({label,overflow,offenders});}
 for(const width of [390,320,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const id of topIds){
   await page.locator(`[id="${id}"]`).evaluate(e=>e.click());
   await measure(width+':'+id);
   const nested=await page.locator('.settings-card > .ant-card-body > .ant-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active .ant-tabs-nav .ant-tabs-tab-btn').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.id));
   for(const sub of nested){await page.locator(`[id="${sub}"]`).evaluate(e=>e.click());await measure(width+':'+id+'/'+sub);}
  }
 }
 fs.writeFileSync(path.join(out,'details-results.json'),JSON.stringify({saves,results,errors},null,2));
 if(results.some(r=>r.overflow>1)||errors.length)process.exitCode=1;
 console.log(JSON.stringify({saves,checks:results.length,issues:results.filter(r=>r.overflow>1),errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});



