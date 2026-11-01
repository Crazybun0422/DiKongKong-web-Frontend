const BASE_URL = process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5186';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const out = path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/admin-responsive'); fs.mkdirSync(out,{recursive:true});
const routes = ['','airspace','users','online-users','groups','subscription-push','flp-pool','discovery-promotions','api-access','drone-leaderboard','planet-market','flight-meetups','settings'];
(async()=>{
 const browser = await chromium.launch({headless:true});
 const results=[];
 try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*', r => {
   const url = new URL(r.request().url());
   if(url.origin!==new URL(BASE_URL).origin) return r.abort();
   if(url.pathname.startsWith('/api/')) {
    let data={content:[],records:[],items:[],totalElements:0,total:0,page:1,size:20,season:'2026-10',config:{},rows:[],list:[]};
    if(url.pathname.includes('/auth/profile')) data={username:'星球管理员',avatarUrl:''};
    if(url.pathname.includes('discovery-promotions')) data=[];
    return r.fulfill({json:{success:true,code:200,data}});
   }
   return r.continue();
  });
  const page=await context.newPage();
  let errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390,320,768]) {
   await page.setViewportSize({width,height:900});
   await page.goto(BASE_URL + '/admin/login');
   await page.locator('.auth-entry').waitFor();
   await page.screenshot({path:path.join(out,`admin-login-${width}.png`),fullPage:true});
   results.push({width,route:'login',...(await measure(page)),errors});errors=[];
  }
  await page.evaluate(()=>localStorage.setItem('dikongkong_token','isolated-layout-fixture'));
  for(const width of [1440,390,320,768]) {
   await page.setViewportSize({width,height:900});
   for(const route of routes) {
    await page.goto(`${BASE_URL}/admin/${route}`);
    await page.locator('.admin-content > :last-child').waitFor();
    await page.waitForTimeout(220);
    if(route==='') {
      const removed=await page.getByRole('button',{name:/锚点绘制|清除锚点|保存瓦片图|连续保存/}).count();
      if(removed)throw Error('Removed map export controls are still visible');
    }
    if(route==='subscription-push') {
      const ghost=page.getByRole('button',{name:'更新落地页 >'});
      const checkGhost=async()=>{const color=await ghost.evaluate(e=>getComputedStyle(e).color);if(color!=='rgb(255, 255, 255)')throw Error('Ghost button must use white text: '+color);};
      await checkGhost();await ghost.hover();await checkGhost();
      await ghost.focus();await checkGhost();
    }
    const measurement=await measure(page);
    results.push({width,route:route||'home',...measurement,errors});errors=[];
    if(width===390||width===1440) await page.screenshot({path:path.join(out,`admin-${route||'home'}-${width}.png`),fullPage:true});
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'打开管理菜单'}).click();
  await page.locator('.admin-mobile-drawer .admin-navigation').waitFor();
  await page.screenshot({path:path.join(out,'admin-mobile-menu.png')});
  await page.getByRole('textbox',{name:'搜索管理菜单'}).last().fill('星球有市');
  await page.locator('.admin-mobile-drawer').getByRole('link',{name:'星球有市'}).click();
  await page.waitForURL('**/admin/planet-market');
  await page.waitForTimeout(350);
  const drawerClosed=await page.locator('.admin-mobile-drawer').isVisible()===false;
  await page.getByRole('button',{name:'账户菜单'}).click();
  await page.getByRole('menuitem').first().click();
  await page.locator('.ant-modal-content:visible').waitFor(); await page.waitForTimeout(200);
  await page.screenshot({path:path.join(out,'admin-mobile-profile.png')});
  results.push({interaction:'mobile navigation/search/profile',drawerClosed,...await measure(page)});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  if(results.some(r=>r.overflow>1||r.errors?.length||r.drawerClosed===false))process.exitCode=1;
  console.log(JSON.stringify({checks:results.length,issues:results.filter(r=>r.overflow>1||r.errors?.length||r.drawerClosed===false)},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
async function measure(page) {return page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,offenders:[...document.querySelectorAll('main *, .ant-modal-content *')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.right>innerWidth+2&&s.position!=='fixed'&&!e.closest('.ant-table,.table-scroll,.ant-tabs-nav,.ant-select-dropdown');}).slice(0,8).map(e=>e.className)}));}
