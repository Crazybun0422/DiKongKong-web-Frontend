const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5195';
const OUT=path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/api-row-contrast');fs.mkdirSync(OUT,{recursive:true});
const rows=require('./fixtures/apiAccessServices.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try {
  const page=await browser.newPage({viewport:{width:2048,height:1000},reducedMotion:'reduce'});
  let skin='lime-night';const results=[];
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','api-row-fixture'));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(BASE).origin)return r.abort();if(!u.pathname.startsWith('/api/'))return r.continue();let data={content:[],records:[],items:[],total:0,totalElements:0};if(u.pathname==='/api/auth/appearance')data={skin};if(u.pathname==='/api/auth/profile')data={username:'对比度检查'};if(u.pathname==='/api/admin/api-access-services')data={content:rows,page:0,size:20,totalElements:rows.length};return r.fulfill({json:{success:true,data}});});
  for(skin of ['lime-night','ocean-blue','twilight-purple','sand-gold','ink-white']) {
    for(const width of [2048,390]) {
      await page.setViewportSize({width,height:1000});await page.goto(BASE+'/admin/api-access');
      await page.waitForFunction(id=>document.documentElement.dataset.adminSkin===id,skin);
      await page.locator('tr[data-row-key="expired-30"]').waitFor();
      await page.waitForFunction(()=>!document.querySelector('.ant-spin-spinning'));
      for(const state of ['normal','hover']) {
        if(state==='normal')await page.mouse.move(0,0);
        else await page.locator('tr[data-row-key="expired-30"] > td').first().hover();
        const result=await page.locator('.api-access-table').evaluate((table,state)=>{
          const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
          const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
          const bg=e=>e?blend(rgb(getComputedStyle(e).backgroundColor),bg(e.parentElement)):[255,255,255];
          const lum=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
          const issues=[];let min=100;
          for(const e of table.querySelectorAll('tbody td, tbody td *')) {
            if(!e.getClientRects().length||![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
            const s=getComputedStyle(e),b=bg(e),f=blend(rgb(s.color),b),a=lum(f),c=lum(b),ratio=(Math.max(a,c)+.05)/(Math.min(a,c)+.05);min=Math.min(min,ratio);
            if(ratio<4.5)issues.push({text:e.textContent.trim(),color:s.color,bg:b,ratio});
          }
          const backgrounds=[...table.querySelectorAll('.api-row-expired > td')].map(e=>getComputedStyle(e).backgroundColor);
          return {state,min,issues,backgrounds};
        },state);
        assert.deepEqual(result.issues,[]);
        assert.ok(result.backgrounds.every(bg=>['rgb(53, 34, 34)','rgb(67, 41, 41)'].includes(bg)));
        results.push({skin,width,...result});
      }
      await page.locator('.api-access-table').screenshot({path:path.join(OUT,`${skin}-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(width===2048){await page.locator('tr[data-row-key="expired-30"]').getByRole('button',{name:'编辑'}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByPlaceholder('请输入公司名称').inputValue(),rows[0].companyName);}
    }
  }
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({checks:results.length,minContrast:Math.min(...results.map(r=>r.min)),passed:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
