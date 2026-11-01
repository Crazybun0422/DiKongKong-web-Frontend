import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const server=await preview({preview:{host:'127.0.0.1',port:17821,strictPort:true}});
const browser=await chromium.launch({headless:true});
const pack='artifacts/aircraft-thumbnails-20261018.zip';
const manifest=JSON.parse(fs.readFileSync('artifacts/aircraft-thumbnails-20261018/manifest.json','utf8'));
const catalog={version:manifest.version,aircraft:manifest.aircraft.map(row=>({name:row.name,slug:row.slug,thumbnail1024:'/api/files/download/1024-'+row.slug+'.png',thumbnail128:'/api/files/download/128-'+row.slug+'.png'}))};
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:950}});let uploads=0, originalRequests=0;
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture-admin'));
  await page.route('https://**',route=>route.abort());
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url());let data={};
   if(url.pathname.startsWith('/api/files/download/')) {
    if(url.pathname.includes('/1024-'))originalRequests++;
    const name=url.pathname.split('/').pop(),size=name.startsWith('1024-')?'1024':'128',slug=name.slice(size.length+1);
    return route.fulfill({contentType:'image/png',body:fs.readFileSync('artifacts/aircraft-thumbnails-20261018/'+size+'/'+slug)});
   }
   if(['/api/config/aircraft-thumbnails','/api/config/aircraft-thumbnails/admin'].includes(url.pathname)) {
    if(request.method()==='POST') {
     assert.equal(request.headers().authorization,'Bearer fixture-admin');
     assert.match(request.headers()['content-type'],/^multipart\/form-data; boundary=/);
     assert.match(request.postDataBuffer().toString('latin1'),/filename="aircraft-thumbnails-20261018.zip"/);uploads++;
    }
    data=uploads?catalog:{version:'',aircraft:[]};
   }
   return route.fulfill({json:{success:true,data}});
  });
  await page.goto('http://127.0.0.1:17821/admin/settings',{waitUntil:'networkidle'});
  await page.getByRole('tab',{name:'系统设置',exact:true}).click();
  await page.getByRole('tab',{name:'机型缩略图',exact:true}).evaluate(el=>el.click());
  await page.locator('.aircraft-thumbnails input[type=file]').setInputFiles(pack);
  assert.equal(await page.locator('.aircraft-thumbnails input[type=file]').evaluate(el=>el.files[0].size),fs.statSync(pack).size);
  await page.getByRole('button',{name:'上传缩略图压缩包',exact:true}).click();
  await page.getByText('当前版本：20261018 · 78 个机型',{exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.aircraft-thumbnails img')].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(uploads,1);
  assert.equal(originalRequests,0,'admin table must not download 1024 previews');
  assert.equal(await page.locator('.aircraft-thumbnails a[href*="/1024-"]').count(),12);
  assert(await page.locator('.aircraft-thumbnails img').evaluateAll(images=>images.every(image=>image.naturalWidth===128)));
  const originalLink=await page.locator('.aircraft-thumbnails a[href*="/1024-"]').first().getAttribute('href');
  await page.evaluate(async href=>{const response=await fetch(href);if(!response.ok)throw Error('Original link broken');},originalLink);
  assert.equal(originalRequests,1,'original is fetched only on demand');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  fs.mkdirSync('build/checks',{recursive:true});await page.screenshot({path:'build/checks/aircraft-thumbnails-admin-'+width+'.png',fullPage:true});
  console.log('PASS admin '+width+': ZIP upload, catalog refreshed, image previews decoded');await page.close();
 }
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
