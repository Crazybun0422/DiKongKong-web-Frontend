const apiRows=require('./fixtures/apiAccessServices.cjs');
const {chromium} = require('playwright');
const fs=require('fs'),path=require('path');
const BASE=process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5193';
const OUT=path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/admin-appearance');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try {
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
let skin='lime-night';
await page.addInitScript(()=>localStorage.setItem('dikongkong_token','contrast-fixture'));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(BASE).origin)return r.abort();if(!u.pathname.startsWith('/api/'))return r.continue();let data={content:[],items:[],records:[],rows:[],list:[],config:{},total:0,totalElements:0};if(u.pathname==='/api/admin/api-access-services')data={content:apiRows,page:0,size:20,totalElements:apiRows.length};if(u.pathname==='/api/auth/appearance')data={skin};if(u.pathname==='/api/auth/profile')data={username:'contrast-fixture'};if(u.pathname.includes('discovery-promotions'))data=[];return r.fulfill({json:{success:true,data}});});
const findings=[];
async function audit(label){await page.waitForTimeout(130);const issues=await page.evaluate(()=>{
const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
const blend=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((n,i)=>n*alpha+b[i]*(1-alpha));};
const lum=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const background=e=>{if(!e)return [255,255,255];return blend(rgb(getComputedStyle(e).backgroundColor),background(e.parentElement));};
return [...document.querySelectorAll('.admin-content *, .ant-modal-content *, .ant-drawer-body *')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('[disabled],.ant-btn-disabled,.ant-select-disabled,.ant-tabs-tab-disabled,.skin-preview,.map-canvas')).flatMap(e=>{const s=getComputedStyle(e);if(s.visibility!=='visible'||Number(s.opacity)<1)return [];const b=background(e),f=blend(rgb(s.color),b),l1=lum(f),l2=lum(b),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);return ratio>=(large?3:4.5)?[]:[{text:e.textContent.trim().slice(0,65),class:e.className,tag:e.tagName,color:s.color,bg:b.map(Math.round),ratio:Number(ratio.toFixed(2))}];});});if(issues.length)findings.push({skin,label,issues});}
for(skin of ['lime-night','ocean-blue','twilight-purple','sand-gold','ink-white']){
for(const route of ['','users','online-users','groups','subscription-push','flp-pool','discovery-promotions','api-access','drone-leaderboard','planet-market','flight-meetups','settings']){await page.goto(BASE+'/admin/'+route);await page.locator('.admin-content').waitFor();await audit(route||'home');if(route===''){await page.locator('.floating-btn--layer').click();await page.locator('.layer-card__label').first().waitFor();await audit('home/layer-drawer');await page.locator('.ant-drawer-close:visible').click();}}
{
const tabs=await page.locator('.settings-card > .ant-card-body > .ant-tabs > .ant-tabs-nav .ant-tabs-tab-btn').evaluateAll(es=>es.map(e=>e.id));
for(const id of tabs){await page.locator(`[id="${id}"]`).evaluate(e=>e.click());await audit(id);
const nested=await page.locator('.settings-card > .ant-card-body > .ant-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active .ant-tabs-nav .ant-tabs-tab-btn').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.id));
for(const sub of nested){await page.locator(`[id="${sub}"]`).evaluate(e=>e.click());await audit(id+'/'+sub);}
}
}}
fs.writeFileSync(path.join(OUT,'contrast-audit.json'),JSON.stringify(findings,null,2));console.log(JSON.stringify(findings));if(findings.length)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

