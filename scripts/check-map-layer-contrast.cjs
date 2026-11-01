const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5194';
const OUT=path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/map-layer-contrast');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  let skin='lime-night';const results=[];
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','layer-contrast-fixture'));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(BASE).origin)return r.abort();if(!u.pathname.startsWith('/api/'))return r.continue();let data={content:[],records:[],items:[],rows:[],list:[],config:{},total:0,totalElements:0};if(u.pathname==='/api/auth/appearance')data={skin};if(u.pathname==='/api/auth/profile')data={username:'图层检查'};return r.fulfill({json:{success:true,data}});});
  for(skin of ['lime-night','ocean-blue','twilight-purple','sand-gold','ink-white']) {
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(BASE+'/admin/');
      await page.waitForFunction(id=>document.documentElement.dataset.adminSkin===id,skin);
      await page.locator('.floating-btn--layer').click();
      const labels=page.locator('.layer-card__label');await labels.first().waitFor();
      assert.equal(await labels.count(),2);
      const drawer=page.locator('.ant-drawer-content:visible').filter({has:page.locator('.layer-maptypes')});
      for(const state of ['initial','selected','hover','focus']) {
        for(const card of await page.locator('.layer-card').all()) {
          if(state==='selected')await card.click();
          if(state==='hover')await card.hover();
          if(state==='focus')await card.focus();
          const label=card.locator('.layer-card__label');
          const color=await label.evaluate(e=>getComputedStyle(e).color);
          assert.equal(color,'rgb(255, 255, 255)');
          // Treat the thumbnail as pure white: the darkest label foreground must still be readable.
          const ratio=await label.evaluate(e=>{
            const rgba=getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number),a=rgba[3]??1;
            const rgb=rgba.slice(0,3).map(n=>(n*a+255*(1-a))/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
            return 1.05/(rgb.reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0)+.05);
          });
          assert.ok(ratio>=4.5,`${skin}: ${state} contrast ${ratio}`);
        }
      }
      for(const pill of await page.locator('.layer-pill').all()) {
        for(let i=0;i<2;i++) {
          await pill.click();
          const color=await pill.evaluate(e=>getComputedStyle(e).color);
          assert.notEqual(color,'rgb(0, 0, 0)');assert.notEqual(color,'rgb(17, 17, 17)');
        }
      }
      await page.locator('.layer-card').first().click();
      await page.mouse.move(0,0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await drawer.screenshot({path:path.join(OUT,`${skin}-${width}.png`)});
      results.push({skin,width,states:4,labels:'white',thumbnailContrast:'pass',elementButtons:'pass'});
    }
  }
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({checks:results.length,passed:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

